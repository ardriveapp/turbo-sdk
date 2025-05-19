import { expect } from 'chai';
import { stub } from 'sinon';
import { Readable } from 'stream';

import { UploadEmitter } from '../../src/common/events.js';

describe('EventingReadable', () => {
  it('should use passed in onProgress callback', () => {
    const onProgress = stub();
    const emitter = new UploadEmitter({ onProgress });
    // we test this way so that we know when others read the stream, it will emit the event
    const stream = emitter.createEventingStream(
      Readable.from(['test']),
      10,
    ) as Readable;
    stream.read();
    expect(onProgress.calledOnce).to.be.true;
  });

  it('should emit progress events', () => {
    const progress = stub();
    const emitter = new UploadEmitter({ onProgress: progress });
    emitter.emit('progress', {
      chunk: Buffer.from('test'),
      uploadedBytes: 10,
      totalBytes: 20,
    });
    expect(progress.calledOnce).to.be.true;
  });
});
