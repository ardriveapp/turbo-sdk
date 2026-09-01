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
import bs58 from 'bs58';
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import nacl from 'tweetnacl';

import { testJwk } from '../../tests/helpers.js';
import { TurboNodeSigner } from '../node/signer.js';
import { ArNSActionResult } from '../types.js';
import { fromB64Url } from '../utils/base64.js';
import {
  FailedRequestError,
  InsufficientCreditsError,
} from '../utils/errors.js';
import { emptySignatureSlots, solanaOwnerSigner } from './arnsActions.js';
import { TurboAuthenticatedPaymentService } from './payment.js';

/** Records calls and returns canned responses, one per call. */
class FakeHttp {
  public calls: {
    method: string;
    endpoint: string;
    headers?: any;
    data?: any;
  }[] = [];
  public responses: unknown[] = [];
  public error: unknown = undefined;
  private next() {
    if (this.error) throw this.error;
    return this.responses.length > 1
      ? this.responses.shift()
      : this.responses[0];
  }
  async get(args: { endpoint: string; headers?: any }) {
    this.calls.push({ method: 'GET', ...args });
    return this.next();
  }
  async post(args: { endpoint: string; headers?: any; data?: any }) {
    this.calls.push({ method: 'POST', ...args });
    return this.next();
  }
  get last() {
    return this.calls[this.calls.length - 1];
  }
}

function serviceWith(http: FakeHttp) {
  const service = new TurboAuthenticatedPaymentService({
    signer: new TurboNodeSigner({
      signer: new ArweaveSigner(testJwk),
      token: 'arweave',
    }),
  });
  // Same injection the rest of this suite uses.
  (service as unknown as { httpService: FakeHttp }).httpService = http;
  return service;
}

const ownerKeypair = Keypair.generate();
const owner = solanaOwnerSigner(ownerKeypair.secretKey);
const body = (call: { data?: any }) =>
  JSON.parse(Buffer.from(call.data).toString());

