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
  BaseUploadEmitter,
  TurboUploadEmitterBaseFactory,
} from '../common/upload.js';
import { TurboUploadEmitter, TurboUploadEmitterParams } from '../types.js';
import { isTurboUploadEmitter } from '../utils/common.js';

export class TurboWebUploadEmitter extends BaseUploadEmitter {
  constructor(params?: TurboUploadEmitterParams) {
    super(params);
  }

  createEventingStream(data: Buffer | ReadableStream): ReadableStream {
    // ReadableStream do not emit events, so we need to wrap it in a new ReadableStream with eventing in the hooks
    const originalStream =
      data instanceof ReadableStream
        ? data
        : new ReadableStream({
            start: (controller) => {
              controller.enqueue(data);
              controller.close();
            },
          });

    const reader = originalStream.getReader();

    return new ReadableStream({
      async pull(controller) {
        const { value, done } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        this.emit('progress', { chunk: value });
        controller.enqueue(value);
      },
      cancel(reason) {
        return reader.cancel(reason);
      },
    });
  }
}

export class TurboUploadEmitterFactory extends TurboUploadEmitterBaseFactory {
  from(
    params?: TurboUploadEmitterParams | TurboUploadEmitter,
  ): TurboUploadEmitter {
    if (isTurboUploadEmitter(params)) {
      return params;
    }
    return new TurboWebUploadEmitter(params);
  }
}
