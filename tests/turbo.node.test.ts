import { ArweaveSigner, createData } from 'arbundles';
import Arweave from 'arweave';
import { CanceledError } from 'axios';
import { expect } from 'chai';
import fs from 'fs';
import { Readable } from 'node:stream';

import {
  TurboAuthenticatedClient,
  TurboUnauthenticatedClient,
} from '../src/common/turbo.js';
import { TurboFactory } from '../src/node/index.js';
import { JWKInterface } from '../src/types/index.js';
import { jwkToPublicArweaveAddress } from '../src/utils/base64.js';

describe('Node environment', () => {
  describe('TurboFactory', () => {
    it('should return a TurboUnauthenticatedClient when running in Node environment and not provided a privateKey', () => {
      const turbo = TurboFactory.public({});
      expect(turbo).to.be.instanceOf(TurboUnauthenticatedClient);
    });
    it('should return a TurboAuthenticatedClient when running in Node environment and  provided a privateKey', async () => {
      const jwk = await Arweave.crypto.generateJWK();
      const turbo = TurboFactory.private({ privateKey: jwk });
      expect(turbo).to.be.instanceOf(TurboAuthenticatedClient);
    });
  });

  describe('TurboUnauthenticatedNodeClient', () => {
    let turbo: TurboUnauthenticatedClient;

    before(() => {
      turbo = TurboFactory.public({});
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
            signal: AbortSignal.timeout(0), // abort the request right away
          })
          .catch((err) => err);
        expect(error).to.be.instanceOf(CanceledError);
      });
    });
  });

  describe('TurboAuthenticatedNodeClient', () => {
    let jwk: JWKInterface;
    let turbo: TurboAuthenticatedClient;

    before(async () => {
      jwk = await Arweave.crypto.generateJWK();
      turbo = TurboFactory.private({
        privateKey: jwk,
      });
    });

    it('getBalance()', async () => {
      const balance = await turbo.getBalance();
      expect(+balance.winc).to.equal(0);
    });

    describe('uploadFile()', () => {
      it('should properly upload a Readable to turbo', async () => {
        const filePath = new URL('files/0_kb.txt', import.meta.url).pathname;
        const response = await turbo.uploadFile({
          fileStreamFactory: () => fs.createReadStream(filePath),
        });
        expect(response).to.not.be.undefined;
        expect(response).to.not.be.undefined;
        expect(response).to.have.property('fastFinalityIndexes');
        expect(response).to.have.property('dataCaches');
        expect(response).to.have.property('owner');
        expect(response['owner']).to.equal(jwkToPublicArweaveAddress(jwk));
      });

      it('should abort the upload when AbortController.signal is triggered', async () => {
        const filePath = new URL('files/0_kb.txt', import.meta.url).pathname;
        const error = await turbo
          .uploadFile({
            fileStreamFactory: () => fs.createReadStream(filePath),
            signal: AbortSignal.timeout(0), // abort the request right away
          })
          .catch((err) => err);
        expect(error).to.be.instanceOf(CanceledError);
      });
    });
  });
});
