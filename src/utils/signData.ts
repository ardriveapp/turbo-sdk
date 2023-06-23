import { JWKInterface } from "arbundles";
import { AxiosRequestHeaders } from "axios";
import { Buffer } from "buffer";
import { randomBytes } from "crypto";
import { toB64Url } from "./base64";
import Arweave from "arweave";
import { stringToBuffer } from "arweave/node/lib/utils";

export async function signData(
  jwk: JWKInterface,
  dataToSign: string
): Promise<Uint8Array> {
  return await Arweave.crypto.sign(jwk, stringToBuffer(dataToSign), {
    saltLength: 0, // We do not need to salt the signature since we combine with a random UUID
  });
}

export async function signedRequestHeadersFromJwk(
  jwk: JWKInterface,
  nonce: string = randomBytes(16).toString("hex"),
  data = ""
): Promise<AxiosRequestHeaders> {
  const signature = await signData(jwk, data + nonce);

  console.log("nonce", nonce);
  // @ts-expect-error
  return {
    "x-public-key": jwk.n,
    "x-nonce": nonce,
    "x-signature": toB64Url(Buffer.from(signature)),
  };
}
