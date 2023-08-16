import { expect } from "chai";
import Arweave from "arweave";
import { JWKInterface } from "../src/utils/jwkTypes.js";
import { base64URLRegex } from "../src/utils/regex.js";
import { TurboFactory } from "../src/index.js";
import { TurboClient } from "../src/common/index.js";
import TurboWebClient from "../src/web/index.js";
import TurboNodeClient from "../src/node/index.js";
import { ByteCount } from "../src/types/byteCount.js";
import { Winc } from "../src/types/winc.js";
import { Payment } from "../src/types/payment.js";

describe("TurboFactory", () => {
  it("should return a TurboNodeClient when running in node", () => {
    const turbo = TurboFactory.init();
    expect(turbo).to.be.instanceOf(TurboNodeClient);
  });
  it("should be a TurboWebClient when running in the browser", () => {
    (global as any).window = { document: {} };
    const turbo = TurboFactory.init();
    expect(turbo).to.be.instanceOf(TurboWebClient);
    delete (global as any).window;
  });
});

describe("TurboClient", () => {
  let jwk: JWKInterface;

  before(async () => {
    jwk = await Arweave.crypto.generateJWK();
  });

  describe("TurboNodeClient", () => {
    let turbo: TurboClient;
    before(() => {
      turbo = TurboFactory.init({ jwk });
    })
    describe("public methods", () => {
      it("getWincBalance()", async () => {
        const balance = await turbo.getWincBalance();
        expect(balance.toString()).to.equal("0");
      });
      it("getRates()", async () => {
        const { winc, fiat, adjustments } = await turbo.getRates();
        expect(winc).to.not.be.undefined.and.to.be.a('number');
        expect(fiat).to.have.property('usd').that.is.a('number');
        expect(adjustments).to.not.be.undefined;
      });

      it("getWincEstimationForByteCount()", async () => {
        const byteCount = ByteCount(1024);
        const winc = await turbo.getWincEstimationForByteCount(byteCount);
        expect(winc).to.be.instanceOf(Winc);
        expect(+winc.valueOf()).to.be.greaterThan(0);
      });

      it("getWincEstimationForPayment()", async () => {
        const payment = new Payment({ amount: 1000, type: 'usd'});
        const winc = await turbo.getWincEstimationForPayment(payment);
        expect(winc).to.be.instanceOf(Winc);
        expect(+winc.valueOf()).to.be.greaterThan(0);
      });
    });

    describe("upload files", () => {
      it("works", async () => {
        const localDataItems = [
          { filePath: new URL("stubFiles/1KiB.txt", import.meta.url) },
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
  describe("TurboWebClient", () => {
    let turbo: TurboClient;

    before(async () => {
      // simulate the browser environment
      (global as any).window = { document: {} };
      turbo = TurboFactory.init({ jwk });
    });

    after(() => {
      delete (global as any).window;
    });

    describe("client", () => {
      it("should be a WebTurboClient", () => {
        expect(turbo).to.be.instanceOf(TurboWebClient);
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
  });
});
