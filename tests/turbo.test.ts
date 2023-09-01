import { ArweaveSigner, createData, streamSigner } from 'arbundles';
import Arweave from 'arweave';
import { expect } from 'chai';
import fs from 'fs';
import { ReadableStream as ReadableStreamPolyfill } from 'node:stream/web';
import { Readable } from 'stream';

import {
  TurboAuthenticatedClient,
  TurboUnauthenticatedClient,
} from '../src/common/turbo.js';
import { TurboFactory } from '../src/index.js';
import { JWKInterface } from '../src/types/index.js';
import { jwkToPublicArweaveAddress } from '../src/utils/base64.js';

describe('TurboFactory', () => {
  describe('TurboUnauthenticatedClient', () => {
    it('should return a TurboUnauthenticatedClient when running in node', () => {
      const turbo = TurboFactory.public({});
      expect(turbo).to.be.instanceOf(TurboUnauthenticatedClient);
    });
    it('should be a TurboUnauthenticatedClient running in the browser', () => {
      (global as any).window = { document: {} };
      const turbo = TurboFactory.public({});
      expect(turbo).to.be.instanceOf(TurboUnauthenticatedClient);
      delete (global as any).window;
    });
  });

  describe('TurboAuthenticatedClient', () => {
    let jwk: JWKInterface;
    before(async () => {
      jwk = await Arweave.crypto.generateJWK();
    });

    it('should return a TurboUnauthenticatedClient when running in node', () => {
      const turbo = TurboFactory.private({ privateKey: jwk });
      expect(turbo).to.be.instanceOf(TurboAuthenticatedClient);
    });
    it('should be a TurboUnauthenticatedClient running in the browser', () => {
      (global as any).window = { document: {} };
      const turbo = TurboFactory.private({ privateKey: jwk });
      expect(turbo).to.be.instanceOf(TurboAuthenticatedClient);
      delete (global as any).window;
    });
  });
});

describe('Node environment', () => {
  describe('TurboFactory', () => {
    describe('TurboUnauthenticatedClient', () => {
      it('should return a TurboUnauthenticatedClient', () => {
        const turbo = TurboFactory.public({});
        expect(turbo).to.be.instanceOf(TurboUnauthenticatedClient);
      });
    });

    describe('TurboAuthenticatedClient', () => {
      let jwk: JWKInterface;
      before(async () => {
        jwk = await Arweave.crypto.generateJWK();
      });

      it('should return a TurboUnauthenticatedClient when running in node', () => {
        const turbo = TurboFactory.private({ privateKey: jwk });
        expect(turbo).to.be.instanceOf(TurboAuthenticatedClient);
      });
    });
  });

  describe('TurboUnauthenticatedNodeClient', () => {
    let turbo: TurboUnauthenticatedClient;

    before(async () => {
      turbo = TurboFactory.public({});
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

      it('getPriceForFiat()', async () => {
        const { winc } = await turbo.getWincForFiat({
          amount: 1000, // 10 USD
          currency: 'usd',
        });
        expect(winc).to.not.be.undefined;
        expect(+winc).to.be.greaterThan(0);
      });

      it('uploadSignedDataItems()', async () => {
        const jwk = await Arweave.crypto.generateJWK();
        const signer = new ArweaveSigner(jwk);
        // TODO: move to helper function
        const readableGenerator = () => Readable.from('test stream');

        const signedDataItem = await streamSigner(
          readableGenerator(),
          readableGenerator(),
          signer,
        );

        const response = await turbo.uploadSignedDataItems({
          dataItemGenerator: [() => signedDataItem],
        });
        expect(response).to.not.be.undefined;
        expect(response).to.have.property('dataItems');
        for (const dataItem of Object.values(response['dataItems'])) {
          expect(dataItem).to.have.property('fastFinalityIndexes');
          expect(dataItem).to.have.property('dataCaches');
          expect(dataItem).to.have.property('owner');
          expect(dataItem['owner']).to.equal(jwkToPublicArweaveAddress(jwk));
        }
      });
    });
  });

  describe('TurboAuthenticatedNodeClient', () => {
    describe('authenticated requests', () => {
      let jwk: JWKInterface;
      let turbo: TurboAuthenticatedClient;

      before(async () => {
        jwk = await Arweave.crypto.generateJWK();
        turbo = TurboFactory.private({ privateKey: jwk });
      });

      it('getBalance()', async () => {
        const balance = await turbo.getBalance();
        expect(+balance.winc).to.equal(0);
      });

      it('uploadFiles()', async () => {
        const file = new URL('files/0_kb.txt', import.meta.url).pathname;
        const streamGenerator = [() => fs.createReadStream(file)];
        const response = await turbo.uploadFiles({
          fileStreamGenerator: streamGenerator,
        });
        expect(response).to.not.be.undefined;
        expect(response).to.have.property('dataItems');
        expect(Object.keys(response['dataItems']).length).to.equal(
          streamGenerator.length,
        );
        for (const dataItem of Object.values(response['dataItems'])) {
          expect(dataItem).to.have.property('fastFinalityIndexes');
          expect(dataItem).to.have.property('dataCaches');
          expect(dataItem).to.have.property('owner');
          expect(dataItem['owner']).to.equal(jwkToPublicArweaveAddress(jwk));
        }
      });

      describe('uploadSignedDataItems()', () => {
        it('should forward the Readable signed data items to turbo', async () => {
          const signer = new ArweaveSigner(jwk);
          const readableGenerator = () => Readable.from('test stream');

          const signedDataItem1 = await streamSigner(
            readableGenerator(),
            readableGenerator(),
            signer,
          );

          const signedDataItem2 = await streamSigner(
            readableGenerator(),
            readableGenerator(),
            signer,
          );

          const response = await turbo.uploadSignedDataItems({
            dataItemGenerator: [() => signedDataItem1, () => signedDataItem2],
          });
          expect(response).to.not.be.undefined;
          expect(response).to.have.property('dataItems');
          for (const dataItem of Object.values(response['dataItems'])) {
            expect(dataItem).to.have.property('fastFinalityIndexes');
            expect(dataItem).to.have.property('dataCaches');
            expect(dataItem).to.have.property('owner');
            expect(dataItem['owner']).to.equal(jwkToPublicArweaveAddress(jwk));
          }
        });

        it('should forward the Buffer signed data items to turbo', async () => {
          const signer = new ArweaveSigner(jwk);
          const createSignedDataItem = () =>
            createData('test buffer data item', signer);
          const response = await turbo.uploadSignedDataItems({
            dataItemGenerator: [() => createSignedDataItem().getRaw()],
          });
          expect(response).to.not.be.undefined;
          expect(response).to.have.property('dataItems');
          for (const dataItem of Object.values(response['dataItems'])) {
            expect(dataItem).to.have.property('fastFinalityIndexes');
            expect(dataItem).to.have.property('dataCaches');
            expect(dataItem).to.have.property('owner');
            expect(dataItem['owner']).to.equal(jwkToPublicArweaveAddress(jwk));
          }
        });
      });
    });
  });
});

