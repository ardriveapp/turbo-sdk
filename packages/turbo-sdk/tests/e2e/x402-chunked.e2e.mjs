/**
 * x402-paid CHUNKED upload, end to end, through the built SDK.
 *
 * Before this change the SDK refused to chunk an x402 upload — upload.ts
 * explicitly skipped the chunked path for X402Funding, because the bundler had
 * no way to charge for a multipart upload. That capped x402 at the single-item
 * limit no matter how the caller configured chunking.
 *
 * This uploads MORE than that limit over multiple chunks, paying with real
 * Base Sepolia USDC.
 *
 * Usage:
 *   node tests/e2e/x402-chunked.e2e.mjs \
 *     --upload-url http://localhost:3001 \
 *     --key ops-test-wallet-base-sepolia.json
 */
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { TurboFactory, X402Funding } from '../../lib/esm/node/index.js';

const arg = (f, d) => {
  const i = process.argv.indexOf(f);
  return i !== -1 ? process.argv[i + 1] : d;
};
const UPLOAD_URL = arg('--upload-url', 'http://localhost:3001');
const KEY = arg(
  '--key',
  '/opt/ar-io-bundler/ops-test-wallet-base-sepolia.json',
);
const PAYMENT_URL = arg('--payment-url', 'http://localhost:4001');

let failures = 0;
const ok = (m) => console.log(`   PASS  ${m}`);
const bad = (m) => {
  failures++;
  console.log(`   FAIL  ${m}`);
};
const check = (c, g, b) => (c ? ok(g) : bad(b ?? g));

const keyfile = JSON.parse(readFileSync(KEY, 'utf8'));
const privateKey = keyfile.privateKey;
const wallet = keyfile.address;

console.log('============================================================');
console.log('x402 CHUNKED upload — real Base Sepolia USDC');
console.log(`upload: ${UPLOAD_URL}`);
console.log('============================================================');

try {
  const turbo = TurboFactory.authenticated({
    privateKey,
    token: 'base-usdc',
    uploadServiceConfig: { url: UPLOAD_URL },
  });

  // Comfortably over the 5 MiB minimum chunk size, so this MUST chunk, and
  // over the old single-request x402 ceiling.
  const bytes = 8 * 1024 * 1024;
  const payload = randomBytes(bytes);

  // What the bundler says this costs, so we can assert we were charged that
  // and not something else. A chunked upload settles at CREATE, on the
  // declared byte count, so the quote must line up with the real charge.
  //
  // Quote from the PAYMENT service, which is what the multipart create and the
  // single-shot x402 post both settle against. The upload service also exposes
  // /price/x402/data-item/..., but that is a public estimate on different math
  // (it read ~19% higher here) and drifts between calls with the AR/USD rate —
  // asserting against it fails a correct charge.
  const quote = await fetch(
    `${PAYMENT_URL}/v1/x402/price/3/${wallet}?bytes=${bytes + 150}`,
  ).then((r) => r.json());
  const quoted = BigInt(quote.accepts[0].maxAmountRequired);
  console.log(
    `   quote: ${quoted} base units ($${(Number(quoted) / 1e6).toFixed(4)})`,
  );

  const usdc = async () => {
    const res = await fetch('https://sepolia.base.org', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_call',
        params: [
          {
            to: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
            data:
              '0x70a08231000000000000000000000000' +
              wallet.slice(2).toLowerCase(),
          },
          'latest',
        ],
      }),
    }).then((r) => r.json());
    return BigInt(res.result);
  };
  const before = await usdc();
  console.log(`   USDC before: ${before}`);

  console.log(
    `\n-- uploading ${(bytes / 1024 / 1024).toFixed(
      0,
    )} MiB with X402Funding --`,
  );
  const res = await turbo.upload({
    data: payload,
    // Above x402-fetch's 0.10 USDC default cap; 12 MiB quotes ~$0.44.
    fundingMode: new X402Funding({ maxMUSDCAmount: 2_000_000 }),
    chunkingMode: 'force',
  });

  check(!!res?.id, `upload completed, id ${String(res?.id).slice(0, 24)}...`);
  check(!!res?.owner, `receipt owner ${String(res?.owner).slice(0, 16)}...`);

  const after = await usdc();
  const spent = before - after;
  console.log(`   USDC after:  ${after}  (spent ${spent})`);
  // The quote is taken on an estimated size (the exact data-item header length
  // is not known here) and the AR/USD rate moves between calls, so a few
  // percent is expected. The point of the assertion is the order of magnitude:
  // it catches paying N times over (the retry loop re-buying the upload) and
  // unit mistakes, which is where the real bugs have been.
  const ratio = Number(spent) / Number(quoted);
  check(
    ratio > 0.9 && ratio < 1.1,
    `charged once, within 10% of quote (${spent} vs ${quoted}, ${ratio.toFixed(
      3,
    )}x)`,
    `charged ${spent} against a quote of ${quoted} (${ratio.toFixed(
      3,
    )}x) — a ratio near a whole number means the upload was paid for more than once`,
  );
  ok('-> an x402 upload past the single-request ceiling, over multiple chunks');
} catch (error) {
  bad(`threw: ${error?.message ?? error}`);
  if (process.env.DEBUG) console.error(error);
}

console.log('\n============================================================');
console.log(
  failures === 0
    ? 'PASSED - x402 chunked upload'
    : `FAILED - ${failures} check(s)`,
);
console.log('============================================================');
process.exit(failures === 0 ? 0 : 1);
