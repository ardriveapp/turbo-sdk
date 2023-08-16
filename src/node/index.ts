import { ArweaveSigner, streamSigner } from "arbundles";
import { TurboClient } from "../common/index.js";
import {
  TurboDataItemStream,
  TurboFileUpload,
  TurboSettings,
} from "../types/turboTypes.js";
import internal from "stream";
import fs from "fs";

class TurboNodeClient extends TurboClient {
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
      let dataItemStream1: TurboDataItemStream;
      let dataItemSTream2: TurboDataItemStream;

      dataItemStream1 = fs.createReadStream(file.filePath);
      dataItemSTream2 = fs.createReadStream(file.filePath);

      const signedDataItem = await streamSigner(
        dataItemStream1,
        dataItemSTream2,
        signer,
        file.options,
      );
      return signedDataItem;
    });

    return await Promise.all(signedDataItemStreams);
  }
}

export default TurboNodeClient;
