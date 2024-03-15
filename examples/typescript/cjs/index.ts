import {
  TurboFactory,
  USD,
  developmentTurboConfiguration,
} from '@ardrive/turbo-sdk';
import Arweave from 'arweave';
import fs from 'fs';
import path from 'path';

(async () => {
  /**
   * Generate a key from the arweave wallet.
   */
  const arweave = new Arweave({});
  const jwk = await arweave.wallets.generate();
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
  console.log('Balance:', balance);

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
  const filePath = path.join(__dirname, '../../files/1KB_file');
  const fileSize = fs.statSync(filePath).size;
  const uploadResult = await turboAuthClient.uploadFile({
    fileStreamFactory: () => fs.createReadStream(filePath),
    fileSizeFactory: () => fileSize,
    signal: AbortSignal.timeout(10_000), // cancel the upload after 10 seconds
  });
  console.log(JSON.stringify(uploadResult, null, 2));
})();
