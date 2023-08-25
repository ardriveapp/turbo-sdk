import Arweave from 'arweave';
import { expect } from 'chai';

import { TurboClient } from '../src/common/turbo.js';
import { TurboFactory } from '../src/index.js';
import { JWKInterface } from '../src/types/index.js';

// TODO: move these to local services
const defaultConfig = {
  paymentServiceConfig: {
    url: 'https://payment.ardrive.dev',
  },
  uploadServiceConfig: {
    url: 'https://upload.ardrive.dev',
  },
};

describe('TurboFactory', () => {
  it('should return a TurboClient when running in node', () => {
    const turbo = TurboFactory.init(defaultConfig);
    expect(turbo).to.be.instanceOf(TurboClient);
  });
  it('should be a TurboClient when running in the browser', () => {
    (global as any).window = { document: {} };
    const turbo = TurboFactory.init(defaultConfig);
    expect(turbo).to.be.instanceOf(TurboClient);
    delete (global as any).window;
  });
});

describe('TurboClient', () => {
  let turbo: TurboClient;

  before(async () => {
    turbo = TurboFactory.init(defaultConfig);
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

    it('getWincPriceForBytes()', async () => {
      const { winc, adjustments } = await turbo.getWincPriceForBytes({
        bytes: 1024,
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
  });

  describe('authenticated requests', () => {
    let privateKey: JWKInterface;
    let turbo: TurboClient;

    before(async () => {
      privateKey = await Arweave.crypto.generateJWK();
      turbo = TurboFactory.init({ ...defaultConfig, privateKey });
    });

    it('getBalance()', async () => {
      const balance = await turbo.getBalance();
      expect(+balance.winc).to.equal(0);
    });
  });
});
