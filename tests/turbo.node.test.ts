import { ArweaveSigner, createData } from 'arbundles';
import Arweave from 'arweave';
import axios, { CanceledError } from 'axios';
import { expect } from 'chai';
import fs from 'fs';
import { describe } from 'mocha';
import { Readable } from 'node:stream';
import { restore, stub } from 'sinon';

import { USD } from '../src/common/currency.js';
import {
  ARToTokenAmount,
  ArweaveToken,
  WinstonToTokenAmount,
} from '../src/common/token.js';
import {
  TurboAuthenticatedClient,
  TurboUnauthenticatedClient,
} from '../src/common/turbo.js';
import { TurboFactory } from '../src/node/factory.js';
import { FailedRequestError } from '../src/utils/errors.js';
import {
  expectAsyncErrorThrow,
  fundArLocalWalletAddress,
  mineArLocalBlock,
  testJwk,
  testWalletAddress,
  turboDevelopmentConfigurations,
} from './helpers.js';

describe('Node environment', () => {
  afterEach(() => {
    // Restore all stubs
    restore();
  });
  const urlString = process.env.ARWEAVE_GATEWAY ?? 'http://localhost:1984';
  const arweaveUrl = new URL(urlString);
  const arweave = Arweave.init({
    host: arweaveUrl.hostname,
    port: +arweaveUrl.port,
    protocol: arweaveUrl.protocol.replace(':', ''),
  });

  describe('TurboFactory', () => {
    it('should return a TurboUnauthenticatedClient when running in Node environment and not provided a privateKey', () => {
      const turbo = TurboFactory.unauthenticated(
        turboDevelopmentConfigurations,
      );
      expect(turbo).to.be.instanceOf(TurboUnauthenticatedClient);
    });
    it('should return a TurboAuthenticatedClient when running in Node environment and provided a privateKey', async () => {
      const turbo = TurboFactory.authenticated({
        privateKey: testJwk,
        ...turboDevelopmentConfigurations,
      });
      expect(turbo).to.be.instanceOf(TurboAuthenticatedClient);
    });

    it('should return a TurboAuthenticatedClient when running in Node environment and an ArweaveSigner', async () => {
      const turbo = TurboFactory.authenticated({
        signer: new ArweaveSigner(testJwk),
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

  describe('TurboUnauthenticatedNodeClient', () => {
    let turbo: TurboUnauthenticatedClient;

    before(() => {
      turbo = TurboFactory.unauthenticated(turboDevelopmentConfigurations);
    });

    it('getFiatRates()', async () => {
      const { winc, fiat, adjustments } = await turbo.getFiatRates();
      expect(winc).to.not.be.undefined.and.to.be.a('number');
      expect(fiat).to.have.property('usd').that.is.a('number');
      expect(adjustments).to.not.be.undefined;
    });

    it('getFiatToAR()', async () => {
      const { currency, rate } = await turbo.getFiatToAR({
        currency: 'usd',
      });
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
      const signer = new ArweaveSigner(testJwk);
      it('should properly upload a signed Buffer to turbo', async () => {
        const signedDataItem = createData('signed data item', signer, {});
        await signedDataItem.sign(signer);

        const response = await turbo.uploadSignedDataItem({
          dataItemStreamFactory: () => signedDataItem.getRaw(),
          dataItemSizeFactory: () => signedDataItem.getRaw().length,
        });
        expect(response).to.not.be.undefined;
        expect(response).to.have.property('fastFinalityIndexes');
        expect(response).to.have.property('dataCaches');
        expect(response).to.have.property('owner');
        expect(response['owner']).to.equal(testWalletAddress);
      });

      it('should properly upload signed Readable to turbo', async () => {
        const signedDataItem = createData('signed data item', signer, {});
        await signedDataItem.sign(signer);

        const response = await turbo.uploadSignedDataItem({
          dataItemStreamFactory: () => Readable.from(signedDataItem.getRaw()),
          dataItemSizeFactory: () => signedDataItem.getRaw().length,
        });
        expect(response).to.not.be.undefined;
        expect(response).to.have.property('fastFinalityIndexes');
        expect(response).to.have.property('dataCaches');
        expect(response).to.have.property('owner');
        expect(response['owner']).to.equal(testWalletAddress);
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
        expect(error).to.be.instanceOf(CanceledError);
      });

      it('should return FailedRequestError for incorrectly signed data item', async () => {
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
          client_secret,
          id,
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
        await fundArLocalWalletAddress(arweave, testWalletAddress);

        const paymentUrl = new URL(
          turboDevelopmentConfigurations.paymentServiceConfig.url,
        );
        const target = (await axios.get(`${paymentUrl}/info`)).data.addresses
          .arweave;
        console.log('target', target);
        const tx = await arweave.createTransaction({
          quantity: '1000', // cspell:disable
          target,
        });

        console.log('idb4', tx.id);

        await arweave.transactions.sign(tx, testJwk);

        const existingPaymentTxIdToDev = tx.id;
        await arweave.transactions.post(tx);

        await mineArLocalBlock(arweave);
        await mineArLocalBlock(arweave);
        await mineArLocalBlock(arweave);
        console.log('existingPaymentTxIdToDev', existingPaymentTxIdToDev);

        const { id, winc, owner, token } = await turbo.submitFundTransaction({
          txId: existingPaymentTxIdToDev,
        });
        expect(id).to.equal(existingPaymentTxIdToDev);
        expect(owner).to.equal('jaxl_dxqJ00gEgQazGASFXVRvO4h-Q0_vnaLtuOUoWU'); // cspell:enable
        expect(winc).to.equal('7670');
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

  describe('TurboAuthenticatedNodeClient', () => {
    let turbo: TurboAuthenticatedClient;

    const arweaveToken = new ArweaveToken({
      arweave,
      pollingOptions: {
        maxAttempts: 3,
        pollingIntervalMs: 5,
        initialBackoffMs: 10,
      },
    });
    const tokenMap = {
      arweave: arweaveToken,
    };

    before(async () => {
      turbo = TurboFactory.authenticated({
        privateKey: testJwk,
        ...turboDevelopmentConfigurations,
        // @ts-ignore
        tokenMap,
      });
    });

    it('getBalance()', async () => {
      const balance = await turbo.getBalance();
      expect(+balance.winc).to.equal(0);
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
          target: 'WeirdCharacters-_!felwfleowpfl12345678901234',
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
        it('should properly upload a Readable to turbo', async () => {
          const filePath = new URL('files/1KB_file', import.meta.url).pathname;
          const fileSize = fs.statSync(filePath).size;
          const response = await turbo.uploadFile({
            fileStreamFactory: () => fs.createReadStream(filePath),
            fileSizeFactory: () => fileSize,
            dataItemOpts,
          });
          expect(response).to.not.be.undefined;
          expect(response).to.not.be.undefined;
          expect(response).to.have.property('fastFinalityIndexes');
          expect(response).to.have.property('dataCaches');
          expect(response).to.have.property('owner');
          expect(response['owner']).to.equal(testWalletAddress);
        });
      }

      const invalidDataItemOpts = [
        {
          testName: 'tag name too long',
          errorType: 'FailedRequestError',
          errorMessage: 'Failed request: 400: Data item parsing error!',
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
          errorMessage: 'Failed request: 400: Data item parsing error!',
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
        it(`should fail to upload a Buffer to turbo with invalid  when ${testName}`, async () => {
          const filePath = new URL('files/1KB_file', import.meta.url).pathname;
          const fileSize = fs.statSync(filePath).size;

          await expectAsyncErrorThrow({
            promiseToError: turbo.uploadFile({
              fileStreamFactory: () => fs.createReadStream(filePath),
              fileSizeFactory: () => fileSize,
              dataItemOpts,
            }),
            errorType,
            errorMessage,
          });
        });
      }

      it('should abort the upload when AbortController.signal is triggered', async () => {
        const filePath = new URL('files/1KB_file', import.meta.url).pathname;
        const fileSize = fs.statSync(filePath).size;
        const error = await turbo
          .uploadFile({
            fileStreamFactory: () => fs.createReadStream(filePath),
            fileSizeFactory: () => fileSize,
            signal: AbortSignal.timeout(0), // abort the request right away
          })
          .catch((error) => error);
        expect(error).to.be.instanceOf(CanceledError);
      });

      it('should return a FailedRequestError when the file is larger than the free limit and wallet is underfunded', async () => {
        const nonAllowListedJWK = await Arweave.crypto.generateJWK();
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
        expect(error).to.be.instanceOf(FailedRequestError);
        expect(error.message).to.contain('Insufficient balance');
      });
    });

    it('getWincForFiat() with a bad promo code', async () => {
      const error = await turbo
        .getWincForFiat({
          amount: USD(10), // $10.00 USD
          promoCodes: ['BAD_PROMO_CODE'],
        })
        .catch((error) => error);
      expect(error).to.be.instanceOf(FailedRequestError);
      // TODO: Could provide better error message to client. We have error messages on response.data
      expect(error.message).to.equal('Failed request: 400: Bad Request');
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
            amount: USD(10), // 10 USD
            owner: testWalletAddress,
            promoCodes: ['BAD_PROMO_CODE'],
          })
          .catch((error) => error);
        expect(error).to.be.instanceOf(FailedRequestError);
        expect(error.message).to.equal('Failed request: 400: Bad Request');
      });
    });

    describe('fund()', function () {
      this.timeout(30_000); // Can take awhile for payment to retrieve transaction

      it('should succeed', async () => {
        const delayedBlockMining = async () => {
          let blocksMined = 0;
          while (blocksMined < 3) {
            await mineArLocalBlock(arweave);
            blocksMined++;
            await new Promise((resolve) => setTimeout(resolve, 10));
          }
        };
        const [{ winc }] = await Promise.all([
          turbo.topUpWithTokens({
            tokenAmount: WinstonToTokenAmount(10),
          }),
          delayedBlockMining(),
        ]);

        expect(winc).to.equal('7');
      });

      it('should fail to submit fund tx when arweave fund tx is stubbed to succeed but wont exist on chain', async () => {
        stub(arweave.transactions, 'getTransactionAnchor').resolves(
          'stub anchor',
        );
        stub(arweave.transactions, 'getPrice').resolves('101');
        stub(arweaveToken, 'submitTx').resolves();

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
