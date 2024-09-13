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
import { TokenConfig } from '../../types.js';
import { TurboWinstonLogger } from '../logger.js';
import { EthereumToken } from './ethereum.js';

export class PolygonToken extends EthereumToken {
  constructor({
    logger = TurboWinstonLogger.default,
    gatewayUrl = 'https://polygon-rpc.com/',
    pollingOptions = {
      maxAttempts: 10,
      pollingIntervalMs: 4_000,
      initialBackoffMs: 5_000,
    },
  }: TokenConfig = {}) {
    super({ logger, gatewayUrl, pollingOptions });
  }
}
