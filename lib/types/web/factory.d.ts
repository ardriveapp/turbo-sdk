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
import { TurboBaseFactory } from '../common/factory.js';
import { TurboAuthenticatedPaymentService } from '../common/payment.js';
import { TurboDataItemAbstractSigner } from '../common/signer.js';
import { GetTurboSignerParams, TurboAuthenticatedConfiguration, TurboAuthenticatedUploadServiceConfiguration, TurboAuthenticatedUploadServiceInterface } from '../types.js';
export declare class TurboFactory extends TurboBaseFactory {
    protected getSigner({ providedPrivateKey, logger, providedSigner, providedWalletAdapter, token, }: GetTurboSignerParams): TurboDataItemAbstractSigner;
    protected getAuthenticatedUploadService(config: TurboAuthenticatedUploadServiceConfiguration & {
        paymentService: TurboAuthenticatedPaymentService;
    }): TurboAuthenticatedUploadServiceInterface;
    static authenticated({ privateKey, signer: providedSigner, paymentServiceConfig, uploadServiceConfig, token, gatewayUrl, tokenMap, tokenTools, walletAdapter, cuUrl, processId, }: TurboAuthenticatedConfiguration): import("./index.js").TurboAuthenticatedClient;
}
//# sourceMappingURL=factory.d.ts.map