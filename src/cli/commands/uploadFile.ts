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
import { createReadStream, statSync } from 'fs';

import { turboCliTags } from '../constants.js';
import { UploadFileOptions } from '../types.js';
import { turboFromOptions } from '../utils.js';

export async function uploadFile(options: UploadFileOptions): Promise<void> {
  const { filePath } = options;
  if (filePath === undefined) {
    throw new Error('Must provide a --file-path to upload');
  }

  const turbo = await turboFromOptions(options);

  const fileSize = statSync(filePath).size;

  const result = await turbo.uploadFile({
    fileStreamFactory: () => createReadStream(filePath),
    fileSizeFactory: () => fileSize,
    dataItemOpts: { tags: [...turboCliTags] }, // TODO: Inject user tags
  });

  console.log('Uploaded file:', JSON.stringify(result, null, 2));
}
