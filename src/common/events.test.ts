import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Readable } from 'stream';

import { UploadEmitter } from './events.js';

describe('UploadEmitter', () => {
  describe('Readable', () => {
    it('should call onUploadProgress callback and emit progress events when stream is consumed', async () => {
      let onProgressCalled = false;
      let progressEventEmitted = false;
      const onUploadProgress = () => {
        onProgressCalled = true;
      };
      const emitter = new UploadEmitter({ onUploadProgress });
      const data = Readable.from(['test', 'test', 'test', 'test', 'test']); // needs to be big enough to trigger the event
      // we test this way so that we know when others read the stream, it will emit the event
      const stream = emitter.createEventingStream({
        data,
        dataSize: 50,
      });
      emitter.on('upload-progress', () => {
        progressEventEmitted = true;
      });
      // TODO: ideally use generics to avoid needing to cast here
      // consume the stream using promises
      await new Promise((resolve) => {
        (stream as Readable).on('data', () => {
          resolve(true);
        });
      });
      assert(onProgressCalled);
      assert(progressEventEmitted);
    });

    it('should call onUploadError callback and emit error events when stream errors', async () => {
      let onErrorCalled = false;
      let errorEventEmitted = false;
      const testError = new Error('Test error');
      const onUploadError = () => {
        onErrorCalled = true;
      };
      const emitter = new UploadEmitter({ onUploadError });

      // Create a readable stream that will emit an error
      const data = new Readable({
        read() {
          this.emit('error', testError);
        },
      });

      const stream = emitter.createEventingStream({
        data,
        dataSize: 10,
      });

      emitter.on('upload-error', () => {
        errorEventEmitted = true;
      });

      try {
        await new Promise((_, reject) => {
          (stream as Readable).on('error', () => {
            reject(testError);
          });
        });
      } catch (error) {
        // Error is expected
      }

      assert(onErrorCalled);
      assert(errorEventEmitted);
    });
  });

  describe('ReadableStream', () => {
    it('should call onUploadProgress callback and emit progress events when stream is consumed', async () => {
      let onProgressCalled = false;
      let progressEventEmitted = false;
      const onUploadProgress = () => {
        onProgressCalled = true;
      };
      const data = new ReadableStream({
        start(controller) {
          controller.enqueue(Buffer.from('test'));
          controller.close();
        },
      });
      const emitter = new UploadEmitter({ onUploadProgress });
      const stream = emitter.createEventingStream({
        data,
        dataSize: 10,
      });
      emitter.on('upload-progress', () => {
        progressEventEmitted = true;
      });
      // TODO: ideally use generics to avoid needing to cast here
      const reader = (stream as ReadableStream).getReader();
      // read the stream
      await reader.read();
      assert(onProgressCalled);
      assert(progressEventEmitted);
    });

    it('should call onUploadError callback and emit error events when stream errors', async () => {
      let onErrorCalled = false;
      let errorEventEmitted = false;
      const testError = new Error('Test error');
      const onUploadError = () => {
        onErrorCalled = true;
      };

      // Create a ReadableStream that will throw an error
      const data = new ReadableStream({
        pull() {
          throw testError;
        },
      });

      const emitter = new UploadEmitter({ onUploadError });
      const stream = emitter.createEventingStream({
        data,
        dataSize: 10,
      });

      emitter.on('upload-error', () => {
        errorEventEmitted = true;
      });

      // Trigger error
      try {
        const reader = (stream as ReadableStream).getReader();
        await reader.read();
      } catch (error) {
        // Error is expected
      }

      assert(onErrorCalled);
      assert(errorEventEmitted);
    });
  });
});
