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
import { turboCliTags } from '../constants.js';
import { UploadFolderOptions } from '../types.js';
import {
  getUploadFolderOptions,
  paidByFromOptions,
  turboFromOptions,
} from '../utils.js';

export async function uploadFolder(
  options: UploadFolderOptions,
): Promise<void> {
  const turbo = await turboFromOptions(options);
  const paidBy = await paidByFromOptions(options, turbo);

  const {
    disableManifest,
    fallbackFile,
    folderPath,
    indexFile,
    maxConcurrentUploads,
  } = getUploadFolderOptions(options);

  const result = await turbo.uploadFolder({
    folderPath: folderPath,
    dataItemOpts: { tags: [...turboCliTags], paidBy }, // TODO: Inject user tags
    manifestOptions: {
      disableManifest,
      indexFile,
      fallbackFile,
    },
    maxConcurrentUploads,
  });

  console.log('Uploaded folder:', JSON.stringify(result, null, 2));
}
