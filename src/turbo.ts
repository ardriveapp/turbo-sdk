/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { JWKInterface } from "arweave/node/lib/wallet";
import { createData , ArweaveSigner } from "arbundles";
import { W, Winc } from "./types/winc";
import { ByteCount } from "./types/byteCount";
import { Payment } from "./types/payment";
import { UserAddress } from "./types/types";
import {
  AuthTurbo,
  AuthTurboSettings,
  CardDetails,
  PaymentConfirmation,
  PaymentSessionParams,
  TopUpCheckoutSession,
  TopUpPaymentIntent,
  Turbo,
  TurboSettings,
  UploadParams,
  UploadResult,
} from "./types/turboTypes";
import { jwkToPublicArweaveAddress } from "./utils/base64";
import { signedRequestHeadersFromJwk } from "./utils/signData";
import { readFileSync } from "fs";
import { createAxiosInstance } from "./utils/axiosClient";
import { AxiosInstance } from "axios";
import { isBrowser } from "./constants";

export class ArDriveTurbo implements Turbo {
  protected readonly paymentUrl: string;
  protected readonly uploadUrl: string;
  protected readonly axios: AxiosInstance;

  constructor({
    paymentUrl = "https://payment.ardrive.dev",
    uploadUrl = /* "http://localhost:3000", */ "https://upload.ardrive.dev",
    axiosClient = createAxiosInstance({
      config: { validateStatus: () => true },
    }),
  }: TurboSettings) {
    this.paymentUrl = paymentUrl;
    this.uploadUrl = uploadUrl;
    this.axios = axiosClient;
  }

  public async getWincEstimationForByteCount(
    byteCount: ByteCount
  ): Promise<Winc> {
    // TODO
    return W(byteCount.toString());
  }

  public async getWincEstimationForPayment(payment: Payment): Promise<Winc> {
    // TODO
    return W(payment.amount);
  }

  public async getTopUpCheckoutSession({
    destinationAddress,
    payment,
  }: PaymentSessionParams): Promise<TopUpCheckoutSession> {
    return {
      checkoutUrl: "TODO",
      topUpQuote: { destinationAddress, paymentAmount: payment.amount },
    };
  }

  public async getTopUpPaymentIntent({
    destinationAddress,
    payment,
  }: {
    destinationAddress: UserAddress;
    payment: Payment;
  }): Promise<TopUpPaymentIntent> {
    // TODO
    return {
      paymentIntent: {
        id: "TODO",
      },
      topUpQuote: { destinationAddress, paymentAmount: payment.amount },
    };
  }

  public async confirmPaymentIntent(
    cardDetails: CardDetails
  ): Promise<PaymentConfirmation> {
    // TODO
    console.log(cardDetails);
    return { newBalance: W(123) };
  }
}

export class AuthArDriveTurbo extends ArDriveTurbo implements AuthTurbo {
  private readonly jwk: JWKInterface;

  constructor(settings: AuthTurboSettings) {
    super(settings);
    this.jwk = settings.jwk;
  }

  public async getWincBalance(): Promise<Winc> {
    const headers = await signedRequestHeadersFromJwk(this.jwk);
    const { data, status } = await this.axios.get(
      `${this.paymentUrl}/v1/balance`,
      {
        headers,
      }
    );

    if (status === 404 && data === "User Not Found") {
      return W(0);
    }

    return W(data.winc);
  }

  public async upload(files: UploadParams[]): Promise<UploadResult> {
    const uploadResult: UploadResult = {
      dataItems: {},
      ownerAddress: jwkToPublicArweaveAddress(this.jwk),
    };

    const signer = new ArweaveSigner(this.jwk);

    for (const file of files) {
      let fileData: Uint8Array;

      if (isBrowser && file.data instanceof Blob) {
        fileData = new Uint8Array(await file.data.arrayBuffer()); // Convert Blob to Uint8Array
      } else {
        fileData = readFileSync(file.filePath);
      }

      const dataItem = createData(fileData, signer, file.options);
      await dataItem.sign(signer);

      const size = dataItem.data.length;

      const requestData: unknown = dataItem.getRaw();

      const { data } = await this.axios.post<{
        id: string;
        owner: string;
        dataCaches: string[];
        fastFinalityIndexes: string[];
      }>(`${this.uploadUrl}/v1/tx`, requestData, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Length": size,
        },
      });

      const { dataCaches, fastFinalityIndexes, id } = data;

      uploadResult.dataItems[id] = {
        byteCount: size,
        dataCaches,
        fastFinalityIndexes,
      };
    }
    
    return uploadResult;
  }
}
