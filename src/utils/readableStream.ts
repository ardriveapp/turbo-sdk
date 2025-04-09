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
import { ReadableStream } from 'stream/web';

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