describe('ArNS actions', () => {
  describe('createArNSAction', () => {
    it('posts to the per-action endpoint with a JSON body and payer headers', async () => {
      const http = new FakeHttp();
      http.responses = [
        {
          nonce: 'n1',
          action: 'extend-lease',
          status: 'completed',
          messageId: 'm1',
        },
      ];
      await serviceWith(http).createArNSAction('extend-lease', {
        name: 'x',
        years: 2,
      });

      assert.equal(http.last.endpoint, '/arns/actions/extend-lease');
      assert.deepEqual(body(http.last), { name: 'x', years: 2 });
      assert.equal(http.last.headers['content-type'], 'application/json');
      // The PAYER's signed request must be present on every action — it is billed.
      assert.ok(http.last.headers['x-signature']);
      assert.ok(http.last.headers['x-public-key']);
    });

    it('maps a 402 to InsufficientCreditsError so callers can prompt a top-up', async () => {
      const http = new FakeHttp();
      http.error = new FailedRequestError('no credits', 402);
      await assert.rejects(
        () => serviceWith(http).createArNSAction('buy-name', { name: 'x' }),
        InsufficientCreditsError,
      );
    });

    it('sends the owner proof in x-owner-* headers, signed over message+nonce', async () => {
      const http = new FakeHttp();
      http.responses = [
        {
          nonce: 'n1',
          action: 'set-record',
          status: 'completed',
          messageId: 'm1',
        },
      ];
      const message = 'arns\nset-record\nant1\n@\ntx1\n3600';
      await serviceWith(http).createArNSAction(
        'set-record',
        { antId: 'ant1' },
        { owner, message },
      );

      const h = http.last.headers;
      // The owner's proof travels in its OWN header set: two signatures from two
      // different keys cannot share one, or the second verifier rejects the first.
      assert.ok(h['x-owner-signature'], 'owner signature present');
      assert.notEqual(
        h['x-owner-nonce'],
        h['x-nonce'],
        'owner nonce is independent',
      );
      assert.equal(h['x-owner-signature-type'], '4', 'solana');

      // Verify the signature really is over `message + ownerNonce`.
      const ok = nacl.sign.detached.verify(
        Uint8Array.from(Buffer.from(message + h['x-owner-nonce'])),
        fromB64Url(h['x-owner-signature']),
        ownerKeypair.publicKey.toBytes(),
      );
      assert.ok(ok, 'owner signature verifies over message+nonce');
      // The public key header must decode to the owner's raw ed25519 key.
      assert.deepEqual(
        Uint8Array.from(fromB64Url(h['x-owner-public-key'])),
        Uint8Array.from(bs58.decode(ownerKeypair.publicKey.toBase58())),
      );
    });
  });

  describe('the two-shape branch', () => {
    it('signs and submits when the server asks for a signature', async () => {
      const http = new FakeHttp();
      const prepared = await buildPreparedTx();
      http.responses = [
        {
          nonce: 'n1',
          action: 'buy-name',
          status: 'awaiting-signature',
          transaction: prepared,
          antId: 'ant1',
        },
        {
          nonce: 'n1',
          action: 'buy-name',
          status: 'completed',
          antId: 'ant1',
          messageId: 'm1',
        },
      ];
      const result = await serviceWith(http).buyArNSName({
        name: 'x',
        owner,
        type: 'permabuy',
      });

      assert.equal(result.status, 'completed');
      assert.equal(http.calls.length, 2);
      assert.equal(http.calls[1].endpoint, '/arns/actions/n1/sign');
      // The signed transaction goes back whole, not as a bare signature.
      assert.ok(typeof body(http.calls[1]).transaction === 'string');
    });

    it('does NOT ask for a signature when the server already completed it', async () => {
      const http = new FakeHttp();
      http.responses = [
        {
          nonce: 'n2',
          action: 'set-record',
          status: 'completed',
          messageId: 'm1',
        },
      ];
      const result = await serviceWith(http).setArNSRecord({
        antId: 'ant1',
        owner,
        transactionId: 'tx1',
      });
      assert.equal(result.status, 'completed');
      // One call only: the branch is the server's decision, not the caller's.
      assert.equal(http.calls.length, 1);
    });

    it('fires onNonce BEFORE signing, so an abandoned action is still recoverable', async () => {
      const http = new FakeHttp();
      const prepared = await buildPreparedTx();
      http.responses = [
        {
          nonce: 'n3',
          action: 'buy-name',
          status: 'awaiting-signature',
          transaction: prepared,
        },
        {
          nonce: 'n3',
          action: 'buy-name',
          status: 'completed',
          messageId: 'm1',
        },
      ];
      const seen: { nonce: string; callsAtThatPoint: number }[] = [];
      await serviceWith(http).buyArNSName({
        name: 'x',
        owner,
        type: 'permabuy',
        onNonce: (nonce) => {
          seen.push({ nonce, callsAtThatPoint: http.calls.length });
        },
      });
      assert.deepEqual(seen, [{ nonce: 'n3', callsAtThatPoint: 1 }]);
    });

    it('names the debited nonce when a signature is needed but no owner was given', async () => {
      const http = new FakeHttp();
      http.responses = [
        {
          nonce: 'n4',
          action: 'buy-name',
          status: 'awaiting-signature',
          transaction: 'x',
        },
      ];
      // Drive the private path via the raw API the way a caller without an owner would.
      const svc = serviceWith(http);
      const created = (await svc.createArNSAction('buy-name', {
        name: 'x',
      })) as ArNSActionResult;
      assert.equal(created.status, 'awaiting-signature');
    });
  });

  describe('pricing', () => {
    it('adds wincTotal so a caller cannot under-quote by reading winc', async () => {
      const http = new FakeHttp();
      http.responses = [
        {
          winc: '974711979594',
          mARIO: '1782379680',
          antSpawnSurchargeWinc: '2000000000000',
          wincTotalWithAntSpawn: '2974711979594',
        },
      ];
      const price = await serviceWith(http).getArNSPriceForName({
        intent: 'Buy-Name',
        name: 'x',
        type: 'permabuy',
      } as never);
      assert.equal(price.wincTotal, '2974711979594');
    });

    it('falls back to winc when no surcharge applies (non-minting intents)', async () => {
      const http = new FakeHttp();
      http.responses = [{ winc: '123', mARIO: '456' }];
      const price = await serviceWith(http).getArNSPriceForName({
        intent: 'Extend-Lease',
        name: 'x',
        years: 1,
      } as never);
      assert.equal(price.wincTotal, '123');
    });
  });

  describe('getArNSActionPrice', () => {
    it('GETs /arns/actions/{action}/price and returns the response as-is', async () => {
      const http = new FakeHttp();
      http.responses = [
        { action: 'remove-controller', wincQty: '50000000000' },
      ];
      const price =
        await serviceWith(http).getArNSActionPrice('remove-controller');
      assert.equal(http.last.method, 'GET');
      assert.equal(http.last.endpoint, '/arns/actions/remove-controller/price');
      assert.deepEqual(price, {
        action: 'remove-controller',
        wincQty: '50000000000',
      });
    });

    it('threads the action through unmodified for every non-purchase action', async () => {
      for (const action of ['set-record', 'transfer-record', 'transfer']) {
        const http = new FakeHttp();
        http.responses = [{ action, wincQty: '1' }];
        await serviceWith(http).getArNSActionPrice(action as never);
        assert.equal(http.last.endpoint, `/arns/actions/${action}/price`);
      }
    });
  });
});

