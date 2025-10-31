import Arweave from 'arweave';
import axios from 'axios';
import bs58 from 'bs58';
import { JsonRpcProvider, parseEther } from 'ethers';
import * as fs from 'fs';
import { strict as assert } from 'node:assert';

import { defaultRetryConfig } from '../src/utils/axiosClient.js';
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

  assert.equal(error?.name, errorType);

  if (errorMessage) {
    assert.equal(error?.message, errorMessage);
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

const testEnvRetryConfig = () => {
  const config = defaultRetryConfig();
  config.retryDelay = () => 0; // no delay in tests
  return config;
};

export const turboTestEnvConfigurations = {
  paymentServiceConfig: {
    ...turboDevelopmentConfigurations.paymentServiceConfig,
    retryConfig: testEnvRetryConfig(),
  },
  uploadServiceConfig: {
    ...turboDevelopmentConfigurations.uploadServiceConfig,
    retryConfig: testEnvRetryConfig(),
  },
};

// cspell:disable
/**
 * Local wallet allow listed for tests
 */
export const testArweaveNativeB64Address =
  'sYFSpEH7Gls-5Spq5FjuP85JCZj6QYzNvCm9BdKEJs4';
export const testJwk = JSON.parse(
  fs.readFileSync(
    new URL(`wallets/${testArweaveNativeB64Address}.json`, import.meta.url)
      .pathname,
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
export const testSolNativeAddress =
  'BTV1zY7njS5an91v9nphCK48d2vnMuecEgHLYiP25ycj'; // cspell:enable
export const testSolWallet = bs58.encode(
  JSON.parse(
    fs.readFileSync(
      new URL(`wallets/${testSolNativeAddress}.sol.sk.json`, import.meta.url)
        .pathname,
      'utf-8',
    ),
  ),
);

export const testKyveMnemonic = // cspell:disable
  'industry addict wink hero diet bitter obscure need melt road fuel error category jealous eye cushion castle satoshi hungry clean observe lobster normal lazy';
export const testKyvePrivatekey =
  'b271ff821a011e89ce35b952c6336c810aa553646fd52c187f10cf910e45545c';
export const testKyveNativeAddress =
  'kyve1xddfun7awnee70xdq5fnt5ja3vxh93v3dj4k8v';
export const base64KyveAddress = 'Rdhf8cqIdoeb7scy9l0d1iVmhu6nmRJIGR-V7YQPKy8'; // cspell:enable

export const arweaveUrlString =
  process.env.ARWEAVE_GATEWAY ?? 'http://localhost:1984';
const arweaveUrl = new URL(arweaveUrlString);
export const testArweave = Arweave.init({
  host: arweaveUrl.hostname,
  port: arweaveUrl.port,
  protocol: arweaveUrl.protocol.replace(':', ''),
});

export const solanaUrlString = // TODO: Local SOL net in integration test
  process.env.SOLANA_GATEWAY ?? 'https://api.devnet.solana.com';

export const ethereumGatewayUrl = // TODO: Local ETH net in integration test -- 'http://localhost:8545'
  process.env.ETHEREUM_GATEWAY ?? 'https://eth-sepolia.public.blastapi.io'; // sepolia testnet rpc

export const kyveUrlString = // TODO: Local KYVE net in integration test
  process.env.KYVE_GATEWAY ?? 'https://api.korellia.kyve.network';

export async function fundArLocalWalletAddress(address: string): Promise<void> {
  await testArweave.api.get(`mint/${address}/9999999999999999`);
}

export async function mineArLocalBlock(numBlocks = 1): Promise<void> {
  await testArweave.api.get(`mine/${numBlocks}`);
}

export async function sendFundTransaction(
  quantity = 1000,
  jwk = testJwk,
): Promise<string> {
  const paymentUrl = new URL(
    turboDevelopmentConfigurations.paymentServiceConfig.url,
  );
  const target = (await axios.get(`${paymentUrl}info`)).data.addresses.arweave;
  const tx = await testArweave.createTransaction({
    quantity: `${quantity}`,
    target,
  });

  await testArweave.transactions.sign(tx, jwk);

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
