const path = require('path');
const fs = require('fs');

const Arweave = require('arweave');
const {
  USD,
  developmentTurboConfiguration,
  TurboFactory,
  TurboUnauthenticatedPaymentService,
} = require('@ardrive/turbo-sdk/node');

// immediately invoked function expression
(async () => {
  /**
   * Fetching rates using an unauthenticated Turbo client.
   */
  const turbo = TurboFactory.unauthenticated(developmentTurboConfiguration);
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
  const turboAuthClient = TurboFactory.authenticated({
    privateKey: jwk,
    ...developmentTurboConfiguration,
  });

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
    amount: USD(10),
  });
  console.log('10 USD to winc:', estimatedWinc);

  /**
   * Post local files to the Turbo service.
   */
  console.log('Posting raw file to Turbo service...');
  const filePath = path.join(__dirname, '../files/1KB_file');
  const fileSize = fs.statSync(filePath).size;
  const uploadResult = await turboAuthClient.uploadFile({
    fileStreamFactory: () => fs.createReadStream(filePath),
    fileSizeFactory: () => fileSize,
    signal: AbortSignal.timeout(10_000), // cancel the upload after 10 seconds
  });
  console.log(JSON.stringify(uploadResult, null, 2));

  /**
   * Tops up a wallet with Credits using tokens.
   * Default token is AR, using Winston as the unit.
   */
  const topUpResult = await turboAuthClient
    .topUpWithTokens({
      tokenAmount: 1, /// 0.000_000_000_000_001 AR
    })
    .catch((err) => err); // Will throw an error with a wallet that has no tokens
  console.log(JSON.stringify(topUpResult, null, 2));
})();