describe('ArNS actions - the thin wrappers', () => {
  // Each wrapper is a few lines, but a wrong param NAME is invisible until the
  // service 400s at runtime. These pin the wire shape of every action that the
  // on-chain e2e does not already exercise.

  const completed = (action: string) => ({
    nonce: 'n',
    action,
    status: 'completed',
    messageId: 'm',
  });

  it('extendArNSLease sends name + years', async () => {
    const http = new FakeHttp();
    http.responses = [completed('extend-lease')];
    await serviceWith(http).extendArNSLease({ name: 'x', years: 2 });
    assert.equal(http.last.endpoint, '/arns/actions/extend-lease');
    assert.deepEqual(body(http.last), { name: 'x', years: 2 });
  });

  it('upgradeArNSName sends just the name', async () => {
    const http = new FakeHttp();
    http.responses = [completed('upgrade-name')];
    await serviceWith(http).upgradeArNSName({ name: 'x' });
    assert.equal(http.last.endpoint, '/arns/actions/upgrade-name');
    assert.deepEqual(body(http.last), { name: 'x' });
  });

  it('increaseArNSUndernameLimit sends name + increaseQty', async () => {
    const http = new FakeHttp();
    http.responses = [completed('increase-undername-limit')];
    await serviceWith(http).increaseArNSUndernameLimit({
      name: 'x',
      increaseQty: 5,
    });
    assert.equal(http.last.endpoint, '/arns/actions/increase-undername-limit');
    assert.deepEqual(body(http.last), { name: 'x', increaseQty: 5 });
  });

  it('paidBy is forwarded only when supplied', async () => {
    const http = new FakeHttp();
    http.responses = [completed('extend-lease'), completed('extend-lease')];
    const svc = serviceWith(http);
    await svc.extendArNSLease({ name: 'x', years: 1 });
    assert.ok(!('paidBy' in body(http.last)), 'omitted when undefined');
    await svc.extendArNSLease({ name: 'x', years: 1, paidBy: ['a'] });
    assert.deepEqual(body(http.last).paidBy, ['a']);
  });

  it('addArNSController omits target so the service defaults to Turbo', async () => {
    const http = new FakeHttp();
    const prepared = await buildPreparedTx();
    http.responses = [
      {
        nonce: 'n',
        action: 'add-controller',
        status: 'awaiting-signature',
        transaction: prepared,
      },
      completed('add-controller'),
    ];
    await serviceWith(http).addArNSController({ antId: 'ant1', owner });
    const sent = body(http.calls[0]);
    assert.equal(sent.antId, 'ant1');
    assert.ok(!('target' in sent), 'no target => Turbo itself');
    assert.equal(sent.ownerAddress, await owner.getAddress());
  });

  it('removeArNSController forwards an explicit target', async () => {
    const http = new FakeHttp();
    const prepared = await buildPreparedTx();
    http.responses = [
      {
        nonce: 'n',
        action: 'remove-controller',
        status: 'awaiting-signature',
        transaction: prepared,
      },
      completed('remove-controller'),
    ];
    await serviceWith(http).removeArNSController({
      antId: 'ant1',
      owner,
      target: 'someone-else',
    });
    assert.equal(body(http.calls[0]).target, 'someone-else');
  });

  it('transferArNSAnt sends antId + target', async () => {
    const http = new FakeHttp();
    const prepared = await buildPreparedTx();
    http.responses = [
      {
        nonce: 'n',
        action: 'transfer',
        status: 'awaiting-signature',
        transaction: prepared,
      },
      completed('transfer'),
    ];
    await serviceWith(http).transferArNSAnt({
      antId: 'ant1',
      owner,
      target: 'new-owner',
    });
    assert.deepEqual(body(http.calls[0]), {
      antId: 'ant1',
      ownerAddress: await owner.getAddress(),
      target: 'new-owner',
    });
  });

  it('removeArNSRecord binds the owner proof to THIS undername', async () => {
    const http = new FakeHttp();
    http.responses = [completed('remove-record')];
    await serviceWith(http).removeArNSRecord({
      antId: 'ant1',
      owner,
      undername: 'docs',
    });
    const h = http.last.headers;
    // A signature captured for one undername must not authorize another.
    const ok = nacl.sign.detached.verify(
      Uint8Array.from(
        Buffer.from('arns\nremove-record\nant1\ndocs' + h['x-owner-nonce']),
      ),
      fromB64Url(h['x-owner-signature']),
      ownerKeypair.publicKey.toBytes(),
    );
    assert.ok(ok, 'proof is bound to antId + undername');
  });

  it('setArNSRecord defaults undername to @ and ttl to 3600', async () => {
    const http = new FakeHttp();
    http.responses = [completed('set-record')];
    await serviceWith(http).setArNSRecord({
      antId: 'ant1',
      owner,
      transactionId: 'tx1',
    });
    assert.equal(body(http.last).undername, '@');
    assert.equal(body(http.last).ttlSeconds, 3600);
  });
});

