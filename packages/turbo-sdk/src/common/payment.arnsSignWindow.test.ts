/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { ArweaveSigner } from '@dha-team/arbundles';
import { Keypair } from '@solana/web3.js';
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { testJwk } from '../../tests/helpers.js';
import { TurboNodeSigner } from '../node/signer.js';
import {
  ArNSActionResult,
  ArNSOwnerSigner,
  TurboSignedRequestHeaders,
} from '../types.js';
import {
  ArNSActionExpiredError,
  FailedRequestError,
  InsufficientCreditsError,
} from '../utils/errors.js';
import { TurboAuthenticatedPaymentService } from './payment.js';

/*
  The blockhash window. Creating an action starts a ~60-90 s clock on the
  transaction Turbo returns. For a browser payer every payer signature is a
  wallet prompt, so the `/sign` headers must be signed BEFORE the action is
  created — leaving the owner's transaction signature as the only prompt
  inside the window.
*/

/** One ordered log across payer signer, HTTP and owner, so order is testable. */
type Event =
  | { kind: 'payer-sign'; nonce: string }
  | { kind: 'post'; endpoint: string; headerNonce?: string }
  | { kind: 'owner-sign-tx' }
  | { kind: 'on-nonce' };

// A real base58 key: the owner proof decodes it.
const ownerAddress = Keypair.generate().publicKey.toBase58();

function harness(responses: unknown[], error?: unknown) {
  const events: Event[] = [];
  const queue = [...responses];
  const http = {
    async post(args: { endpoint: string; headers?: Record<string, string> }) {
      events.push({
        kind: 'post',
        endpoint: args.endpoint,
        headerNonce: args.headers?.['x-nonce'],
      });
      if (args.endpoint.endsWith('/sign') && error !== undefined) throw error;
      return queue.shift();
    },
    async get() {
      return queue.shift();
    },
  };
  const signer = new TurboNodeSigner({
    signer: new ArweaveSigner(testJwk),
    token: 'arweave',
  });
  const original = signer.generateSignedRequestHeaders.bind(signer);
  signer.generateSignedRequestHeaders = async (
    nonce?: string,
    additionalData?: string,
  ) => {
    const headers = await original(nonce, additionalData);
    events.push({ kind: 'payer-sign', nonce: headers['x-nonce'] });
    return headers;
  };
  const service = new TurboAuthenticatedPaymentService({ signer });
  (service as unknown as { httpService: unknown }).httpService = http;

  const owner: ArNSOwnerSigner = {
    getAddress: () => ownerAddress,
    async signTransaction(tx: string) {
      events.push({ kind: 'owner-sign-tx' });
      return `signed:${tx}`;
    },
    async signMessage() {
      return new Uint8Array(64);
    },
  };
  return { service, events, owner };
}

const awaiting = (nonce: string, action = 'buy-name') => ({
  nonce,
  action,
  status: 'awaiting-signature',
  transaction: 'TX',
  lastValidBlockHeight: '123',
  expiresAt: '2026-01-01T00:15:00Z',
});
const completed = (nonce: string, action = 'buy-name') => ({
  nonce,
  action,
  status: 'completed',
  messageId: 'm1',
});

const kinds = (events: Event[]) => events.map((e) => e.kind);

