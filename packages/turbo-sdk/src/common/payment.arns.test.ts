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
import { ArweaveSigner, HexSolanaSigner } from '@dha-team/arbundles';
import { strict as assert } from 'node:assert';
import { beforeEach, describe, it } from 'node:test';
import nacl from 'tweetnacl';

import { testJwk, testSolWallet } from '../../tests/helpers.js';
import { TurboNodeSigner } from '../node/signer.js';
import { fromB64Url } from '../utils/base64.js';
import {
  FailedRequestError,
  InsufficientCreditsError,
  ProvidedInputError,
} from '../utils/errors.js';
import {
  TurboAuthenticatedPaymentService,
  TurboUnauthenticatedPaymentService,
} from './payment.js';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Records the last get/post call and returns a canned response. Set `error` to
// make the next call reject (used to exercise 402/401/503 handling).
class FakeHttp {
  public calls: {
    method: string;
    endpoint: string;
    headers?: any;
    data?: any;
    retry?: boolean;
  }[] = [];
  public response: unknown = {};
  public error: unknown = undefined;
  async get(args: { endpoint: string; headers?: any }) {
    this.calls.push({ method: 'GET', ...args });
    if (this.error) throw this.error;
    return this.response;
  }
  async post(args: {
    endpoint: string;
    headers?: any;
    data?: any;
    retry?: boolean;
  }) {
    this.calls.push({ method: 'POST', ...args });
    if (this.error) throw this.error;
    return this.response;
  }
  get last() {
    return this.calls[this.calls.length - 1];
  }
}

// Wraps a real signer to capture the (nonce, additionalData) passed to
// generateSignedRequestHeaders, so tests can assert the ACTION-BOUND custody
// message is byte-exact without cracking real signatures open.
class RecordingSigner {
  public calls: { nonce: string; additionalData?: string }[] = [];
  constructor(private readonly inner: TurboNodeSigner) {}
  async generateSignedRequestHeaders(nonce: string, additionalData?: string) {
    this.calls.push({ nonce, additionalData });
    return this.inner.generateSignedRequestHeaders(nonce, additionalData);
  }
  get last() {
    return this.calls[this.calls.length - 1];
  }
}

const newSigner = () =>
  new TurboNodeSigner({ signer: new ArweaveSigner(testJwk), token: 'arweave' });

const newSolanaSigner = () =>
  new TurboNodeSigner({
    signer: new HexSolanaSigner(testSolWallet),
    token: 'solana',
  });