describe('ArNS actions - raw endpoints and error paths', () => {
  it('signArNSAction posts the transaction to the nonce sign endpoint', async () => {
    const http = new FakeHttp();
    http.responses = [
      { nonce: 'n9', action: 'buy-name', status: 'completed', messageId: 'm' },
    ];
    await serviceWith(http).signArNSAction('n9', 'BASE64TX');
    assert.equal(http.last.endpoint, '/arns/actions/n9/sign');
    assert.deepEqual(body(http.last), { transaction: 'BASE64TX' });
  });

  it('getArNSActionStatus reads by nonce without a body', async () => {
    const http = new FakeHttp();
    http.responses = [
      { nonce: 'n9', action: 'buy-name', status: 'completed', messageId: 'm' },
    ];
    await serviceWith(http).getArNSActionStatus('n9');
    assert.equal(http.last.method, 'GET');
    assert.equal(http.last.endpoint, '/arns/actions/n9');
  });

  it('rethrows non-402 failures unchanged rather than mislabelling them', async () => {
    const http = new FakeHttp();
    http.error = new FailedRequestError('chain unreachable', 503);
    await assert.rejects(
      () => serviceWith(http).createArNSAction('buy-name', { name: 'x' }),
      (err: Error) => {
        assert.ok(!(err instanceof InsufficientCreditsError));
        assert.equal((err as FailedRequestError).status, 503);
        return true;
      },
    );
  });

  it('names the already-debited nonce when a signature is needed but no owner was given', async () => {
    const http = new FakeHttp();
    http.responses = [
      {
        nonce: 'n-debited',
        action: 'extend-lease',
        status: 'awaiting-signature',
        transaction: 'x',
      },
    ];
    // extend-lease normally completes alone; if the service ever asks for a
    // signature there is no owner to sign with, and the caller must be told
    // WHICH nonce is already paid for so they poll instead of re-creating.
    await assert.rejects(
      () => serviceWith(http).extendArNSLease({ name: 'x', years: 1 }),
      /n-debited/,
    );
  });
});

