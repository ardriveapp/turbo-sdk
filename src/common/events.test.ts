import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Readable } from 'stream';

import { UploadEmitter } from './events.js';

describe('UploadEmitter', () => {
  describe('Readable', () => {
    it('should call onProgress callback and emit progress events when stream is consumed', () => {
      let onProgressCalled = false;
      let progressEventEmitted = false;
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
      emitter.on('progress', () => {
        progressEventEmitted = true;
      });
      // TODO: ideally use generics to avoid needing to cast here
      (stream as Readable).read();
      assert(onProgressCalled);
      assert(progressEventEmitted);
    });
  });

  describe('ReadableStream', () => {
    it('should call onProgress callback and emit progress events when stream is consumed', async () => {
      let onProgressCalled = false;
      let progressEventEmitted = false;
      const onProgress = () => {
        onProgressCalled = true;
      };
      const data = new ReadableStream({
        start(controller) {
          controller.enqueue(Buffer.from('test'));
          controller.close();
        },
      });
      const emitter = new UploadEmitter({ onProgress });
      const stream = emitter.createEventingStream({
        data,
        dataSize: 10,
      });
      emitter.on('progress', () => {
        progressEventEmitted = true;
      });
      // TODO: ideally use generics to avoid needing to cast here
      const reader = (stream as ReadableStream).getReader();
      // read the stream
      await reader.read();
      assert(onProgressCalled);
      assert(progressEventEmitted);
    });
  });
});
