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
import { Buffer } from 'node:buffer';
import { ReadableStream } from 'node:stream/web';

export async function readableStreamToBuffer({
  stream,
  size,
}: {
  stream: ReadableStream;
  size: number;
}): Promise<Buffer> {
  const reader = stream.getReader();
  const buffer = Buffer.alloc(size);
  let offset = 0;

  let done = false;
  while (!done) {
    const { done: streamDone, value } = await reader.read();
    done = streamDone;
    if (!done) {
      buffer.set(value, offset);
      offset += value.byteLength;
    }
  }
  return buffer;
}