describe('Browser environment', () => {
  before(() => {
    (global as any).window = { document: {} };
  });

  after(() => {
    delete (global as any).window;
  });

  describe('TurboFactory', () => {
    describe('TurboUnauthenticatedClient', () => {
      it('should be a TurboUnauthenticatedClient running in the browser', () => {
        const turbo = TurboFactory.public({});
        expect(turbo).to.be.instanceOf(TurboUnauthenticatedClient);
      });
    });

    describe('TurboAuthenticatedClient', () => {
      let jwk: JWKInterface;
      before(async () => {
        jwk = await Arweave.crypto.generateJWK();
      });

      it('should be a TurboUnauthenticatedClient running in the browser', () => {
        const turbo = TurboFactory.private({ privateKey: jwk });
        expect(turbo).to.be.instanceOf(TurboAuthenticatedClient);
      });
    });
  });

  describe('TurboUnauthenticatedWebClient', () => {
    let turbo: TurboUnauthenticatedClient;

    before(async () => {
      turbo = TurboFactory.public({});
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

      it('getPriceForFiat()', async () => {
        const { winc } = await turbo.getWincForFiat({
          amount: 1000, // 10 USD
          currency: 'usd',
        });
        expect(winc).to.not.be.undefined;
        expect(+winc).to.be.greaterThan(0);
      });

      describe('uploadSignedDataItems()', () => {
        let jwk: JWKInterface;

        before(async () => {
          // generate a JWK but don't pass it to Turbo SDK
          jwk = await Arweave.crypto.generateJWK();
        });

        it('should forward the ReadableStream signed data items to turbo', async () => {
          const signer = new ArweaveSigner(jwk);
          const signedDataItemBuffer = await createData(
            'test ReadableStream',
            signer,
          );

          const createReadableStream = () =>
            new ReadableStreamPolyfill({
              start(controller) {
                controller.enqueue(signedDataItemBuffer.getRaw());
                controller.close();
              },
            }) as ReadableStream; // force cast to ReadableStream
          const response = await turbo.uploadSignedDataItems({
            dataItemGenerator: [createReadableStream, createReadableStream],
          });
          expect(response).to.not.be.undefined;
          expect(response).to.have.property('dataItems');
          for (const dataItem of Object.values(response['dataItems'])) {
            expect(dataItem).to.have.property('fastFinalityIndexes');
            expect(dataItem).to.have.property('dataCaches');
            expect(dataItem).to.have.property('owner');
            expect(dataItem['owner']).to.equal(jwkToPublicArweaveAddress(jwk));
          }
        });

        it('should forward the Buffer signed data items to turbo', async () => {
          const signer = new ArweaveSigner(jwk);
          const createSignedDataItem = () =>
            createData('test buffer data item', signer);
          const response = await turbo.uploadSignedDataItems({
            dataItemGenerator: [() => createSignedDataItem().getRaw()],
          });
          expect(response).to.not.be.undefined;
          expect(response).to.have.property('dataItems');
          for (const dataItem of Object.values(response['dataItems'])) {
            expect(dataItem).to.have.property('fastFinalityIndexes');
            expect(dataItem).to.have.property('dataCaches');
            expect(dataItem).to.have.property('owner');
            expect(dataItem['owner']).to.equal(jwkToPublicArweaveAddress(jwk));
          }
        });
      });
    });
  });
});
