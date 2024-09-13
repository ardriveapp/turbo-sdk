/**
 * Copyright (C) 2022-2024 Permanent Data Solutions, Inc. All Rights Reserved.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
import { turboCliTags } from '../constants.js';
import { UploadFolderOptions } from '../types.js';
import { getUploadFolderOptions, turboFromOptions } from '../utils.js';

export async function uploadFolder(
  options: UploadFolderOptions,
): Promise<void> {
  const turbo = await turboFromOptions(options);

  const {
    disableManifest,
    fallbackFile,
    folderPath,
    indexFile,
    maxConcurrentUploads,
  } = getUploadFolderOptions(options);

  const result = await turbo.uploadFolder({
    folderPath: folderPath,
    dataItemOpts: { tags: [...turboCliTags] }, // TODO: Inject user tags
    manifestOptions: {
      disableManifest,
      indexFile,
      fallbackFile,
    },
    maxConcurrentUploads,
  });

  console.log('Uploaded folder:', JSON.stringify(result, null, 2));
}
