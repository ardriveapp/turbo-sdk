import { JWKInterface } from "arweave/node/lib/wallet";
import { createData } from "arbundles/file";
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
import axios from "axios";
import { signedRequestHeadersFromJwk } from "./utils/signData";
import { createReadStream } from "fs";
import { ArweaveSigner } from "arbundles/node";

class ArDriveTurbo implements Turbo {
  protected readonly paymentUrl: string;
  protected readonly uploadUrl: string;

  constructor({
    paymentUrl = "https://payment.ardrive.dev",
    uploadUrl = /* "http://localhost:3000",*/ "https://upload.ardrive.dev",
  }: TurboSettings) {
    this.paymentUrl = paymentUrl;
    this.uploadUrl = uploadUrl;
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
      paymentIntent: {},
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

export default class AuthArDriveTurbo
  extends ArDriveTurbo
  implements AuthTurbo
{
  private readonly jwk: JWKInterface;

  constructor(settings: AuthTurboSettings) {
    super(settings);
    this.jwk = settings.jwk;
  }

  public async getWincBalance(): Promise<Winc> {
    const headers = await signedRequestHeadersFromJwk(this.jwk);
    const { data } = await axios.get(`${this.paymentUrl}/v1/balance`, {
      headers,
    });
    return W(data.winc);
  }

  public async upload(files: UploadParams[]): Promise<UploadResult> {
    const uploadResult: UploadResult = {
      dataItems: {},
      ownerAddress: jwkToPublicArweaveAddress(this.jwk),
    };

    const signer = new ArweaveSigner(this.jwk);

    for (const file of files) {
      const dataItem = await createData(
        createReadStream(file.filePath),
        signer,
        file.options
      );
      await dataItem.sign(signer);

      const size = await dataItem.size();

      const { data } = await axios.post<{
        id: string;
        owner: string;
        dataCaches: string[];
        fastFinalityIndexes: string[];
      }>(`${this.uploadUrl}/v1/tx`, createReadStream(dataItem.filename), {
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
