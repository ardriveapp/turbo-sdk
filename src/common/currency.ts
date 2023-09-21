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

export interface AmountMapper {
  amount: number;
  type: Currency;
}

export class USDAmount implements AmountMapper {
  constructor(public readonly usd: number) {}

  get amount(): number {
    return this.usd * 100;
  }

  get type(): Currency {
    return 'usd';
  }
}

export class EURAmount implements AmountMapper {
  constructor(public readonly eur: number) {}

  get amount(): number {
    return this.eur * 100;
  }

  get type(): Currency {
    return 'eur';
  }
}

export class GBPAmount implements AmountMapper {
  constructor(public readonly gbp: number) {}

  get amount(): number {
    return this.gbp * 100;
  }

  get type(): Currency {
    return 'gbp';
  }
}

export class CADAmount implements AmountMapper {
  constructor(public readonly cad: number) {}

  get amount(): number {
    return this.cad * 100;
  }

  get type(): Currency {
    return 'cad';
  }
}

export class AUDAmount implements AmountMapper {
  constructor(public readonly aud: number) {}

  get amount(): number {
    return this.aud * 100;
  }

  get type(): Currency {
    return 'aud';
  }
}

export class JPYAmount implements AmountMapper {
  constructor(public readonly jpy: number) {}

  get amount(): number {
    // JPY is a zero-decimal currency, so we don't multiply by 100
    return this.jpy;
  }

  get type(): Currency {
    return 'jpy';
  }
}

export class INRAmount implements AmountMapper {
  constructor(public readonly inr: number) {}

  get amount(): number {
    return this.inr * 100;
  }

  get type(): Currency {
    return 'inr';
  }
}

export class SGDAmount implements AmountMapper {
  constructor(public readonly sgd: number) {}

  get amount(): number {
    return this.sgd * 100;
  }

  get type(): Currency {
    return 'sgd';
  }
}

export class HKDAmount implements AmountMapper {
  constructor(public readonly hkd: number) {}

  get amount(): number {
    return this.hkd * 100;
  }

  get type(): Currency {
    return 'hkd';
  }
}

export class BRLAmount implements AmountMapper {
  constructor(public readonly brl: number) {}

  get amount(): number {
    return this.brl * 100;
  }

  get type(): Currency {
    return 'brl';
  }
}
