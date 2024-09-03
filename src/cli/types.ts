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
import { TokenType } from '../types.js';

export type GlobalOptions = {
  dev: boolean;
  gateway: string | undefined;
  debug: boolean;
  quiet: boolean;
  token: TokenType;
};

export type WalletOptions = GlobalOptions & {
  walletFile: string | undefined;
  mnemonic: string | undefined;
  privateKey: string | undefined;
};

export type AddressOptions = WalletOptions & {
  address: string | undefined;
};

export type TopUpOptions = AddressOptions & {
  value: string | undefined;
  currency: string | undefined;
};
