import Arweave from 'arweave';
import axios from 'axios';
import { expect } from 'chai';
import * as fs from 'fs';

import { sleep } from '../src/utils/common';

interface expectAsyncErrorThrowParams {
  promiseToError: Promise<unknown>;

  // errorType: 'Error' | 'TypeError' | ...
  errorType?: string;
  errorMessage?: string;
}

/**
 * Test helper function that takes a promise and will expect a caught error
 *
 * @param promiseToError the promise on which to expect a thrown error
 * @param errorType type of error to expect, defaults to 'Error'
 * @param errorMessage exact error message to expect
 * */
export async function expectAsyncErrorThrow({
  promiseToError,
  errorType = 'Error',
  errorMessage,
}: expectAsyncErrorThrowParams): Promise<void> {
  let error: null | Error = null;
  try {
    await promiseToError;
  } catch (err) {
    error = err as Error | null;
  }

  expect(error?.name).to.equal(errorType);

  if (errorMessage) {
    expect(error?.message).to.equal(errorMessage);
  }
}

/**
 * Used to setup our local development configuration
 */
export const turboDevelopmentConfigurations = {
  paymentServiceConfig: {
    url: process.env.PAYMENT_SERVICE_URL ?? 'https://payment.ardrive.dev',
  },
  uploadServiceConfig: {
    url: process.env.UPLOAD_SERVICE_URL ?? 'https://upload.ardrive.dev',
  },
};

// cspell:disable
/**
 * Local wallet allow listed for tests
 */
export const testWalletAddress = 'sYFSpEH7Gls-5Spq5FjuP85JCZj6QYzNvCm9BdKEJs4'; // cspell:enable
export const testJwk = JSON.parse(
  fs.readFileSync(
    new URL(`wallets/${testWalletAddress}.json`, import.meta.url).pathname,
    'utf-8',
  ),
);

const urlString = process.env.ARWEAVE_GATEWAY ?? 'http://localhost:1984';
const arweaveUrl = new URL(urlString);
export const testArweave = Arweave.init({
  host: arweaveUrl.hostname,
  port: +arweaveUrl.port,
  protocol: arweaveUrl.protocol.replace(':', ''),
});

export async function fundArLocalWalletAddress(address: string): Promise<void> {
  await testArweave.api.get(`mint/${address}/9999999999999999`);
}

export async function mineArLocalBlock(): Promise<void> {
  await testArweave.api.get('mine');
}

export async function sendFundTransaction(quantity = 1000): Promise<string> {
  const paymentUrl = new URL(
    turboDevelopmentConfigurations.paymentServiceConfig.url,
  );
  const target = (await axios.get(`${paymentUrl}info`)).data.addresses.arweave;
  const tx = await testArweave.createTransaction({
    quantity: `${quantity}`,
    target,
  });

  await testArweave.transactions.sign(tx, testJwk);

  await testArweave.transactions.post(tx);
  return tx.id;
}

export async function getRawBalance(address: string): Promise<string> {
  return (
    (
      await axios.get(
        `${turboDevelopmentConfigurations.paymentServiceConfig.url}/v1/account/balance?address=${address}`,
        { validateStatus: () => true },
      )
    ).data?.winc ?? '0'
  );
}

export async function delayedBlockMining(
  numBlocks = 3,
  delayMs = 5,
): Promise<void> {
  let blocksMined = 0;
  while (blocksMined < numBlocks) {
    await sleep(delayMs);
    await mineArLocalBlock();
    blocksMined++;
  }
}
