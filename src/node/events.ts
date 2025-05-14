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
import { Readable } from 'stream';

import {
  BaseUploadEmitter,
  TurboUploadEmitterBaseFactory,
} from '../common/upload.js';
import { TurboUploadEmitter, TurboUploadEmitterParams } from '../types.js';
import { isTurboUploadEmitter } from '../utils/common.js';

export class TurboNodeUploadEmitter extends BaseUploadEmitter {
  constructor(params?: TurboUploadEmitterParams) {
    super(params);
  }

  createEventingStream(data: Readable | Buffer): Readable {
    const stream = data instanceof Readable ? data : Readable.from(data);
    stream.on('data', (chunk) => {
      this.emit('progress', { chunk });
    });
    return stream;
  }
}

export class TurboUploadEmitterFactory extends TurboUploadEmitterBaseFactory {
  from(
    params?: TurboUploadEmitterParams | TurboUploadEmitter,
  ): TurboUploadEmitter {
    if (isTurboUploadEmitter(params)) {
      return params;
    }
    return new TurboNodeUploadEmitter(params);
  }
}
