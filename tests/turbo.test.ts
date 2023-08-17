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

describe('TurboNodeClient', () => {
  describe('unauthenticated requests', () => {
    let turbo: TurboClient;

    before(async () => {
      turbo = TurboFactory.init();
    });
    it('getRates()', async () => {
      const { winc, fiat, adjustments } = await turbo.getRates();
      expect(winc).to.not.be.undefined.and.to.be.a('number');
      expect(fiat).to.have.property('usd').that.is.a('number');
      expect(adjustments).to.not.be.undefined;
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
});

describe('TurboWebClient', () => {
  describe('unauthenticated requests', () => {
    let turbo: TurboClient;

    before(async () => {
      turbo = TurboFactory.init();
    });
    it('getRates()', async () => {
      const { winc, fiat, adjustments } = await turbo.getRates();
      expect(winc).to.not.be.undefined.and.to.be.a('number');
      expect(fiat).to.have.property('usd').that.is.a('number');
      expect(adjustments).to.not.be.undefined;
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
});
