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
import {
  DataItem,
  SIG_CONFIG,
  Tag,
  serializeTags,
} from '@dha-team/arbundles/node';
import { writeFileSync } from 'fs';

import { fromB64Url } from '../../utils/base64.js';

/**
 * Reconstructs an ANS-104 data item with signature from its components
 * @param signatureType The signature type (1 for Arweave, 2 for ED25519, etc.)
 * @param signature The signature as hex string or base64url string
 * @param owner The base64url encoded owner/public key
 * @param target Optional target address (base64url)
 * @param anchor Optional anchor string
 * @param tags Array of name-value tag pairs
 * @param data The payload data as a string or Buffer
 * @returns Buffer containing the complete ANS-104 data item
 */
export function reconstructDataItemBuffer(
  signatureType: number,
  signature: string,
  owner: string,
  target: string | undefined,
  anchor: string | undefined,
  tags: Tag[],
  data: string | Buffer,
): Buffer {
  // Convert data to buffer if it's a string
  const dataBuffer =
    typeof data === 'string' ? Buffer.from(data, 'utf8') : data;

  // Convert signature to buffer (handle both hex and base64url)
  let signatureBuffer: Buffer;
  if (signature.startsWith('x') || /^[0-9a-fA-F]+$/.test(signature)) {
    // Handle hex format (remove 'x' prefix if present)
    const hexSignature = signature.startsWith('x')
      ? signature.slice(1)
      : signature;
    signatureBuffer = Buffer.from(hexSignature, 'hex');
  } else {
    // Handle base64url format
    signatureBuffer = fromB64Url(signature);
  }

  // Convert base64url strings to buffers
  const ownerBuffer = fromB64Url(owner);
  const targetBuffer = target !== undefined ? fromB64Url(target) : undefined;
  const anchorBuffer =
    anchor !== undefined ? Buffer.from(anchor, 'utf8') : undefined;

  // Serialize tags using arbundles serialization
  const serializedTags =
    tags.length > 0 ? serializeTags(tags) : Buffer.alloc(0);

  // Calculate sizes
  const signatureTypeBytes = 2; // 2 bytes for signature type
  const sigInfo = SIG_CONFIG[signatureType];
  if (!sigInfo) {
    throw new Error(`Unknown signature type: ${signatureType}`);
  }

  const targetBytes = target !== undefined ? 32 : 1; // 32 bytes for target or 1 byte for empty flag
  const anchorBytes = anchor !== undefined ? 32 : 1; // 32 bytes for anchor or 1 byte for empty flag
  const numTagsBytes = 8; // 8 bytes for number of tags
  const numTagsBytesLength = 8; // 8 bytes for tags byte length

  // Calculate total header size
  const headerSize =
    signatureTypeBytes +
    sigInfo.sigLength +
    sigInfo.pubLength +
    targetBytes +
    anchorBytes +
    numTagsBytes +
    numTagsBytesLength +
    serializedTags.length;
  console.log('headerSize', headerSize);

  // Create the data item buffer
  const totalSize = headerSize + dataBuffer.length;
  const dataItemBuffer = Buffer.alloc(totalSize);
  let offset = 0;

  // Write signature type (2 bytes, little endian)
  dataItemBuffer.writeUInt16LE(signatureType, offset);
  offset += 2;

  // Write signature (pad if necessary)
  const paddedSignature = Buffer.alloc(sigInfo.sigLength);
  signatureBuffer.copy(
    paddedSignature as any,
    0,
    0,
    Math.min(signatureBuffer.length, sigInfo.sigLength),
  );
  paddedSignature.copy(dataItemBuffer as any, offset);
  offset += sigInfo.sigLength;

  // Write owner/public key (pad if necessary)
  const paddedOwner = Buffer.alloc(sigInfo.pubLength);
  ownerBuffer.copy(
    paddedOwner as any,
    0,
    0,
    Math.min(ownerBuffer.length, sigInfo.pubLength),
  );
  paddedOwner.copy(dataItemBuffer as any, offset);
  offset += sigInfo.pubLength;

  // Write target
  if (target !== undefined && targetBuffer) {
    dataItemBuffer.writeUInt8(1, offset); // target present flag
    offset += 1;
    targetBuffer.copy(dataItemBuffer as any, offset);
    offset += 31; // remaining target bytes
  } else {
    dataItemBuffer.writeUInt8(0, offset); // target not present flag
    offset += 1;
  }

  // Write anchor
  if (anchor !== undefined && anchorBuffer) {
    dataItemBuffer.writeUInt8(1, offset); // anchor present flag
    offset += 1;
    const paddedAnchor = Buffer.alloc(31);
    anchorBuffer.copy(
      paddedAnchor as any,
      0,
      0,
      Math.min(anchorBuffer.length, 31),
    );
    paddedAnchor.copy(dataItemBuffer as any, offset);
    offset += 31;
  } else {
    dataItemBuffer.writeUInt8(0, offset); // anchor not present flag
    offset += 1;
  }

  // Write number of tags (8 bytes, little endian)
  const numTags = BigInt(tags.length);
  dataItemBuffer.writeBigUInt64LE(numTags, offset);
  offset += 8;

  // Write tags byte length (8 bytes, little endian)
  const tagsLength = BigInt(serializedTags.length);
  dataItemBuffer.writeBigUInt64LE(tagsLength, offset);
  offset += 8;

  // Write serialized tags
  serializedTags.copy(dataItemBuffer as any, offset);
  offset += serializedTags.length;

  // Write data
  dataBuffer.copy(dataItemBuffer as any, offset);
  return dataItemBuffer;
}

