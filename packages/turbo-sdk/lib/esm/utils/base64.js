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
import { bufferTob64Url } from 'arweave/node/lib/utils.js';
import { createHash } from 'crypto';
export const base64URLRegex = /^[a-zA-Z0-9_-]{43}$/;
export function jwkToPublicArweaveAddress(jwk) {
    return ownerToAddress(jwk.n);
}
export function ownerToAddress(owner) {
    return sha256B64Url(fromB64Url(owner));
}
export function fromB64Url(input) {
    const paddingLength = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
    const base64 = input
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .concat('='.repeat(paddingLength));
    return Buffer.from(base64, 'base64');
}
export function toB64Url(buffer) {
    return bufferTob64Url(Uint8Array.from(buffer));
}
export function sha256B64Url(input) {
    return toB64Url(createHash('sha256').update(Uint8Array.from(input)).digest());
}
