import { strict as assert } from 'node:assert';
import { Readable } from 'node:stream';
import { describe, it } from 'node:test';

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

      const emitter = new TurboEventEmitter({
        onUploadProgress: () => {
          onProgressCalled = true;
        },
        onUploadSuccess: () => {
          onSuccessCalled = true;
        },
      });

      const data = new Readable({
        read() {
          this.push(Buffer.from('test'));
          this.push(null); // End the stream
        },
      });
      emitter.on('upload-progress', () => {
        progressEventEmitted = true;
      });
      emitter.on('upload-success', () => {
        successEventEmitted = true;
      });

      const { stream, resume } = createStreamWithUploadEvents({
        data,
        dataSize: 4,
        emitter,
      });

      // Promise that resolves when all events have fired
      const streamConsumerPromise = new Promise<void>((resolve) => {
        (stream as Readable).on('data', () => {
          // data starts flowing through the stream
        });
        (stream as Readable).on('end', () => {
          resolve();
        });
        (stream as Readable).on('error', (error: Error) => {
          throw error;
        });
      });

      // allow bytes to start flowing
      resume();

      // consume the full stream
      await streamConsumerPromise;

      // Assert that the events were called after the stream has been fully consumed
      assert.equal(onProgressCalled, true, 'onProgressCalled should be true');
      assert.equal(
        progressEventEmitted,
        true,
        'progressEventEmitted should be true',
      );
      assert.equal(onSuccessCalled, true, 'onSuccessCalled should be true');
      assert.equal(
        successEventEmitted,
        true,
        'successEventEmitted should be true',
      );
    });

    it('should call onUploadError callback and emit error events when stream errors', async () => {
      let onErrorCalled = false;
      let errorEventEmitted = false;
      const testError = new Error('Test error');
      const emitter = new TurboEventEmitter({
        onUploadError: () => {
          onErrorCalled = true;
        },
      });

      // Create a readable stream that will emit an error
      const data = new Readable({
        read() {
          this.emit('error', testError);
        },
      });

      emitter.on('upload-error', () => {
        errorEventEmitted = true;
      });

      const { stream, resume } = createStreamWithUploadEvents({
        data,
        dataSize: 10,
        emitter,
      });

      const streamErrorPromise = new Promise<void>((_, reject) => {
        (stream as Readable).on('error', (error: Error) => {
          reject(error);
        });
      });

      // allow bytes to start flowing
      resume();

      try {
        // consume the full stream and wait for the error to be thrown
        await streamErrorPromise;
      } catch (error) {
        // Error is expected
      }

      assert.equal(onErrorCalled, true);
      assert.equal(errorEventEmitted, true);
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
      const data = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(Buffer.from('test test test test test'));
          controller.close();
        },
      });
      const { stream } = createStreamWithUploadEvents({
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
      assert.equal(onProgressCalled, true, 'onProgressCalled should be true');
      assert.equal(
        progressEventEmitted,
        true,
        'progressEventEmitted should be true',
      );

      // error event not called
      assert.equal(
        errorEventEmitted,
        false,
        'errorEventEmitted should be false',
      );
      assert.equal(onErrorCalled, false, 'onErrorCalled should be false');

      // success event called
      assert.equal(onSuccessCalled, true, 'onSuccessCalled should be true');
      assert.equal(
        successEventEmitted,
        true,
        'successEventEmitted should be true',
      );
    });

    it('should call onUploadError callback and emit error events when stream errors', async () => {
      let onErrorCalled = false;
      let errorEventEmitted = false;
      const testError = new Error('Test error');
      const onUploadError = () => {
        onErrorCalled = true;
      };

      // Create a ReadableStream that will throw an error
      const data = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(testError);
          throw testError;
        },
      });

      const emitter = new TurboEventEmitter({ onUploadError });
      const { stream } = createStreamWithUploadEvents({
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

      assert.equal(onErrorCalled, true, 'onErrorCalled should be true');
      assert.equal(errorEventEmitted, true, 'errorEventEmitted should be true');
    });
  });
});

