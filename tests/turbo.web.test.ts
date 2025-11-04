import {
  ArconnectSigner,
  ArweaveSigner,
  EthereumSigner,
  HexSolanaSigner,
  createData,
} from '@dha-team/arbundles';
import { CanceledError } from 'axios';
import { BigNumber } from 'bignumber.js';
import { JsonRpcProvider, TransactionResponse } from 'ethers';
import { File } from 'node-fetch';
import { strict as assert } from 'node:assert';
import { randomBytes } from 'node:crypto';
import { after, afterEach, before, describe, it } from 'node:test';
import { restore, stub } from 'sinon';

import { USD } from '../src/common/currency.js';
import { TurboWinstonLogger } from '../src/common/logger.js';
import { EthereumToken } from '../src/common/token/ethereum.js';
import {
  TurboAuthenticatedClient,
  TurboUnauthenticatedClient,
} from '../src/common/turbo.js';
import { FailedRequestError } from '../src/utils/errors.js';
import {
  ARToTokenAmount,
  ArweaveToken,
  SolanaToken,
  TurboFactory,
  TurboWebArweaveSigner,
  WinstonToTokenAmount,
} from '../src/web/index.js';
import {
  delayedBlockMining,
  ethereumGatewayUrl,
  fundArLocalWalletAddress,
  getRawBalance,
  mineArLocalBlock,
  sendFundTransaction,
  solanaUrlString,
  testArweave,
  testArweaveNativeB64Address,
  testEthAddressBase64,
  testEthNativeAddress,
  testEthWallet,
  testJwk,
  testSolAddressBase64,
  testSolNativeAddress,
  testSolWallet,
  turboDevelopmentConfigurations,
} from './helpers.js';

