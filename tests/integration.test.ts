import { expect } from "chai";
import Arweave from "arweave";
import { JWKInterface } from "../src/utils/jwkTypes";
import { base64URLRegex } from "../src/utils/regex";
import { TurboClient as NodeTurboClient } from "../src/node";
import { TurboClient as WebTurboClient } from "../src/web";
import path from "path";
describe("ArDrive Turbo", () => {
  let jwk: JWKInterface;
  let turbo: NodeTurboClient;

  before(async () => {
    jwk = await Arweave.crypto.generateJWK();
    turbo = new NodeTurboClient({ jwk });
  });

  describe("public methods", () => {
    it("getWincBalance()", async () => {
      const turbo = new NodeTurboClient({
        jwk,
      });
      const balance = await turbo.getWincBalance();

      expect(balance.toString()).to.equal("0");
    });
  });

  describe("upload files", () => {
    it("works", async () => {
      const localDataItems = [
        { filePath: path.join(__dirname, "stubFiles/1KiB.txt") },
      ];
      const uploadDataItemsResponse = await turbo.upload(localDataItems);
      const { ownerAddress, dataItems } = uploadDataItemsResponse;
      const dataItemIds = Object.keys(dataItems);
      expect(ownerAddress).to.have.match(base64URLRegex);
      expect(dataItemIds.length).to.equal(localDataItems.length);
      for (const [dataItemId, uploadResults] of Object.entries(dataItems)) {
        expect(dataItemId).to.match(base64URLRegex);
        expect(uploadResults.dataCaches).to.deep.equal(["arweave.net"]);
        expect(uploadResults.fastFinalityIndexes).to.deep.equal([
          "arweave.net",
        ]);
      }
    });
  });
});

describe("WebTurboClient", () => {
  let jwk: JWKInterface;
  let turbo: WebTurboClient;

  before(async () => {
    jwk = await Arweave.crypto.generateJWK();
    turbo = new WebTurboClient({ jwk });
  });

  describe("public methods", () => {
    it("getWincBalance()", async () => {
      const balance = await turbo.getWincBalance();

      expect(balance.toString()).to.equal("0");
    });
  });

  describe("private methods", () => {
    it("upload() with a blob", async () => {
      const dataItemBuffer = Buffer.from("hello world");
      const blob = new Blob([dataItemBuffer], { type: "text/plain" });
      const localDataItems = [
        {
          data: blob,
        },
      ];
      const uploadDataItemsResponse = await turbo.upload(localDataItems);
      const { ownerAddress, dataItems } = uploadDataItemsResponse;
      const dataItemIds = Object.keys(dataItems);
      expect(ownerAddress).to.have.match(base64URLRegex);
      expect(dataItemIds.length).to.equal(localDataItems.length);
      for (const [dataItemId, uploadResults] of Object.entries(dataItems)) {
        expect(dataItemId).to.match(base64URLRegex);
        expect(uploadResults.dataCaches).to.deep.equal(["arweave.net"]);
        expect(uploadResults.fastFinalityIndexes).to.deep.equal([
          "arweave.net",
        ]);
      }
    });
  });
});
