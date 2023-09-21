import { ArweaveSigner, createData } from 'arbundles';
import Arweave from 'arweave/node/index.js';
import { CanceledError } from 'axios';
import { expect } from 'chai';
import { ReadableStream } from 'node:stream/web';

import { JWKInterface } from '../src/common/jwk.js';
import {
  TurboAuthenticatedClient,
  TurboUnauthenticatedClient,
} from '../src/common/turbo.js';
import { jwkToPublicArweaveAddress } from '../src/utils/base64.js';
import { TurboFactory } from '../src/web/index.js';

describe('Browser environment', () => {
  before(() => {
    (global as any).window = { document: {} };
  });

  after(() => {
    delete (global as any).window;
  });

  describe('TurboFactory', () => {
    it('should be a TurboUnauthenticatedClient running in the browser and not provided a privateKey', () => {
      const turbo = TurboFactory.unauthenticated({});
      expect(turbo).to.be.instanceOf(TurboUnauthenticatedClient);
    });

    it('should be a TurboAuthenticatedClient running in the browser and provided a privateKey', async () => {
      const jwk = await Arweave.crypto.generateJWK();
      const turbo = TurboFactory.authenticated({ privateKey: jwk });
      expect(turbo).to.be.instanceOf(TurboUnauthenticatedClient);
    });
  });

  describe('TurboUnauthenticatedWebClient', () => {
    let turbo: TurboUnauthenticatedClient;

    before(() => {
      turbo = TurboFactory.unauthenticated({});
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
      });
    });
  });
  describe('TurboAuthenticatedWebClient', () => {
    let turbo: TurboAuthenticatedClient;
    let jwk: JWKInterface;
    before(async () => {
      jwk = await Arweave.crypto.generateJWK();
      turbo = TurboFactory.authenticated({ privateKey: jwk });
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
    });
  });
});
