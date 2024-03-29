import { ArconnectSigner, ArweaveSigner, createData } from 'arbundles';
import Arweave from 'arweave/node/index.js';
import { CanceledError } from 'axios';
import { expect } from 'chai';
import { ReadableStream } from 'node:stream/web';
import { restore, stub } from 'sinon';

import { USD } from '../src/common/currency.js';
import { JWKInterface } from '../src/common/jwk.js';
import {
  ARToTokenAmount,
  ArweaveToken,
  WinstonToTokenAmount,
} from '../src/common/token.js';
import {
  TurboAuthenticatedClient,
  TurboUnauthenticatedClient,
} from '../src/common/turbo.js';
import { jwkToPublicArweaveAddress } from '../src/utils/base64.js';
import { FailedRequestError } from '../src/utils/errors.js';
import { TurboFactory } from '../src/web/index.js';
import { turboDevelopmentConfigurations } from './helpers.js';

describe('Browser environment', () => {
  afterEach(() => {
    // Restore all stubs
    restore();
  });

  before(() => {
    (global as any).window = { document: {}, arweaveWallet: Arweave.init({}) };
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
      const jwk = await Arweave.crypto.generateJWK();
      const turbo = TurboFactory.authenticated({
        privateKey: jwk,
      });
      expect(turbo).to.be.instanceOf(TurboUnauthenticatedClient);
    });

    it('should return a TurboAuthenticatedClient when running in Node environment and an ArconnectSigner', async () => {
      const turbo = TurboFactory.authenticated({
        signer: new ArconnectSigner(global.window.arweaveWallet),
        ...turboDevelopmentConfigurations,
      });
      expect(turbo).to.be.instanceOf(TurboAuthenticatedClient);
    });

    it('should error when creating a TurboAuthenticatedClient and not providing a privateKey or a signer', async () => {
      expect(() =>
        TurboFactory.authenticated({
          ...turboDevelopmentConfigurations,
        }),
      ).to.throw('A privateKey or signer must be provided.');
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
          const jwk = await Arweave.crypto.generateJWK();
          const signer = new ArweaveSigner(jwk);
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
          expect(response['owner']).to.equal(jwkToPublicArweaveAddress(jwk));
        });

        it('should abort the upload when AbortController.signal is triggered', async () => {
          const jwk = await Arweave.crypto.generateJWK();
          const signer = new ArweaveSigner(jwk);
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
          const jwk = await Arweave.crypto.generateJWK();
          const signer = new ArweaveSigner(jwk);
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
      it('should properly submit an existing payment transaction ID to the Turbo Payment Service for processing', async () => {
        const existingPaymentTxIdToDev = // cspell:disable
          'e5kVDnbpyjUFY0SciSvZ1dDqKOWIwnfGvlr4yz-uSSY';

        const { id, winc, owner, token } = await turbo.submitFundTransaction({
          txId: existingPaymentTxIdToDev,
        });
        expect(id).to.equal(existingPaymentTxIdToDev);
        expect(owner).to.equal('jaxl_dxqJ00gEgQazGASFXVRvO4h-Q0_vnaLtuOUoWU'); // cspell:enable
        expect(winc).to.equal('7');
        expect(token).to.equal('arweave');
      });

      it('should return a FailedRequestError when submitting a non-existent payment transaction ID', async () => {
        const nonExistentPaymentTxId = 'non-existent-payment-tx-id';
        const error = await turbo
          .submitFundTransaction({ txId: nonExistentPaymentTxId })
          .catch((error) => error);
        expect(error).to.be.instanceOf(FailedRequestError);
        expect(error.message).to.contain('Failed request: 404: Not Found');
      });
    });
  });
  describe('TurboAuthenticatedWebClient', () => {
    let turbo: TurboAuthenticatedClient;
    let jwk: JWKInterface;
    let address: string;

    const arweave = Arweave.init({});
    const arweaveToken = new ArweaveToken({
      arweave,
      pollingOptions: {
        maxAttempts: 3,
        pollingIntervalMs: 0,
        initialBackoffMs: 0,
      },
    });
    const tokenMap = {
      arweave: arweaveToken,
    };

    before(async () => {
      jwk = await Arweave.crypto.generateJWK();

      turbo = TurboFactory.authenticated({
        privateKey: jwk,
        ...turboDevelopmentConfigurations,
        // @ts-ignore
        tokenMap,
      });
      address = await Arweave.init({}).wallets.jwkToAddress(jwk);
    });

    it('getBalance()', async () => {
      const balance = await turbo.getBalance();
      expect(+balance.winc).to.equal(0);
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
        expect(response['owner']).to.equal(jwkToPublicArweaveAddress(jwk));
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
        const oneMBBuffer = Buffer.alloc(1024 * 1024);
        const readableStream = new ReadableStream({
          start(controller) {
            controller.enqueue(oneMBBuffer);
            controller.close();
          },
        });
        const error = await turbo
          .uploadFile({
            fileStreamFactory: () => readableStream,
            fileSizeFactory: () => oneMBBuffer.byteLength,
          })
          .catch((err) => err);
        expect(error).to.be.instanceOf(FailedRequestError);
        expect(error.message).to.contain('Insufficient balance');
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
      expect(error?.message).to.equal('Failed request: 400: Bad Request');
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
            owner: address,
            promoCodes: ['BAD_PROMO_CODE'],
          })
          .catch((error) => error);
        expect(error).to.be.instanceOf(FailedRequestError);
        expect(error?.message).to.equal('Failed request: 400: Bad Request');
      });
    });

    describe('fund()', function () {
      this.timeout(30_000); // Can take awhile for payment to retrieve transaction

      // Skipped this test in CI because the provided fresh wallet is underfunded on arweave
      // TODO: run arlocal in CI instead of using payment dev / arweave.net
      // before(async() => await arweave.api.post('fund' ... ))
        const { winc } = await turbo.topUpWithTokens({
          tokenAmount: WinstonToTokenAmount(10),
        });
        expect(winc).to.equal('7');
      });

      it('should fail to submit fund tx when arweave fund tx is stubbed to succeed but wont exist on chain', async () => {
        stub(arweaveToken, 'submitTx').resolves();
        stub(arweave.transactions, 'getTransactionAnchor').resolves(
          'stub anchor',
        );
        stub(arweave.transactions, 'getPrice').resolves('101 :)');

        // simulate polling for transaction
        stub(arweave.api, 'post')
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
    });
  });
});
