import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  TurboMultiPartStatusResponse,
  TurboUploadDataItemResponse,
  TurboUploadFolderResponse,
} from '../node/index.js';

/**
 * Type-shape tests for the signed receipt on TurboUploadDataItemResponse
 * (ardriveapp/turbo-sdk#422). Most of what they check is enforced by the
 * compiler: ts-node type-checks this file on load, so a missing or retyped
 * field fails the run before any assertion executes.
 *
 * The fixture follows the upload service. It signs the receipt in
 * packages/upload-service/src/utils/signReceipt.ts and returns it with `owner`
 * from routes/dataItemPost.ts (POST /v1/tx/:token). The chunked status route
 * in routes/multiPartUploads.ts returns the same object under `receipt`.
 */
const requiredFields = {
  id: 'receipt-test-data-item-id-0000000000000000',
  owner: 'receipt-test-owner-address-000000000000000',
  winc: '0',
  dataCaches: ['arweave.net'],
  fastFinalityIndexes: ['arweave.net'],
};

const signedReceipt: TurboUploadDataItemResponse = {
  ...requiredFields,
  version: '0.2.0',
  deadlineHeight: 1_700_200,
  timestamp: 1_760_000_000_000,
  public: 'receipt-test-service-key-modulus',
  signature: 'receipt-test-signature',
};

describe('TurboUploadDataItemResponse receipt fields', () => {
  it('reads every signed receipt field without a cast', () => {
    const timestamp: number | undefined = signedReceipt.timestamp;
    const deadlineHeight: number | undefined = signedReceipt.deadlineHeight;
    const version: string | undefined = signedReceipt.version;
    const publicKey: string | undefined = signedReceipt.public;
    const signature: string | undefined = signedReceipt.signature;

    assert.deepEqual(
      { timestamp, deadlineHeight, version, publicKey, signature },
      {
        timestamp: 1_760_000_000_000,
        deadlineHeight: 1_700_200,
        version: '0.2.0',
        publicKey: 'receipt-test-service-key-modulus',
        signature: 'receipt-test-signature',
      },
    );
  });

  it('keeps the receipt fields optional, so objects built without them compile', () => {
    const withoutReceipt: TurboUploadDataItemResponse = { ...requiredFields };

    assert.equal(withoutReceipt.timestamp, undefined);
    assert.equal(withoutReceipt.deadlineHeight, undefined);
    assert.equal(withoutReceipt.version, undefined);
    assert.equal(withoutReceipt.public, undefined);
    assert.equal(withoutReceipt.signature, undefined);
  });

  it('types timestamp and deadlineHeight as numbers', () => {
    const response: TurboUploadDataItemResponse = {
      ...requiredFields,
      // @ts-expect-error the service sends milliseconds since the epoch, not a string
      timestamp: '1760000000000',
      // @ts-expect-error the service sends a block height, not a string
      deadlineHeight: '1700200',
    };

    assert.equal(typeof response.timestamp, 'string');
  });

  it('carries the receipt fields on the chunked finalized status', () => {
    const status: TurboMultiPartStatusResponse = {
      status: 'FINALIZED',
      receipt: signedReceipt,
    };

    assert.equal(status.status, 'FINALIZED');
    if (status.status === 'FINALIZED') {
      const timestamp: number | undefined = status.receipt.timestamp;
      assert.equal(timestamp, 1_760_000_000_000);
    }
  });

  it('carries the receipt fields on folder file and manifest responses', () => {
    const folder: TurboUploadFolderResponse = {
      fileResponses: [signedReceipt],
      manifestResponse: signedReceipt,
    };

    const fileSignature: string | undefined = folder.fileResponses[0].signature;
    const manifestSignature: string | undefined =
      folder.manifestResponse?.signature;
    assert.equal(fileSignature, 'receipt-test-signature');
    assert.equal(manifestSignature, 'receipt-test-signature');
  });
});
