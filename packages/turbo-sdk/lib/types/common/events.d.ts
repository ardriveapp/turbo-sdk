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
import { EventEmitter } from 'eventemitter3';
import { Readable } from 'stream';
import { TurboFolderUploadEmitterEventArgs, TurboFolderUploadEventsAndPayloads, TurboSigningEmitterEventArgs, TurboSigningEventsAndPayloads, TurboTotalEmitterEventArgs, TurboTotalEventsAndPayloads, TurboUploadEmitterEventArgs, TurboUploadEventsAndPayloads } from '../types.js';
/**
 * Creates an eventing stream from the input data that emits progress and error events
 */
export declare function createStreamWithEvents({ data, dataSize, emitter, eventNamesMap, }: {
    data: Readable | Buffer | ReadableStream;
    dataSize: number;
    emitter: TurboEventEmitter;
    eventNamesMap: {
        'on-progress': keyof TurboUploadEventsAndPayloads | keyof TurboSigningEventsAndPayloads | keyof TurboTotalEventsAndPayloads;
        'on-error': keyof TurboUploadEventsAndPayloads | keyof TurboSigningEventsAndPayloads | keyof TurboTotalEventsAndPayloads;
        'on-end': keyof TurboUploadEventsAndPayloads | keyof TurboSigningEventsAndPayloads | keyof TurboTotalEventsAndPayloads;
    };
}): {
    stream: Readable | ReadableStream;
    resume: () => void;
};
export type TurboEventEmitterEvents = TurboUploadEventsAndPayloads & TurboSigningEventsAndPayloads & TurboTotalEventsAndPayloads & TurboFolderUploadEventsAndPayloads;
export type TurboEventEmitterEventArgs = TurboUploadEmitterEventArgs & TurboSigningEmitterEventArgs & TurboTotalEmitterEventArgs & TurboFolderUploadEmitterEventArgs;
export declare class TurboEventEmitter extends EventEmitter<TurboEventEmitterEvents> {
    constructor({ onProgress, onError, onSuccess, onUploadProgress, onUploadError, onUploadSuccess, onSigningProgress, onSigningError, onSigningSuccess, onFileStart, onFileProgress, onFileComplete, onFileError, onFolderProgress, onFolderError, onFolderSuccess, }?: TurboEventEmitterEventArgs);
}
export declare function createStreamWithUploadEvents({ data, dataSize, emitter, }: {
    data: Readable | Buffer | ReadableStream;
    dataSize: number;
    emitter?: TurboEventEmitter;
}): {
    stream: Readable | ReadableStream;
    resume: () => void;
};
export declare function createStreamWithSigningEvents({ data, dataSize, emitter, }: {
    data: Readable | Buffer | ReadableStream;
    dataSize: number;
    emitter?: TurboEventEmitter;
}): {
    stream: Readable | ReadableStream;
    resume: () => void;
};
//# sourceMappingURL=events.d.ts.map