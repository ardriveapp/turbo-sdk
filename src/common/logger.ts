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
import { TurboLogger } from '../types.js';
import { version } from '../version.js';

export type LogLevel = 'info' | 'debug' | 'error' | 'none';
export type LogFormat = 'simple' | 'json';

export class ConsoleTurboLogger implements TurboLogger {
  private level: LogLevel;
  private format: LogFormat;
  private silent: boolean;

  static default = new ConsoleTurboLogger();

  constructor({
    level = 'info',
    logFormat = 'simple',
  }: {
    level?: LogLevel;
    logFormat?: LogFormat;
  } = {}) {
    this.level = level;
    this.format = logFormat;
    this.silent = level === 'none';
  }

  private shouldLog(level: LogLevel): boolean {
    if (this.silent) return false;
    const order: LogLevel[] = ['none', 'error', 'info', 'debug'];
    return order.indexOf(level) <= order.indexOf(this.level);
  }

  private formatMessage(level: string, message: string, args: unknown[]) {
    const base = {
      level,
      message,
      args,
      version,
      timestamp: new Date().toISOString(),
    };
    return this.format === 'json'
      ? JSON.stringify(base)
      : `[${base.timestamp}] [${level.toUpperCase()}] ${message} ${args
          .map((a) => JSON.stringify(a))
          .join(' ')}`;
  }

  info(message: string, ...args: unknown[]) {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message, args));
    }
  }

  warn(message: string, ...args: unknown[]) {
    if (this.shouldLog('info')) {
      console.warn(this.formatMessage('warn', message, args));
    }
  }

  error(message: string, ...args: unknown[]) {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message, args));
    }
  }

  debug(message: string, ...args: unknown[]) {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message, args));
    }
  }

  setLogLevel(level: LogLevel) {
    this.level = level;
    this.silent = level === 'none';
  }

  setLogFormat(logFormat: LogFormat) {
    this.format = logFormat;
  }
}
