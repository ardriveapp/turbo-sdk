import Arweave from 'arweave';
import fs from 'fs';

import { TurboFactory } from '../../lib/index.js';

(async () => {
  /**
   * Fetching rates using an unauthenticated Turbo client.
   */
  const turbo = TurboFactory.init();
  const rates = await turbo.getFiatRates();
  console.log('Fetched rates:', JSON.stringify(rates, null, 2));

  /**
   * Fetching balance using an authenticated Turbo client.
   */
  const arweave = Arweave.init();
  const jwk = await Arweave.crypto.generateJWK();
  const address = await arweave.wallets.jwkToAddress(jwk);
  const turboAuthClient = TurboFactory.init({ privateKey: jwk });
  const balance = await turboAuthClient.getBalance();
  console.log(
    'Balance:',
    JSON.stringify(
      {
        address,
        balance,
      },
      null,
      2,
    ),
  );

  /**
   * Fetch the estimated amount of winc returned for $1 USD
   */
  const estimatedWinc = await turboAuthClient.getWincForFiat({
    amount: 1000,
    currency: 'usd',
  });
  console.log('10 USD to winc:', estimatedWinc);

  /**
   * Post some local data items to the Turbo service.
   */
  console.log('Posting data items to Turbo service...');
  const files = [new URL('files/0_kb.txt', import.meta.url).pathname];
  const fileStreamGenerator = files.map(
    (dataItem) => () => fs.createReadStream(dataItem),
  );
  const uploadResult = await turboAuthClient.uploadFiles({
    fileStreamGenerator: fileStreamGenerator,
  });
  console.log(JSON.stringify(uploadResult, null, 2));
})();
