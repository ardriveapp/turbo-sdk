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
import { version } from '../version.js';
export class Logger {
    constructor({ level = 'info', } = {}) {
        this.level = 'info';
        this.levels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
            none: 999,
        };
        this.level = level;
    }
    formatMessage(level, message, ...args) {
        const timestamp = new Date().toISOString();
        const meta = {
            timestamp,
            level,
            message,
            name: 'turbo-sdk',
            version,
        };
        if (args.length > 0) {
            return JSON.stringify({ ...meta, args });
        }
        return JSON.stringify(meta);
    }
    log(level, message, ...args) {
        if (this.levels[level] < this.levels[this.level]) {
            return;
        }
        const formattedMessage = this.formatMessage(level, message, ...args);
        switch (level) {
            case 'debug':
                console.debug(formattedMessage);
                break;
            case 'info':
                console.info(formattedMessage);
                break;
            case 'warn':
                console.warn(formattedMessage);
                break;
            case 'error':
                console.error(formattedMessage);
                break;
        }
    }
    info(message, ...args) {
        this.log('info', message, ...args);
    }
    warn(message, ...args) {
        this.log('warn', message, ...args);
    }
    error(message, ...args) {
        this.log('error', message, ...args);
    }
    debug(message, ...args) {
        this.log('debug', message, ...args);
    }
    setLogLevel(level) {
        this.level = level;
    }
}
Logger.default = new Logger();
