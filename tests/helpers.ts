import Arweave from 'arweave';
import { expect } from 'chai';
import * as fs from 'fs';

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

/**
 * Local wallet allow listed for tests
 */
export const testWalletAddress = 'sYFSpEH7Gls-5Spq5FjuP85JCZj6QYzNvCm9BdKEJs4';
export const testJwk = JSON.parse(
  fs.readFileSync(
    new URL(`wallets/${testWalletAddress}.json`, import.meta.url).pathname,
    'utf-8',
  ),
);

export async function fundArLocalWalletAddress(
  arweave: Arweave,
  address: string,
): Promise<void> {
  await arweave.api.get(`mint/${address}/9999999999999999`);
}

export async function mineArLocalBlock(arweave: Arweave): Promise<void> {
  await arweave.api.get('mine');
}
