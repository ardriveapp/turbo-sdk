import { KeyObject, createPrivateKey, createPublicKey } from "crypto";

export interface JWKPublicInterface {
  kty: string;
  e: string;
  n: string;
}

export interface JWKInterface extends JWKPublicInterface {
  d?: string;
  p?: string;
  q?: string;
  dp?: string;
  dq?: string;
  qi?: string;
}

export function jwkInterfaceToPublicKey(jwk: JWKInterface): KeyObject {
  const publicKey = createPublicKey({
    key: {
      ...jwk,
      kty: "RSA",
    },
    format: "jwk",
  });

  return publicKey;
}

export function jwkInterfaceToPrivateKey(jwk: JWKInterface): KeyObject {
  const privateKey = createPrivateKey({
    key: {
      ...jwk,
      kty: "RSA",
    },
    format: "jwk",
  });

  return privateKey;
}