describe('ArNS /sign headers are signed before the blockhash window opens', () => {
  it('signs the /sign headers before the create POST, never after the owner signs', async () => {
    const { service, events, owner } = harness([
      awaiting('n1'),
      completed('n1'),
    ]);
    await service.buyArNSName({ name: 'x', owner, type: 'permabuy' });

    assert.deepEqual(kinds(events), [
      'payer-sign', // /sign headers, pre-signed
      'payer-sign', // create headers
      'post', // create — the window opens here
      'owner-sign-tx', // the ONLY prompt inside the window
      'post', // /sign
    ]);
    const presigned = events[0] as { nonce: string };
    const signPost = events[4] as { endpoint: string; headerNonce?: string };
    assert.equal(signPost.endpoint, '/arns/actions/n1/sign');
    assert.equal(
      signPost.headerNonce,
      presigned.nonce,
      '/sign carries the pre-signed headers',
    );
  });

  for (const [name, call] of [
    [
      'addArNSController',
      (s: TurboAuthenticatedPaymentService, owner: ArNSOwnerSigner) =>
        s.addArNSController({ antId: 'ant1', owner }),
    ],
    [
      'removeArNSController',
      (s: TurboAuthenticatedPaymentService, owner: ArNSOwnerSigner) =>
        s.removeArNSController({ antId: 'ant1', owner }),
    ],
    [
      'transferArNSAnt',
      (s: TurboAuthenticatedPaymentService, owner: ArNSOwnerSigner) =>
        s.transferArNSAnt({ antId: 'ant1', owner, target: 'T' }),
    ],
  ] as const) {
    it(`${name} pre-signs too (owner-only, always awaits a signature)`, async () => {
      const { service, events, owner } = harness([
        awaiting('n2', 'transfer'),
        completed('n2', 'transfer'),
      ]);
      await call(service, owner);
      assert.deepEqual(kinds(events), [
        'payer-sign',
        'payer-sign',
        'post',
        'owner-sign-tx',
        'post',
      ]);
    });
  }

  it('adds no payer prompt to an action that needs no owner', async () => {
    const { service, events } = harness([completed('n3', 'extend-lease')]);
    await service.extendArNSLease({ name: 'x', years: 1 });
    assert.deepEqual(kinds(events), ['payer-sign', 'post']);
  });

  it('adds no payer prompt to a record write that completes alone', async () => {
    // The record family carries an owner, but completes while Turbo is a
    // controller — pre-signing there would be a prompt for nothing.
    const { service, events, owner } = harness([completed('n4', 'set-record')]);
    await service.setArNSRecord({ antId: 'ant1', owner, transactionId: 'tx' });
    assert.deepEqual(kinds(events), ['payer-sign', 'post']);
  });

  it('a record write that DOES await a signature still completes (lazy /sign headers)', async () => {
    const { service, events, owner } = harness([
      awaiting('n5', 'set-record'),
      completed('n5', 'set-record'),
    ]);
    const result = await service.setArNSRecord({
      antId: 'ant1',
      owner,
      transactionId: 'tx',
    });
    assert.equal(result.status, 'completed');
    assert.deepEqual(kinds(events), [
      'payer-sign',
      'post',
      'owner-sign-tx',
      'payer-sign',
      'post',
    ]);
  });
});

describe('signArNSAction', () => {
  it('uses provided headers and does not sign again', async () => {
    const { service, events } = harness([completed('n6')]);
    const headers: TurboSignedRequestHeaders = {
      'x-public-key': 'pk',
      'x-nonce': 'presigned-nonce',
      'x-signature': 'sig',
      'x-signature-type': '1',
    };
    await service.signArNSAction('n6', 'SIGNED', headers);
    assert.deepEqual(kinds(events), ['post']);
    assert.equal(
      (events[0] as { headerNonce?: string }).headerNonce,
      'presigned-nonce',
    );
  });

  it('signs its own headers when none are given (unchanged behaviour)', async () => {
    const { service, events } = harness([completed('n7')]);
    await service.signArNSAction('n7', 'SIGNED');
    assert.deepEqual(kinds(events), ['payer-sign', 'post']);
  });
});

