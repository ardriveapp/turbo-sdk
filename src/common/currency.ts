/**
 * Copyright (C) 2022-2023 Permanent Data Solutions, Inc. All Rights Reserved.
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
import { Currency } from '../types.js';

export abstract class AmountMapper {
  abstract amount: number;
  get type(): Currency {
    return this.constructor.name.toLowerCase() as Currency;
  }
}

export abstract class ZeroDecimalCurrency extends AmountMapper {
  constructor(public a: number) {
    super();
  }

  get amount() {
    return this.a;
  }
}

export abstract class TwoDecimalCurrency extends AmountMapper {
  constructor(public a: number) {
    super();
  }

  get amount() {
    return this.a * 100;
  }
}

export class USD extends TwoDecimalCurrency {
  constructor(usd: number) {
    super(usd);
  }
}

export class EUR extends TwoDecimalCurrency {
  constructor(eur: number) {
    super(eur);
  }
}

export class GBP extends TwoDecimalCurrency {
  constructor(gbp: number) {
    super(gbp);
  }
}

export class CAD extends TwoDecimalCurrency {
  constructor(public readonly cad: number) {
    super(cad);
  }
}

export class AUD extends TwoDecimalCurrency {
  constructor(public readonly aud: number) {
    super(aud);
  }
}

export class JPY extends ZeroDecimalCurrency {
  constructor(public readonly jpy: number) {
    super(jpy);
  }
}

export class INR extends TwoDecimalCurrency {
  constructor(public readonly inr: number) {
    super(inr);
  }
}

export class SGD extends TwoDecimalCurrency {
  constructor(public readonly sgd: number) {
    super(sgd);
  }
}

export class HKD extends TwoDecimalCurrency {
  constructor(public readonly hkd: number) {
    super(hkd);
  }
}

export class BRL extends TwoDecimalCurrency {
  constructor(public readonly brl: number) {
    super(brl);
  }
}
