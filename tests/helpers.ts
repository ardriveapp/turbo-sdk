import Arweave from '@irys/arweave';
import axios from 'axios';
import bs58 from 'bs58';
import { expect } from 'chai';
import { JsonRpcProvider, parseEther } from 'ethers';
import * as fs from 'fs';

import { sleep } from '../src/utils/common.js';

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
export const testWalletAddress = 'sYFSpEH7Gls-5Spq5FjuP85JCZj6QYzNvCm9BdKEJs4';
export const testJwk = JSON.parse(
  fs.readFileSync(
    new URL(`wallets/${testWalletAddress}.json`, import.meta.url).pathname,
    'utf-8',
  ),
);

export const testEthAddressBase64 =
  '3wfoux4MjIabQXIxtQ3h2jXs-FMAt3Uw1xmkbRcOtLE';
export const testEthNativeAddress =
  '0x20c1DF6f3310600c8396111EB5182af9213828Dc';
export const testEthWallet = fs.readFileSync(
  new URL(`wallets/${testEthNativeAddress}.eth.pk.txt`, import.meta.url)
    .pathname,
  'utf-8',
);

export async function fundETHWallet() {
  const provider = new JsonRpcProvider(ethereumGatewayUrl);

  const [account] = await provider.listAccounts();
  const transaction = {
    to: testEthNativeAddress,
    value: parseEther('100'), // Change the amount as necessary
  };

  const txResponse = await account.sendTransaction(transaction);
  await txResponse.wait();
  await provider.send('evm_mine', []);

  console.log(`Funded ${testEthNativeAddress} with 100 Ether.`);
}

export const testSolAddressBase64 =
  'AlZOxuKT1uJTpCPb3FH76z31MunxMfQWfm7F1n2QiN4';
export const testSolBase58Address =
  'BTV1zY7njS5an91v9nphCK48d2vnMuecEgHLYiP25ycj'; // cspell:enable
export const testSolWallet = bs58.encode(
  JSON.parse(
    fs.readFileSync(
      new URL(`wallets/${testSolBase58Address}.sol.sk.json`, import.meta.url)
        .pathname,
      'utf-8',
    ),
  ),
);

export const testKyveMnemonic = // cspell:disable
  'industry addict wink hero diet bitter obscure need melt road fuel error category jealous eye cushion castle satoshi hungry clean observe lobster normal lazy';
export const testKyveAddress = 'kyve1xddfun7awnee70xdq5fnt5ja3vxh93v3dj4k8v';
export const base64KyveAddress = 'Rdhf8cqIdoeb7scy9l0d1iVmhu6nmRJIGR-V7YQPKy8'; // cspell:enable

const arweaveUrlString = process.env.ARWEAVE_GATEWAY ?? 'http://localhost:1984';
const arweaveUrl = new URL(arweaveUrlString);
export const testArweave = Arweave.init({
  url: arweaveUrl,
});

export const solanaUrlString = // TODO: Local SOL net in integration test
  process.env.SOLANA_GATEWAY ?? 'https://api.devnet.solana.com';

export const ethereumGatewayUrl = // TODO: Local ETH net in integration test -- 'http://localhost:8545'
  process.env.ETHEREUM_GATEWAY ?? 'https://ethereum-holesky-rpc.publicnode.com'; // holesky testnet rpc

export const kyveUrlString = // TODO: Local KYVE net in integration test
  process.env.KYVE_GATEWAY ?? 'https://api.korellia.kyve.network';

export async function fundArLocalWalletAddress(address: string): Promise<void> {
  await testArweave.api.get(`mint/${address}/9999999999999999`);
}

export async function mineArLocalBlock(numBlocks = 1): Promise<void> {
  await testArweave.api.get(`mine/${numBlocks}`);
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
