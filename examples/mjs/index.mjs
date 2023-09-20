import {
  TurboFactory,
  TurboUnauthenticatedPaymentService,
} from '@ardrive/turbo-sdk/node';
import Arweave from 'arweave';
import fs from 'fs';

(async () => {
  /**
   * Fetching rates using an unauthenticated Turbo client.
   */
  const turbo = TurboFactory.unauthenticated();
  const rates = await turbo.getFiatRates();
  console.log('Fetched rates:', JSON.stringify(rates, null, 2));

  /**
   * Alternatively instantiate your own clients independently.
   */
  const paymentService = new TurboUnauthenticatedPaymentService({
    url: 'https://payment.ardrive.dev',
  });
  const supportedCurrencies = await paymentService.getSupportedCurrencies();
  console.log(
    'Supported currencies:',
    JSON.stringify(supportedCurrencies, null, 2),
  );

  /**
   * Create a new arweave private key
   */
  const arweave = new Arweave({});
  const jwk = await Arweave.crypto.generateJWK();
  const address = await arweave.wallets.jwkToAddress(jwk);

  /**
   * Use the arweave key to create an authenticated turbo client
   */
  const turboAuthClient = TurboFactory.authenticated({ privateKey: jwk });

  /**
   * Fetch the balance for the private key.
   */
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
   * Fetch the estimated amount of winc returned for 10 USD (1000 cents).
   */
  const estimatedWinc = await turboAuthClient.getWincForFiat({
    amount: 1000,
    currency: 'usd',
  });
  console.log('10 USD to winc:', estimatedWinc);

  /**
   * Post local files to the Turbo service.
   */
  console.log('Posting raw file to Turbo service...');
  const filePath = new URL('../files/0_kb.txt', import.meta.url).pathname;
  const uploadResult = await turboAuthClient.uploadFile({
    fileStreamFactory: () => fs.createReadStream(filePath),
    signal: AbortSignal.timeout(10_000), // cancel the upload after 10 seconds
  });
  console.log(JSON.stringify(uploadResult, null, 2));
})();
