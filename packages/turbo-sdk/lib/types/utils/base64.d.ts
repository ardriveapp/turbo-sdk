import { JWKInterface } from '../common/jwk.js';
import { Base64String, PublicArweaveAddress } from '../types.js';
export declare const base64URLRegex: RegExp;
export declare function jwkToPublicArweaveAddress(jwk: JWKInterface): PublicArweaveAddress;
export declare function ownerToAddress(owner: Base64String): PublicArweaveAddress;
export declare function fromB64Url(input: Base64String): Buffer;
export declare function toB64Url(buffer: Buffer): Base64String;
export declare function sha256B64Url(input: Buffer): Base64String;
//# sourceMappingURL=base64.d.ts.map