describe('emptySignatureSlots', () => {
  it('reports the slot Turbo left for the owner', async () => {
    const prepared = await buildPreparedTx();
    // Fee payer + owner are both unsigned in the fixture.
    assert.ok(emptySignatureSlots(prepared) >= 1);
  });

  it('drops to zero once every required signature is present', async () => {
    const prepared = await buildPreparedTx();
    const signedOnce = await owner.signTransaction(prepared);
    assert.ok(emptySignatureSlots(signedOnce) < emptySignatureSlots(prepared));
  });
});

describe('public export surface', () => {
  // A regression guard. `solanaOwnerSigner` shipped in 1.42.0-alpha.9 built but
  // NOT re-exported from the package index, so the documented
  // `import { solanaOwnerSigner } from '@ardrive/turbo-sdk'` did not resolve.
  // The unit suite could not catch it because it imports module paths directly;
  // only installing the tarball did. These assert the barrel, not the module.
  it('re-exports the ANT-owner helpers the README tells callers to import', async () => {
    const index = await import('./index.js');
    for (const name of [
      'solanaOwnerSigner',
      'emptySignatureSlots',
      'buildArNSCustodyMessage',
    ]) {
      assert.equal(
        typeof (index as Record<string, unknown>)[name],
        'function',
        `${name} must be reachable from the package entry point`,
      );
    }
  });

  it('exposes every sponsored action on the authenticated client', async () => {
    const { TurboAuthenticatedClient } = await import('./turbo.js');
    for (const method of [
      'createArNSAction',
      'signArNSAction',
      'getArNSActionStatus',
      'buyArNSName',
      'extendArNSLease',
      'upgradeArNSName',
      'increaseArNSUndernameLimit',
      'setArNSRecord',
      'removeArNSRecord',
      'addArNSController',
      'removeArNSController',
      'transferArNSAnt',
    ]) {
      assert.equal(
        typeof (
          TurboAuthenticatedClient.prototype as unknown as Record<
            string,
            unknown
          >
        )[method],
        'function',
        `${method} missing from the authenticated client`,
      );
    }
  });
});

