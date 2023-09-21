import { ArweaveSigner, createData } from 'arbundles';
import Arweave from 'arweave';
import { CanceledError } from 'axios';
import { expect } from 'chai';
import fs from 'fs';
import { Readable } from 'node:stream';

import { JWKInterface } from '../src/common/jwk.js';
import {
  TurboAuthenticatedClient,
  TurboUnauthenticatedClient,
} from '../src/common/turbo.js';
import { TurboFactory } from '../src/node/factory.js';
import { jwkToPublicArweaveAddress } from '../src/utils/base64.js';
import { FailedRequestError } from '../src/utils/errors.js';

describe('Node environment', () => {
  describe('TurboFactory', () => {
    it('should return a TurboUnauthenticatedClient when running in Node environment and not provided a privateKey', () => {
      const turbo = TurboFactory.unauthenticated({});
      expect(turbo).to.be.instanceOf(TurboUnauthenticatedClient);
    });
    it('should return a TurboAuthenticatedClient when running in Node environment and  provided a privateKey', async () => {
      const jwk = await Arweave.crypto.generateJWK();
      const turbo = TurboFactory.authenticated({ privateKey: jwk });
      expect(turbo).to.be.instanceOf(TurboAuthenticatedClient);
    });
  });

  describe('TurboUnauthenticatedNodeClient', () => {
    let turbo: TurboUnauthenticatedClient;

    before(() => {
      turbo = TurboFactory.unauthenticated({});
    });

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

    it('getPriceForFiat()', async () => {
      const { winc } = await turbo.getWincForFiat({
        amount: 1000, // 10 USD
        currency: 'usd',
      });
      expect(winc).to.not.be.undefined;
      expect(+winc).to.be.greaterThan(0);
    });

    describe('uploadSignedDataItem()', () => {
      it('should properly upload a signed Buffer to turbo', async () => {
        const jwk = await Arweave.crypto.generateJWK();
        const signer = new ArweaveSigner(jwk);
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
        expect(response['owner']).to.equal(jwkToPublicArweaveAddress(jwk));
      });

      it('should properly upload signed Readable to turbo', async () => {
        const jwk = await Arweave.crypto.generateJWK();
        const signer = new ArweaveSigner(jwk);
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
        expect(response['owner']).to.equal(jwkToPublicArweaveAddress(jwk));
      });

      it('should abort an upload when AbortController.signal is triggered', async () => {
        const jwk = await Arweave.crypto.generateJWK();
        const signer = new ArweaveSigner(jwk);
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
        const { adjustments, paymentAmount, quotedPaymentAmount, url } =
          await turbo.createCheckoutSession({
            amount: 1000, // 10 USD
            currency: 'usd',
            owner: '43-character-stub-arweave-address-000000000',
          });
        expect(adjustments).to.deep.equal([]);
        expect(paymentAmount).to.equal(1000);
        expect(quotedPaymentAmount).to.equal(1000);
        expect(url).to.be.a('string');
      });
    });
  });

  describe('TurboAuthenticatedNodeClient', () => {
    let jwk: JWKInterface;
    let turbo: TurboAuthenticatedClient;
    let address: string;

    before(async () => {
      jwk = await Arweave.crypto.generateJWK();
      turbo = TurboFactory.authenticated({
        privateKey: jwk,
      });
      address = await Arweave.init({}).wallets.jwkToAddress(jwk);
    });

    it('getBalance()', async () => {
      const balance = await turbo.getBalance();
      expect(+balance.winc).to.equal(0);
    });

    describe('uploadFile()', () => {
      it('should properly upload a Readable to turbo', async () => {
        const filePath = new URL('files/1KB_file', import.meta.url).pathname;
        const fileSize = fs.statSync(filePath).size;
        const response = await turbo.uploadFile({
          fileStreamFactory: () => fs.createReadStream(filePath),
          fileSizeFactory: () => fileSize,
        });
        expect(response).to.not.be.undefined;
        expect(response).to.not.be.undefined;
        expect(response).to.have.property('fastFinalityIndexes');
        expect(response).to.have.property('dataCaches');
        expect(response).to.have.property('owner');
        expect(response['owner']).to.equal(jwkToPublicArweaveAddress(jwk));
      });

      it('should abort the upload when AbortController.signal is triggered', async () => {
        const filePath = new URL('files/1KB_file', import.meta.url).pathname;
        const fileSize = fs.statSync(filePath).size;
        const error = await turbo
          .uploadFile({
            fileStreamFactory: () => fs.createReadStream(filePath),
            fileSizeFactory: () => fileSize,
            signal: AbortSignal.timeout(0), // abort the request right away
          })
          .catch((err) => err);
        expect(error).to.be.instanceOf(CanceledError);
      });

      it('should return a FailedRequestError when the file is larger than the free limit and wallet is underfunded', async () => {
        const filePath = new URL('files/1MB_file', import.meta.url).pathname;
        const fileSize = fs.statSync(filePath).size;
        const error = await turbo
          .uploadFile({
            fileStreamFactory: () => fs.createReadStream(filePath),
            fileSizeFactory: () => fileSize,
          })
          .catch((err) => err);
        expect(error).to.be.instanceOf(FailedRequestError);
        expect(error.message).to.contain('Insufficient balance');
      });
    });

    describe('createCheckoutSession()', () => {
      it('should properly get a checkout session with promo code', async () => {
        const { adjustments, paymentAmount, quotedPaymentAmount, url } =
          await turbo.createCheckoutSession({
            amount: 1000, // 10 USD
            currency: 'usd',
            owner: address,
            promoCodes: ['TOKEN2049'],
          });
        expect(adjustments).to.deep.equal([
          {
            adjustmentAmount: -200,
            currencyType: 'usd',
            description:
              '20% off of top up purchase, can be used once per user.',
            name: 'Token2049 Singapore Promo Code',
            operator: 'multiply',
            operatorMagnitude: 0.8,
          },
        ]);
        expect(paymentAmount).to.equal(800);
        expect(quotedPaymentAmount).to.equal(1000);
        expect(url).to.be.a('string');
      });
    });
  });
});
