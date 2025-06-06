import {
  ArweaveSigner,
  EthereumSigner,
  HexSolanaSigner,
  createData,
} from '@dha-team/arbundles';
import { CanceledError } from 'axios';
import { BigNumber } from 'bignumber.js';
import fs from 'fs';
import { strict as assert } from 'node:assert';
import { Readable } from 'node:stream';
import { afterEach, before, describe, it } from 'node:test';
import { restore, stub } from 'sinon';

import { JPY, USD } from '../src/common/currency.js';
import { TurboWinstonLogger } from '../src/common/logger.js';
import { EthereumToken } from '../src/common/token/ethereum.js';
import {
  ARToTokenAmount,
  ArweaveToken,
  KyveToken,
  SolanaToken,
  WinstonToTokenAmount,
  privateKeyFromKyveMnemonic,
} from '../src/common/token/index.js';
import {
  TurboAuthenticatedClient,
  TurboUnauthenticatedClient,
} from '../src/common/turbo.js';
import { TurboFactory } from '../src/node/factory.js';
import { TurboNodeSigner } from '../src/node/signer.js';
import {
  NativeAddress,
  TokenType,
  TurboSigner,
  fiatCurrencyTypes,
  tokenTypes,
} from '../src/types.js';
import { signerFromKyveMnemonic } from '../src/utils/common.js';
import { FailedRequestError } from '../src/utils/errors.js';
import {
  base64KyveAddress,
  delayedBlockMining,
  ethereumGatewayUrl,
  expectAsyncErrorThrow,
  fundArLocalWalletAddress,
  getRawBalance,
  kyveUrlString,
  mineArLocalBlock,
  sendFundTransaction,
  solanaUrlString,
  testArweave,
  testArweaveNativeB64Address,
  testEthAddressBase64,
  testEthNativeAddress,
  testEthWallet,
  testJwk,
  testKyveMnemonic,
  testKyveNativeAddress,
  testKyvePrivatekey,
  testSolAddressBase64,
  testSolNativeAddress,
  testSolWallet,
  turboDevelopmentConfigurations,
  turboTestEnvConfigurations,
} from './helpers.js';

