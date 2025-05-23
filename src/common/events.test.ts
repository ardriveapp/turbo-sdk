import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Readable } from 'stream';

import { UploadEmitter } from './events.js';

describe('EventingReadable', () => {
  it('should use passed in onProgress callback', () => {
    let onProgressCalled = false;
    const onProgress = () => {
      onProgressCalled = true;
    };
    const emitter = new UploadEmitter({ onProgress });
    const data = Readable.from(['test']);
    // we test this way so that we know when others read the stream, it will emit the event
    const stream = emitter.createEventingStream({
      data,
      dataSize: 10,
    });
    // TODO: ideally use generics to avoid needing to cast here
    (stream as Readable).read();
    assert(onProgressCalled);
  });

  it('should emit progress events', () => {
    let progressCalled = false;
    const progress = () => {
      progressCalled = true;
    };
    const emitter = new UploadEmitter({ onProgress: progress });
    emitter.emit('progress', {
      uploadedBytes: 10,
      totalBytes: 20,
    });
    assert(progressCalled);
  });
});
