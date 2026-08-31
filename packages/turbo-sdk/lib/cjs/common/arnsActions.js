"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildArNSCustodyMessage = buildArNSCustodyMessage;
exports.arNSOwnerProofHeaders = arNSOwnerProofHeaders;
exports.solanaOwnerSigner = solanaOwnerSigner;
exports.emptySignatureSlots = emptySignatureSlots;
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
const web3_js_1 = require("@solana/web3.js");
const bs58_1 = __importDefault(require("bs58"));
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const base64_js_1 = require("../utils/base64.js");
/**
 * Canonical ACTION-BOUND message for the owner proof.
 *
 * MUST match the bundler's `buildArNSCustodyMessage` byte for byte
 * (newline-delimited) or every signature is rejected. The bundler rebuilds this
 * from the request and verifies the signature over `message + nonce`, so a
 * signature captured for one operation cannot authorize a different one, and
 * the nonce is consumed on use so the same one cannot be replayed (e.g. to
 * revert a record to an older value).
 */
function buildArNSCustodyMessage(action, fields) {
    return ['arns', action, ...fields].join('\n');
}
/** Solana's signature-type discriminator in Turbo's signed-request scheme. */
const SOLANA_SIGNATURE_TYPE = 4;
/**
 * The ANT owner's half of the envelope, in its own `x-owner-*` headers.
 *
 * Two signatures travel on a record action — the PAYER's signed request over
 * `"" + nonce`, and the OWNER's action-bound proof over `message + nonce` —
 * from two different keys, usually on two different chains. They cannot share
 * one header set: whichever verifier ran second would reject a signature that
 * was never meant for it.
 */
async function arNSOwnerProofHeaders(owner, message, nonce) {
    const address = await owner.getAddress();
    const signature = await owner.signMessage(Uint8Array.from(Buffer.from(message + nonce)));
    return {
        // A Solana address IS the base58-encoded 32-byte ed25519 public key, so
        // decoding the address recovers exactly the bytes the bundler verifies
        // against. Keeps ArNSOwnerSigner minimal — no separate getPublicKey().
        'x-owner-public-key': (0, base64_js_1.toB64Url)(Buffer.from(bs58_1.default.decode(address))),
        'x-owner-nonce': nonce,
        'x-owner-signature': (0, base64_js_1.toB64Url)(Buffer.from(signature)),
        'x-owner-signature-type': String(SOLANA_SIGNATURE_TYPE),
    };
}
/**
 * Build an {@link ArNSOwnerSigner} from a raw Solana secret key.
 *
 * For servers and tests. A browser wallet (Phantom, Solflare, or a console's
 * embedded wallet) should implement the interface directly against its own
 * `signTransaction` / `signMessage` rather than exposing a secret key.
 *
 * Note the owner needs a key to SIGN with, not a funded account: Turbo is the
 * fee payer on every sponsored action, so this wallet's SOL balance can stay
 * at zero for the entire life of the name.
 */
function solanaOwnerSigner(secretKey) {
    const keypair = web3_js_1.Keypair.fromSecretKey(typeof secretKey === 'string' ? bs58_1.default.decode(secretKey) : secretKey);
    return {
        getAddress: () => keypair.publicKey.toBase58(),
        signTransaction: async (transactionBase64) => {
            const tx = web3_js_1.VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'));
            // Sign the bytes as returned. Turbo's fee-payer signature already covers
            // this exact message; rebuilding it from parts invalidates that and the
            // submission is rejected.
            tx.sign([keypair]);
            return Buffer.from(tx.serialize()).toString('base64');
        },
        signMessage: async (message) => tweetnacl_1.default.sign.detached(message, keypair.secretKey),
    };
}
/**
 * Count the signature slots a prepared transaction still has empty.
 *
 * Turbo pre-signs as fee payer and leaves exactly one slot for the owner, so a
 * client can assert that before prompting a wallet — a cheap way to catch a
 * malformed or already-signed transaction before bothering the user.
 */
function emptySignatureSlots(transactionBase64) {
    const tx = web3_js_1.VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'));
    return tx.signatures.filter((sig) => sig.every((byte) => byte === 0)).length;
}
