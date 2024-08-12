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
  protected logger: winston.Logger | Console;
  private silent = false;

  static default = new TurboWinstonLogger();

  constructor({
    level = 'info',
    logFormat = 'simple',
  }: {
    level?: 'info' | 'debug' | 'error' | 'none' | undefined;
    logFormat?: 'simple' | 'json' | undefined;
  } = {}) {
    if (level === 'none') {
      this.silent = true;
    }
    if (typeof window !== 'undefined') {
      this.logger = console;
    } else {
      this.logger = createLogger({
        level,
        silent: this.silent,
        defaultMeta: {
          name: 'ar-io-sdk',
          version,
        },
        format: format.combine(format.timestamp(), format.json()),
        transports: [
          new transports.Console({
            format: getLogFormat(logFormat),
          }),
        ],
      });
    }
  }

  info(message: string, ...args: unknown[]) {
    if (this.silent) return;

    this.logger.info(message, ...args);
  }

  warn(message: string, ...args: unknown[]) {
    if (this.silent) return;

    this.logger.warn(message, ...args);
  }

  error(message: string, ...args: unknown[]) {
    if (this.silent) return;

    this.logger.error(message, ...args);
  }

  debug(message: string, ...args: unknown[]) {
    if (this.silent) return;

    this.logger.debug(message, ...args);
  }

  setLogLevel(level: string) {
    this.silent = level === 'none';
    if ('silent' in this.logger) {
      this.logger.silent = level === 'none';
    }

    if ('level' in this.logger) {
      this.logger.level = level;
    }
  }

  setLogFormat(logFormat: string) {
    if ('format' in this.logger) {
      this.logger.format = getLogFormat(logFormat);
    }
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
