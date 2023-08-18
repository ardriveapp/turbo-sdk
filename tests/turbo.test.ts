import Arweave from 'arweave';
import { expect } from 'chai';

import { TurboClient } from '../src/common/index.js';
import { TurboFactory } from '../src/index.js';
import TurboNodeClient from '../src/node/index.js';
import { JWKInterface } from '../src/types/index.js';
import TurboWebClient from '../src/web/index.js';

describe('TurboFactory', () => {
  it('should return a TurboNodeClient when running in node', () => {
    const turbo = TurboFactory.init();
    expect(turbo).to.be.instanceOf(TurboNodeClient);
  });
  it('should be a TurboWebClient when running in the browser', () => {
    (global as any).window = { document: {} };
    const turbo = TurboFactory.init();
    expect(turbo).to.be.instanceOf(TurboWebClient);
    delete (global as any).window;
  });
});

describe('TurboClient', () => {
  let turbo: TurboClient;

  before(async () => {
    turbo = TurboFactory.init();
  });

  describe('unauthenticated requests', () => {
    it('getRates()', async () => {
      const { winc, fiat, adjustments } = await turbo.getRates();
      expect(winc).to.not.be.undefined.and.to.be.a('number');
      expect(fiat).to.have.property('usd').that.is.a('number');
      expect(adjustments).to.not.be.undefined;
    });

    it('getRate()', async () => {
      const { currency, rate } = await turbo.getRate('usd');
      expect(currency).to.equal('usd');
      expect(rate).to.be.a('number');
    });

    it('getCountries()', async () => {
      const countries = await turbo.getCountries();
      expect(countries).to.be.an('array');
      expect(countries.length).to.be.greaterThan(0);
      expect(countries).to.include('United States');
    });

    it('getCurrencies()', async () => {
      const { supportedCurrencies, limits } = await turbo.getCurrencies();
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

    it('getWincPriceForBytes()', async () => {
      const { winc, adjustments } = await turbo.getWincPriceForBytes(1024);
      expect(winc).to.not.be.undefined;
      expect(+winc).to.be.greaterThan(0);
      expect(adjustments).to.not.be.undefined;
      expect(adjustments).to.be.an('array');
    });

    it('getPriceForFiat()', async () => {
      const { winc } = await turbo.getWincPriceForFiat({
        amount: 1000, // 10 USD
        currency: 'usd',
      });
      expect(winc).to.not.be.undefined;
      expect(+winc).to.be.greaterThan(0);
    });
  });

  describe('authenticated requests', () => {
    let jwk: JWKInterface;
    let turbo: TurboClient;

    before(async () => {
      jwk = await Arweave.crypto.generateJWK();
      turbo = TurboFactory.init({ jwk });
    });

    it('getBalance()', async () => {
      const balance = await turbo.getBalance();
      expect(balance).to.equal(0);
    });
  });

  describe('TurboNodeClient', () => {
    before(async () => {
      turbo = TurboFactory.init();
    });

    // node client specific tests
  });

  describe('TurboWebClient', () => {
    before(async () => {
      (global as any).window = { document: {} };
      turbo = TurboFactory.init();
    });

    after(() => {
      delete (global as any).window;
    });

    // web client specific tests
  });
});