describe('createStreamWithSigningEvents', () => {
  describe('Readable', () => {
    it('should call onSigningProgress and onSigningSuccess callback and emit progress events when stream is consumed', async () => {
      let onProgressCalled = false;
      let progressEventEmitted = false;
      let onErrorCalled = false;
      let errorEventEmitted = false;
      let onSuccessCalled = false;
      let successEventEmitted = false;
      const emitter = new TurboEventEmitter({
        onSigningProgress: () => {
          onProgressCalled = true;
        },
        onSigningError: () => {
          onErrorCalled = true;
        },
        onSigningSuccess: () => {
          onSuccessCalled = true;
        },
      });
      emitter.on('signing-progress', () => {
        progressEventEmitted = true;
      });
      emitter.on('signing-success', () => {
        successEventEmitted = true;
      });
      emitter.on('signing-error', () => {
        errorEventEmitted = true;
      });

      const data = Readable.from(['test']);
      const { stream, resume } = createStreamWithSigningEvents({
        data,
        dataSize: 50,
        emitter,
      });

      // Promise that resolves when all events have fired
      const streamConsumerPromise = new Promise<void>((resolve) => {
        (stream as Readable).on('data', () => {
          // data starts flowing through the stream
        });
        (stream as Readable).on('end', () => {
          resolve();
        });
        (stream as Readable).on('error', (error: Error) => {
          throw error;
        });
      });

      // allow bytes to start flowing
      resume();

      // consume the full stream
      await streamConsumerPromise;

      assert.equal(onProgressCalled, true);
      assert.equal(progressEventEmitted, true);
      assert.equal(onSuccessCalled, true);
      assert.equal(successEventEmitted, true);
      assert.equal(onErrorCalled, false);
      assert.equal(errorEventEmitted, false);
    });

    it('should call onSigningError callback and emit error events when stream errors', async () => {
      let onErrorCalled = false;
      let errorEventEmitted = false;
      const testError = new Error('Test error');
      const emitter = new TurboEventEmitter({
        onSigningError: () => {
          onErrorCalled = true;
        },
      });

      // Create a readable stream that will emit an error
      const data = new Readable({
        read() {
          this.emit('error', testError);
        },
      });

      emitter.on('signing-error', () => {
        errorEventEmitted = true;
      });

      const { stream, resume } = createStreamWithSigningEvents({
        data,
        dataSize: 10,
        emitter,
      });

      const streamErrorPromise = new Promise<void>((_, reject) => {
        (stream as Readable).on('error', (error: Error) => {
          reject(error);
        });
      });

      // allow bytes to start flowing
      resume();

      try {
        // consume the full stream
        await streamErrorPromise;
      } catch (error) {
        // Error is expected
      }

      assert.equal(onErrorCalled, true);
      assert.equal(errorEventEmitted, true);
    });
  });

  describe('ReadableStream', () => {
    it('should call onSigningProgress and onSigningSuccess callback and emit progress events when stream is consumed', async () => {
      let onProgressCalled = false;
      let progressEventEmitted = false;
      let onErrorCalled = false;
      let errorEventEmitted = false;
      let onSuccessCalled = false;
      let successEventEmitted = false;
      const data = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(Buffer.from('test'));
          controller.close();
        },
      });
      const emitter = new TurboEventEmitter({
        onSigningProgress: () => {
          onProgressCalled = true;
        },
        onSigningError: () => {
          onErrorCalled = true;
        },
        onSigningSuccess: () => {
          onSuccessCalled = true;
        },
      });
      const { stream } = createStreamWithSigningEvents({
        data,
        dataSize: 10,
        emitter,
      });
      emitter.on('signing-progress', () => {
        progressEventEmitted = true;
      });
      emitter.on('signing-success', () => {
        successEventEmitted = true;
      });
      emitter.on('signing-error', () => {
        errorEventEmitted = true;
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

      assert.equal(onProgressCalled, true);
      assert.equal(progressEventEmitted, true);
      assert.equal(onSuccessCalled, true);
      assert.equal(successEventEmitted, true);
      assert.equal(onErrorCalled, false);
      assert.equal(errorEventEmitted, false);
    });

    it('should call onSigningError callback and emit error events when stream errors', async () => {
      let onErrorCalled = false;
      let errorEventEmitted = false;
      let onSuccessCalled = false;
      let successEventEmitted = false;
      const testError = new Error('Test error');

      // Create a ReadableStream that will throw an error
      const data = new ReadableStream<Uint8Array>({
        pull(controller) {
          controller.error(testError);
          throw testError;
        },
      });

      const emitter = new TurboEventEmitter({
        onSigningError: () => {
          onErrorCalled = true;
        },
        onSigningSuccess: () => {
          onSuccessCalled = true;
        },
      });
      const { stream } = createStreamWithSigningEvents({
        data,
        dataSize: 10,
        emitter,
      });

      emitter.on('signing-error', () => {
        errorEventEmitted = true;
      });

      emitter.on('signing-success', () => {
        successEventEmitted = true;
      });

      try {
        // consume the full stream
        const reader = (stream as ReadableStream).getReader();
        while (true) {
          const { done } = await reader.read();
          if (done) {
            break;
          }
        }
      } catch (error) {
        // Error is expected
      }

      assert.equal(onErrorCalled, true);
      assert.equal(errorEventEmitted, true);
      assert.equal(onSuccessCalled, false);
      assert.equal(successEventEmitted, false);
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
    assert.equal(overallSuccessCalled, true);
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
    assert.equal(overallProgressCalled, true);
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
    emitter.on('overall-error', (error) => {
      overallErrorCalled = true;
      overallErrorPayload = error;
    });
    emitter.emit('signing-error', testError);
    assert.equal(overallErrorCalled, true);
    assert.deepStrictEqual(overallErrorPayload, testError);
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
    emitter.emit('upload-error', testError);
    assert.equal(overallErrorCalled, true);
    assert.deepStrictEqual(overallErrorPayload, testError);
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
    assert.equal(overallProgressCalled, true);
    assert.equal(overallProgressPayload?.processedBytes, 500 + 100 / 2);
    assert.equal(overallProgressPayload?.totalBytes, 1000);
    assert.equal(overallProgressPayload?.step, 'upload');
  });

  it('should register onFileStart callback and emit file-upload-start event', () => {
    let onFileStartCalled = false;
    let fileStartPayload: any;
    const emitter = new TurboEventEmitter({
      onFileStart: (event) => {
        onFileStartCalled = true;
        fileStartPayload = event;
      },
    });

    const testPayload = {
      fileName: 'test.txt',
      fileSize: 1024,
      fileIndex: 0,
      totalFiles: 5,
    };

    emitter.emit('file-upload-start', testPayload);
    assert.equal(onFileStartCalled, true);
    assert.deepStrictEqual(fileStartPayload, testPayload);
  });

  it('should register onFileProgress callback and emit file-upload-progress event', () => {
    let onFileProgressCalled = false;
    let fileProgressPayload: any;
    const emitter = new TurboEventEmitter({
      onFileProgress: (event) => {
        onFileProgressCalled = true;
        fileProgressPayload = event;
      },
    });

    const testPayload = {
      fileName: 'test.txt',
      fileIndex: 0,
      totalFiles: 5,
      fileProcessedBytes: 512,
      fileTotalBytes: 1024,
      step: 'signing' as const,
    };

    emitter.emit('file-upload-progress', testPayload);
    assert.equal(onFileProgressCalled, true);
    assert.deepStrictEqual(fileProgressPayload, testPayload);
  });

  it('should register onFileComplete callback and emit file-upload-complete event', () => {
    let onFileCompleteCalled = false;
    let fileCompletePayload: any;
    const emitter = new TurboEventEmitter({
      onFileComplete: (event) => {
        onFileCompleteCalled = true;
        fileCompletePayload = event;
      },
    });

    const testPayload = {
      fileName: 'test.txt',
      fileIndex: 0,
      totalFiles: 5,
      id: 'abc123',
    };

    emitter.emit('file-upload-complete', testPayload);
    assert.equal(onFileCompleteCalled, true);
    assert.deepStrictEqual(fileCompletePayload, testPayload);
  });

  it('should register onFileError callback and emit file-upload-error event', () => {
    let onFileErrorCalled = false;
    let fileErrorPayload: any;
    const emitter = new TurboEventEmitter({
      onFileError: (event) => {
        onFileErrorCalled = true;
        fileErrorPayload = event;
      },
    });

    const testError = new Error('File upload error');
    const testPayload = {
      fileName: 'test.txt',
      fileIndex: 0,
      totalFiles: 5,
      error: testError,
    };

    emitter.emit('file-upload-error', testPayload);
    assert.equal(onFileErrorCalled, true);
    assert.deepStrictEqual(fileErrorPayload, testPayload);
  });

  it('should register onFolderProgress callback and emit folder-progress event', () => {
    let onFolderProgressCalled = false;
    let folderProgressPayload: any;
    const emitter = new TurboEventEmitter({
      onFolderProgress: (event) => {
        onFolderProgressCalled = true;
        folderProgressPayload = event;
      },
    });

    const testPayload = {
      processedFiles: 2,
      totalFiles: 5,
      processedBytes: 2048,
      totalBytes: 5120,
      currentPhase: 'files' as const,
    };

    emitter.emit('folder-progress', testPayload);
    assert.equal(onFolderProgressCalled, true);
    assert.deepStrictEqual(folderProgressPayload, testPayload);
  });

  it('should register onFolderError callback and emit folder-error event', () => {
    let onFolderErrorCalled = false;
    let folderErrorPayload: any;
    const emitter = new TurboEventEmitter({
      onFolderError: (error) => {
        onFolderErrorCalled = true;
        folderErrorPayload = error;
      },
    });

    const testError = new Error('Folder upload error');
    emitter.emit('folder-error', testError);
    assert.equal(onFolderErrorCalled, true);
    assert.deepStrictEqual(folderErrorPayload, testError);
  });

  it('should register onFolderSuccess callback and emit folder-success event', () => {
    let onFolderSuccessCalled = false;
    const emitter = new TurboEventEmitter({
      onFolderSuccess: () => {
        onFolderSuccessCalled = true;
      },
    });

    emitter.emit('folder-success');
    assert.equal(onFolderSuccessCalled, true);
  });
});
