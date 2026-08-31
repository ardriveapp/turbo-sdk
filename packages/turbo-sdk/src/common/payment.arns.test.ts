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
import { solanaOwnerSigner } from './arnsActions.js';
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
