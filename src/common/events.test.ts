import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Readable } from 'stream';

import { TurboTotalEventsAndPayloads } from '../types.js';
import {
  TurboEventEmitter,
  createStreamWithSigningEvents,
  createStreamWithUploadEvents,
} from './events.js';

describe('createStreamWithUploadEvents', () => {
  describe('Readable', () => {
    it('should call onUploadProgress and onUploadSuccess callback and emit progress events when stream is consumed', async () => {
      let onProgressCalled = false;
      let progressEventEmitted = false;
      let onSuccessCalled = false;
      let successEventEmitted = false;
      const onUploadProgress = () => {
        onProgressCalled = true;
      };
      const onUploadSuccess = () => {
        onSuccessCalled = true;
      };
      const emitter = new TurboEventEmitter({
        onUploadProgress,
        onUploadSuccess,
      });
      const data = Readable.from(['test']);
      // we test this way so that we know when others read the stream, it will emit the event
      const stream = createStreamWithUploadEvents({
        data,
        dataSize: 4,
        emitter,
      });
      emitter.on('upload-progress', () => {
        progressEventEmitted = true;
      });
      emitter.on('upload-success', () => {
        successEventEmitted = true;
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
      assert(onSuccessCalled);
      assert(successEventEmitted);
    });

    it('should call onUploadError callback and emit error events when stream errors', async () => {
      let onErrorCalled = false;
      let errorEventEmitted = false;
      const testError = new Error('Test error');
      const onUploadError = () => {
        onErrorCalled = true;
      };
      const emitter = new TurboEventEmitter({ onUploadError });

      // Create a readable stream that will emit an error
      const data = new Readable({
        read() {
          this.emit('error', testError);
        },
      });

      const stream = createStreamWithUploadEvents({
        data,
        dataSize: 10,
        emitter,
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
    it('should call onUploadProgress and onUploadSuccess callback and emit progress events when stream is consumed', async () => {
      let onProgressCalled = false;
      let progressEventEmitted = false;
      let onSuccessCalled = false;
      let successEventEmitted = false;
      let onErrorCalled = false;
      let errorEventEmitted = false;

      const emitter = new TurboEventEmitter({
        onUploadProgress: () => {
          onProgressCalled = true;
        },
        onUploadSuccess: () => {
          onSuccessCalled = true;
        },
        onUploadError: () => {
          onErrorCalled = true;
        },
      });
      const data = new ReadableStream({
        start(controller) {
          controller.enqueue(Buffer.from('test test test test test'));
          controller.close();
        },
      });
      const stream = createStreamWithUploadEvents({
        data,
        dataSize: 4,
        emitter,
      });
      emitter.on('upload-progress', () => {
        progressEventEmitted = true;
      });
      emitter.on('upload-error', () => {
        errorEventEmitted = true;
      });
      emitter.on('upload-success', () => {
        successEventEmitted = true;
      });
      // TODO: ideally use generics to avoid needing to cast here
      const reader = (stream as ReadableStream).getReader();

      // read the stream to the end
      while (true) {
        const { done } = await reader.read();
        if (done) {
          break;
        }
      }

      // progress events called
      assert(onProgressCalled, 'onProgressCalled should be true');
      assert(progressEventEmitted, 'progressEventEmitted should be true');

      // error event not called
      assert(!errorEventEmitted, 'errorEventEmitted should be false');
      assert(!onErrorCalled, 'onErrorCalled should be false');

      // success event called
      assert(onSuccessCalled, 'onSuccessCalled should be true');
      assert(successEventEmitted, 'successEventEmitted should be true');
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

      const emitter = new TurboEventEmitter({ onUploadError });
      const stream = createStreamWithUploadEvents({
        data,
        dataSize: 4,
        emitter,
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

      assert(onErrorCalled, 'onErrorCalled should be true');
      assert(errorEventEmitted, 'errorEventEmitted should be true');
    });
  });
});

describe('createStreamWithSigningEvents', () => {
  describe('Readable', () => {
    it('should call onSigningProgress callback and emit progress events when stream is consumed', async () => {
      let onProgressCalled = false;
      let progressEventEmitted = false;
      const onSigningProgress = () => {
        onProgressCalled = true;
      };
      const emitter = new TurboEventEmitter({ onSigningProgress });
      const data = Readable.from(['test', 'test', 'test', 'test', 'test']); // needs to be big enough to trigger the event
      // we test this way so that we know when others read the stream, it will emit the event
      const stream = createStreamWithSigningEvents({
        data,
        dataSize: 50,
        emitter,
      });
      emitter.on('signing-progress', () => {
        progressEventEmitted = true;
      });

      // consume the stream using promises
      await new Promise((resolve) => {
        (stream as Readable).on('data', () => {
          resolve(true);
        });
      });

      assert(onProgressCalled);
      assert(progressEventEmitted);
    });

    it('should call onSigningError callback and emit error events when stream errors', async () => {
      let onErrorCalled = false;
      let errorEventEmitted = false;
      const testError = new Error('Test error');
      const onSigningError = () => {
        onErrorCalled = true;
      };
      const emitter = new TurboEventEmitter({ onSigningError });

      // Create a readable stream that will emit an error
      const data = new Readable({
        read() {
          this.emit('error', testError);
        },
      });

      const stream = createStreamWithSigningEvents({
        data,
        dataSize: 10,
        emitter,
      });

      emitter.on('signing-error', () => {
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
    it('should call onSigningProgress callback and emit progress events when stream is consumed', async () => {
      let onProgressCalled = false;
      let progressEventEmitted = false;
      const onSigningProgress = () => {
        onProgressCalled = true;
      };
      const data = new ReadableStream({
        start(controller) {
          controller.enqueue(Buffer.from('test'));
          controller.close();
        },
      });
      const emitter = new TurboEventEmitter({ onSigningProgress });
      const stream = createStreamWithSigningEvents({
        data,
        dataSize: 10,
        emitter,
      });
      emitter.on('signing-progress', () => {
        progressEventEmitted = true;
      });

      // TODO: ideally use generics to avoid needing to cast here
      const reader = (stream as ReadableStream).getReader();
      // read the stream
      await reader.read();

      assert(onProgressCalled);
      assert(progressEventEmitted);
    });

    it('should call onSigningError callback and emit error events when stream errors', async () => {
      let onErrorCalled = false;
      let errorEventEmitted = false;
      const testError = new Error('Test error');
      const onSigningError = () => {
        onErrorCalled = true;
      };

      // Create a ReadableStream that will throw an error
      const data = new ReadableStream({
        pull() {
          throw testError;
        },
      });

      const emitter = new TurboEventEmitter({ onSigningError });
      const stream = createStreamWithSigningEvents({
        data,
        dataSize: 10,
        emitter,
      });

      emitter.on('signing-error', () => {
        errorEventEmitted = true;
      });

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

describe('TurboEventEmitter', () => {
  it('should emit overall-success event when upload-success event is emitted', () => {
    const emitter = new TurboEventEmitter();
    let overallSuccessCalled = false;
    emitter.on('overall-success', () => {
      overallSuccessCalled = true;
    });
    emitter.emit('upload-success');
    assert(overallSuccessCalled);
  });
  it('should emit progress events when signing-progress event is emitted', () => {
    const emitter = new TurboEventEmitter();

    let overallProgressCalled = false;
    let overallProgressPayload:
      | TurboTotalEventsAndPayloads['overall-progress']
      | undefined;
    emitter.on('overall-progress', (event) => {
      overallProgressCalled = true;
      overallProgressPayload = event;
    });
    emitter.emit('signing-progress', {
      processedBytes: 100,
      totalBytes: 1000,
    });
    assert(overallProgressCalled);
    assert.equal(overallProgressPayload?.processedBytes, 50);
    assert.equal(overallProgressPayload?.totalBytes, 1000);
    assert.equal(overallProgressPayload?.step, 'signing');
  });

  it('should emit error events when signing-error event is emitted', () => {
    const emitter = new TurboEventEmitter();
    const testError = new Error('Signing error');
    let overallErrorCalled = false;
    let overallErrorPayload:
      | TurboTotalEventsAndPayloads['overall-error']
      | undefined;
    emitter.on('overall-error', (event) => {
      overallErrorCalled = true;
      overallErrorPayload = event;
    });
    emitter.emit('signing-error', {
      error: testError,
    });
    assert(overallErrorCalled);
    assert.deepStrictEqual(overallErrorPayload?.error, testError);
  });

  it('should emit error events when upload-error event is emitted', () => {
    const emitter = new TurboEventEmitter();
    const testError = new Error('Upload error');
    let overallErrorCalled = false;
    let overallErrorPayload:
      | TurboTotalEventsAndPayloads['overall-error']
      | undefined;
    emitter.on('overall-error', (event) => {
      overallErrorCalled = true;
      overallErrorPayload = event;
    });
    emitter.emit('upload-error', {
      error: testError,
    });
    assert(overallErrorCalled);
    assert.deepStrictEqual(overallErrorPayload?.error, testError);
  });
  it('should emit progress events when upload-progress event is emitted', () => {
    const emitter = new TurboEventEmitter();
    let overallProgressCalled = false;
    let overallProgressPayload:
      | TurboTotalEventsAndPayloads['overall-progress']
      | undefined;
    emitter.on('overall-progress', (event) => {
      overallProgressCalled = true;
      overallProgressPayload = event;
    });
    emitter.emit('upload-progress', {
      processedBytes: 100,
      totalBytes: 1000,
    });
    assert(overallProgressCalled);
    assert.equal(overallProgressPayload?.processedBytes, 500 + 100 / 2);
    assert.equal(overallProgressPayload?.totalBytes, 1000);
    assert.equal(overallProgressPayload?.step, 'upload');
  });
});
