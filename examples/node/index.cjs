(async () => {
  const { default: Arweave } = await import('arweave');
  const { TurboFactory, TurboUnauthenticatedPaymentService } = await import(
    '../../lib/index.js'
  );
  /**
   * Fetching rates using an unauthenticated Turbo client.
   */
  const turbo = TurboFactory.public();
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
  const turboAuthClient = TurboFactory.private({ privateKey: jwk });

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
   * Fetch the estimated amount of winc returned for $1 USD
   */
  const estimatedWinc = await turboAuthClient.getWincForFiat({
    amount: 1000,
    currency: 'usd',
  });
  console.log('10 USD to winc:', estimatedWinc);
})();
