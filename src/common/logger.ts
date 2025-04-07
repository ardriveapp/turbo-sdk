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
import {
  Logger as WinstonLogger,
  createLogger,
  format,
  transports,
} from 'winston';

import { TurboLogger } from '../types.js';
import { version } from '../version.js';

export class TurboWinstonLogger implements TurboLogger {
  protected logger: WinstonLogger | Console;
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
          name: 'turbo-sdk',
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
