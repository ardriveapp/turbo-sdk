import Arweave from 'arweave';
import { expect } from 'chai';

import { toB64Url } from './base64.js';
import { signData } from './signData.js';

describe('signData', () => {
  it('snapshot test for signing with crypto.constants.RSA_PKCS1_PSS_PADDING', async () => {
    const signature = await signData(await Arweave.crypto.generateJWK(), '123');

    expect(toB64Url(Buffer.from(signature))).to.have.length(683);
  });
});
