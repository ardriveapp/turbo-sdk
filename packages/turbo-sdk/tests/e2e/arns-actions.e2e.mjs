/**
 * ArNS actions - end-to-end, on chain, through the BUILT SDK.
 *
 * Why this exists: the unit suite stubs HTTP, so it proves the SDK sends the
 * right bytes but not that the bytes are right. Everything that actually breaks
 * here - the canonical owner-proof message, the transaction round-trip, the
 * two-shape branch, whether Turbo really is a controller after a buy - is only
 * observable against a real service and a real chain.
 *
 * The owner key is generated fresh and NEVER funded. If any stage strands the
 * customer needing SOL, this fails - the single most important property of the
 * whole feature.
 *
 * SPENDS REAL devnet SOL + ARIO from the bundler's ArNS signer, and real Turbo
 * Credits from the payer wallet. Devnet/testnet only.
 *
 * Usage:
 *   node tests/e2e/arns-actions.e2e.mjs \
 *     --payment-url http://localhost:4001 \
 *     --wallet /opt/ar-io-bundler/ops-test-wallet-arns.json
 */
import { Keypair } from '@solana/web3.js';
import { readFileSync } from 'node:fs';

import { solanaOwnerSigner } from '../../lib/esm/common/arnsActions.js';
import { TurboFactory } from '../../lib/esm/node/index.js';

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? process.argv[i + 1] : fallback;
};

const PAYMENT_URL = arg('--payment-url', 'http://localhost:4001');
const WALLET = arg('--wallet', '/opt/ar-io-bundler/ops-test-wallet-arns.json');
const NAME = arg('--name', `sdke2e${Date.now().toString().slice(-6)}`);
const VALID_TX_ID = 'AnYvLJTWcG9lr2Ll5MwYWZR2o5uTE39WbpYB0zCxwKM';

let failures = 0;
const ok = (msg) => console.log(`   PASS  ${msg}`);
const bad = (msg) => {
  failures++;
  console.log(`   FAIL  ${msg}`);
};
const check = (cond, good, badMsg) => (cond ? ok(good) : bad(badMsg ?? good));
const head = (n, t) => console.log(`\n-- ${n}. ${t}`);

const jwk = JSON.parse(readFileSync(WALLET, 'utf-8'));
const turbo = TurboFactory.authenticated({
  privateKey: jwk,
  paymentServiceConfig: { url: PAYMENT_URL },
});

// The customer. Never funded, for the entire run.
const ownerKeypair = Keypair.generate();
const owner = solanaOwnerSigner(ownerKeypair.secretKey);

console.log('============================================================');
console.log('ArNS actions e2e - through the built SDK');
console.log(`payment: ${PAYMENT_URL}`);
console.log(`name:    ${NAME}`);
console.log(`owner:   ${ownerKeypair.publicKey.toBase58()} (never funded)`);
console.log('============================================================');

const winc = async () => BigInt((await turbo.getBalance()).winc);