describe('Node environment', () => {
  afterEach(() => {
    // Restore all stubs
    restore();
  });
  const oneKiBFilePath = new URL('files/1KB_file', import.meta.url).pathname;

  describe('TurboDataItemSigner', () => {
    const signers: Record<TokenType, [TurboSigner, NativeAddress]> = {
      arweave: [new ArweaveSigner(testJwk), testArweaveNativeB64Address],
      ario: [new ArweaveSigner(testJwk), testArweaveNativeB64Address],
      ethereum: [new EthereumSigner(testEthWallet), testEthNativeAddress],
      'base-eth': [new EthereumSigner(testEthWallet), testEthNativeAddress],
      solana: [new HexSolanaSigner(testSolWallet), testSolNativeAddress],
      kyve: [new EthereumSigner(testKyvePrivatekey), testKyveNativeAddress],
      matic: [new EthereumSigner(testEthWallet), testEthNativeAddress],
      pol: [new EthereumSigner(testEthWallet), testEthNativeAddress],
    };

    for (const [token, [signer, expectedNativeAddress]] of Object.entries(
      signers,
    )) {
      const turboSigner = new TurboNodeSigner({
        signer,
        token: token as TokenType,
      });

      it(`should return the correct native address for ${token}`, async () => {
        const nativeAddress = await turboSigner.getNativeAddress();
        assert.equal(nativeAddress, expectedNativeAddress);
      });
    }
  });

  describe('TurboFactory', () => {
    it('should return a TurboUnauthenticatedClient when running in Node environment and not provided a privateKey', () => {
      const turbo = TurboFactory.unauthenticated(
        turboDevelopmentConfigurations,
      );
      assert.ok(turbo instanceof TurboUnauthenticatedClient);
    });

    it('should return a TurboAuthenticatedClient when running in Node environment and provided a privateKey', async () => {
      const turbo = TurboFactory.authenticated({
        privateKey: testJwk,
        ...turboDevelopmentConfigurations,
      });
      assert.ok(turbo instanceof TurboAuthenticatedClient);
    });

    it('should return a TurboAuthenticatedClient when running in Node environment and an ArweaveSigner', async () => {
      const turbo = TurboFactory.authenticated({
        signer: new ArweaveSigner(testJwk),
        ...turboDevelopmentConfigurations,
      });
      assert.ok(turbo instanceof TurboAuthenticatedClient);
      assert.equal(
        await turbo.signer.getNativeAddress(),
        testArweaveNativeB64Address,
      );
    });

    it('should return a TurboAuthenticatedClient when running in Node environment and an EthereumSigner', async () => {
      const turbo = TurboFactory.authenticated({
        signer: new EthereumSigner(testEthWallet),
        ...turboDevelopmentConfigurations,
      });
      assert.ok(turbo instanceof TurboAuthenticatedClient);
      assert.equal(await turbo.signer.getNativeAddress(), testEthNativeAddress);
    });

    it('should return a TurboAuthenticatedClient when running in Node environment and a provided KYVE private key', async () => {
      const turbo = TurboFactory.authenticated({
        privateKey: await privateKeyFromKyveMnemonic(testKyveMnemonic),
        token: 'kyve',
        ...turboDevelopmentConfigurations,
      });
      assert.ok(turbo instanceof TurboAuthenticatedClient);
      assert.equal(
        await turbo.signer.getNativeAddress(),
        testKyveNativeAddress,
      );
    });

    it('should return a TurboAuthenticatedClient when running in Node environment and a HexSolanaSigner', async () => {
      const turbo = TurboFactory.authenticated({
        signer: new HexSolanaSigner(testSolWallet),
        ...turboDevelopmentConfigurations,
      });
      assert.ok(turbo instanceof TurboAuthenticatedClient);
      assert.equal(await turbo.signer.getNativeAddress(), testSolNativeAddress);
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
      const turboSigner = new TurboNodeSigner({
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

    it('signerFromKyveMnemonic() should return a TurboSigner', async () => {
      const signer = await signerFromKyveMnemonic(testKyveMnemonic);
      assert.ok(signer instanceof EthereumSigner);
    });
  });

  describe('TurboUnauthenticatedNodeClient', () => {
    let turbo: TurboUnauthenticatedClient;

    before(() => {
      turbo = TurboFactory.unauthenticated(turboDevelopmentConfigurations);
    });

    it('getFiatRates()', async () => {
      const { winc, fiat, adjustments } = await turbo.getFiatRates();
      assert.ok(typeof winc === 'string');
      assert.ok(typeof fiat.usd === 'number');
      assert.ok(adjustments !== undefined);
    });

    it('getFiatToAR()', async () => {
      const { currency, rate } = await turbo.getFiatToAR({
        currency: 'usd',
      });
      assert.equal(currency, 'usd');
      assert.ok(typeof rate === 'number');
    });

    it('getSupportedCountries()', async () => {
      const countries = await turbo.getSupportedCountries();
      assert.ok(Array.isArray(countries));
      assert.ok(countries.length > 0);
      assert.ok(countries.includes('United States'));
    });

    it('getTurboCryptoWallets', async () => {
      const wallets = await turbo.getTurboCryptoWallets();

      assert.ok(wallets !== undefined);
      assert.ok(wallets.arweave !== undefined);
      assert.ok(wallets.ethereum !== undefined);
      assert.ok(wallets.solana !== undefined);
      assert.ok(wallets.kyve !== undefined);
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
      const {
        winc,
        actualPaymentAmount,
        adjustments,
        quotedPaymentAmount,
        fees,
      } = await turbo.getWincForFiat({
        amount: USD(10), // $10.00 USD
      });
      assert.ok(winc !== undefined);
      assert.ok(+winc > 0);
      assert.equal(actualPaymentAmount, 1000);
      assert.equal(quotedPaymentAmount, 1000);
      assert.deepEqual(adjustments, []);
      assert.equal(fees.length, 1);
    });

    it('getWincForToken()', async () => {
      const { winc, actualTokenAmount, equivalentWincTokenAmount, fees } =
        await turbo.getWincForToken({
          tokenAmount: 100000, // 100,000 winston
        });
      assert.ok(winc !== undefined);
      assert.ok(+winc > 0);
      assert.equal(actualTokenAmount, '100000');
      assert.equal(equivalentWincTokenAmount, '100000');
      assert.equal(fees.length, 1);
    });
    const oneHundredMiBInBytes = 1024 * 1024 * 100; // 100 MiB

    describe('getFiatEstimateForBytes()', async () => {
      for (const fiat of fiatCurrencyTypes) {
        it(`should return the correct fiat estimate for ${fiat} for 100 MiB`, async () => {
          const { amount, byteCount: bytesResult } =
            await turbo.getFiatEstimateForBytes({
              byteCount: oneHundredMiBInBytes,
              currency: fiat,
            });
          assert.ok(amount !== undefined);
          assert.equal(bytesResult, oneHundredMiBInBytes);
          assert.ok(typeof +amount === 'number');
        });
      }
    });

    describe('getTokenPriceForBytes()', async () => {
      for (const token of tokenTypes) {
        it(`should return the correct token price for the given bytes for ${token}`, async () => {
          const { tokenPrice, byteCount: bytesResult } =
            await TurboFactory.unauthenticated({
              ...turboTestEnvConfigurations,
              token,
            }).getTokenPriceForBytes({
              byteCount: oneHundredMiBInBytes,
            });
          assert.ok(tokenPrice !== undefined);
          assert.equal(bytesResult, oneHundredMiBInBytes);
          assert.ok(typeof +tokenPrice === 'number');
        });
      }
    });

    describe('uploadSignedDataItem()', () => {
      const signer = new ArweaveSigner(testJwk);
      it('should properly upload a signed Buffer to turbo', async () => {
        const signedDataItem = createData('signed data item', signer, {});
        await signedDataItem.sign(signer);

        const response = await turbo.uploadSignedDataItem({
          dataItemStreamFactory: () => signedDataItem.getRaw(),
          dataItemSizeFactory: () => signedDataItem.getRaw().length,
        });
        assert.ok(response !== undefined);
        assert.ok(response.fastFinalityIndexes !== undefined);
        assert.ok(response.dataCaches !== undefined);
        assert.ok(response.owner !== undefined);
        assert.equal(response.owner, testArweaveNativeB64Address);
      });

      it('should properly upload signed Readable to turbo', async () => {
        const signedDataItem = createData('signed data item', signer, {});
        await signedDataItem.sign(signer);

        const response = await turbo.uploadSignedDataItem({
          dataItemStreamFactory: () => Readable.from(signedDataItem.getRaw()),
          dataItemSizeFactory: () => signedDataItem.getRaw().length,
        });
        assert.ok(response !== undefined);
        assert.ok(response.fastFinalityIndexes !== undefined);
        assert.ok(response.dataCaches !== undefined);
        assert.ok(response.owner !== undefined);
        assert.equal(response.owner, testArweaveNativeB64Address);
      });

      it('should abort an upload when AbortController.signal is triggered', async () => {
        const signedDataItem = createData('signed data item', signer, {});
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
        const unsignedDataItem = createData('signed data item', signer, {});
        const unsignedBuffer = unsignedDataItem.getRaw();
        // not signed
        const error = await turbo
          .uploadSignedDataItem({
            dataItemStreamFactory: () => unsignedBuffer,
            dataItemSizeFactory: () => unsignedBuffer.length,
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
          client_secret,
          id,
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

  describe('TurboAuthenticatedNodeClient', () => {
    let turbo: TurboAuthenticatedClient;

    const arweaveToken = new ArweaveToken({
      arweave: testArweave,
      pollingOptions: {
        maxAttempts: 3,
        pollingIntervalMs: 10,
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
      const validDataItemOpts = [
        {
          target: '43charactersAbcdEfghIjklMnopQrstUvwxYz12345',
          anchor: 'anchorMustBeThirtyTwoBytesLong!!',
          tags: [
            {
              name: '', // empty name
              value: '', // empty val
            },
          ],
        },
        {
          // cspell:disable
          target: 'WeirdCharacters-_!felwfleowpfl12345678901234', // cspell:disable
          anchor: 'anchor-MusTBe__-__TwoBytesLong!!',
          tags: [
            {
              name: 'test',
              value: 'test',
            },
            {
              name: 'test2',
              value: 'test2',
            },
          ],
        },
      ];

      const uploadDataTypeInputsMap = {
        string: 'a test string',
        Buffer: Buffer.from('a test string'),
        Uint8Array: new Uint8Array(Buffer.from('a test string')),
        ArrayBuffer: Buffer.from('a test string').buffer as ArrayBuffer,
      };

      for (const [label, input] of Object.entries(uploadDataTypeInputsMap)) {
        for (const dataItemOpts of validDataItemOpts) {
          it(`should properly upload a ${label} to turbo with events`, async () => {
            let uploadProgressCalled = false;
            let signingProgressCalled = false;
            let overallProgressCalled = false;
            let overallErrorCalled = false;
            let overallSuccessCalled = false;
            let uploadErrorCalled = false;
            let signingErrorCalled = false;
            let uploadSuccessCalled = false;
            let signingSuccessCalled = false;
            const response = await turbo.upload({
              data: input,
              dataItemOpts,
              events: {
                onProgress: () => {
                  overallProgressCalled = true;
                },
                onError: () => {
                  overallErrorCalled = true;
                },
                onSuccess: () => {
                  overallSuccessCalled = true;
                },
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

            // signing events
            assert.equal(signingProgressCalled, true);
            assert.equal(signingErrorCalled, false);
            assert.equal(signingSuccessCalled, true);

            // upload events
            assert.equal(uploadProgressCalled, true);
            assert.equal(uploadErrorCalled, false);
            assert.equal(uploadSuccessCalled, true);

            // overall events
            assert.equal(overallProgressCalled, true);
            assert.equal(overallErrorCalled, false);
            assert.equal(overallSuccessCalled, true);
          });
        }
      }

      const invalidDataItemOpts = [
        {
          testName: 'tag name too long',
          errorType: 'FailedRequestError',
          errorMessage:
            'Failed to upload file after 6 attempts\nFailed request (Status 400): Data item parsing error!',
          dataItemOpts: {
            tags: [
              {
                name: Array(1025).fill('a').join(''),
                value: 'test',
              },
            ],
          },
        },
        {
          testName: 'tag value too long',
          errorType: 'FailedRequestError',
          errorMessage:
            'Failed to upload file after 6 attempts\nFailed request (Status 400): Data item parsing error!',
          dataItemOpts: {
            tags: [
              {
                name: 'test',
                value: Array(3073).fill('a').join(''),
              },
            ],
          },
        },
        {
          testName: 'target Too Short',
          errorMessage: 'Target must be 32 bytes but was incorrectly 10',
          dataItemOpts: {
            target: 'target Too Short',
          },
        },
        {
          testName: 'anchor Too Short',
          errorMessage: 'Anchor must be 32 bytes',
          dataItemOpts: {
            anchor: 'anchor Too Short',
          },
        },
        {
          testName: 'target Too Long',
          errorMessage: 'Target must be 32 bytes but was incorrectly 33',
          dataItemOpts: {
            target: 'target Too Long This is 33 Bytes one two three four five',
          },
        },
        {
          testName: 'anchor Too Long',
          errorMessage: 'Anchor must be 32 bytes',
          dataItemOpts: {
            anchor: 'anchor Too Long This is 33 Bytes one two three four five',
          },
        },
      ];
      for (const {
        testName,
        dataItemOpts,
        errorMessage,
        errorType,
      } of invalidDataItemOpts) {
        it(`should fail to upload a Buffer to turbo when ${testName}`, async () => {
          await expectAsyncErrorThrow({
            promiseToError: turbo.upload({
              data: 'a test string',
              dataItemOpts,
            }),
            errorType,
            errorMessage,
          });
        });
      }

      it('should abort the upload when AbortController.signal is triggered', async () => {
        const error = await turbo
          .upload({
            data: 'a test string',
            signal: AbortSignal.timeout(0), // abort the request right away
          })
          .catch((error) => error);
        assert.ok(error instanceof CanceledError);
      });

      it('should return a FailedRequestError when the data is larger than the free limit and wallet is underfunded', async () => {
        const nonAllowListedJWK = await testArweave.crypto.generateJWK();
        const filePath = new URL('files/1MB_file', import.meta.url).pathname;
        const buffer = fs.readFileSync(filePath);
        const newTurbo = TurboFactory.authenticated({
          privateKey: nonAllowListedJWK,
          ...turboDevelopmentConfigurations,
        });
        const error = await newTurbo
          .upload({
            data: buffer,
          })
          .catch((error) => error);
        assert.ok(error instanceof FailedRequestError);
        assert.match(error.message, /Insufficient balance/);
      });

      it('should return proper error when http throws an unrecognized error', async () => {
        stub(turbo['uploadService']['httpService'], 'post').throws(Error);
        const error = await turbo
          .upload({
            data: 'a test string',
          })
          .catch((error) => error);
        assert.ok(error instanceof FailedRequestError);
        assert.equal(
          error.message,
          'Failed request: Failed to upload file after 6 attempts\n',
        );
      });
    });

    describe('uploadFile()', () => {
      const validDataItemOpts = [
        {
          target: '43charactersAbcdEfghIjklMnopQrstUvwxYz12345',
          anchor: 'anchorMustBeThirtyTwoBytesLong!!',
          tags: [
            {
              name: '', // empty name
              value: '', // empty val
            },
          ],
        },
        {
          // cspell:disable
          target: 'WeirdCharacters-_!felwfleowpfl12345678901234', // cspell:disable
          anchor: 'anchor-MusTBe__-__TwoBytesLong!!',
          tags: [
            {
              name: 'test',
              value: 'test',
            },
            {
              name: 'test2',
              value: 'test2',
            },
          ],
        },
      ];

      for (const dataItemOpts of validDataItemOpts) {
        it('should properly upload a Readable to turbo with events', async () => {
          let uploadProgressCalled = false;
          let signingProgressCalled = false;
          let overallProgressCalled = false;
          let overallErrorCalled = false;
          let overallSuccessCalled = false;
          let uploadErrorCalled = false;
          let signingErrorCalled = false;
          let uploadSuccessCalled = false;
          let signingSuccessCalled = false;
          const fileSize = fs.statSync(oneKiBFilePath).size;
          const response = await turbo.uploadFile({
            fileStreamFactory: () => fs.createReadStream(oneKiBFilePath),
            fileSizeFactory: () => fileSize,
            dataItemOpts,
            events: {
              // overall events
              onProgress: () => {
                overallProgressCalled = true;
              },
              onError: () => {
                overallErrorCalled = true;
              },
              onSuccess: () => {
                overallSuccessCalled = true;
              },
              // upload events
              onUploadProgress: () => {
                uploadProgressCalled = true;
              },
              onUploadError: () => {
                uploadErrorCalled = true;
              },
              onUploadSuccess: () => {
                uploadSuccessCalled = true;
              },
              // signing events
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

          // signing events
          assert.equal(signingProgressCalled, true);
          assert.equal(signingErrorCalled, false);
          assert.equal(signingSuccessCalled, true);

          // upload events
          assert.equal(uploadProgressCalled, true);
          assert.equal(uploadErrorCalled, false);
          assert.equal(uploadSuccessCalled, true);

          // overall events
          assert.equal(overallProgressCalled, true);
          assert.equal(overallErrorCalled, false);
          assert.equal(overallSuccessCalled, true);
        });
      }

      const invalidDataItemOpts = [
        {
          testName: 'tag name too long',
          errorType: 'FailedRequestError',
          errorMessage:
            'Failed to upload file after 6 attempts\nFailed request (Status 400): Data item parsing error!',
          dataItemOpts: {
            tags: [
              {
                name: Array(1025).fill('a').join(''),
                value: 'test',
              },
            ],
          },
        },
        {
          testName: 'tag value too long',
          errorType: 'FailedRequestError',
          errorMessage:
            'Failed to upload file after 6 attempts\nFailed request (Status 400): Data item parsing error!',
          dataItemOpts: {
            tags: [
              {
                name: 'test',
                value: Array(3073).fill('a').join(''),
              },
            ],
          },
        },
        {
          testName: 'target Too Short',
          errorMessage: 'Target must be 32 bytes but was incorrectly 10',
          dataItemOpts: {
            target: 'target Too Short',
          },
        },
        {
          testName: 'anchor Too Short',
          errorMessage: 'Anchor must be 32 bytes',
          dataItemOpts: {
            anchor: 'anchor Too Short',
          },
        },
        {
          testName: 'target Too Long',
          errorMessage: 'Target must be 32 bytes but was incorrectly 33',
          dataItemOpts: {
            target: 'target Too Long This is 33 Bytes one two three four five',
          },
        },
        {
          testName: 'anchor Too Long',
          errorMessage: 'Anchor must be 32 bytes',
          dataItemOpts: {
            anchor: 'anchor Too Long This is 33 Bytes one two three four five',
          },
        },
      ];
      for (const {
        testName,
        dataItemOpts,
        errorMessage,
        errorType,
      } of invalidDataItemOpts) {
        it(`should fail to upload a Buffer to turbo when ${testName}`, async () => {
          const fileSize = fs.statSync(oneKiBFilePath).size;

          await expectAsyncErrorThrow({
            promiseToError: turbo.uploadFile({
              fileStreamFactory: () => fs.createReadStream(oneKiBFilePath),
              fileSizeFactory: () => fileSize,
              dataItemOpts,
            }),
            errorType,
            errorMessage,
          });
        });
      }

      it('should abort the upload when AbortController.signal is triggered', async () => {
        const fileSize = fs.statSync(oneKiBFilePath).size;
        const error = await turbo
          .uploadFile({
            fileStreamFactory: () => fs.createReadStream(oneKiBFilePath),
            fileSizeFactory: () => fileSize,
            signal: AbortSignal.timeout(0), // abort the request right away
          })
          .catch((error) => error);
        assert.ok(error instanceof CanceledError);
      });

      it('should return a FailedRequestError when the file is larger than the free limit and wallet is underfunded', async () => {
        const nonAllowListedJWK = await testArweave.crypto.generateJWK();
        const filePath = new URL('files/1MB_file', import.meta.url).pathname;
        const fileSize = fs.statSync(filePath).size;
        const newTurbo = TurboFactory.authenticated({
          privateKey: nonAllowListedJWK,
          ...turboDevelopmentConfigurations,
        });
        const error = await newTurbo
          .uploadFile({
            fileStreamFactory: () => fs.createReadStream(filePath),
            fileSizeFactory: () => fileSize,
          })
          .catch((error) => error);
        assert.ok(error instanceof FailedRequestError);
        assert.match(error.message, /Insufficient balance/);
      });

      it('should return proper error when http throws an unrecognized error', async () => {
        stub(turbo['uploadService']['httpService'], 'post').throws(Error);
        const error = await turbo
          .uploadFile({
            fileStreamFactory: () => fs.createReadStream(oneKiBFilePath),
            fileSizeFactory: () => fs.statSync(oneKiBFilePath).size,
          })
          .catch((error) => error);
        assert.ok(error instanceof FailedRequestError);
        assert.equal(
          error.message,
          'Failed request: Failed to upload file after 6 attempts\n',
        );
      });
    });

    describe('uploadFolder()', () => {
      it('uploads expected data items and manifest', async () => {
        const folderPath = new URL('files/stubFolder', import.meta.url)
          .pathname;

        const result = await turbo.uploadFolder({
          folderPath,
          dataItemOpts: {
            tags: [{ name: 'Content-Type', value: 'total/gibberish' }],
          },
        });
        assert.ok(result !== undefined);
        assert.ok(result.manifest !== undefined);

        assert.equal(result.fileResponses.length, 7);
        assert.ok(result.manifestResponse !== undefined);
      });

      it('uploads expected manifest with an index.html', async () => {
        const folderPath = new URL(
          'files/stubFolderWithIndexFile',
          import.meta.url,
        ).pathname;

        const result = await turbo.uploadFolder({
          folderPath,
        });
        assert.ok(result !== undefined);
        assert.ok(result.manifest !== undefined);

        assert.equal(result.fileResponses.length, 5);
        assert.equal(result.manifest?.index.path, 'index.html');
        assert.equal(
          result.manifest?.fallback?.id,
          result.manifest?.paths['404.html'].id,
        );
      });

      it('uploads expected manifest with specified index file and fallback files', async () => {
        const folderPath = new URL(
          'files/stubFolderWithIndexFile',
          import.meta.url,
        ).pathname;

        const result = await turbo.uploadFolder({
          folderPath,
          manifestOptions: {
            indexFile: '3.txt',
            fallbackFile: 'content/4.txt',
          },
        });

        assert.equal(result.fileResponses.length, 5);
        assert.equal(result.manifest?.index.path, '3.txt');
        assert.equal(
          result.manifest?.fallback?.id,
          result.manifest?.paths['content/4.txt'].id,
        );
      });
    });

    it('getWincForFiat() with a bad promo code', async () => {
      const error = await turbo
        .getWincForFiat({
          amount: USD(10), // $10.00 USD
          promoCodes: ['BAD_PROMO_CODE'],
        })
        .catch((error) => error);
      assert.ok(error instanceof FailedRequestError);
      // TODO: Could provide better error message to client. We have error messages on response.data
      assert.equal(
        error.message,
        "Failed request (Status 400): No promo code found with code 'BAD_PROMO_CODE'",
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
            amount: USD(10), // 10 USD
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

  describe('TurboAuthenticatedNodeClient with EthereumSigner', () => {
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
        ...turboTestEnvConfigurations,
      });
    });

    it('should properly upload a Readable to turbo', async () => {
      const fileSize = fs.statSync(oneKiBFilePath).size;
      const response = await turbo.uploadFile({
        fileStreamFactory: () => fs.createReadStream(oneKiBFilePath),
        fileSizeFactory: () => fileSize,
      });
      assert.ok(response !== undefined);
      assert.ok(response.fastFinalityIndexes !== undefined);
      assert.ok(response.dataCaches !== undefined);
      assert.ok(response.owner !== undefined);
      assert.equal(response.owner, testEthAddressBase64);
    });

    it('should properly upload a Buffer to turbo with uploadFile', async () => {
      const fileSize = fs.statSync(oneKiBFilePath).size;
      const response = await turbo.uploadFile({
        fileStreamFactory: () => fs.readFileSync(oneKiBFilePath),
        fileSizeFactory: () => fileSize,
      });
      assert.ok(response !== undefined);
      assert.equal(response.owner, testEthAddressBase64);
    });

    it('should properly upload a Buffer to turbo with uploadSignedDataItem with events', async () => {
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
          // upload events
          onUploadProgress: () => {
            uploadProgressCalled = true;
          },
          onUploadError: () => {
            uploadErrorCalled = true;
          },
          onUploadSuccess: () => {
            uploadSuccessCalled = true;
          },
          // signing events
          // @ts-expect-error - this is a test to check that the signing progress is not called for signed data items
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
      assert.equal(response.id, signedDataItem.id);

      // upload events
      assert.equal(uploadProgressCalled, true);
      assert.equal(uploadErrorCalled, false);
      assert.equal(uploadSuccessCalled, true);

      // signing events should not be called
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

  describe('TurboAuthenticatedNodeClient with HexSolanaSigner', () => {
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
      const fileSize = fs.statSync(oneKiBFilePath).size;
      const response = await turbo.uploadFile({
        fileStreamFactory: () => fs.createReadStream(oneKiBFilePath),
        fileSizeFactory: () => fileSize,
      });
      assert.ok(response !== undefined);
      assert.ok(response.fastFinalityIndexes !== undefined);
      assert.ok(response.dataCaches !== undefined);
      assert.ok(response.owner !== undefined);
      assert.equal(response.owner, testSolAddressBase64);
    });

    it('should properly upload a Buffer to turbo with events', async () => {
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
          // @ts-expect-error - this is a test to check that the signing progress is not called for signed data items
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
      assert.equal(response.owner, testSolAddressBase64);
      assert.equal(uploadProgressCalled, true);
      assert.equal(uploadErrorCalled, false);
      assert.equal(uploadSuccessCalled, true);
      // Since this is already signed, signing progress won't be called
      assert.equal(signingProgressCalled, false);
      assert.equal(signingErrorCalled, false);
      assert.equal(signingSuccessCalled, false);
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

  describe('TurboAuthenticatedNodeClient with KyveSigner', () => {
    let turbo: TurboAuthenticatedClient;

    const tokenTools = new KyveToken({
      gatewayUrl: kyveUrlString,
      pollingOptions: {
        maxAttempts: 3,
        pollingIntervalMs: 10,
        initialBackoffMs: 0,
      },
    });

    let signer: TurboSigner; // KyveSigner
    before(async () => {
      signer = await signerFromKyveMnemonic(testKyveMnemonic);

      turbo = TurboFactory.authenticated({
        signer,
        ...turboDevelopmentConfigurations,
        token: 'kyve',
        tokenTools,
      });
    });

    it('should properly upload a Readable to turbo with events', async () => {
      const fileSize = fs.statSync(oneKiBFilePath).size;
      let uploadProgressCalled = false;
      let uploadErrorCalled = false;
      let uploadSuccessCalled = false;
      let signingProgressCalled = false;
      let signingErrorCalled = false;
      let signingSuccessCalled = false;
      let overallProgressCalled = false;
      let overallErrorCalled = false;
      let overallSuccessCalled = false;
      const response = await turbo.uploadFile({
        fileStreamFactory: () => fs.createReadStream(oneKiBFilePath),
        fileSizeFactory: () => fileSize,
        events: {
          // overall events
          onProgress: () => {
            overallProgressCalled = true;
          },
          onError: () => {
            overallErrorCalled = true;
          },
          onSuccess: () => {
            overallSuccessCalled = true;
          },
          // upload events
          onUploadProgress: () => {
            uploadProgressCalled = true;
          },
          onUploadError: () => {
            uploadErrorCalled = true;
          },
          onUploadSuccess: () => {
            uploadSuccessCalled = true;
          },
          // signing events
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
      assert.equal(response.owner, base64KyveAddress);

      // signing events
      assert.equal(signingProgressCalled, true);
      assert.equal(signingErrorCalled, false);
      assert.equal(signingSuccessCalled, true);

      // upload events
      assert.equal(uploadProgressCalled, true);
      assert.equal(uploadErrorCalled, false);
      assert.equal(uploadSuccessCalled, true);

      // overall events
      assert.equal(overallProgressCalled, true);
      assert.equal(overallErrorCalled, false);
      assert.equal(overallSuccessCalled, true);
    });

    it('should properly upload a Buffer to turbo with events', async () => {
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
      assert.equal(response.owner, base64KyveAddress);

      // signing events should not be called at all
      assert.equal(signingProgressCalled, false);
      assert.equal(signingErrorCalled, false);
      assert.equal(signingSuccessCalled, false);

      // upload events
      assert.equal(uploadProgressCalled, true);
      assert.equal(uploadErrorCalled, false);
      assert.equal(uploadSuccessCalled, true);
    });

    it('should get a checkout session with kyve token', async () => {
      const { adjustments, paymentAmount, quotedPaymentAmount, url, id } =
        await turbo.createCheckoutSession({
          amount: USD(10), // 10 USD
          owner: testKyveNativeAddress,
        });

      assert.deepEqual(adjustments, []);
      assert.equal(paymentAmount, 1000);
      assert.equal(quotedPaymentAmount, 1000);
      assert.ok(typeof url === 'string');
      assert.ok(typeof id === 'string');
    });

    it.skip('should topUpWithTokens() to a KYVE wallet', async () => {
      const { id, quantity, owner, winc, target } = await turbo.topUpWithTokens(
        {
          tokenAmount: 1_000, // 0.001_000 KYVE
        },
      );

      assert.ok(typeof id === 'string');
      assert.ok(typeof target === 'string');
      assert.ok(typeof winc === 'string');
      assert.equal(quantity, '1000');
      assert.equal(owner, testKyveNativeAddress);
    });

    it('should fail to topUpWithTokens() to a KYVE wallet if tx is stubbed to succeed but wont exist on chain', async () => {
      stub(tokenTools, 'createAndSubmitTx').resolves({
        id: 'stubbed-tx-id',
        target: 'fake target',
      });

      await turbo
        .topUpWithTokens({
          tokenAmount: 1_000, // 0.001_000 KYVE
        })
        .catch((error) => {
          assert.ok(error instanceof Error);
          assert.match(error.message, /Failed to submit fund transaction!/);
        });
    });
  });

  describe('ZeroDecimalCurrency()', () => {
    it('should construct with a value zero decimal value', () => {
      const zeroDecimalCurrency = JPY(1000);
      assert.equal(zeroDecimalCurrency.type, 'jpy');
      assert.equal(zeroDecimalCurrency.amount, 1000);
    });

    it('should throw an error when constructing with a non-zero decimal value', () => {
      assert.throws(
        () => JPY(100.1),
        /jpy currency amount must have zero decimal places/,
      );
    });

    it('should throw an error when constructing with a negative value', () => {
      assert.throws(() => JPY(-532), /jpy currency amount cannot be negative/);
    });
  });

  describe('TwoDecimalCurrency()', () => {
    it('should construct with a value two decimal value', () => {
      const twoDecimalCurrency = USD(10.43);
      assert.equal(twoDecimalCurrency.type, 'usd');
      assert.equal(twoDecimalCurrency.amount, 1043);
    });

    it('should construct with a zero decimal value', () => {
      const twoDecimalCurrency = USD(764);
      assert.equal(twoDecimalCurrency.type, 'usd');
      assert.equal(twoDecimalCurrency.amount, 76400);
    });

    it('should throw an error when constructing with a non-two decimal value', () => {
      assert.throws(
        () => USD(10.431),
        /usd currency amount must have two decimal places/,
      );
    });
  });
});