// Example usage with the provided data
export function createExampleDataItem(): Buffer {
  const data = `{"description":"Galaxy core inside the shell","name":"Crab Rave Cosmic","image_details":{"bytes":1468198,"format":"PNG","sha256":"e08251c63f26fbd5c0722c62793b8870c522046a244b5b5e74e5717e38d9541e","width":1024,"height":1024},"image":"https://arweave.net/qrVRcyPBqq6xInuegPc4aN-oTH-na5rPvIG25magi3o","image_url":"https://arweave.net/qrVRcyPBqq6xInuegPc4aN-oTH-na5rPvIG25magi3o"}`;

  const signature = `x885f066ba670ad4ccf65e7bbbb1afcaf9d7196d7359029058fbc587aba00bce6acf030a1b333fb63901a31324d65f4dd8bbef90c99e9ea5e8207148da54a95e20ea40fddc212f0195933181c3b42d17a2e04ca03e12dba30c72c49891c30395d959379aa921f3afd30ce79e6a929c88e5f5f5e64b719139413710a5fb231404b1a405381777f6292b3efb113fab85661e8a6e7b4a88a1dc2382d379938615a6556c709a959fca9cc9ae9eceb3f283c1322d39f1aa9f164c70d9a828b023cf7058f90db1fa9138ee0a9081299eb993935116ba4bf669b134a241ed000a70c315225d8b3dc77d00cf26e722fbce391b1bc28d935aec2a79d0c3cc293bcecef62db8a27a9976b24364f06ba37d99d3c2ee2f71102d6358dd17448ec26fd15c4e8adc0ecba32a3b69fe2570d246eedb48f544e705bfe6b6594701aabbacef7029b45b1668e5378a45ecdfdfe4f72c536c4872f5933f14731d42fb7470d9b8c6b4e55022188e6d6fbcf72bd6ebd7274a732859b57bf938f595bc28de03d7f1f2194cc943745c08bcefc74b77f799e9550b9c882378738da3d66d3947c79b823383922a411f3b7e3552acc82322e2ee3216e636f7f9fd82c6bea9d918e636f89b779a1ba032abc7dbf65738d3835bd5881a4c523ab00e113b114dfddd2a916d62585a769598b55eefe3d6e3fa5da34305a886ce3fe8f88a2b992f751a6b58442c5550d`;

  const owner = `xBMLaS_ZBugqQwp9U2ihh6lAOiLsyh9T7r5SljMRaxQNE2FDhRg5hKtohhQK4lo8HhwspmgT_rsx2Vx27aXOJdOW4UnaGjmbzkoKNFls_8vLrT-HIYK6NYgoJvCS5tuqWvtrmxJSc-CQ9MNeZllz5f1FvHUUsXB98W4NZLNQfnDUlhArMV3grMhLjw6TjTWEIJIWWLETv3bdQLOiD0SFqAKQqcEm1hPRn8UharyRL_AvHEi-Vrgcb-lRfqUQS8ZSByaXdU5uRhNXF-rIBIoAqLePcJobnW0tPeq0wyaMYBxSq-RGpfTY7EwhRzXBs5v6OE-Hg77DVtBlTTk-5AkF0UVzC8jGjs1pd-RrzRGqyj3QLTy8eQ79-BeBF5To5IVMwzwFmg-kGH1UUQtXAsNsQCWp_NQl4VfZG1pEFY3juGmOBsxTY4KmjLOBAZ6ZAa0MzV1ONU3epaE56QncTHQKYxiNgJQ1DkKS5zIwi4Jt5hRHMhWt_D9T52QCjcXA6nRSp4ZNdJB5nPyxGRNNdO7OO2lv3MI-6EywaIB8YNEwd9FgBH5AR3F7eHNmSDDfTQd9n3YatDbMXnTZiUeldTrkp7HU2G3TMKa_Jcwhu98S6xBuiz2aydEmeJdgM85AjUV9PdNtW9hbd7mWqPB9DISXTVpInUZgOOohqbIyjgz7CnM`;

  const tags = [{ name: 'Content-Type', value: 'application/json' }];

  const SIG_TYPE_ARWEAVE = 1;

  const dataBuffer = reconstructDataItemBuffer(
    SIG_TYPE_ARWEAVE,
    signature,
    owner,
    undefined, // no target
    undefined, // no anchor
    tags,
    data,
  );

  return dataBuffer;
}

export async function reconstructDataItem() {
  // TODO: Replace with actual parameters or input handling
  const dataItemBuffer = createExampleDataItem();
  const dataItem = new DataItem(dataItemBuffer);

  console.log('id', dataItem.id);
  console.log('owner', dataItem.ownerLength);
  console.log('valid', await dataItem.isValid());

  writeFileSync('reconstructed-data-item.bin', dataItemBuffer as any);
}
