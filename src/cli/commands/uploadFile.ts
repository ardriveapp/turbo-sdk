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
import { createReadStream, statSync } from 'fs';

import { turboCliTags } from '../constants.js';
import { UploadFileOptions } from '../types.js';
import { paidByFromOptions, turboFromOptions } from '../utils.js';

export async function uploadFile(options: UploadFileOptions): Promise<void> {
  const { filePath } = options;
  if (filePath === undefined) {
    throw new Error('Must provide a --file-path to upload');
  }

  const turbo = await turboFromOptions(options);
  const paidBy = await paidByFromOptions(options, turbo);

  const fileSize = statSync(filePath).size;

  const result = await turbo.uploadFile({
    fileStreamFactory: () => createReadStream(filePath),
    fileSizeFactory: () => fileSize,
    dataItemOpts: { tags: [...turboCliTags], paidBy }, // TODO: Inject user tags
  });

  console.log('Uploaded file:', JSON.stringify(result, null, 2));
}