describe('ArNS purchase client', () => {
  let http: FakeHttp;

  beforeEach(() => {
    http = new FakeHttp();
  });

  describe('unauthenticated', () => {
    const service = () => {
      const s = new TurboUnauthenticatedPaymentService({});
      (s as unknown as { httpService: FakeHttp }).httpService = http;
      return s;
    };

    it('getArNSPriceForName builds the price endpoint + query (Buy-Name lease)', async () => {
      http.response = { winc: '5', mARIO: '10' };
      const res = await service().getArNSPriceForName({
        intent: 'Buy-Name',
        name: 'my-name',
        type: 'lease',
        years: 1,
        processId: 'ant-123',
      });
      assert.equal(http.last.method, 'GET');
      assert.equal(
        http.last.endpoint,
        '/arns/price/buy-name/my-name?type=lease&years=1&processId=ant-123',
      );
      assert.deepEqual(res, { winc: '5', mARIO: '10' });
    });

    it('getArNSPriceForName builds the permabuy price query', async () => {
      await service().getArNSPriceForName({
        intent: 'Buy-Name',
        name: 'my-name',
        type: 'permabuy',
        processId: 'ant-123',
      });
      assert.equal(
        http.last.endpoint,
        '/arns/price/buy-name/my-name?type=permabuy&processId=ant-123',
      );
    });

    it('getArNSPriceForName builds the extend-lease price query', async () => {
      await service().getArNSPriceForName({
        intent: 'Extend-Lease',
        name: 'my-name',
        years: 3,
      });
      assert.equal(
        http.last.endpoint,
        '/arns/price/extend-lease/my-name?years=3',
      );
    });

    it('getArNSPriceForName builds the increase-undername-limit price query', async () => {
      await service().getArNSPriceForName({
        intent: 'Increase-Undername-Limit',
        name: 'my-name',
        increaseQty: 7,
      });
      assert.equal(
        http.last.endpoint,
        '/arns/price/increase-undername-limit/my-name?increaseQty=7',
      );
    });

    it('getArNSPriceForName builds the upgrade-name price query (no params)', async () => {
      await service().getArNSPriceForName({
        intent: 'Upgrade-Name',
        name: 'my-name',
      });
      assert.equal(http.last.endpoint, '/arns/price/upgrade-name/my-name');
    });

    it('getArNSPriceForName validates required params before hitting the network', async () => {
      await assert.rejects(
        () =>
          service().getArNSPriceForName({
            // missing processId
            intent: 'Buy-Name',
            name: 'my-name',
            type: 'lease',
            years: 1,
          } as never),
        (err: unknown) =>
          err instanceof ProvidedInputError &&
          /processId/.test((err as Error).message),
      );
      assert.equal(http.calls.length, 0, 'no request should be issued');
    });

    it('getArNSPurchaseStatus uses the nonce path', async () => {
      await service().getArNSPurchaseStatus({ nonce: 'abc-nonce' });
      assert.equal(http.last.endpoint, '/arns/purchase/abc-nonce');
    });

    it('getArNSPurchaseStatus surfaces a terminal SUCCESS (messageId, no failedDate)', async () => {
      http.response = {
        name: 'foo',
        intent: 'Buy-Name',
        nonce: 'abc-nonce',
        owner: 'owner-1',
        wincQty: '5',
        mARIOQty: '10',
        usdArRate: 1,
        usdArioRate: 1,
        paidBy: [],
        messageId: 'sol-tx-success',
      };
      const res = await service().getArNSPurchaseStatus({ nonce: 'abc-nonce' });
      assert.equal(res.messageId, 'sol-tx-success');
      assert.equal(res.failedDate, undefined);
    });

    it('getArNSPurchaseStatus surfaces a terminal FAILURE (failedDate present)', async () => {
      http.response = {
        name: 'foo',
        intent: 'Buy-Name',
        nonce: 'abc-nonce',
        owner: 'owner-1',
        wincQty: '5',
        mARIOQty: '10',
        usdArRate: 1,
        usdArioRate: 1,
        paidBy: [],
        messageId: '',
        failedDate: '2026-07-14T00:00:00.000Z',
      };
      const res = await service().getArNSPurchaseStatus({ nonce: 'abc-nonce' });
      assert.equal(res.failedDate, '2026-07-14T00:00:00.000Z');
    });
  });

  describe('authenticated', () => {
    const service = () => {
      const s = new TurboAuthenticatedPaymentService({ signer: newSigner() });
      (s as unknown as { httpService: FakeHttp }).httpService = http;
      return s;
    };

    // Regression: non-idempotent signed writes must NOT auto-retry — the nonce
    // is single-use, so a retried-but-already-landed write 4xxs as
    // "already exists"/"nonce used" and surfaces a false failure.
    it('non-idempotent ArNS writes disable HTTP auto-retry (retry:false)', async () => {
      http.response = {
        purchaseReceipt: { name: 'foo' },
        arioWriteResult: { id: 'x' },
      };
      const s = service();
      await s.buyArNSName({ name: 'foo', type: 'permabuy', processId: 'ant' });
      assert.equal(http.last.method, 'POST');
      assert.equal(http.last.retry, false);

      await s.transferArNSAnt({ antId: 'ant-1', target: 'tgt-1' });
      assert.equal(http.last.retry, false);

      await s.setArNSRecord({
        antId: 'ant-1',
        transactionId: 'tx-1',
        ttlSeconds: 900,
      });
      assert.equal(http.last.retry, false);

      await s.removeArNSRecord({ antId: 'ant-1', undername: 'docs' });
      assert.equal(http.last.retry, false);
    });

    it('purchaseArNSName signs a UUID nonce + sends signature-type, returns the nonce', async () => {
      http.response = {
        purchaseReceipt: { name: 'foo', nonce: 'ignored' },
        arioWriteResult: { id: 'sol-tx' },
      };
      const res = await service().purchaseArNSName({
        intent: 'Buy-Name',
        name: 'foo',
        type: 'lease',
        years: 1,
        processId: 'ant-xyz',
      });

      assert.equal(http.last.method, 'POST');
      assert.equal(
        http.last.endpoint,
        '/arns/purchase/buy-name/foo?type=lease&years=1&processId=ant-xyz',
      );
      // UUID nonce, signed, with signature type advertised
      assert.match(http.last.headers['x-nonce'], UUID_RE);
      assert.equal(http.last.headers['x-signature-type'], '1'); // arweave
      assert.ok(http.last.headers['x-public-key']?.length > 0);
      assert.ok(http.last.headers['x-signature']?.length > 0);
      assert.ok(Buffer.isBuffer(http.last.data));
      // returned nonce is the one that was signed/sent
      assert.equal(res.nonce, http.last.headers['x-nonce']);
      assert.match(res.nonce, UUID_RE);
      // both the top-level and nested receipt nonce are normalized to the
      // signed nonce (the service echo of `purchaseReceipt.nonce` is ignored)
      assert.equal(res.purchaseReceipt.nonce, res.nonce);
    });

    it('every purchase mints a FRESH UUID nonce (no reuse across calls)', async () => {
      http.response = {
        purchaseReceipt: { name: 'foo' },
        arioWriteResult: { id: 'x' },
      };
      const a = await service().buyArNSName({
        name: 'foo',
        type: 'permabuy',
        processId: 'ant',
      });
      const b = await service().buyArNSName({
        name: 'foo',
        type: 'permabuy',
        processId: 'ant',
      });
      assert.notEqual(a.nonce, b.nonce);
      assert.match(a.nonce, UUID_RE);
      assert.match(b.nonce, UUID_RE);
    });

    it('per-intent wrappers set the correct intent in the path', async () => {
      const s = service();
      await s.extendArNSLease({ name: 'foo', years: 2 });
      assert.ok(
        http.last.endpoint.startsWith('/arns/purchase/extend-lease/foo'),
      );
      assert.ok(http.last.endpoint.includes('years=2'));

      await s.increaseArNSUndernameLimit({ name: 'foo', increaseQty: 5 });
      assert.ok(
        http.last.endpoint.startsWith(
          '/arns/purchase/increase-undername-limit/foo',
        ),
      );
      assert.ok(http.last.endpoint.includes('increaseQty=5'));

      await s.upgradeArNSName({ name: 'foo' });
      assert.ok(
        http.last.endpoint.startsWith('/arns/purchase/upgrade-name/foo'),
      );
    });

    it('buyArNSName supports a permabuy (no years, processId set)', async () => {
      await service().buyArNSName({
        name: 'foo',
        type: 'permabuy',
        processId: 'ant-p',
      });
      assert.equal(
        http.last.endpoint,
        '/arns/purchase/buy-name/foo?type=permabuy&processId=ant-p',
      );
    });

    it('appends paidBy delegated payers as repeated params', async () => {
      await service().buyArNSName({
        name: 'foo',
        type: 'permabuy',
        processId: 'ant',
        paidBy: ['payer-a', 'payer-b'],
      });
      assert.ok(http.last.endpoint.includes('paidBy=payer-a'));
      assert.ok(http.last.endpoint.includes('paidBy=payer-b'));
    });

    it('appends a single paidBy payer', async () => {
      await service().buyArNSName({
        name: 'foo',
        type: 'permabuy',
        processId: 'ant',
        paidBy: 'solo-payer',
      });
      assert.ok(http.last.endpoint.includes('paidBy=solo-payer'));
    });

    // ---- per-intent required-param validation (fail fast, no network) ----

    it('rejects an unknown intent', async () => {
      await assert.rejects(
        () =>
          service().purchaseArNSName({
            intent: 'Not-An-Intent',
            name: 'foo',
          } as never),
        ProvidedInputError,
      );
      assert.equal(http.calls.length, 0);
    });

    it('rejects a missing/empty name', async () => {
      await assert.rejects(
        () =>
          service().purchaseArNSName({
            intent: 'Upgrade-Name',
            name: '',
          } as never),
        (err: unknown) =>
          err instanceof ProvidedInputError &&
          /name/.test((err as Error).message),
      );
    });

    it('rejects Buy-Name with a bad type', async () => {
      await assert.rejects(
        () =>
          service().buyArNSName({
            name: 'foo',
            type: 'rental' as never,
            processId: 'ant',
          }),
        (err: unknown) =>
          err instanceof ProvidedInputError &&
          /type/.test((err as Error).message),
      );
    });

    it('rejects a lease Buy-Name without years', async () => {
      await assert.rejects(
        () =>
          service().buyArNSName({
            name: 'foo',
            type: 'lease',
            processId: 'ant',
          } as never),
        (err: unknown) =>
          err instanceof ProvidedInputError &&
          /years/.test((err as Error).message),
      );
    });

    it('rejects Extend-Lease without a positive years', async () => {
      await assert.rejects(
        () => service().extendArNSLease({ name: 'foo', years: 0 }),
        (err: unknown) =>
          err instanceof ProvidedInputError &&
          /years/.test((err as Error).message),
      );
    });

    it('rejects Increase-Undername-Limit without a positive increaseQty', async () => {
      await assert.rejects(
        () =>
          service().increaseArNSUndernameLimit({ name: 'foo', increaseQty: 0 }),
        (err: unknown) =>
          err instanceof ProvidedInputError &&
          /increaseQty/.test((err as Error).message),
      );
    });

    // ---- error semantics: 402 -> typed, others -> FailedRequestError ----

    it('maps a 402 to a typed InsufficientCreditsError (prompt top-up)', async () => {
      http.error = new FailedRequestError('insufficient balance', 402);
      await assert.rejects(
        () =>
          service().buyArNSName({
            name: 'foo',
            type: 'permabuy',
            processId: 'ant',
          }),
        (err: unknown) => {
          assert.ok(err instanceof InsufficientCreditsError);
          assert.equal((err as InsufficientCreditsError).status, 402);
          return true;
        },
      );
    });

    it('propagates a 401 as a FailedRequestError (not insufficient-credits)', async () => {
      http.error = new FailedRequestError('unauthorized', 401);
      await assert.rejects(
        () =>
          service().buyArNSName({
            name: 'foo',
            type: 'permabuy',
            processId: 'ant',
          }),
        (err: unknown) => {
          assert.ok(err instanceof FailedRequestError);
          assert.ok(!(err instanceof InsufficientCreditsError));
          assert.equal((err as FailedRequestError).status, 401);
          return true;
        },
      );
    });

    it('propagates a 503 as a FailedRequestError', async () => {
      http.error = new FailedRequestError('service unavailable', 503);
      await assert.rejects(
        () =>
          service().buyArNSName({
            name: 'foo',
            type: 'permabuy',
            processId: 'ant',
          }),
        (err: unknown) =>
          err instanceof FailedRequestError &&
          (err as FailedRequestError).status === 503,
      );
    });

    // The custody methods send a signed, UUID-nonced request to the bound
    // endpoint. (Cross-system binding correctness — that the signed message
    // equals the bundler's canonical string — is enforced by both sides using
    // the identical newline-delimited builder + the bundler's binding tests.)
    const assertSignedHeaders = () => {
      assert.match(http.last.headers['x-nonce'], UUID_RE);
      assert.ok(http.last.headers['x-public-key']?.length > 0);
      assert.ok(http.last.headers['x-signature']?.length > 0);
      assert.equal(http.last.headers['x-signature-type'], '1'); // arweave
      assert.ok(Buffer.isBuffer(http.last.data));
    };

    it('transferArNSAnt posts to the transfer endpoint with a signed request', async () => {
      http.response = { antId: 'ant-1', target: 'tgt-1', messageId: 'm' };
      await service().transferArNSAnt({ antId: 'ant-1', target: 'tgt-1' });
      assert.equal(http.last.method, 'POST');
      assert.equal(http.last.endpoint, '/arns/transfer/ant-1?target=tgt-1');
      assertSignedHeaders();
    });

    it('setArNSRecord posts the record op with a signed request', async () => {
      await service().setArNSRecord({
        antId: 'ant-1',
        undername: 'docs',
        transactionId: 'tx-1',
        ttlSeconds: 900,
      });
      assert.equal(
        http.last.endpoint,
        '/arns/manage/ant-1/set-record?undername=docs&transactionId=tx-1&ttlSeconds=900',
      );
      assertSignedHeaders();
    });

    it('setArNSRecord defaults undername to @', async () => {
      await service().setArNSRecord({
        antId: 'ant-1',
        transactionId: 'tx-1',
        ttlSeconds: 900,
      });
      assert.ok(http.last.endpoint.includes('undername=%40'));
    });

    it('removeArNSRecord posts the remove op with a signed request', async () => {
      await service().removeArNSRecord({ antId: 'ant-1', undername: 'docs' });
      assert.equal(
        http.last.endpoint,
        '/arns/manage/ant-1/remove-record?undername=docs',
      );
      assertSignedHeaders();
    });

    // ---- ACTION-BOUND custody message is byte-exact ----
    //
    // The signature is taken over `<message>\n... + nonce` where <message> is the
    // canonical `arns\n<action>\n<fields...>` string. This MUST match the bundler
    // reconstruction byte-for-byte
    // (ar-io-bundler packages/payment-service/src/utils/verifyArweaveSignature.ts
    // -> verifySigAndGetNativeAddress, which verifies over `additionalData + nonce`)
    // or every custody signature is rejected. We capture the `additionalData`
    // handed to the signer and assert it exactly.
    describe('custody message is byte-exact (buildArNSCustodyMessage)', () => {
      const recordingService = () => {
        const s = new TurboAuthenticatedPaymentService({ signer: newSigner() });
        (s as unknown as { httpService: FakeHttp }).httpService = http;
        const rec = new RecordingSigner(
          (s as unknown as { signer: TurboNodeSigner }).signer,
        );
        (s as unknown as { signer: RecordingSigner }).signer = rec;
        return { s, rec };
      };

      it('transfer -> "arns\\ntransfer\\n<antId>\\n<target>"', async () => {
        const { s, rec } = recordingService();
        await s.transferArNSAnt({ antId: 'ant-1', target: 'tgt-1' });
        assert.equal(rec.last.additionalData, 'arns\ntransfer\nant-1\ntgt-1');
      });

      it('set-record -> "arns\\nset-record\\n<antId>\\n<undername>\\n<txId>\\n<ttl>"', async () => {
        const { s, rec } = recordingService();
        await s.setArNSRecord({
          antId: 'ant-1',
          undername: 'docs',
          transactionId: 'tx-1',
          ttlSeconds: 900,
        });
        assert.equal(
          rec.last.additionalData,
          'arns\nset-record\nant-1\ndocs\ntx-1\n900',
        );
      });

      it('set-record binds the DEFAULT @ undername', async () => {
        const { s, rec } = recordingService();
        await s.setArNSRecord({
          antId: 'ant-1',
          transactionId: 'tx-1',
          ttlSeconds: 900,
        });
        assert.equal(
          rec.last.additionalData,
          'arns\nset-record\nant-1\n@\ntx-1\n900',
        );
      });

      it('remove-record -> "arns\\nremove-record\\n<antId>\\n<undername>"', async () => {
        const { s, rec } = recordingService();
        await s.removeArNSRecord({ antId: 'ant-1', undername: 'docs' });
        assert.equal(
          rec.last.additionalData,
          'arns\nremove-record\nant-1\ndocs',
        );
      });
    });
  });

  // =========================================================================
  // SIGNED-BYTES CONTRACT REGRESSION GUARD (Solana / ed25519).
  //
  // This pins the canonical Solana signing convention that the SDK<->bundler
  // contract depends on. arbundles' `HexSolanaSigner` HEX-ENCODES the message
  // before ed25519-signing:  sign(m) == nacl.sign(utf8(hex(utf8(m)))).
  //
  // A recently-found launch-blocker was the bundler verifying over the RAW
  // preimage (utf8(m)) instead of the hex preimage, so every Solana-signed ArNS
  // request failed. The bundler verifier convention now lives in
  //   ar-io-bundler packages/payment-service/src/utils/verifyArweaveSignature.ts
  //   -> verifySolanaSignature  (must verify over the SAME preimage this asserts).
  //
  // If arbundles ever changes the hex-encoding (or someone swaps the Solana
  // signer), these assertions fail LOUDLY instead of silently drifting.
  // =========================================================================
  describe('Solana signed-bytes contract (regression guard)', () => {
    const solService = () => {
      const s = new TurboAuthenticatedPaymentService({
        signer: newSolanaSigner(),
        token: 'solana',
      });
      (s as unknown as { httpService: FakeHttp }).httpService = http;
      return s;
    };

    // ed25519 detached-verify helper mirroring the bundler's verifySolanaSignature.
    const verifyOver = (
      preimage: Buffer,
      sigB64Url: string,
      pubB64Url: string,
    ): boolean =>
      nacl.sign.detached.verify(
        new Uint8Array(preimage),
        new Uint8Array(fromB64Url(sigB64Url)),
        new Uint8Array(fromB64Url(pubB64Url)),
      );

    it('a purchase signature verifies over the HEX preimage of the nonce, NOT the raw bytes', async () => {
      http.response = {
        purchaseReceipt: { name: 'foo' },
        arioWriteResult: { id: 'sol-tx' },
      };
      await solService().buyArNSName({
        name: 'foo',
        type: 'permabuy',
        processId: 'ant',
      });

      const { headers } = http.last;
      assert.equal(headers['x-signature-type'], '4'); // solana/ed25519
      const nonce: string = headers['x-nonce'];
      assert.match(nonce, UUID_RE);

      // The signed message is the bare nonce (no action-binding on purchase).
      const message = Buffer.from(nonce);
      const hexPreimage = Buffer.from(message.toString('hex')); // canonical
      const rawPreimage = message; // the buggy convention

      assert.ok(
        verifyOver(
          hexPreimage,
          headers['x-signature'],
          headers['x-public-key'],
        ),
        'signature MUST verify over the hex preimage (HexSolanaSigner convention)',
      );
      assert.ok(
        !verifyOver(
          rawPreimage,
          headers['x-signature'],
          headers['x-public-key'],
        ),
        'signature MUST NOT verify over the raw preimage (guards the launch-blocker)',
      );
    });

    it('a custody signature verifies over the HEX preimage of (message + nonce)', async () => {
      http.response = { antId: 'ant-1', target: 'tgt-1', messageId: 'm' };
      await solService().transferArNSAnt({ antId: 'ant-1', target: 'tgt-1' });

      const { headers } = http.last;
      assert.equal(headers['x-signature-type'], '4');
      const nonce: string = headers['x-nonce'];

      // action-bound message + nonce, exactly what the bundler reconstructs
      const signed = Buffer.from('arns\ntransfer\nant-1\ntgt-1' + nonce);
      const hexPreimage = Buffer.from(signed.toString('hex'));

      assert.ok(
        verifyOver(
          hexPreimage,
          headers['x-signature'],
          headers['x-public-key'],
        ),
        'custody signature MUST verify over hex(message + nonce)',
      );
      // A different action must NOT verify (proves the binding is real).
      const wrong = Buffer.from(
        Buffer.from('arns\nremove-record\nant-1\ntgt-1' + nonce).toString(
          'hex',
        ),
      );
      assert.ok(
        !verifyOver(wrong, headers['x-signature'], headers['x-public-key']),
      );
    });
  });
});
