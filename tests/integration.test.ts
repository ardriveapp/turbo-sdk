import { expect } from "chai";
import Turbo from "../src";
import Arweave from "arweave";
import { JWKInterface } from "../src/utils/jwkTypes";
import { base64URLRegex } from "../src/utils/regex";

describe("ArDrive Turbo", () => {
  let jwk: JWKInterface;
  let turbo: Turbo;

  before(async () => {
    jwk = await Arweave.crypto.generateJWK();
    turbo = new Turbo({ jwk });
  });

  describe("getWincBalance", () => {
    it("works", async () => {
      const turbo = new Turbo({
        jwk,
      });
      const balance = await turbo.getWincBalance();

      expect(balance.toString()).to.equal("0");
    });
  });

  describe("upload files", () => {
    it("works", async () => {
      const { dataItems, ownerAddress } = await turbo.upload([
        { filePath: "tests/stubFiles/1KiB.txt" },
      ]);

      expect(ownerAddress).to.have.match(base64URLRegex);
      const entries = Object.entries(dataItems);

      expect(entries.length).to.equal(1);

      const dataItemId = entries[0][0];
      expect(dataItemId).to.match(base64URLRegex);

      expect(entries[0][1].byteCount.toString()).to.equal("2068");
      expect(entries[0][1].dataCaches).to.deep.equal(["arweave.net"]);
      expect(entries[0][1].fastFinalityIndexes).to.deep.equal(["arweave.net"]);
    });
  });
});
