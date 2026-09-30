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
  The signing window. Solana accepts the transaction Turbo builds for only
  about 30 seconds, so nothing but the owner's signature may sit between
  create and `/sign`. `/sign` is authorised by that signature alone, so the
  payer — a wallet prompt for a browser payer — signs once per action: the
  create request.
*/

/** One ordered log across payer signer, HTTP and owner, so order is testable. */
type Event =
  | { kind: 'payer-sign'; nonce: string }
  | {
      kind: 'post';
      endpoint: string;
      headerNonce?: string;
      signature?: string;
    }
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
        signature: args.headers?.['x-signature'],
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

const payerSigns = (events: Event[]) =>
  events.filter((e) => e.kind === 'payer-sign').length;
const signPost = (events: Event[]) =>
  events.find(
    (e) => e.kind === 'post' && e.endpoint.endsWith('/sign'),
  ) as Extract<Event, { kind: 'post' }>;

describe('ArNS /sign carries no payer signature', () => {
  it('buy-name: one payer prompt (create), only the owner inside the window', async () => {
    const { service, events, owner } = harness([
      awaiting('n1'),
      completed('n1'),
    ]);
    await service.buyArNSName({ name: 'x', owner, type: 'permabuy' });

    assert.deepEqual(kinds(events), [
      'payer-sign', // create headers
      'post', // create — the window opens here
      'owner-sign-tx', // the ONLY prompt inside the window
      'post', // /sign
    ]);
    const sign = signPost(events);
    assert.equal(sign.endpoint, '/arns/actions/n1/sign');
    assert.equal(sign.headerNonce, undefined, 'no x-nonce on /sign');
    assert.equal(sign.signature, undefined, 'no x-signature on /sign');
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
    [
      'setArNSRecord (after a revoke)',
      (s: TurboAuthenticatedPaymentService, owner: ArNSOwnerSigner) =>
        s.setArNSRecord({ antId: 'ant1', owner, transactionId: 'tx' }),
    ],
    [
      'setArNSRecordMetadata (after a revoke)',
      (s: TurboAuthenticatedPaymentService, owner: ArNSOwnerSigner) =>
        s.setArNSRecordMetadata({ antId: 'ant1', owner, displayName: 'd' }),
    ],
  ] as const) {
    it(`${name}: exactly one payer prompt when a signature is needed`, async () => {
      const { service, events, owner } = harness([
        awaiting('n2', 'transfer'),
        completed('n2', 'transfer'),
      ]);
      await call(service, owner);
      assert.equal(payerSigns(events), 1);
      assert.deepEqual(kinds(events), [
        'payer-sign',
        'post',
        'owner-sign-tx',
        'post',
      ]);
      assert.equal(signPost(events).signature, undefined);
    });
  }

  it('an action that completes alone is unchanged: one payer prompt, one POST', async () => {
    const { service, events, owner } = harness([completed('n4', 'set-record')]);
    await service.setArNSRecord({ antId: 'ant1', owner, transactionId: 'tx' });
    assert.deepEqual(kinds(events), ['payer-sign', 'post']);
  });

  it('an alreadyCompleted /sign replay is returned as-is', async () => {
    const replay = { ...completed('n5'), alreadyCompleted: true };
    const { service, owner } = harness([awaiting('n5'), replay]);
    const result = await service.buyArNSName({
      name: 'x',
      owner,
      type: 'permabuy',
    });
    assert.deepEqual(result, replay);
  });
});

describe('signArNSAction', () => {
  it('sends only content-type by default and signs nothing', async () => {
    const { service, events } = harness([completed('n6')]);
    await service.signArNSAction('n6', 'SIGNED');
    assert.deepEqual(kinds(events), ['post']);
    assert.equal(signPost(events).signature, undefined);
  });

  it('passes caller-supplied payer headers through unchanged', async () => {
    const { service, events } = harness([completed('n7')]);
    const headers: TurboSignedRequestHeaders = {
      'x-public-key': 'pk',
      'x-nonce': 'caller-nonce',
      'x-signature': 'sig',
      'x-signature-type': '1',
    };
    await service.signArNSAction('n7', 'SIGNED', headers);
    assert.deepEqual(kinds(events), ['post']);
    assert.equal(signPost(events).headerNonce, 'caller-nonce');
    assert.equal(signPost(events).signature, 'sig');
  });
});

