import { ArweaveSigner, streamSigner } from "arbundles";
import { BaseTurboClient } from "../common";
import { TurboFileUpload, TurboSettings } from "../types/turboTypes";
import internal from "stream";
import fs from "fs";

class NodeTurboClient extends BaseTurboClient {
  constructor(settings: TurboSettings) {
    super(settings);
  }

  override async prepareDataItems(
    files: TurboFileUpload[],
  ): Promise<internal.PassThrough[]> {
    if (!this.jwk) {
      throw new Error("JWK required in client configuration.");
    }

    const signer = new ArweaveSigner(this.jwk);

    // concurrently upload files
    // TODO: use p-limit to avoid overwhelming resources
    const signedDataItemStreams = files.map(async (file: TurboFileUpload) => {
      const [fileStream1, fileStream2] = [
        fs.createReadStream(file.filePath),
        fs.createReadStream(file.filePath),
      ];
      const signedDataItem = await streamSigner(
        fileStream1,
        fileStream2,
        signer,
        file.options,
      );
      return signedDataItem;
    });

    return await Promise.all(signedDataItemStreams);
  }
}

export { NodeTurboClient as TurboClient };
