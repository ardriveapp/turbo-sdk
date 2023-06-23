import { expect } from "chai";
import Turbo from "../src";
import { JWKInterface } from "arbundles/node";

const jwk = { stub: "wallet" } as unknown as JWKInterface;

describe("ArDrive Turbo", () => {
  const turbo = new Turbo({ jwk });

  describe("getWincBalance", () => {
    it("works", async () => {
      const turbo = new Turbo({ jwk });
      const balance = await turbo.getWincBalance();

      expect(balance.toString()).to.equal("2471066334217");
    });
  });

  describe("upload files", () => {
    it("works", async () => {
      const res = await turbo.upload([
        { filePath: "tests/stubFiles/1KiB.txt" },
      ]);

      console.log("res", res);
    });
  });
});
