import { EventEmitter } from 'eventemitter3';
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Readable } from 'stream';

import {
  TurboEventEmitter,
  createStreamWithEvents,
  createStreamWithSigningEvents,
  createStreamWithUploadEvents,
} from './events.js';

describe('createStreamWithUploadEvents', () => {
  describe('Readable', () => {
    it('should call onUploadProgress callback and emit progress events when stream is consumed', async () => {
      let onProgressCalled = false;
      let progressEventEmitted = false;
      const onUploadProgress = () => {
        onProgressCalled = true;
      };
      const emitter = new TurboEventEmitter({ onUploadProgress });
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
      const emitter = new TurboEventEmitter({ onUploadProgress });
      const stream = createStreamWithUploadEvents({
        data,
        dataSize: 4,
        emitter,
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

      assert(onErrorCalled);
      assert(errorEventEmitted);
    });
  });
});

describe('createStreamWithEvents', () => {
  describe('with Readable', () => {
    it('should emit progress events with correct payload when stream is consumed', async () => {
      const emitter = new EventEmitter();
      const progressEventName = 'test-progress';
      const errorEventName = 'test-error';

      // Track events
      let progressCalled = false;

      emitter.on(progressEventName, () => {
        progressCalled = true;
      });

      // Create test data
      const testData = 'testdata';
      const data = Readable.from([testData]);
      const dataSize = testData.length;

      // Create stream with events
      const stream = createStreamWithEvents({
        data,
        dataSize,
        emitter,
        eventNamesMap: {
          'on-progress': progressEventName,
          'on-error': errorEventName,
          'on-end': 'test-end',
        },
      }) as Readable;

      // Consume the stream
      await new Promise<void>((resolve) => {
        stream.on('data', () => {});
        stream.on('end', () => resolve());
      });

      // Verify events
      assert(progressCalled, 'Progress event should be called');
    });

    it('should emit error events with correct payload when stream errors', async () => {
      const emitter = new EventEmitter();
      const progressEventName = 'test-progress';
      const errorEventName = 'test-error';
      const testError = new Error('Test error');

      // Track events
      let errorCalled = false;
      let errorPayload = null;

      emitter.on(errorEventName, (payload) => {
        errorCalled = true;
        errorPayload = payload;
      });

      // Create a readable stream that will emit an error
      const data = new Readable({
        read() {
          this.emit('error', testError);
        },
      });

      // Create stream with events
      const stream = createStreamWithEvents({
        data,
        dataSize: 10,
        emitter,
        eventNamesMap: {
          'on-progress': progressEventName,
          'on-error': errorEventName,
          'on-end': 'test-end',
        },
      }) as Readable;

      // Trigger error
      try {
        await new Promise((_, reject) => {
          stream.on('error', (err) => {
            reject(err);
          });

          // Force read to trigger error
          stream.resume();
        });
      } catch (error) {
        // Error is expected
      }

      // Verify events
      assert(errorCalled, 'Error event should be called');
      assert.equal(
        errorPayload,
        testError,
        'Error payload should contain the error',
      );
    });
  });

  describe('with ReadableStream', () => {
    it('should emit progress events with correct payload when stream is consumed', async () => {
      const emitter = new EventEmitter();
      const progressEventName = 'test-progress';
      const errorEventName = 'test-error';

      // Track events
      let progressCalled = false;

      emitter.on(progressEventName, () => {
        progressCalled = true;
      });

      // Create test data
      const testData = Buffer.from('testdata');
      const dataSize = testData.length;

      // Create a ReadableStream with the test data
      const data = new ReadableStream({
        start(controller) {
          controller.enqueue(testData);
          controller.close();
        },
      });

      // Create stream with events
      const stream = createStreamWithEvents({
        data,
        dataSize,
        emitter,
        eventNamesMap: {
          'on-progress': progressEventName,
          'on-error': errorEventName,
          'on-end': 'test-end',
        },
      }) as ReadableStream;

      // Consume the stream
      const reader = stream.getReader();
      await reader.read();

      // Verify events
      assert(progressCalled, 'Progress event should be called');
    });

    it('should emit error events with correct payload when stream errors', async () => {
      const emitter = new EventEmitter();
      const progressEventName = 'test-progress';
      const errorEventName = 'test-error';
      const testError = new Error('Test error');

      // Track events
      let errorCalled = false;
      let errorPayload = null;

      emitter.on(errorEventName, (payload) => {
        errorCalled = true;
        errorPayload = payload;
      });

      // Create a ReadableStream that will throw an error
      const data = new ReadableStream({
        pull() {
          throw testError;
        },
      });

      // Create stream with events
      const stream = createStreamWithEvents({
        data,
        dataSize: 10,
        emitter,
        eventNamesMap: {
          'on-progress': progressEventName,
          'on-error': errorEventName,
          'on-end': 'test-end',
        },
      }) as ReadableStream;

      // Trigger error
      try {
        const reader = stream.getReader();
        await reader.read();
      } catch (error) {
        // Error is expected
      }

      // Verify events
      assert(errorCalled, 'Error event should be called');
      assert.equal(
        errorPayload,
        testError,
        'Error payload should contain the error',
      );
    });
  });

  it('should throw an error for invalid input types', () => {
    const emitter = new EventEmitter();
    const invalidData = {};

    assert.throws(() => {
      createStreamWithEvents({
        // @ts-expect-error Testing invalid input
        data: invalidData,
        dataSize: 10,
        emitter,
        eventNamesMap: {
          'on-progress': 'test-progress',
          'on-error': 'test-error',
          'on-end': 'test-end',
        },
      });
    }, /Invalid data or platform type/);
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

describe('createStreamWithEvents', () => {
  describe('with Readable', () => {
    it('should emit progress events with correct payload when stream is consumed', async () => {
      const emitter = new EventEmitter();
      const progressEventName = 'test-progress';
      const errorEventName = 'test-error';

      // Track events
      let progressCalled = false;

      emitter.on(progressEventName, () => {
        progressCalled = true;
      });

      // Create test data
      const testData = 'testdata';
      const data = Readable.from([testData]);
      const dataSize = testData.length;

      // Create stream with events
      const stream = createStreamWithEvents({
        data,
        dataSize,
        emitter,
        eventNamesMap: {
          'on-progress': progressEventName,
          'on-error': errorEventName,
          'on-end': 'test-end',
        },
      }) as Readable;

      // Consume the stream
      await new Promise<void>((resolve) => {
        stream.on('data', () => {});
        stream.on('end', () => resolve());
      });

      // Verify events
      assert(progressCalled, 'Progress event should be called');
    });

    it('should emit error events with correct payload when stream errors', async () => {
      const emitter = new EventEmitter();
      const progressEventName = 'test-progress';
      const errorEventName = 'test-error';
      const testError = new Error('Test error');

      // Track events
      let errorCalled = false;
      let errorPayload = null;

      emitter.on(errorEventName, (payload) => {
        errorCalled = true;
        errorPayload = payload;
      });

      // Create a readable stream that will emit an error
      const data = new Readable({
        read() {
          this.emit('error', testError);
        },
      });

      // Create stream with events
      const stream = createStreamWithEvents({
        data,
        dataSize: 10,
        emitter,
        eventNamesMap: {
          'on-progress': progressEventName,
          'on-error': errorEventName,
          'on-end': 'test-end',
        },
      }) as Readable;

      // Trigger error
      try {
        await new Promise((_, reject) => {
          stream.on('error', (err) => {
            reject(err);
          });

          // Force read to trigger error
          stream.resume();
        });
      } catch (error) {
        // Error is expected
      }

      // Verify events
      assert(errorCalled, 'Error event should be called');
      assert.equal(
        errorPayload,
        testError,
        'Error payload should contain the error',
      );
    });
  });

  describe('with ReadableStream', () => {
    it('should emit progress events with correct payload when stream is consumed', async () => {
      const emitter = new EventEmitter();
      const progressEventName = 'test-progress';
      const errorEventName = 'test-error';

      // Track events
      let progressCalled = false;
      let totalBytes = 0;

      // Create test data
      const testData = Buffer.from('testdata');
      const dataSize = testData.length;

      emitter.on(progressEventName, (chunk) => {
        progressCalled = true;
        totalBytes += chunk.processedBytes;
      });

      // Create a ReadableStream with the test data
      const data = new ReadableStream({
        start(controller) {
          controller.enqueue(testData);
          controller.close();
        },
      });

      // Create stream with events
      const stream = createStreamWithEvents({
        data,
        dataSize,
        emitter,
        eventNamesMap: {
          'on-progress': progressEventName,
          'on-error': errorEventName,
          'on-end': 'test-end',
        },
      }) as ReadableStream;

      // Consume the stream
      const reader = stream.getReader();
      await reader.read();

      // Verify events
      assert(progressCalled, 'Progress event should be called');
    });

    it('should emit error events with correct payload when stream errors', async () => {
      const emitter = new EventEmitter();
      const progressEventName = 'test-progress';
      const errorEventName = 'test-error';
      const testError = new Error('Test error');

      // Track events
      let errorCalled = false;
      let errorPayload = null;

      emitter.on(errorEventName, (payload) => {
        errorCalled = true;
        errorPayload = payload;
      });

      // Create a ReadableStream that will throw an error
      const data = new ReadableStream({
        pull() {
          throw testError;
        },
      });

      // Create stream with events
      const stream = createStreamWithEvents({
        data,
        dataSize: 10,
        emitter,
        eventNamesMap: {
          'on-progress': progressEventName,
          'on-error': errorEventName,
          'on-end': 'test-end',
        },
      }) as ReadableStream;

      // Trigger error
      try {
        const reader = stream.getReader();
        await reader.read();
      } catch (error) {
        // Error is expected
      }

      // Verify events
      assert(errorCalled, 'Error event should be called');
      assert.equal(
        errorPayload,
        testError,
        'Error payload should contain the error',
      );
    });
  });

  it('should throw an error for invalid input types', () => {
    const emitter = new EventEmitter();
    const invalidData = {};

    assert.throws(() => {
      createStreamWithEvents({
        // @ts-expect-error Testing invalid input
        data: invalidData,
        dataSize: 10,
        emitter,
        eventNamesMap: {
          'on-progress': 'test-progress',
          'on-error': 'test-error',
          'on-end': 'test-end',
        },
      });
    }, /Invalid data or platform type/);
  });
});
