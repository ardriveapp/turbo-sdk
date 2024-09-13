/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { currencyMap } from '../../common/currency.js';
import { isTokenType, tokenToBaseMap } from '../../common/index.js';
import { TurboFactory } from '../../node/factory.js';
import { fiatCurrencyTypes, isCurrency, tokenTypes } from '../../types.js';
import { PriceOptions } from '../types.js';
import { configFromOptions } from '../utils.js';

export async function price(options: PriceOptions) {
  const value = options.value;
  if (value === undefined || +value <= 0 || isNaN(+value)) {
    throw new Error('Must provide a positive number --value to get price');
  }

  const type = options.type ?? 'bytes';

  const winc = await (async () => {
    if (isTokenType(type)) {
      const turbo = TurboFactory.unauthenticated({
        ...configFromOptions(options),
        token: type,
      });
      return (
        await turbo.getWincForToken({
          tokenAmount: tokenToBaseMap[type](value),
        })
      ).winc;
    }

    const turbo = TurboFactory.unauthenticated(configFromOptions(options));
    if (type === 'bytes') {
      return (await turbo.getUploadCosts({ bytes: [+value] }))[0].winc;
    }

    if (isCurrency(type)) {
      return (
        await turbo.getWincForFiat({
          amount: currencyMap[type](+value),
        })
      ).winc;
    }

    throw new Error(
      `Invalid price type!\nMust be one of: bytes, ${
        fiatCurrencyTypes.join(', ') + ' ' + tokenTypes.join(', ')
      }`,
    );
  })();

  console.log(
    `Current price estimate for ${value} ${type} is ~${(
      +winc / 1_000_000_000_000
    ).toFixed(12)} Credits`,
  );
}
