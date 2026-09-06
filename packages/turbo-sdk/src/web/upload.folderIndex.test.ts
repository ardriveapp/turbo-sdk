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
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { createMemoryFolderIndex } from '../common/folderIndex.js';
import {
  TurboUploadDataItemResponse,
  TurboUploadFileParams,
} from '../types.js';
import { contentHashTagName } from '../utils/folderIndex.js';
import { TurboAuthenticatedUploadService } from './index.js';

const manifestContentType = 'application/x.arweave-manifest+json';

let dataItemCounter = 0;

type RecordedUpload = {
  id: string;
  tags: { name: string; value: string }[];
  contentHash: string | undefined;
};

function stubbedUploadService() {
  const service = new TurboAuthenticatedUploadService({
    signer: {} as never,
    paymentService: {} as never,
  });

  const uploads: RecordedUpload[] = [];

  const uploadFile = async (
    params: TurboUploadFileParams,
  ): Promise<TurboUploadDataItemResponse> => {
    const tags = params.dataItemOpts?.tags ?? [];
    const id = `web${dataItemCounter++}`.padEnd(43, 'x');
    const isManifest = tags.some(
      (tag) => tag.name === 'Content-Type' && tag.value === manifestContentType,
    );
    if (!isManifest) {
      uploads.push({
        id,
        tags,
        contentHash: tags.find((tag) => tag.name === contentHashTagName)?.value,
      });
    }
    return { id } as TurboUploadDataItemResponse;
  };

  (service as unknown as { uploadFile: typeof uploadFile }).uploadFile =
    uploadFile;

  return { service, uploads };
}

const newFiles = () => [
  new File(['<h1>one</h1>'], 'index.html', { type: 'text/html' }),
  new File(['console.log(1);'], 'app.js', { type: 'text/javascript' }),
];

describe('web uploadFolder with a folder index', () => {
  it('hashes each File and tags it with its content hash', async () => {
    const { service, uploads } = stubbedUploadService();

    await service.uploadFolder({
      files: newFiles(),
      folderIndex: createMemoryFolderIndex(),
    });

    assert.equal(uploads.length, 2);
    for (const upload of uploads) {
      assert.match(upload.contentHash ?? '', /^[0-9a-f]{64}$/);
    }
    // Distinct bytes, distinct hashes.
    assert.equal(new Set(uploads.map((upload) => upload.contentHash)).size, 2);
  });

  it('uploads nothing when the same bytes are offered again', async () => {
    const folderIndex = createMemoryFolderIndex();

    const first = await stubbedUploadService().service.uploadFolder({
      files: newFiles(),
      folderIndex,
    });

    const second = stubbedUploadService();
    const result = await second.service.uploadFolder({
      files: newFiles(),
      folderIndex,
    });

    assert.equal(second.uploads.length, 0);
    assert.deepEqual(result.folderIndexSummary, {
      totalFiles: 2,
      totalBytes: 27,
      uploadedFiles: 0,
      uploadedBytes: 0,
      reusedFiles: 2,
      reusedBytes: 27,
    });
    assert.deepEqual(result.manifest?.paths, first.manifest?.paths);
  });

  it('uploads only the File whose bytes changed', async () => {
    const folderIndex = createMemoryFolderIndex();

    const first = await stubbedUploadService().service.uploadFolder({
      files: newFiles(),
      folderIndex,
    });

    const second = stubbedUploadService();
    const result = await second.service.uploadFolder({
      files: [
        new File(['<h1>one</h1>'], 'index.html', { type: 'text/html' }),
        new File(['console.log(2);'], 'app.js', { type: 'text/javascript' }),
      ],
      folderIndex,
    });

    assert.equal(second.uploads.length, 1);
    assert.equal(
      result.manifest?.paths['index.html'].id,
      first.manifest?.paths['index.html'].id,
    );
    assert.equal(result.manifest?.paths['app.js'].id, second.uploads[0].id);
  });

  it('pays twice for identical bytes with different content types', async () => {
    const { service, uploads } = stubbedUploadService();

    const result = await service.uploadFolder({
      files: [
        new File([''], 'a.css', { type: 'text/css' }),
        new File([''], 'b.js', { type: 'text/javascript' }),
      ],
      folderIndex: createMemoryFolderIndex(),
    });

    assert.equal(uploads.length, 2);
    const paths = result.manifest?.paths ?? {};
    assert.notEqual(paths['a.css'].id, paths['b.js'].id);
    assert.equal(uploads[0].contentHash, uploads[1].contentHash);
  });

  it('treats an index read that throws as a miss rather than a failed upload', async () => {
    const { service, uploads } = stubbedUploadService();

    const result = await service.uploadFolder({
      files: newFiles(),
      folderIndex: {
        get: () => {
          throw new Error('cache is down');
        },
        set: () => undefined,
      },
    });

    assert.equal(uploads.length, 2);
    assert.equal(Object.keys(result.manifest?.paths ?? {}).length, 2);
  });
});
