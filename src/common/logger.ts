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
import winston, { createLogger, format, transports } from 'winston';

import { TurboLogger } from '../types.js';
import { version } from '../version.js';

export class TurboWinstonLogger implements TurboLogger {
  protected logger: winston.Logger;
  constructor({
    level = 'info',
    logFormat = 'simple',
  }: {
    level?: 'info' | 'debug' | 'error' | 'none' | undefined;
    logFormat?: 'simple' | 'json' | undefined;
  } = {}) {
    this.logger = createLogger({
      level,
      defaultMeta: { client: 'turbo-sdk', version },
      silent: level === 'none',
      format: getLogFormat(logFormat),
      transports: [new transports.Console()],
    });
  }

  info(message: string, ...args: unknown[]) {
    this.logger.info(message, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    this.logger.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]) {
    this.logger.error(message, ...args);
  }

  debug(message: string, ...args: unknown[]) {
    this.logger.debug(message, ...args);
  }

  setLogLevel(level: string) {
    this.logger.level = level;
  }

  setLogFormat(logFormat: string) {
    this.logger.format = getLogFormat(logFormat);
  }
}

function getLogFormat(logFormat: string) {
  return format.combine(
    format((info) => {
      if (info.stack && info.level !== 'error') {
        delete info.stack;
      }
      return info;
    })(),
    format.errors({ stack: true }), // Ensure errors show a stack trace
    format.timestamp(),
    logFormat === 'json' ? format.json() : format.simple(),
  );
}
