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
import {
  ArweaveSigner,
  EthereumSigner,
  HexSolanaSigner,
  SignatureConfig,
} from '@dha-team/arbundles';
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  testArweaveNativeB64Address,
  testEthWallet,
  testJwk,
  testSolNativeAddress,
  testSolWallet,
} from '../../tests/helpers.js';
import { TurboFactory } from '../node/factory.js';
import { TurboNodeSigner } from '../node/signer.js';
import { TokenType, TurboSigner } from '../types.js';
import { isValidUserAddress } from '../utils/common.js';

describe('TurboDataItemAbstractSigner.generateSignedRequestHeaders', () => {
  // arbundles SignatureConfig: ARWEAVE=1, ETHEREUM=3, SOLANA=4
  const cases: {
    name: string;
    token: TokenType;
    signer: TurboSigner;
    expectedSignatureType: string;
  }[] = [
    {
      name: 'arweave',
      token: 'arweave',
      signer: new ArweaveSigner(testJwk),
      expectedSignatureType: '1',
    },
    {
      name: 'ethereum',
      token: 'ethereum',
      signer: new EthereumSigner(testEthWallet),
      expectedSignatureType: '3',
    },
    {
      name: 'solana',
      token: 'solana',
      signer: new HexSolanaSigner(testSolWallet),
      expectedSignatureType: '4',
    },
  ];

  for (const { name, token, signer, expectedSignatureType } of cases) {
    it(`emits x-signature-type for a ${name} signer`, async () => {
      const turboSigner = new TurboNodeSigner({ signer, token });
      const headers = await turboSigner.generateSignedRequestHeaders();

      // The header must match the signer's own signatureType...
      assert.equal(
        headers['x-signature-type'],
        signer.signatureType.toString(),
      );
      // ...and equal the expected arbundles SignatureConfig value.
      assert.equal(headers['x-signature-type'], expectedSignatureType);

      // The pre-existing headers are still present and well-formed.
      assert.ok(headers['x-public-key']?.length > 0);
      assert.ok(headers['x-nonce']?.length > 0);
      assert.ok(headers['x-signature']?.length > 0);
    });
  }
});

/*
  #454 / #455: the native address of a `token: 'ario'` client.

  ARIO is an SPL token, so a client built from a private key signs with a Solana
  key. The payment service bills a Solana signature to the raw base58 public
  key (it derives the address from the signature type, not the token). The SDK
  used the Arweave derivation (sha256 of the key) for every `ario` signer, so
  such a client read and reported one account while the service debited and
  implicitly credited another.
*/
describe('native address for token: ario', () => {
  const nativeAddress = (signer: TurboSigner, token: TokenType) =>
    new TurboNodeSigner({ signer, token }).getNativeAddress();

  it('uses the base58 public key for a Solana signer', async () => {
    assert.equal(
      await nativeAddress(new HexSolanaSigner(testSolWallet), 'ario'),
      testSolNativeAddress,
    );
  });

  // A wallet adapter or an injected Solana wallet signs as ED25519 (type 2),
  // not SOLANA (type 4), and the service maps both to the base58 key. Without
  // this case, an implementation that handles only type 4 passes.
  it('uses the base58 public key for an ED25519 signer', async () => {
    const solanaSigner = new HexSolanaSigner(testSolWallet);
    const ed25519Signer = Object.create(
      Object.getPrototypeOf(solanaSigner),
    ) as TurboSigner;
    Object.assign(ed25519Signer, solanaSigner, {
      signatureType: SignatureConfig.ED25519,
    });

    assert.equal(ed25519Signer.signatureType, SignatureConfig.ED25519);
    assert.equal(
      await nativeAddress(ed25519Signer, 'ario'),
      testSolNativeAddress,
    );
  });

  it('matches what the same Solana key reports as token: solana', async () => {
    const signer = new HexSolanaSigner(testSolWallet);
    assert.equal(
      await nativeAddress(signer, 'ario'),
      await nativeAddress(signer, 'solana'),
    );
  });

  // The reported path: a private key plus `token: 'ario'`.
  it('uses the base58 public key for a client built from a private key', async () => {
    const turbo = TurboFactory.authenticated({
      privateKey: testSolWallet,
      token: 'ario',
    });
    assert.equal(await turbo.signer.getNativeAddress(), testSolNativeAddress);
  });

  // An Arweave signer is billed at its Arweave address, so this must not move.
  it('keeps the Arweave address for an Arweave signer', async () => {
    assert.equal(
      await nativeAddress(new ArweaveSigner(testJwk), 'ario'),
      testArweaveNativeB64Address,
    );
  });

  // The SDK's own validator already expects a Solana address for `ario`.
  it('reports an address the SDK itself accepts for token: ario', async () => {
    const address = await nativeAddress(
      new HexSolanaSigner(testSolWallet),
      'ario',
    );
    assert.ok(isValidUserAddress(address, 'ario'));
  });
});
