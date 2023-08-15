import { BaseTurboClient } from "../common";
import { TurboBlobUpload, TurboSettings } from "../types/turboTypes";
import { ArweaveSigner, createData } from "arbundles";

class WebTurboClient extends BaseTurboClient {
  constructor(settings: TurboSettings) {
    super(settings);
  }

  async prepareDataItems(files: TurboBlobUpload[]): Promise<Uint8Array[]> {
    if (!this.jwk) {
      throw new Error("JWK required to prepare data items.");
    }
    const signer = new ArweaveSigner(this.jwk);
    const uploadPromises = files.map(async (file: TurboBlobUpload) => {
      let fileData: Uint8Array;
      if (file.data instanceof Blob) {
        fileData = new Uint8Array(await file.data.arrayBuffer()); // Convert Blob to Uint8Array
      } else if (file.data instanceof Uint8Array) {
        fileData = file.data;
      } else {
        throw new Error("Unsupported file data.");
      }

      const dataItem = createData(fileData, signer, file.options);
      await dataItem.sign(signer);
      const requestData: Buffer = dataItem.getRaw();
      return requestData;
    });

    return await Promise.all(uploadPromises);
  }
}

export { WebTurboClient as TurboClient };