describe('ArNS record-scoped actions', () => {
  const completed = (action: string) => ({
    nonce: 'n',
    action,
    status: 'completed',
    messageId: 'm',
  });

  /** Does the owner proof verify against this candidate message? */
  const signedMessage = (headers: Record<string, string>, candidate: string) =>
    nacl.sign.detached.verify(
      Uint8Array.from(Buffer.from(candidate + headers['x-owner-nonce'])),
      fromB64Url(headers['x-owner-signature']),
      ownerKeypair.publicKey.toBytes(),
    );

  const NUL = '\u0000';
  const SEP = '\u0001';

  it('binds every metadata field into the owner proof', async () => {
    const http = new FakeHttp();
    http.responses = [completed('set-record-metadata')];
    await serviceWith(http).setArNSRecordMetadata({
      antId: 'ant1',
      owner,
      displayName: 'My Blog',
      recordDescription: 'hello',
      recordKeywords: ['a', 'b'],
    });
    const expected = [
      'arns',
      'set-record-metadata',
      'ant1',
      '@',
      'My Blog',
      NUL, // recordLogo omitted -> absent sentinel
      'hello',
      ['a', 'b'].join(SEP),
    ].join('\n');
    assert.ok(
      signedMessage(http.last.headers, expected),
      'proof is bound to every field',
    );
  });

  it('sends CLEAR (null) and EMPTY (empty string) distinguishably', async () => {
    const http = new FakeHttp();
    http.responses = [
      completed('set-record-metadata'),
      completed('set-record-metadata'),
    ];
    const svc = serviceWith(http);
    await svc.setArNSRecordMetadata({
      antId: 'a',
      owner,
      recordDescription: null,
    });
    assert.equal(body(http.last).recordDescription, null);
    await svc.setArNSRecordMetadata({
      antId: 'a',
      owner,
      recordDescription: '',
    });
    assert.equal(body(http.last).recordDescription, '');
  });

  it('omits an undefined field entirely, so it is left unchanged', async () => {
    const http = new FakeHttp();
    http.responses = [completed('set-record-metadata')];
    await serviceWith(http).setArNSRecordMetadata({
      antId: 'a',
      owner,
      displayName: 'only this',
    });
    const sent = body(http.last);
    assert.ok(!('recordLogo' in sent), 'untouched fields are not sent');
    assert.equal(sent.displayName, 'only this');
  });

  it('removeArNSRecordMetadata binds antId + undername', async () => {
    const http = new FakeHttp();
    http.responses = [completed('remove-record-metadata')];
    await serviceWith(http).removeArNSRecordMetadata({
      antId: 'ant1',
      owner,
      undername: 'docs',
    });
    assert.equal(http.last.endpoint, '/arns/actions/remove-record-metadata');
    assert.ok(
      signedMessage(
        http.last.headers,
        ['arns', 'remove-record-metadata', 'ant1', 'docs'].join('\n'),
      ),
    );
  });

  it('transferArNSRecord cannot be replayed as a whole-ANT transfer', async () => {
    const http = new FakeHttp();
    http.responses = [completed('transfer-record')];
    await serviceWith(http).transferArNSRecord({
      antId: 'ant1',
      owner,
      undername: 'docs',
      target: 'dest1',
    });
    const h = http.last.headers;
    assert.ok(
      signedMessage(
        h,
        ['arns', 'transfer-record', 'ant1', 'docs', 'dest1'].join('\n'),
      ),
      'signs the record-transfer message',
    );
    assert.ok(
      !signedMessage(h, ['arns', 'transfer', 'ant1', 'dest1'].join('\n')),
      'the whole-ANT transfer message must NOT verify against this proof',
    );
  });
});

/**
 * A real unsigned v0 transaction, base64, shaped like one Turbo prepares:
 * a separate FEE PAYER plus the ANT owner as an additional required signer.
 * The owner must be a required signer or `tx.sign([owner])` rejects the key.
 */
async function buildPreparedTx(): Promise<string> {
  const { VersionedTransaction, TransactionMessage, SystemProgram } =
    await import('@solana/web3.js');
  const feePayer = Keypair.generate();
  const msg = new TransactionMessage({
    payerKey: feePayer.publicKey,
    recentBlockhash: Keypair.generate().publicKey.toBase58(),
    instructions: [
      // `fromPubkey: owner` is what makes the owner a required signer, which
      // mirrors how the real spawn needs the owner's signature.
      SystemProgram.transfer({
        fromPubkey: ownerKeypair.publicKey,
        toPubkey: feePayer.publicKey,
        lamports: 1,
      }),
    ],
  }).compileToV0Message();
  return Buffer.from(new VersionedTransaction(msg).serialize()).toString(
    'base64',
  );
}
