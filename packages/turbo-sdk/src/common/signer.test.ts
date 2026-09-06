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
} from '@dha-team/arbundles';
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { testEthWallet, testJwk, testSolWallet } from '../../tests/helpers.js';
import { TurboNodeSigner } from '../node/signer.js';
import { TokenType, TurboSigner } from '../types.js';

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