describe('/sign error mapping', () => {
  const cases: {
    label: string;
    error: FailedRequestError;
    check: (err: unknown) => void;
  }[] = [
    {
      label: '409 expired → ArNSActionExpiredError, credits released',
      error: new FailedRequestError(
        'signed transaction expired; credits released',
        409,
      ),
      check: (err) => {
        assert.ok(err instanceof ArNSActionExpiredError);
        assert.equal(err.nonce, 'n8');
        assert.equal(err.status, 409);
        assert.equal(err.creditsReleased, true);
      },
    },
    {
      label: '400 expired → ArNSActionExpiredError, credits held',
      error: new FailedRequestError('Action n8 expired', 400),
      check: (err) => {
        assert.ok(err instanceof ArNSActionExpiredError);
        assert.equal(err.status, 400);
        assert.equal(err.creditsReleased, false);
      },
    },
    {
      label: '503 blockhash → ArNSActionExpiredError, credits held',
      error: new FailedRequestError(
        'Transaction simulation failed: Blockhash not found',
        503,
      ),
      check: (err) => {
        assert.ok(err instanceof ArNSActionExpiredError);
        assert.equal(err.status, 503);
        assert.equal(err.creditsReleased, false);
        assert.equal(err.nonce, 'n8');
      },
    },
    {
      label: '503 other → FailedRequestError unchanged',
      error: new FailedRequestError('Internal Server Error: rpc down', 503),
      check: (err) => {
        assert.ok(!(err instanceof ArNSActionExpiredError));
        assert.ok(err instanceof FailedRequestError);
        assert.equal(err.status, 503);
      },
    },
    {
      label: '400 other → FailedRequestError unchanged',
      error: new FailedRequestError('invalid transaction encoding', 400),
      check: (err) => {
        assert.ok(!(err instanceof ArNSActionExpiredError));
        assert.ok(err instanceof FailedRequestError);
      },
    },
    {
      label: '402 → InsufficientCreditsError',
      error: new FailedRequestError('insufficient credits', 402),
      check: (err) => {
        assert.ok(err instanceof InsufficientCreditsError);
        assert.equal(err.status, 402);
      },
    },
  ];

  for (const { label, error, check } of cases) {
    it(label, async () => {
      const { service } = harness([], error);
      await assert.rejects(
        () => service.signArNSAction('n8', 'SIGNED'),
        (err) => {
          check(err);
          return true;
        },
      );
    });
  }

  it('maps errors on the completeArNSAction path too', async () => {
    const { service, owner } = harness(
      [awaiting('n9')],
      new FailedRequestError('Blockhash not found', 503),
    );
    await assert.rejects(
      () => service.buyArNSName({ name: 'x', owner, type: 'permabuy' }),
      (err) =>
        err instanceof ArNSActionExpiredError &&
        err.nonce === 'n9' &&
        !err.creditsReleased,
    );
  });

  it('is exported from the package entry point', async () => {
    const index = await import('./index.js');
    assert.equal(index.ArNSActionExpiredError, ArNSActionExpiredError);
  });
});

describe('onNonce', () => {
  it('receives the full create result as its second argument', async () => {
    const { service, events, owner } = harness([
      awaiting('n10'),
      completed('n10'),
    ]);
    const seen: { nonce: string; action?: ArNSActionResult }[] = [];
    await service.buyArNSName({
      name: 'x',
      owner,
      type: 'permabuy',
      onNonce: (nonce, action) => {
        events.push({ kind: 'on-nonce' });
        seen.push({ nonce, action });
      },
    });
    assert.equal(seen.length, 1);
    assert.equal(seen[0].nonce, 'n10');
    assert.equal(seen[0].action?.status, 'awaiting-signature');
    assert.equal(
      (seen[0].action as { lastValidBlockHeight?: string })
        .lastValidBlockHeight,
      '123',
    );
    // Still before the owner's prompt.
    assert.ok(
      kinds(events).indexOf('on-nonce') <
        kinds(events).indexOf('owner-sign-tx'),
    );
  });

  it('a one-argument callback is still accepted', async () => {
    const { service } = harness([completed('n11', 'extend-lease')]);
    const seen: string[] = [];
    await service.extendArNSLease({
      name: 'x',
      years: 1,
      onNonce: (nonce: string) => {
        seen.push(nonce);
      },
    });
    assert.deepEqual(seen, ['n11']);
  });
});