describe('Browser environment', () => {
  afterEach(() => {
    // Restore all stubs
    restore();
  });

  before(() => {
    (global as any).window = { document: {}, arweaveWallet: testArweave };
  });

  after(() => {
    delete (global as any).window;
  });

  const randomTestData = () => randomBytes(1024).toString('utf-8');

  describe('TurboFactory', () => {
    it('should be a TurboUnauthenticatedClient running in the browser and not provided a privateKey', () => {
      const turbo = TurboFactory.unauthenticated(
        turboDevelopmentConfigurations,
      );
      assert.ok(turbo instanceof TurboUnauthenticatedClient);
    });

    it('should be a TurboAuthenticatedClient running in the browser and provided a privateKey', async () => {
      const turbo = TurboFactory.authenticated({
        privateKey: testJwk,
        ...turboDevelopmentConfigurations,
      });
      assert.ok(turbo instanceof TurboUnauthenticatedClient);
    });

    it('should return a TurboAuthenticatedClient when running in Web environment and an EthereumSigner', async () => {
      const turbo = TurboFactory.authenticated({
        signer: new EthereumSigner(testEthWallet),
        ...turboDevelopmentConfigurations,
      });
      assert.ok(turbo instanceof TurboAuthenticatedClient);
    });

    it('should return a TurboAuthenticatedClient when running in Web environment and a HexSolanaSigner', async () => {
      const turbo = TurboFactory.authenticated({
        signer: new HexSolanaSigner(testSolWallet),
        ...turboDevelopmentConfigurations,
      });
      assert.ok(turbo instanceof TurboAuthenticatedClient);
    });

    it('should return a TurboAuthenticatedClient when running in Web environment and an ArconnectSigner', async () => {
      const turbo = TurboFactory.authenticated({
        signer: new ArconnectSigner(global.window.arweaveWallet),
        ...turboDevelopmentConfigurations,
      });
      assert.ok(turbo instanceof TurboAuthenticatedClient);
    });

    it('should return a TurboAuthenticatedClient when a compatible solana walletAdapter is provided', async () => {
      const turbo = TurboFactory.authenticated({
        token: 'solana',
        walletAdapter: {
          signMessage: (m) => Promise.resolve(m),
          publicKey: { toBuffer: () => Buffer.from(testSolWallet, 'hex') },
          signTransaction: (t) => Promise.resolve(t),
        },
      });
      assert.ok(turbo instanceof TurboAuthenticatedClient);
    });

    it('throws an error when an incompatible solana walletAdapter is provided', async () => {
      assert.throws(
        () =>
          TurboFactory.authenticated({
            token: 'solana',
            walletAdapter: {
              getSigner: () => ({
                signMessage: (m) => Promise.resolve(m as string),
                sendTransaction: () =>
                  Promise.resolve({ hash: 'hash' } as TransactionResponse),
                provider: new JsonRpcProvider(ethereumGatewayUrl),
              }),
            },
          }),
        /Unsupported wallet adapter/,
      );
    });

    it('should return a TurboAuthenticatedClient with InjectedEthereumSigner when a compatible ethereum walletAdapter is provided', async () => {
      const turbo = TurboFactory.authenticated({
        token: 'ethereum',
        walletAdapter: {
          getSigner: () => ({
            signMessage: (m) => Promise.resolve(m as string),
            sendTransaction: () =>
              Promise.resolve({ hash: 'hash' } as TransactionResponse),
            provider: new JsonRpcProvider(ethereumGatewayUrl),
          }),
        },
      });
      assert.ok(turbo instanceof TurboAuthenticatedClient);
      assert.equal(
        await turbo.signer.sendTransaction({
          amount: BigNumber('1'),
          target: 'target',
          gatewayUrl: 'http://this.location',
        }),
        'hash',
      );
    });

    it('throws an error when an incompatible ethereum walletAdapter is provided', async () => {
      assert.throws(
        () =>
          TurboFactory.authenticated({
            token: 'ethereum',
            walletAdapter: {
              signMessage: (m) => Promise.resolve(m),
              publicKey: { toBuffer: () => Buffer.from(testEthWallet, 'hex') },
              signTransaction: (t) => Promise.resolve(t),
            },
          }),
        /Unsupported wallet adapter/,
      );
    });

    it('throws an error when a walletAdapter is provided with an incompatible token', async () => {
      assert.throws(
        () =>
          TurboFactory.authenticated({
            token: 'arweave',
            walletAdapter: {
              signMessage: (m) => Promise.resolve(m),
              publicKey: { toBuffer: () => Buffer.from(testEthWallet, 'hex') },
              signTransaction: (t) => Promise.resolve(t),
            },
          }),
        /Unsupported wallet adapter/,
      );
    });

    it('should return a TurboAuthenticatedClient when running in Node environment and a provided base58 SOL secret key', async () => {
      const turbo = TurboFactory.authenticated({
        privateKey: testSolWallet,
        token: 'solana',
        ...turboDevelopmentConfigurations,
      });
      assert.ok(turbo instanceof TurboAuthenticatedClient);
    });

    it('should error when creating a TurboAuthenticatedClient and when providing a SOL Secret Key to construct an Arweave signer', async () => {
      assert.throws(
        () =>
          TurboFactory.authenticated({
            privateKey: testSolWallet,
            token: 'arweave',
            ...turboDevelopmentConfigurations,
          }),
        /A JWK must be provided for ArweaveSigner./,
      );
    });

    it('should return a TurboAuthenticatedClient when running in Node environment and a provided ethereum private key', async () => {
      const turbo = TurboFactory.authenticated({
        privateKey: testEthWallet,
        token: 'ethereum',
        ...turboDevelopmentConfigurations,
      });
      assert.ok(turbo instanceof TurboAuthenticatedClient);
    });

    it('should error when creating a TurboAuthenticatedClient and when providing a SOL Secret Key to construct an Ethereum signer', async () => {
      assert.throws(
        () =>
          TurboFactory.authenticated({
            privateKey: testSolWallet,
            token: 'ethereum',
            ...turboDevelopmentConfigurations,
          }),
        /A valid Ethereum private key must be provided for EthereumSigner./,
      );
    });

    it('should error when creating a TurboAuthenticatedClient and not providing a privateKey or a signer', async () => {
      assert.throws(
        () =>
          TurboFactory.authenticated({
            ...turboDevelopmentConfigurations,
          }),
        /A privateKey or signer must be provided./,
      );
    });

    it('should construct a TurboAuthenticatedClient with a provided deprecated tokenMap', async () => {
      const tokenMap = {
        arweave: new ArweaveToken({
          arweave: testArweave,
          pollingOptions: {
            maxAttempts: 3,
            pollingIntervalMs: 10,
            initialBackoffMs: 0,
          },
        }),
      };

      const turbo = TurboFactory.authenticated({
        privateKey: testJwk,
        tokenMap,
        ...turboDevelopmentConfigurations,
      });
      assert.ok(turbo instanceof TurboAuthenticatedClient);
    });

    it('TurboDataItemSigner errors when using an invalid signer on sendTransaction api', async () => {
      const signer = new ArweaveSigner(testJwk);
      const turboSigner = new TurboWebArweaveSigner({
        signer,
        logger: TurboWinstonLogger.default,
        token: 'arweave',
      });
      const error = await turboSigner
        .sendTransaction({
          target: 'fake target',
          amount: BigNumber('1'),
          gatewayUrl: '',
        })
        .catch((error) => error);
      assert.ok(error instanceof Error);
      assert.match(error.message, /Only EthereumSigner is supported/);
    });
  });

  describe('TurboUnauthenticatedWebClient', () => {
    let turbo: TurboUnauthenticatedClient;

    before(() => {
      turbo = TurboFactory.unauthenticated(turboDevelopmentConfigurations);
    });

    describe('unauthenticated requests', () => {
      it('getFiatRates()', async () => {
        const { winc, fiat, adjustments } = await turbo.getFiatRates();
        assert.ok(typeof winc === 'string');
        assert.ok(typeof fiat.usd === 'number');
        assert.ok(adjustments !== undefined);
      });

      it('getFiatToAR()', async () => {
        const { currency, rate } = await turbo.getFiatToAR({ currency: 'usd' });
        assert.equal(currency, 'usd');
        assert.ok(typeof rate === 'number');
      });

      it('getSupportedCountries()', async () => {
        const countries = await turbo.getSupportedCountries();
        assert.ok(Array.isArray(countries));
        assert.ok(countries.length > 0);
        assert.ok(countries.includes('United States'));
      });

      it('getSupportedCurrencies()', async () => {
        const { supportedCurrencies, limits } =
          await turbo.getSupportedCurrencies();
        assert.ok(supportedCurrencies !== undefined);
        assert.ok(Array.isArray(supportedCurrencies));
        assert.ok(supportedCurrencies.length > 0);
        assert.ok(supportedCurrencies.includes('usd'));
        assert.ok(limits !== undefined);
        assert.ok(typeof limits === 'object');
        assert.ok(limits.usd !== undefined);
        assert.ok(limits.usd.minimumPaymentAmount !== undefined);
        assert.ok(limits.usd.maximumPaymentAmount !== undefined);
        assert.ok(limits.usd.suggestedPaymentAmounts !== undefined);
        assert.ok(limits.usd.zeroDecimalCurrency !== undefined);
      });

      it('getUploadCosts()', async () => {
        const [{ winc, adjustments }] = await turbo.getUploadCosts({
          bytes: [1024],
        });
        assert.ok(winc !== undefined);
        assert.ok(+winc > 0);
        assert.ok(adjustments !== undefined);
        assert.ok(Array.isArray(adjustments));
      });

      it('getWincForFiat()', async () => {
        const { winc } = await turbo.getWincForFiat({
          amount: USD(10), // $10.00 USD
        });
        assert.ok(winc !== undefined);
        assert.ok(+winc > 0);
      });

      describe('uploadSignedDataItem()', () => {
        it('supports sending a signed Buffer to turbo', async () => {
          const signer = new ArweaveSigner(testJwk);

          const signedDataItem = createData('signed data item', signer);
          await signedDataItem.sign(signer);

          let uploadProgressCalled = false;
          let uploadErrorCalled = false;
          let uploadSuccessCalled = false;
          let signingProgressCalled = false;
          let signingErrorCalled = false;
          let signingSuccessCalled = false;
          const response = await turbo.uploadSignedDataItem({
            dataItemStreamFactory: () => signedDataItem.getRaw(),
            dataItemSizeFactory: () => signedDataItem.getRaw().length,
            events: {
              onUploadError: () => {
                uploadErrorCalled = true;
              },
              onUploadSuccess: () => {
                uploadSuccessCalled = true;
              },
              onUploadProgress: () => {
                uploadProgressCalled = true;
              },
              // @ts-expect-error - this is a test to check that the signing progress is not called for signed data
              onSigningProgress: () => {
                signingProgressCalled = true;
              },
              onSigningError: () => {
                signingErrorCalled = true;
              },
              onSigningSuccess: () => {
                signingSuccessCalled = true;
              },
            },
          });

          assert.ok(response !== undefined);
          assert.ok(response.fastFinalityIndexes !== undefined);
          assert.ok(response.dataCaches !== undefined);
          assert.ok(response.owner !== undefined);
          assert.equal(response.owner, testArweaveNativeB64Address);
          assert.equal(uploadProgressCalled, true);
          assert.equal(uploadErrorCalled, false);
          assert.equal(uploadSuccessCalled, true);
          assert.equal(signingProgressCalled, false);
          assert.equal(signingErrorCalled, false);
          assert.equal(signingSuccessCalled, false);
        });

        it('should abort the upload when AbortController.signal is triggered', async () => {
          const signer = new ArweaveSigner(testJwk);
          const signedDataItem = createData('signed data item', signer);
          await signedDataItem.sign(signer);
          const error = await turbo
            .uploadSignedDataItem({
              dataItemStreamFactory: () => signedDataItem.getRaw(),
              dataItemSizeFactory: () => signedDataItem.getRaw().length,
              signal: AbortSignal.timeout(0), // abort the request right away
            })
            .catch((err) => err);
          assert.ok(error instanceof CanceledError);
        });

        it('should return FailedRequestError for incorrectly signed data item', async () => {
          const signer = new ArweaveSigner(testJwk);
          const signedDataItem = createData('signed data item', signer, {});
          // not signed
          const error = await turbo
            .uploadSignedDataItem({
              dataItemStreamFactory: () => signedDataItem.getRaw(),
              dataItemSizeFactory: () => signedDataItem.getRaw().length,
            })
            .catch((err) => err);
          assert.ok(error instanceof FailedRequestError);
          assert.match(error.message, /Invalid Data Item/);
        });
      });

      describe('createCheckoutSession()', () => {
        it('should properly get a checkout session', async () => {
          const {
            adjustments,
            paymentAmount,
            quotedPaymentAmount,
            url,
            id,
            client_secret,
            winc,
          } = await turbo.createCheckoutSession({
            amount: USD(10),
            owner: '43-character-stub-arweave-address-000000000',
          });
          assert.deepEqual(adjustments, []);
          assert.equal(paymentAmount, 1000);
          assert.equal(quotedPaymentAmount, 1000);
          assert.ok(typeof url === 'string');
          assert.ok(typeof id === 'string');
          assert.equal(client_secret, undefined);
          assert.ok(typeof winc === 'string');
        });
      });

      it('should properly get a checkout session with a embedded ui mode', async () => {
        const {
          adjustments,
          paymentAmount,
          quotedPaymentAmount,
          url,
          id,
          client_secret,
          winc,
        } = await turbo.createCheckoutSession({
          amount: USD(20),
          owner: '43-character-stub-arweave-address-000000000',
          uiMode: 'embedded',
        });
        assert.deepEqual(adjustments, []);
        assert.equal(paymentAmount, 2000);
        assert.equal(quotedPaymentAmount, 2000);
        assert.equal(url, undefined);
        assert.ok(typeof id === 'string');
        assert.ok(typeof client_secret === 'string');
        assert.ok(typeof winc === 'string');
      });
    });

    describe('submitFundTransaction()', () => {
      before(async () => {
        await fundArLocalWalletAddress(testArweaveNativeB64Address);

        await mineArLocalBlock();
      });

      it('should return a FailedRequestError when submitting a non-existent payment transaction ID', async () => {
        const nonExistentPaymentTxId = 'non-existent-payment-tx-id';
        const error = await turbo
          .submitFundTransaction({ txId: nonExistentPaymentTxId })
          .catch((error) => error);
        assert.ok(error instanceof FailedRequestError);
        assert.match(
          error.message,
          /Failed request \(Status 404\): Transaction not found/,
        );
      });

      it('should properly submit an existing payment transaction ID to the Turbo Payment Service for processing a pending tx', async () => {
        const txId = await sendFundTransaction(1000);

        const { id, winc, owner, token, status } =
          await turbo.submitFundTransaction({
            txId,
          });
        assert.equal(id, txId);
        assert.equal(owner, testArweaveNativeB64Address);
        assert.equal(winc, '766');
        assert.equal(token, 'arweave');
        assert.equal(status, 'pending');
      });

      const minConfirmations = 25;
      it('should properly submit an existing payment transaction ID to the Turbo Payment Service for processing a confirmed tx', async () => {
        const balanceBefore = await getRawBalance(testArweaveNativeB64Address);

        const txId = await sendFundTransaction(1000);
        await mineArLocalBlock(minConfirmations);

        const { id, winc, owner, token, status } =
          await turbo.submitFundTransaction({
            txId,
          });
        assert.equal(id, txId);
        assert.equal(owner, testArweaveNativeB64Address);
        assert.equal(winc, '766');
        assert.equal(token, 'arweave');
        assert.equal(status, 'confirmed');

        const balanceAfter = await getRawBalance(testArweaveNativeB64Address);

        assert.equal(+balanceAfter - +balanceBefore, 766);
      });
    });
  });
  describe('TurboAuthenticatedWebClient', () => {
    let turbo: TurboAuthenticatedClient;

    const arweaveToken = new ArweaveToken({
      arweave: testArweave,
      pollingOptions: {
        maxAttempts: 3,
        pollingIntervalMs: 0,
        initialBackoffMs: 0,
      },
    });

    before(async () => {
      turbo = TurboFactory.authenticated({
        privateKey: testJwk,
        ...turboDevelopmentConfigurations,
        tokenTools: arweaveToken,
      });
    });

    describe('getBalance()', async () => {
      it('returns correct balance for test wallet', async () => {
        const rawBalance = await getRawBalance(testArweaveNativeB64Address);
        const balance = await turbo.getBalance();
        assert.equal(balance.winc, rawBalance);
      });

      it('returns correct balance for an empty wallet', async () => {
        const emptyJwk = await testArweave.crypto.generateJWK();
        const emptyTurbo = TurboFactory.authenticated({
          privateKey: emptyJwk,
          ...turboDevelopmentConfigurations,
        });
        const balance = await emptyTurbo.getBalance();
        assert.equal(balance.winc, '0');
      });
    });

    describe('upload()', () => {
      const uploadDataTypeInputsMap = {
        string: randomTestData(),
        Uint8Array: new TextEncoder().encode(randomTestData()),
        ArrayBuffer: new TextEncoder().encode(randomTestData()).buffer,
        Blob: new Blob([randomTestData()], { type: 'text/plain' }),
      };
      for (const [label, input] of Object.entries(uploadDataTypeInputsMap)) {
        it(`should properly upload a ${label} to turbo events`, async () => {
          let uploadProgressCalled = false;
          let uploadErrorCalled = false;
          let uploadSuccessCalled = false;
          let signingProgressCalled = false;
          let signingErrorCalled = false;
          let signingSuccessCalled = false;
          const response = await turbo.upload({
            data: input,
            events: {
              onUploadProgress: () => {
                uploadProgressCalled = true;
              },
              onUploadError: () => {
                uploadErrorCalled = true;
              },
              onUploadSuccess: () => {
                uploadSuccessCalled = true;
              },
              onSigningProgress: () => {
                signingProgressCalled = true;
              },
              onSigningError: () => {
                signingErrorCalled = true;
              },
              onSigningSuccess: () => {
                signingSuccessCalled = true;
              },
            },
          });
          assert.ok(response !== undefined);
          assert.ok(response.fastFinalityIndexes !== undefined);
          assert.ok(response.dataCaches !== undefined);
          assert.ok(response.owner !== undefined);
          assert.equal(response.owner, testArweaveNativeB64Address);
          assert.equal(uploadProgressCalled, true);
          assert.equal(uploadErrorCalled, false);
          assert.equal(uploadSuccessCalled, true);
          assert.equal(signingProgressCalled, true);
          assert.equal(signingErrorCalled, false);
          assert.equal(signingSuccessCalled, true);
        });

        it('should abort the upload when AbortController.signal is triggered', async () => {
          const error = await turbo
            .upload({
              data: input,
              signal: AbortSignal.timeout(0), // abort the request right away
            })
            .catch((err) => err);
          assert.ok(error instanceof CanceledError);
        });
      }

      it('should return a FailedRequestError when the file is larger than the free limit and wallet is underfunded', async () => {
        const nonAllowListedJWK = await testArweave.wallets.generate();
        const newTurbo = TurboFactory.authenticated({
          privateKey: nonAllowListedJWK,
          ...turboDevelopmentConfigurations,
        });
        const error = await newTurbo
          .upload({
            data: new Uint8Array(1024 * 1024), // 1MiB
          })
          .catch((err) => err);
        assert.ok(error instanceof FailedRequestError);
        assert.match(error.message, /Insufficient balance/);
      });
    });

    describe('uploadFile()', () => {
      it('should properly upload a ReadableStream to turbo', async () => {
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(randomTestData());
        const readableStream = new ReadableStream({
          start(controller) {
            controller.enqueue(uint8Array);
            controller.close();
          },
        });
        let uploadProgressCalled = false;
        let uploadErrorCalled = false;
        let uploadSuccessCalled = false;
        let signingProgressCalled = false;
        let signingErrorCalled = false;
        let signingSuccessCalled = false;
        const response = await turbo.uploadFile({
          fileStreamFactory: () => readableStream,
          fileSizeFactory: () => uint8Array.length,
          events: {
            onUploadProgress: () => {
              uploadProgressCalled = true;
            },
            onUploadError: () => {
              uploadErrorCalled = true;
            },
            onUploadSuccess: () => {
              uploadSuccessCalled = true;
            },
            onSigningProgress: () => {
              signingProgressCalled = true;
            },
            onSigningError: () => {
              signingErrorCalled = true;
            },
            onSigningSuccess: () => {
              signingSuccessCalled = true;
            },
          },
        });
        assert.ok(response !== undefined);
        assert.ok(response.fastFinalityIndexes !== undefined);
        assert.ok(response.dataCaches !== undefined);
        assert.ok(response.owner !== undefined);
        assert.equal(response.owner, testArweaveNativeB64Address);
        assert.equal(uploadProgressCalled, true);
        assert.equal(uploadErrorCalled, false);
        assert.equal(uploadSuccessCalled, true);
        assert.equal(signingProgressCalled, true);
        assert.equal(signingErrorCalled, false);
        assert.equal(signingSuccessCalled, true);
      });

      it('should abort the upload when AbortController.signal is triggered', async () => {
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(randomTestData());
        const readableStream = new ReadableStream({
          start(controller) {
            controller.enqueue(uint8Array);
            controller.close();
          },
        });
        const error = await turbo
          .uploadFile({
            fileStreamFactory: () => readableStream,
            fileSizeFactory: () => uint8Array.length,
            signal: AbortSignal.timeout(0), // abort the request right away
          })
          .catch((err) => err);
        assert.ok(error instanceof CanceledError);
      });

      it('should properly upload a ReadableStream with chunking forced', async () => {
        const encoder = new TextEncoder();
        const fileSize = 11 * 1024 * 1024;
        const randomData = randomBytes(fileSize).toString();
        const uint8Array = encoder.encode(randomData);
        const readableStream = new ReadableStream({
          start(controller) {
            controller.enqueue(uint8Array);
            controller.close();
          },
        });

        // Upload the ReadableStream
        const response = await turbo.uploadFile({
          fileStreamFactory: () => readableStream,
          fileSizeFactory: () => uint8Array.length,
          dataItemOpts: {},
          chunkingMode: 'force',
        });
        assert.ok(response !== undefined);
        assert.ok(response.fastFinalityIndexes !== undefined);
        assert.ok(response.dataCaches !== undefined);
        assert.ok(response.owner !== undefined);
        assert.equal(response.owner, testArweaveNativeB64Address);
        assert.ok(response.winc !== undefined);
      });

      it('should return a FailedRequestError when the file is larger than the free limit and wallet is underfunded', async () => {
        const nonAllowListedJWK = await testArweave.wallets.generate();
        const oneMBBuffer = Buffer.alloc(1024 * 1024);
        const readableStream = new ReadableStream({
          start(controller) {
            controller.enqueue(oneMBBuffer);
            controller.close();
          },
        });
        const newTurbo = TurboFactory.authenticated({
          privateKey: nonAllowListedJWK,
          ...turboDevelopmentConfigurations,
        });
        const error = await newTurbo
          .uploadFile({
            fileStreamFactory: () => readableStream,
            fileSizeFactory: () => oneMBBuffer.byteLength,
          })
          .catch((err) => err);
        assert.ok(error instanceof FailedRequestError);
        assert.match(error.message, /Insufficient balance/);
      });

      it('should properly upload a file with File object', async () => {
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode(randomTestData());
        const file = new File([uint8Array], 'stubFile.txt', {
          type: 'text/plain',
        });
        const response = await turbo.uploadFile({ file });
        assert.ok(response !== undefined);
      });
    });

    describe('uploadFolder()', () => {
      it('uploads expected data items and manifest', async () => {
        const files = [
          new File([randomTestData()], 'stubFile.txt', { type: 'text/plain' }),
          new File(['test data 2'], 'stubFile2.txt', { type: 'text/plain' }),
          new File(
            [`{ "key":  "val", "key2" : [1, 2, 3] }`],
            'nested/stubFile5.json',
            { type: 'application/json' },
          ),
          new File(['test data 3'], 'stubFile3.txt'),
        ];

        const result = await turbo.uploadFolder({
          files,
        });
        assert.ok(result !== undefined);
        assert.ok(result.manifest !== undefined);

        assert.equal(result.fileResponses.length, 4);
        assert.ok(result.manifestResponse !== undefined);
      });

      it('should properly upload folder with folder events', async () => {
        const files = [
          new File([randomTestData()], 'stubFile.txt', { type: 'text/plain' }),
          new File(['test data 2'], 'stubFile2.txt', { type: 'text/plain' }),
          new File(
            [`{ "key":  "val", "key2" : [1, 2, 3] }`],
            'nested/stubFile5.json',
            { type: 'application/json' },
          ),
          new File(['test data 3'], 'stubFile3.txt'),
        ];

        let fileStartCalled = 0;
        let fileProgressCalled = 0;
        let fileCompleteCalled = 0;
        let fileErrorCalled = 0;
        let folderProgressCalled = 0;
        let folderErrorCalled = 0;
        let folderSuccessCalled = 0;

        const fileStartEvents: Array<{
          fileName: string;
          fileSize: number;
          fileIndex: number;
          totalFiles: number;
        }> = [];
        const fileCompleteEvents: Array<{
          fileName: string;
          fileIndex: number;
          totalFiles: number;
          id: string;
        }> = [];
        const folderProgressEvents: Array<{
          processedFiles: number;
          totalFiles: number;
          processedBytes: number;
          totalBytes: number;
          currentPhase: 'files' | 'manifest';
        }> = [];

        const result = await turbo.uploadFolder({
          files,
          events: {
            onFileStart: ({ fileName, fileIndex, totalFiles, fileSize }) => {
              fileStartCalled++;
              fileStartEvents.push({
                fileName,
                fileIndex,
                totalFiles,
                fileSize,
              });
              assert.ok(typeof fileName === 'string');
              assert.ok(typeof fileSize === 'number');
              assert.ok(typeof fileIndex === 'number');
              assert.equal(totalFiles, 4);
            },
            onFileProgress: ({
              fileName,
              fileIndex,
              totalFiles,
              fileProcessedBytes,
              fileTotalBytes,
              step,
            }) => {
              fileProgressCalled++;
              assert.ok(typeof fileName === 'string');
              assert.ok(typeof fileIndex === 'number');
              assert.equal(totalFiles, 4);
              assert.ok(typeof fileProcessedBytes === 'number');
              assert.ok(typeof fileTotalBytes === 'number');
              assert.ok(step === 'signing' || step === 'upload');
            },
            onFileComplete: ({ fileName, fileIndex, totalFiles, id }) => {
              fileCompleteCalled++;
              fileCompleteEvents.push({ fileName, fileIndex, totalFiles, id });
              assert.ok(typeof fileName === 'string');
              assert.ok(typeof fileIndex === 'number');
              assert.equal(totalFiles, 4);
              assert.ok(typeof id === 'string');
            },
            onFileError: ({ fileName, fileIndex, totalFiles, error }) => {
              fileErrorCalled++;
              assert.ok(typeof fileName === 'string');
              assert.ok(typeof fileIndex === 'number');
              assert.equal(totalFiles, 4);
              assert.ok(error instanceof Error);
            },
            onFolderProgress: ({
              processedFiles,
              totalFiles,
              processedBytes,
              totalBytes,
              currentPhase,
            }) => {
              folderProgressCalled++;
              folderProgressEvents.push({
                processedFiles,
                totalFiles,
                processedBytes,
                totalBytes,
                currentPhase,
              });
              assert.ok(typeof processedFiles === 'number');
              assert.equal(totalFiles, 4);
              assert.ok(typeof processedBytes === 'number');
              assert.ok(typeof totalBytes === 'number');
              assert.ok(
                currentPhase === 'files' || currentPhase === 'manifest',
              );
            },
            onFolderError: (error) => {
              folderErrorCalled++;
              assert.ok(error instanceof Error);
            },
            onFolderSuccess: () => {
              folderSuccessCalled++;
            },
          },
        });

        assert.ok(result !== undefined);
        assert.ok(result.manifest !== undefined);
        assert.equal(result.fileResponses.length, 4);

        // Verify all event callbacks were called
        assert.equal(fileStartCalled, 4, 'fileStart should be called 4 times');
        assert.ok(
          fileProgressCalled > 0,
          'fileProgress should be called at least once',
        );
        assert.equal(
          fileCompleteCalled,
          4,
          'fileComplete should be called 4 times',
        );
        assert.equal(fileErrorCalled, 0, 'fileError should not be called');
        assert.ok(
          folderProgressCalled > 0,
          'folderProgress should be called at least once',
        );
        assert.equal(folderErrorCalled, 0, 'folderError should not be called');
        assert.equal(
          folderSuccessCalled,
          1,
          'folderSuccess should be called once',
        );

        // Verify file indices are sequential
        for (let i = 0; i < 4; i++) {
          const startEvent = fileStartEvents.find((e) => e.fileIndex === i);
          const completeEvent = fileCompleteEvents.find(
            (e) => e.fileIndex === i,
          );
          assert.ok(startEvent !== undefined, `fileStart event for index ${i}`);
          assert.ok(
            completeEvent !== undefined,
            `fileComplete event for index ${i}`,
          );
        }

        // Verify folder progress includes both phases
        const filesPhaseEvents = folderProgressEvents.filter(
          (e) => e.currentPhase === 'files',
        );
        const manifestPhaseEvents = folderProgressEvents.filter(
          (e) => e.currentPhase === 'manifest',
        );
        assert.ok(
          filesPhaseEvents.length > 0,
          'Should have files phase progress events',
        );
        assert.ok(
          manifestPhaseEvents.length > 0,
          'Should have manifest phase progress events',
        );
      });

      it('should track folder upload phases correctly', async () => {
        const files = [
          new File([randomTestData()], 'stubFile.txt', { type: 'text/plain' }),
          new File(['test data 2'], 'stubFile2.txt', { type: 'text/plain' }),
          new File(['test data 3'], 'stubFile3.txt'),
        ];

        const phases: Array<'files' | 'manifest'> = [];

        await turbo.uploadFolder({
          files,
          events: {
            onFolderProgress: ({ currentPhase }) => {
              if (
                phases.length === 0 ||
                phases[phases.length - 1] !== currentPhase
              ) {
                phases.push(currentPhase);
              }
            },
          },
        });

        // Verify phases are in correct order
        assert.ok(phases.includes('files'), 'Should have files phase');
        assert.ok(phases.includes('manifest'), 'Should have manifest phase');
        assert.equal(
          phases.indexOf('files'),
          0,
          'Files phase should come first',
        );
        assert.ok(
          phases.indexOf('manifest') > phases.indexOf('files'),
          'Manifest phase should come after files phase',
        );
      });
    });

    it('getWincForFiat() fails with bad promo code', async () => {
      const error = await turbo
        .getWincForFiat({
          amount: USD(10), // $10.00 USD
          promoCodes: ['BAD_CODE'],
        })
        .catch((error) => error);
      assert.ok(error instanceof FailedRequestError);
      assert.equal(
        error.message,
        "Failed request (Status 400): No promo code found with code 'BAD_CODE'",
      );
    });

    it('getWincForFiat() without a promo could return proper rates', async () => {
      const { winc, adjustments } = await turbo.getWincForFiat({
        amount: USD(10), // $10.00 USD
      });
      assert.ok(+winc > 0);
      assert.ok(adjustments !== undefined);
    });

    describe('createCheckoutSession()', () => {
      it('should fail to get a checkout session with a bad promo code', async () => {
        const error = await turbo
          .createCheckoutSession({
            amount: USD(10),
            owner: testArweaveNativeB64Address,
            promoCodes: ['BAD_PROMO_CODE'],
          })
          .catch((error) => error);
        assert.ok(error instanceof FailedRequestError);
        assert.equal(
          error.message,
          "Failed request (Status 400): No promo code found with code 'BAD_PROMO_CODE'",
        );
      });
    });

    describe('fund()', function () {
      it('should succeed to fund account using arweave tokens', async () => {
        const [{ winc }] = await Promise.all([
          turbo.topUpWithTokens({
            tokenAmount: WinstonToTokenAmount(10),
          }),
          delayedBlockMining(),
        ]);

        assert.equal(winc, '7');
      });

      it('should fail to submit fund tx when arweave fund tx is stubbed to succeed but wont exist on chain', async () => {
        stub(arweaveToken, 'submitTx').resolves();
        stub(testArweave.transactions, 'getTransactionAnchor').resolves(
          'stub anchor',
        );
        stub(testArweave.transactions, 'getPrice').resolves('101 :)');

        // simulate polling for transaction
        stub(testArweave.api, 'post')
          .onFirstCall()
          .throws()
          .onSecondCall()
          .resolves(undefined)
          .onThirdCall()
          .resolves({ data: { data: { transaction: true } } } as any);

        const error = await turbo
          .topUpWithTokens({
            tokenAmount: ARToTokenAmount(0.000_000_100_000),
            feeMultiplier: 1.5,
          })
          .catch((error) => error);
        assert.ok(error instanceof Error);
        assert.match(error.message, /Failed to submit fund transaction!/);
      });

      it('should fail to submit fund tx when fund tx fails to post to arweave', async () => {
        stub(testArweave.transactions, 'post').throws();

        const error = await turbo
          .topUpWithTokens({
            tokenAmount: WinstonToTokenAmount(1000),
          })
          .catch((error) => error);
        assert.ok(error instanceof Error);
        assert.match(error.message, /Failed to post transaction/);
      });
    });
  });

  describe('TurboAuthenticatedWebClient with EthereumSigner', () => {
    let turbo: TurboAuthenticatedClient;

    const signer = new EthereumSigner(testEthWallet);

    const tokenTools = new EthereumToken({
      gatewayUrl: ethereumGatewayUrl,
      pollingOptions: {
        maxAttempts: 3,
        pollingIntervalMs: 10,
        initialBackoffMs: 0,
      },
    });

    before(async () => {
      // TODO: ETH Local Gateway
      // await fundGanacheWallet();

      turbo = TurboFactory.authenticated({
        signer,
        tokenTools,
        ...turboDevelopmentConfigurations,
      });
    });

    it('should properly upload a Readable to turbo', async () => {
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(randomTestData());
      const readableStream = new ReadableStream({
        start(controller) {
          controller.enqueue(uint8Array);
          controller.close();
        },
      });
      const response = await turbo.uploadFile({
        fileStreamFactory: () => readableStream,
        fileSizeFactory: () => uint8Array.length,
      });

      assert.ok(response !== undefined);
      assert.ok(response.fastFinalityIndexes !== undefined);
      assert.ok(response.dataCaches !== undefined);
      assert.ok(response.owner !== undefined);
      assert.equal(response.owner, testEthAddressBase64);
    });

    it('should properly upload a Buffer to turbo', async () => {
      const signedDataItem = createData('signed data item', signer, {});
      await signedDataItem.sign(signer);

      let uploadProgressCalled = false;
      let uploadErrorCalled = false;
      let uploadSuccessCalled = false;
      let signingProgressCalled = false;
      let signingErrorCalled = false;
      let signingSuccessCalled = false;
      const response = await turbo.uploadSignedDataItem({
        dataItemStreamFactory: () => signedDataItem.getRaw(),
        dataItemSizeFactory: () => signedDataItem.getRaw().length,
        events: {
          onUploadProgress: () => {
            uploadProgressCalled = true;
          },
          onUploadError: () => {
            uploadErrorCalled = true;
          },
          onUploadSuccess: () => {
            uploadSuccessCalled = true;
          },
          // @ts-expect-error - this is a test to check that the signing progress is not called for signed data
          onSigningProgress: () => {
            signingProgressCalled = true;
          },
          onSigningError: () => {
            signingErrorCalled = true;
          },
          onSigningSuccess: () => {
            signingSuccessCalled = true;
          },
        },
      });

      assert.ok(response !== undefined);
      assert.ok(response.fastFinalityIndexes !== undefined);
      assert.ok(response.dataCaches !== undefined);
      assert.ok(response.owner !== undefined);
      assert.equal(response.owner, testEthAddressBase64);
      assert.equal(uploadProgressCalled, true);
      assert.equal(uploadErrorCalled, false);
      assert.equal(uploadSuccessCalled, true);
      // no signing callbacks should be called for signed data
      assert.equal(signingProgressCalled, false);
      assert.equal(signingErrorCalled, false);
      assert.equal(signingSuccessCalled, false);
    });

    it.skip('should topUpWithTokens() to an ETH wallet', async () => {
      const { id, quantity, owner, winc, target } = await turbo.topUpWithTokens(
        {
          tokenAmount: 100_000_000, // 0.000_000_000_100_000_000 ETH
        },
      );

      assert.ok(typeof id === 'string');
      assert.ok(typeof target === 'string');
      assert.ok(typeof winc === 'string');
      assert.equal(quantity, '100000000');
      assert.equal(owner, testEthNativeAddress);
    });

    it('should fail to topUpWithTokens() to an ETH wallet if tx is stubbed to succeed but wont exist on chain', async () => {
      stub(tokenTools, 'createAndSubmitTx').resolves({
        id: 'stubbed-tx-id',
        target: 'fake target',
      });

      await turbo
        .topUpWithTokens({
          tokenAmount: 100_000, // 0.0001 ETH
        })
        .catch((error) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /Failed to submit fund transaction!/);
        });
    });
  });

  describe('TurboAuthenticatedWebClient with HexSolanaSigner', () => {
    let turbo: TurboAuthenticatedClient;

    const signer = new HexSolanaSigner(testSolWallet);

    const tokenTools = new SolanaToken({
      gatewayUrl: solanaUrlString,
      pollingOptions: {
        maxAttempts: 3,
        pollingIntervalMs: 10,
        initialBackoffMs: 0,
      },
    });

    before(async () => {
      turbo = TurboFactory.authenticated({
        signer,
        ...turboDevelopmentConfigurations,
        tokenTools,
      });
    });

    it('should properly upload a Readable to turbo', async () => {
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(randomTestData());
      const readableStream = new ReadableStream({
        start(controller) {
          controller.enqueue(uint8Array);
          controller.close();
        },
      });
      const response = await turbo.uploadFile({
        fileStreamFactory: () => readableStream,
        fileSizeFactory: () => uint8Array.length,
      });

      assert.ok(response !== undefined);
      assert.ok(response.fastFinalityIndexes !== undefined);
      assert.ok(response.dataCaches !== undefined);
      assert.ok(response.owner !== undefined);
      assert.equal(response.owner, testSolAddressBase64);
    });

    it('should properly upload a Buffer to turbo with uploadFile', async () => {
      const encoder = new TextEncoder();
      const uint8Array = encoder.encode(randomTestData());

      const response = await turbo.uploadFile({
        fileStreamFactory: () => Buffer.from(uint8Array),
        fileSizeFactory: () => uint8Array.length,
      });

      assert.ok(response !== undefined);
      assert.equal(response.owner, testSolAddressBase64);
    });

    it('should properly upload a Buffer to turbo', async () => {
      const signedDataItem = createData('signed data item', signer, {});
      await signedDataItem.sign(signer);

      let uploadProgressCalled = false;
      const response = await turbo.uploadSignedDataItem({
        dataItemStreamFactory: () => signedDataItem.getRaw(),
        dataItemSizeFactory: () => signedDataItem.getRaw().length,
        events: {
          onUploadProgress: () => {
            uploadProgressCalled = true;
          },
        },
      });

      assert.ok(response !== undefined);
      assert.ok(response.fastFinalityIndexes !== undefined);
      assert.ok(response.dataCaches !== undefined);
      assert.ok(response.owner !== undefined);
      assert.equal(response.owner, testSolAddressBase64);
      assert.equal(uploadProgressCalled, true);
    });

    it.skip('should topUpWithTokens() to a SOL wallet', async () => {
      const { id, quantity, owner, winc, target } = await turbo.topUpWithTokens(
        {
          tokenAmount: 100_000, // 0.0001 SOL
        },
      );

      assert.ok(typeof id === 'string');
      assert.ok(typeof target === 'string');
      assert.ok(typeof winc === 'string');
      assert.equal(quantity, '100000');
      assert.equal(owner, testSolNativeAddress);
    });

    it('should fail to topUpWithTokens() to a SOL wallet if tx is stubbed to succeed but wont exist on chain', async () => {
      stub(tokenTools, 'createAndSubmitTx').resolves({
        id: 'stubbed-tx-id',
        target: 'fake target',
      });

      await turbo
        .topUpWithTokens({
          tokenAmount: 100_000, // 0.0001 SOL
        })
        .catch((error) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /Failed to submit fund transaction!/);
        });
    });
  });
});
