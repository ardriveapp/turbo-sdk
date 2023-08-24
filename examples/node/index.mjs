import Arweave from 'arweave';

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
   * Fetch the estimated of winc $1 USD would return
   */
  const estimatedWinc = await turboAuthClient.getWincForFiat({
    amount: 1000,
    currency: 'usd',
  });
  console.log('10 USD to winc:', estimatedWinc);
})();
