"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.base64URLRegex = void 0;
exports.jwkToPublicArweaveAddress = jwkToPublicArweaveAddress;
exports.ownerToAddress = ownerToAddress;
exports.fromB64Url = fromB64Url;
exports.toB64Url = toB64Url;
exports.sha256B64Url = sha256B64Url;
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
const utils_js_1 = require("arweave/node/lib/utils.js");
const crypto_1 = require("crypto");
exports.base64URLRegex = /^[a-zA-Z0-9_-]{43}$/;
function jwkToPublicArweaveAddress(jwk) {
    return ownerToAddress(jwk.n);
}
function ownerToAddress(owner) {
    return sha256B64Url(fromB64Url(owner));
}
function fromB64Url(input) {
    const paddingLength = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
    const base64 = input
        .replace(/-/g, '+')
        .replace(/_/g, '/')
        .concat('='.repeat(paddingLength));
    return Buffer.from(base64, 'base64');
}
function toB64Url(buffer) {
    return (0, utils_js_1.bufferTob64Url)(Uint8Array.from(buffer));
}
function sha256B64Url(input) {
    return toB64Url((0, crypto_1.createHash)('sha256').update(Uint8Array.from(input)).digest());
}
