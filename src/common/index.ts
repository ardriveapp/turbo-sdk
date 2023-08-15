import { AxiosInstance, AxiosResponse } from "axios";
import {
  TopUpResponse,
  TurboBlobUpload,
  TurboFileUpload,
  TurboService,
  TurboSettings,
  UploadDataItemResponse,
  UploadDataItemResultMap,
  UploadDataItemsResult,
} from "../types/turboTypes";
import { JWKInterface } from "arbundles";
import winston from "winston";
import { createAxiosInstance } from "../utils/axiosClient";
import { ByteCount } from "../types/byteCount";
import { Winc, W } from "../types/winc";
import { signedRequestHeadersFromJwk } from "../utils/signData";
import { Payment } from "../types/payment";
import { TopUpQuote } from "../types/types";
import { PassThrough } from "stream";
import { jwkToPublicArweaveAddress } from "../utils/base64";

export abstract class BaseTurboClient implements TurboService {
  readonly jwk: JWKInterface | undefined;
  readonly paymentService: AxiosInstance;
  readonly uploadService: AxiosInstance;
  readonly logger = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    defaultMeta: { service: "turbo-client" },
    transports: [
      new winston.transports.Console({
        format: winston.format.simple(),
      }),
    ],
  });

  constructor({
    paymentUrl = "https://payment.ardrive.dev",
    uploadUrl = "https://upload.ardrive.dev",
    retries = 3,
    jwk,
  }: TurboSettings) {
    this.paymentService = createAxiosInstance({
      config: {
        baseURL: `${paymentUrl}/v1`,
        validateStatus: () => true,
      },
      retries,
    });
    this.uploadService = createAxiosInstance({
      config: {
        baseURL: `${uploadUrl}/v1`,
        validateStatus: () => true,
      },
      retries,
    });
    this.jwk = jwk;
  }

  async getWincEstimationForByteCount(byteCount: ByteCount): Promise<Winc> {
    const { status, statusText, data } = await this.paymentService.get(
      `/price/bytes/${byteCount}`,
    );
    if (status !== 200) {
      throw new Error(statusText);
    }
    return W(data.winc);
  }

  async getWincEstimationForPayment({ amount, type }: Payment): Promise<Winc> {
    const { status, statusText, data } = await this.paymentService.get(
      `/price/${type}/${amount}`,
    );
    if (status !== 200) {
      throw new Error(statusText);
    }
    return W(data.winc);
  }

  async getWincBalance(): Promise<Winc> {
    if (!this.jwk) {
      throw new Error("JWK required in client configuration.");
    }
    const headers = await signedRequestHeadersFromJwk(this.jwk);
    const { data, status, statusText } = await this.paymentService.get(
      `/balance`,
      {
        headers,
      },
    );

    if (status === 404) {
      return W(0);
    }

    if (status !== 200) {
      throw Error(statusText);
    }

    return W(data.winc);
  }

  async topUp(_topUp: TopUpQuote): Promise<TopUpResponse> {
    throw new Error("Not implemented");
  }

  async prepareDataItems(
    _files: TurboFileUpload[] | TurboBlobUpload[],
  ): Promise<PassThrough[] | Uint8Array[]> {
    throw new Error("Not implemented");
  }

  async upload(
    files: TurboFileUpload[] | TurboBlobUpload[],
  ): Promise<UploadDataItemsResult> {
    if (!this.jwk) {
      throw new Error("JWK required in client configuration.");
    }

    const preparedDataItems = await this.prepareDataItems(files);
    // TODO: add p-limit constraint
    const uploadPromises = preparedDataItems.map((dataItemData) => {
      return this.uploadService.post<UploadDataItemResponse>(
        `/tx`,
        dataItemData,
        {
          headers: {
            "content-type": "application/octet-stream",
          },
        },
      );
    });

    const dataItemResponses = await Promise.allSettled(uploadPromises);
    const dataItems = dataItemResponses.reduce(
      (
        dataItems: UploadDataItemResultMap,
        dataItemResponse:
          | PromiseFulfilledResult<AxiosResponse<UploadDataItemResponse>>
          | PromiseRejectedResult,
      ) => {
        // NOTE: with validateStatus set to true on the axios config we could use Promise.all and remove this check
        if (dataItemResponse.status === "rejected") {
          this.logger.error(dataItemResponse.reason);
          return dataItems;
        }
        // handle the fulfilled response
        const { status, data, statusText } = dataItemResponse.value;
        if (![200, 202].includes(status)) {
          this.logger.error(statusText);
          // TODO: add to failed data items array
          return dataItems;
        }
        const { id, ...dataItemCache } = data;
        dataItems[id] = dataItemCache;
        return dataItems;
      },
      {},
    );

    return {
      dataItems,
      ownerAddress: jwkToPublicArweaveAddress(this.jwk),
    };
  }
}