// Bodies copied from the payment service (ar-io-bundler payment-service:
// SignedTransactionExpired, routes/arnsActions.ts, respondToArNSActionError).
const EXPIRED_409 = (refunded: boolean) =>
  'The signed transaction expired before it could be submitted: Solana ' +
  'only accepts a transaction for about 30 seconds after it is built. ' +
  (refunded
    ? 'Your credits have been returned. Start the action again and approve it promptly.'
    : 'Start the action again and approve it promptly.');

describe('/sign error mapping (real service bodies)', () => {
  const cases: {
    label: string;
    error: FailedRequestError;
    check: (err: unknown) => void;
  }[] = [
    {
      label: '409 refunded → ArNSActionExpiredError, credits released',
      error: new FailedRequestError(EXPIRED_409(true), 409),
      check: (err) => {
        assert.ok(err instanceof ArNSActionExpiredError);
        assert.ok(
          err instanceof FailedRequestError,
          'still a FailedRequestError',
        );
        assert.equal(err.nonce, 'n8');
        assert.equal(err.status, 409);
        assert.equal(err.creditsReleased, true);
        assert.match(err.message, /about 30 seconds/);
        assert.doesNotMatch(
          err.message,
          /Failed request.*Failed request/,
          'prefix not doubled',
        );
      },
    },
    {
      label: '409 not refunded → ArNSActionExpiredError, credits held',
      error: new FailedRequestError(EXPIRED_409(false), 409),
      check: (err) => {
        assert.ok(err instanceof ArNSActionExpiredError);
        assert.equal(err.creditsReleased, false);
      },
    },
    {
      label: '400 "expired and was refunded" → released',
      error: new FailedRequestError(
        'Action n8 expired and was refunded; create a new one.',
        400,
      ),
      check: (err) => {
        assert.ok(err instanceof ArNSActionExpiredError);
        assert.equal(err.status, 400);
        assert.equal(err.creditsReleased, true);
      },
    },
    {
      label: '400 "expired at …" → held until the automatic refund',
      error: new FailedRequestError(
        'Action n8 expired at 2026-01-01T00:15:00.000Z — its blockhash is no ' +
          'longer valid. Create a new action; the credits for this one are ' +
          'refunded automatically.',
        400,
      ),
      check: (err) => {
        assert.ok(err instanceof ArNSActionExpiredError);
        assert.equal(err.creditsReleased, false);
      },
    },
    {
      label: '400 for a DIFFERENT nonce is not mapped',
      error: new FailedRequestError(
        'Action other expired and was refunded; create a new one.',
        400,
      ),
      check: (err) => {
        assert.ok(!(err instanceof ArNSActionExpiredError));
      },
    },
    ...[
      'Lease has expired (LeaseExpired, 6012)',
      'Record is expired (RecordExpired, 6020)',
      'Reservation has expired (ReservationExpired, 6031)',
      'Name not expired (NameNotExpired, 6014)',
    ].map((body) => ({
      label: `400 Anchor "${body}" stays FailedRequestError`,
      error: new FailedRequestError(body, 400),
      check: (err: unknown) => {
        assert.ok(!(err instanceof ArNSActionExpiredError));
        assert.ok(err instanceof FailedRequestError);
        assert.equal(err.status, 400);
      },
    })),
    {
      label:
        '503 "Blockhash not found" stays FailedRequestError (retry the same bytes)',
      error: new FailedRequestError(
        'Transaction simulation failed: Blockhash not found',
        503,
      ),
      check: (err) => {
        assert.ok(!(err instanceof ArNSActionExpiredError));
        assert.ok(err instanceof FailedRequestError);
        assert.equal(err.status, 503);
      },
    },
    {
      label: '402 → InsufficientCreditsError',
      error: new FailedRequestError("Insufficient balance for 'abc'", 402),
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
      new FailedRequestError(EXPIRED_409(true), 409),
    );
    await assert.rejects(
      () => service.buyArNSName({ name: 'x', owner, type: 'permabuy' }),
      (err) =>
        err instanceof ArNSActionExpiredError &&
        err.nonce === 'n9' &&
        err.creditsReleased,
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
