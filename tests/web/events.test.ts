import { expect } from 'chai';
import { stub } from 'sinon';

import { UploadEmitter } from '../../src/common/events.js';

describe('EventingReadableStream', () => {
  it('should use passed in onProgress callback', () => {
    const onProgress = stub();
    const emitter = new UploadEmitter({ onProgress });
    // we test this way so that we know when others read the stream, it will emit the event
    const stream = emitter.createEventingStream(
      new ReadableStream({
        start(controller) {
          controller.enqueue(Buffer.from('test'));
          controller.close();
        },
      }),
      10,
    ) as ReadableStream<Buffer>;
    // read stream and assert onProgress is called
    const reader = stream.getReader();
    reader.read().then(() => {
      expect(onProgress.calledOnce).to.be.true;
    });
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
