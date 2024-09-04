import {
  ArconnectSigner,
  ArweaveSigner,
  EthereumSigner,
  HexSolanaSigner,
  createData,
} from 'arbundles';
import { CanceledError } from 'axios';
import { BigNumber } from 'bignumber.js';
import { expect } from 'chai';
import { File } from 'node-fetch';
import { ReadableStream } from 'node:stream/web';
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

  describe('TurboFactory', () => {
    it('should be a TurboUnauthenticatedClient running in the browser and not provided a privateKey', () => {
      const turbo = TurboFactory.unauthenticated(
        turboDevelopmentConfigurations,
      );
      expect(turbo).to.be.instanceOf(TurboUnauthenticatedClient);
    });

    it('should be a TurboAuthenticatedClient running in the browser and provided a privateKey', async () => {
      const turbo = TurboFactory.authenticated({
        privateKey: testJwk,
        ...turboDevelopmentConfigurations,
      });
      expect(turbo).to.be.instanceOf(TurboUnauthenticatedClient);
    });

    it('should return a TurboAuthenticatedClient when running in Web environment and an EthereumSigner', async () => {
      const turbo = TurboFactory.authenticated({
        signer: new EthereumSigner(testEthWallet),
        ...turboDevelopmentConfigurations,
      });
      expect(turbo).to.be.instanceOf(TurboAuthenticatedClient);
    });

    it('should return a TurboAuthenticatedClient when running in Web environment and a HexSolanaSigner', async () => {
      const turbo = TurboFactory.authenticated({
        signer: new HexSolanaSigner(testSolWallet),
        ...turboDevelopmentConfigurations,
      });
      expect(turbo).to.be.instanceOf(TurboAuthenticatedClient);
    });

    it('should return a TurboAuthenticatedClient when running in Web environment and an ArconnectSigner', async () => {
      const turbo = TurboFactory.authenticated({
        signer: new ArconnectSigner(
          (global as any).window.arweaveWallet,
          // @ts-ignore
          testArweave,
        ),
        ...turboDevelopmentConfigurations,
      });
      expect(turbo).to.be.instanceOf(TurboAuthenticatedClient);
    });

    it('should return a TurboAuthenticatedClient when running in Node environment and a provided base58 SOL secret key', async () => {
      const turbo = TurboFactory.authenticated({
        privateKey: testSolWallet,
        token: 'solana',
        ...turboDevelopmentConfigurations,
      });
      expect(turbo).to.be.instanceOf(TurboAuthenticatedClient);
    });

    it('should error when creating a TurboAuthenticatedClient and when providing a SOL Secret Key to construct an Arweave signer', async () => {
      expect(() =>
        TurboFactory.authenticated({
          privateKey: testSolWallet,
          token: 'arweave',
          ...turboDevelopmentConfigurations,
        }),
      ).to.throw('A JWK must be provided for ArweaveSigner.');
    });

    it('should return a TurboAuthenticatedClient when running in Node environment and a provided ethereum private key', async () => {
      const turbo = TurboFactory.authenticated({
        privateKey: testEthWallet,
        token: 'ethereum',
        ...turboDevelopmentConfigurations,
      });
      expect(turbo).to.be.instanceOf(TurboAuthenticatedClient);
    });

    it('should error when creating a TurboAuthenticatedClient and when providing a SOL Secret Key to construct an Ethereum signer', async () => {
      expect(() =>
        TurboFactory.authenticated({
          privateKey: testSolWallet,
          token: 'ethereum',
          ...turboDevelopmentConfigurations,
        }),
      ).to.throw(
        'A valid Ethereum private key must be provided for EthereumSigner.',
      );
    });

    it('should error when creating a TurboAuthenticatedClient and not providing a privateKey or a signer', async () => {
      expect(() =>
        TurboFactory.authenticated({
          ...turboDevelopmentConfigurations,
        }),
      ).to.throw('A privateKey or signer must be provided.');
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
      expect(turbo).to.be.instanceOf(TurboAuthenticatedClient);
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
      expect(error).to.be.instanceOf(Error);
      expect(error.message).to.contain('Only EthereumSigner is supported');
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
        expect(winc).to.not.be.undefined.and.to.be.a('number');
        expect(fiat).to.have.property('usd').that.is.a('number');
        expect(adjustments).to.not.be.undefined;
      });

      it('getFiatToAR()', async () => {
        const { currency, rate } = await turbo.getFiatToAR({ currency: 'usd' });
        expect(currency).to.equal('usd');
        expect(rate).to.be.a('number');
      });

      it('getSupportedCountries()', async () => {
        const countries = await turbo.getSupportedCountries();
        expect(countries).to.be.an('array');
        expect(countries.length).to.be.greaterThan(0);
        expect(countries).to.include('United States');
      });

      it('getSupportedCurrencies()', async () => {
        const { supportedCurrencies, limits } =
          await turbo.getSupportedCurrencies();
        expect(supportedCurrencies).to.not.be.undefined;
        expect(supportedCurrencies).to.be.an('array');
        expect(supportedCurrencies.length).to.be.greaterThan(0);
        expect(supportedCurrencies).to.include('usd');
        expect(limits).to.not.be.undefined;
        expect(limits).to.be.an('object');
        expect(limits).to.have.property('usd');
        expect(limits.usd).to.have.property('minimumPaymentAmount');
        expect(limits.usd).to.have.property('maximumPaymentAmount');
        expect(limits.usd).to.have.property('suggestedPaymentAmounts');
        expect(limits.usd).to.have.property('zeroDecimalCurrency');
      });

      it('getUploadCosts()', async () => {
        const [{ winc, adjustments }] = await turbo.getUploadCosts({
          bytes: [1024],
        });
        expect(winc).to.not.be.undefined;
        expect(+winc).to.be.greaterThan(0);
        expect(adjustments).to.not.be.undefined;
        expect(adjustments).to.be.an('array');
      });

      it('getWincForFiat()', async () => {
        const { winc } = await turbo.getWincForFiat({
          amount: USD(10), // $10.00 USD
        });
        expect(winc).to.not.be.undefined;
        expect(+winc).to.be.greaterThan(0);
      });

      describe('uploadSignedDataItem()', () => {
        it('supports sending a signed Buffer to turbo', async () => {
          const signer = new ArweaveSigner(testJwk);
          const signedDataItem = createData('signed data item', signer);
          await signedDataItem.sign(signer);

          const response = await turbo.uploadSignedDataItem({
            dataItemStreamFactory: () => signedDataItem.getRaw(),
            dataItemSizeFactory: () => signedDataItem.getRaw().length,
          });
          expect(response).to.not.be.undefined;
          expect(response).to.have.property('fastFinalityIndexes');
          expect(response).to.have.property('dataCaches');
          expect(response).to.have.property('owner');
          expect(response['owner']).to.equal(testArweaveNativeB64Address);
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
          expect(error).be.instanceOf(CanceledError);
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
          expect(error).to.be.instanceOf(FailedRequestError);
          expect(error.message).to.contain('Invalid Data Item');
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
          expect(adjustments).to.deep.equal([]);
          expect(paymentAmount).to.equal(1000);
          expect(quotedPaymentAmount).to.equal(1000);
          expect(url).to.be.a('string');
          expect(id).to.be.a('string');
          expect(client_secret).to.equal(undefined);
          expect(winc).to.be.a('string');
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
        expect(adjustments).to.deep.equal([]);
        expect(paymentAmount).to.equal(2000);
        expect(quotedPaymentAmount).to.equal(2000);
        expect(url).to.equal(undefined);
        expect(id).to.be.a('string');
        expect(client_secret).to.be.a('string');
        expect(winc).to.be.a('string');
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
        expect(error).to.be.instanceOf(FailedRequestError);
        expect(error.message).to.contain('Failed request: 404: Not Found');
      });

      it('should properly submit an existing payment transaction ID to the Turbo Payment Service for processing a pending tx', async () => {
        const txId = await sendFundTransaction(1000);

        const { id, winc, owner, token, status } =
          await turbo.submitFundTransaction({
            txId,
          });
        expect(id).to.equal(txId);
        expect(owner).to.equal(testArweaveNativeB64Address);
        expect(winc).to.equal('766');
        expect(token).to.equal('arweave');
        expect(status).to.equal('pending');
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
        expect(id).to.equal(txId);
        expect(owner).to.equal(testArweaveNativeB64Address);
        expect(winc).to.equal('766');
        expect(token).to.equal('arweave');
        expect(status).to.equal('confirmed');

        const balanceAfter = await getRawBalance(testArweaveNativeB64Address);

        expect(+balanceAfter - +balanceBefore).to.equal(766);
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
        expect(balance.winc).to.equal(rawBalance);
      });

      it('returns correct balance for an empty wallet', async () => {
        const emptyJwk = await testArweave.crypto.generateJWK();
        const emptyTurbo = TurboFactory.authenticated({
          privateKey: emptyJwk,
          ...turboDevelopmentConfigurations,
        });
        const balance = await emptyTurbo.getBalance();
        expect(balance.winc).to.equal('0');
      });
    });

    describe('uploadFile()', () => {
      it('should properly upload a ReadableStream to turbo', async () => {
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode('test data');
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
        expect(response).to.not.be.undefined;
        expect(response).to.not.be.undefined;
        expect(response).to.have.property('fastFinalityIndexes');
        expect(response).to.have.property('dataCaches');
        expect(response).to.have.property('owner');
        expect(response['owner']).to.equal(testArweaveNativeB64Address);
      });

      it('should abort the upload when AbortController.signal is triggered', async () => {
        const encoder = new TextEncoder();
        const uint8Array = encoder.encode('test data');
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
        expect(error).to.be.instanceOf(CanceledError);
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
        expect(error).to.be.instanceOf(FailedRequestError);
        expect(error.message).to.contain('Insufficient balance');
      });
    });

    describe('uploadFolder()', () => {
      it('uploads expected data items and manifest', async () => {
        const files = [
          new File(['test data'], 'stubFile.txt', { type: 'text/plain' }),
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
        expect(result).to.not.be.undefined;
        expect(result).to.have.property('manifest');

        expect(result['fileResponses']).to.have.length(4);
        expect(result['manifestResponse']).to.not.be.undefined;
      });
    });

    it('getWincForFiat() fails with bad promo code', async () => {
      const error = await turbo
        .getWincForFiat({
          amount: USD(10), // $10.00 USD
          promoCodes: ['BAD_CODE'],
        })
        .catch((error) => error);
      expect(error).to.be.instanceOf(FailedRequestError);
      expect(error?.message).to.equal(
        "Failed request: 400: No promo code found with code 'BAD_CODE'",
      );
    });

    it('getWincForFiat() without a promo could return proper rates', async () => {
      const { winc, adjustments } = await turbo.getWincForFiat({
        amount: USD(10), // $10.00 USD
      });
      expect(+winc).to.be.greaterThan(0);
      expect(adjustments).to.not.be.undefined;
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
        expect(error).to.be.instanceOf(FailedRequestError);
        expect(error?.message).to.equal(
          "Failed request: 400: No promo code found with code 'BAD_PROMO_CODE'",
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

        expect(winc).to.equal('7');
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
        expect(error).to.be.instanceOf(Error);
        expect(error.message).to.contain('Failed to submit fund transaction!');
      });

      it('should fail to submit fund tx when fund tx fails to post to arweave', async () => {
        stub(testArweave.transactions, 'post').throws();

        const error = await turbo
          .topUpWithTokens({
            tokenAmount: WinstonToTokenAmount(1000),
          })
          .catch((error) => error);
        expect(error).to.be.instanceOf(Error);
        expect(error.message).to.contain('Failed to post transaction');
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
      const uint8Array = encoder.encode('test data');
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

      expect(response).to.not.be.undefined;
      expect(response).to.not.be.undefined;
      expect(response).to.have.property('fastFinalityIndexes');
      expect(response).to.have.property('dataCaches');
      expect(response).to.have.property('owner');
      expect(response['owner']).to.equal(testEthAddressBase64);
    });

    it('should properly upload a Buffer to turbo', async () => {
      const signedDataItem = createData('signed data item', signer, {});
      await signedDataItem.sign(signer);

      const response = await turbo.uploadSignedDataItem({
        dataItemStreamFactory: () => signedDataItem.getRaw(),
        dataItemSizeFactory: () => signedDataItem.getRaw().length,
      });

      expect(response).to.not.be.undefined;
      expect(response).to.not.be.undefined;
      expect(response).to.have.property('fastFinalityIndexes');
      expect(response).to.have.property('dataCaches');
      expect(response).to.have.property('owner');
      expect(response['owner']).to.equal(testEthAddressBase64);
    });

    it.skip('should topUpWithTokens() to an ETH wallet', async () => {
      const { id, quantity, owner, winc, target } = await turbo.topUpWithTokens(
        {
          tokenAmount: 100_000_000, // 0.000_000_000_100_000_000 ETH
        },
      );

      expect(id).to.be.a('string');
      expect(target).to.be.a('string');
      expect(winc).be.a('string');
      expect(quantity).to.equal('100000000');
      expect(owner).to.equal(testEthNativeAddress);
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
          expect(error).to.be.instanceOf(Error);
          expect(error.message).to.contain(
            'Failed to submit fund transaction!',
          );
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
      const uint8Array = encoder.encode('test data');
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

      expect(response).to.not.be.undefined;
      expect(response).to.not.be.undefined;
      expect(response).to.have.property('fastFinalityIndexes');
      expect(response).to.have.property('dataCaches');
      expect(response).to.have.property('owner');
      expect(response['owner']).to.equal(testSolAddressBase64);
    });

    it('should properly upload a Buffer to turbo', async () => {
      const signedDataItem = createData('signed data item', signer, {});
      await signedDataItem.sign(signer);

      const response = await turbo.uploadSignedDataItem({
        dataItemStreamFactory: () => signedDataItem.getRaw(),
        dataItemSizeFactory: () => signedDataItem.getRaw().length,
      });

      expect(response).to.not.be.undefined;
      expect(response).to.not.be.undefined;
      expect(response).to.have.property('fastFinalityIndexes');
      expect(response).to.have.property('dataCaches');
      expect(response).to.have.property('owner');
      expect(response['owner']).to.equal(testSolAddressBase64);
    });

    it.skip('should topUpWithTokens() to a SOL wallet', async () => {
      const { id, quantity, owner, winc, target } = await turbo.topUpWithTokens(
        {
          tokenAmount: 100_000, // 0.0001 SOL
        },
      );

      expect(id).to.be.a('string');
      expect(target).to.be.a('string');
      expect(winc).be.a('string');
      expect(quantity).to.equal('100000');
      expect(owner).to.equal(testSolNativeAddress);
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
          expect(error).to.be.instanceOf(Error);
          expect(error.message).to.contain(
            'Failed to submit fund transaction!',
          );
        });
    });
  });
});
