/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { exec } from 'child_process';
import prompts from 'prompts';
import Stripe from 'stripe';

import { currencyMap } from '../../common/currency.js';
import { TurboFactory } from '../../node/factory.js';
import { sleep } from '../../utils/common.js';
import { TopUpOptions } from '../types.js';
import {
  addressOrPrivateKeyFromOptions,
  configFromOptions,
  currencyFromOptions,
} from '../utils.js';

function openUrl(url: string) {
  if (process.platform === 'darwin') {
    // macOS
    exec(`open ${url}`);
  } else if (process.platform === 'win32') {
    // Windows
    exec(`start "" "${url}"`, { windowsHide: true });
  } else {
    // Linux/Unix
    open(url);
  }
}

export async function topUp(options: TopUpOptions) {
  const config = configFromOptions(options);

  const { address: maybeAddress, privateKey: maybePrivateKey } =
    await addressOrPrivateKeyFromOptions(options);

  const value = options.value;
  if (value === undefined) {
    throw new Error('Must provide a --value to top up');
  }

  const currency = currencyFromOptions(options) ?? 'usd';
  const amount = currencyMap[currency](+value);

  const payInCli = options.payInCli ?? false;

  let address: string | undefined = maybeAddress;
  if (address === undefined) {
    if (maybePrivateKey === undefined) {
      throw new Error(
        'Must provide an address or private key for target of Turbo top up',
      );
    }
    const turbo = TurboFactory.authenticated({
      ...config,
      privateKey: maybePrivateKey,
    });
    address = await turbo.signer.getNativeAddress();
  }

  if (payInCli) {
    const { id, client_secret } =
      await TurboFactory.unauthenticated().createPaymentIntent({
        amount,
        owner: address,
      });

    // Turbo Stripe Test PUBLISHABLE Key. Enable this one to test workflows
    const stripeTestPublishableKey =
      // /* cspell:disable */ 'pk_test_51JUAtwC8apPOWkDLh2FPZkQkiKZEkTo6wqgLCtQoClL6S4l2jlbbc5MgOdwOUdU9Tn93NNvqAGbu115lkJChMikG00XUfTmo2z'; /* cspell:enable */

      // ArDrive Stripe Production PUBLISHABLE Key. This one is safe to have on a front end application 👍
      // const stripeProdPublishableKey =
      /* cspell:disable */ 'pk_live_51JUAtwC8apPOWkDLMQqNF9sPpfneNSPnwX8YZ8y1FNDl6v94hZIwzgFSYl27bWE4Oos8CLquunUswKrKcaDhDO6m002Yj9AeKj'; /* cspell:enable */

    const stripe = new Stripe(stripeTestPublishableKey, {
      apiVersion: '2025-07-30.basil',
    });

    const { number } = await prompts<string>({
      type: 'text',
      name: 'number',
      message: 'Enter your card number',
    });

    const { expiration } = await prompts({
      type: 'text',
      name: 'expiration',
      message: 'Enter your card expiration with the format mm/dd. e.g: "01/26"',
    });

    const { cvc } = await prompts({
      type: 'password',
      name: 'cvc',
      message: 'Enter your card cvc',
    });

    // Use test card for faster testing
    // const testCard = { number: '4242424242424242', exp_month: 12, exp_year: 26, cvc: '123' };

    const [exp_month, exp_year] = (expiration as string)
      .split('/')
      .map((e) => +e);
    const realCard = {
      number: (number as string).replace('-', ''),
      exp_month,
      exp_year,
      cvc,
    };

    console.error('Creating payment using Stripe payment method...');

    // Create the PaymentMethod using the details collected by the Payment Element
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: realCard,
    });

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    await stripe.paymentIntents.confirm(id, {
      payment_method: paymentMethod.id,
      client_secret: client_secret,
    });
  }

  const { url, paymentAmount, winc } = await TurboFactory.unauthenticated(
    config,
  ).createCheckoutSession({ amount, owner: address });

  if (url === undefined) {
    throw new Error('Failed to create checkout session');
  }

  console.log(
    'Got Checkout Session\n' + JSON.stringify({ url, paymentAmount, winc }),
  );
  console.log('Opening checkout session in browser...');
  await sleep(2000);

  openUrl(url);
}
