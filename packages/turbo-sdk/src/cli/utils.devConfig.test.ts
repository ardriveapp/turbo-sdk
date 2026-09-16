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
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  developmentPaymentServiceURL,
  developmentTurboConfiguration,
  developmentUploadServiceURL,
} from '../node/index.js';
import { GlobalOptions } from './types.js';
import { configFromOptions } from './utils.js';

// The ar.io testnet sandbox. The previous development hosts, on ardrive.dev,
// no longer resolve, so `--dev` and `developmentTurboConfiguration` failed
// every request.
const sandboxPaymentURL = 'https://payment.services.ar-io.dev';
const sandboxUploadURL = 'https://upload.services.ar-io.dev';

describe('development configuration', () => {
  it('points at the ar.io testnet sandbox', () => {
    assert.equal(developmentPaymentServiceURL, sandboxPaymentURL);
    assert.equal(developmentUploadServiceURL, sandboxUploadURL);
    assert.deepEqual(developmentTurboConfiguration, {
      paymentServiceConfig: { url: sandboxPaymentURL },
      uploadServiceConfig: { url: sandboxUploadURL },
    });
  });

  it('is what the CLI uses for --dev, with a testnet gateway', () => {
    const config = configFromOptions({
      dev: true,
      token: 'solana',
    } as GlobalOptions);

    assert.equal(config.paymentServiceConfig?.url, sandboxPaymentURL);
    assert.equal(config.uploadServiceConfig?.url, sandboxUploadURL);
    assert.equal(config.gatewayUrl, 'https://api.devnet.solana.com');
  });
});