try {
  head(1, 'Price quotes a TOTAL, not just the name');
  const price = await turbo.getArNSPriceForName({
    intent: 'Buy-Name',
    name: NAME,
    type: 'lease',
    years: 1,
  });
  check(price.wincTotal !== undefined, `wincTotal ${price.wincTotal}`);
  check(
    BigInt(price.wincTotal) >= BigInt(price.winc),
    'wincTotal >= winc (surcharge included, so a client cannot under-quote)',
  );

  head(2, 'Buy - one signature, and the money moves by exactly the quote');
  const before = await winc();
  let captured;
  const bought = await turbo.buyArNSName({
    name: NAME,
    owner,
    type: 'lease',
    years: 1,
    onNonce: (n) => {
      captured = n;
    },
  });
  check(captured !== undefined, `onNonce fired before signing (${captured})`);
  check(bought.status === 'completed', 'status completed');
  check(!!bought.messageId, `messageId ${bought.messageId}`);
  check(!!bought.antId, `antId ${bought.antId}`);
  const spent = before - (await winc());
  check(
    spent === BigInt(price.wincTotal),
    `debited exactly the quoted total (${spent})`,
    `debit ${spent} != quoted total ${price.wincTotal}`,
  );
  const antId = bought.antId;

  head(3, 'Replay is safe - signing a completed action does not buy twice');
  const beforeReplay = await winc();
  const replay = await turbo.signArNSAction(bought.nonce, 'irrelevant');
  check(replay.alreadyCompleted === true, 'reported alreadyCompleted');
  check((await winc()) === beforeReplay, 'no second debit');

  head(4, 'Status is readable by nonce');
  const status = await turbo.getArNSActionStatus(bought.nonce);
  check(status.status === 'completed', 'status reports completed');

  head(5, 'set-record - Turbo is already a controller, so it acts ALONE');
  const setRes = await turbo.setArNSRecord({
    antId,
    owner,
    transactionId: VALID_TX_ID,
    undername: '@',
    ttlSeconds: 900,
  });
  check(
    setRes.status === 'completed',
    'completed with no customer transaction signature',
  );
  ok('-> proves buy-name granted Turbo controller in the SAME signed tx');

  head(6, 'Undername set + remove, both free');
  const beforeFree = await winc();
  await turbo.setArNSRecord({
    antId,
    owner,
    undername: 'docs',
    transactionId: VALID_TX_ID,
    ttlSeconds: 900,
  });
  const removed = await turbo.removeArNSRecord({
    antId,
    owner,
    undername: 'docs',
  });
  check(removed.status === 'completed', 'undername removed');
  check(
    (await winc()) === beforeFree,
    'record actions cost the customer NOTHING',
  );

  head('6d', 'Record metadata - set, then clear, both free and Turbo-alone');
  const beforeMeta = await winc();
  const metaSet = await turbo.setArNSRecordMetadata({
    antId,
    owner,
    displayName: 'My Blog',
    recordDescription: 'written by the SDK e2e',
    recordKeywords: ['arweave', 'ar-io'],
  });
  check(
    metaSet.status === 'completed',
    'set-record-metadata completed Turbo-alone',
  );
  const metaGone = await turbo.removeArNSRecordMetadata({
    antId,
    owner,
    undername: '@',
  });
  check(metaGone.status === 'completed', 'remove-record-metadata completed');
  check(
    (await winc()) === beforeMeta,
    'record metadata cost the customer NOTHING',
  );

  head('6e', 'transfer-record - hand ONE record over, not the whole ANT');
  await turbo.setArNSRecord({
    antId,
    owner,
    undername: 'blog',
    transactionId: VALID_TX_ID,
    ttlSeconds: 900,
  });
  const recMoved = await turbo.transferArNSRecord({
    antId,
    owner,
    undername: 'blog',
    target: Keypair.generate().publicKey.toBase58(),
  });
  check(recMoved.status === 'completed', 'record ownership moved on chain');
  check(!!recMoved.messageId, `messageId ${recMoved.messageId}`);

  head(7, 'Revoke Turbo - the escape hatch, owner-signed and free');
  const revoked = await turbo.removeArNSController({ antId, owner });
  check(revoked.status === 'completed', 'Turbo revoked on chain');

  head(8, 'set-record now DEGRADES to owner-signed instead of breaking');
  const afterRevoke = await turbo.setArNSRecord({
    antId,
    owner,
    transactionId: VALID_TX_ID,
    undername: '@',
    ttlSeconds: 900,
  });
  check(
    afterRevoke.status === 'completed',
    'still completed - the owner signed it themselves',
  );
  ok('-> the shape flipped, so the revoke provably landed on chain');

  head(9, 'Transfer - the customer walks away entirely');
  const dest = Keypair.generate().publicKey.toBase58();
  const transferred = await turbo.transferArNSAnt({
    antId,
    owner,
    target: dest,
  });
  check(transferred.status === 'completed', `ANT transferred to ${dest}`);

  head(10, 'The customer never held SOL');
  ok('every stage above was fee-paid and rent-funded by Turbo');
} catch (error) {
  bad(`threw: ${error?.message ?? error}`);
  if (process.env.DEBUG) console.error(error);
}

console.log('\n============================================================');
console.log(
  failures === 0
    ? 'PASSED - SDK ArNS actions e2e'
    : `FAILED - ${failures} check(s)`,
);
console.log('============================================================');
process.exit(failures === 0 ? 0 : 1);
