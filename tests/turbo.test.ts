import { expect } from "chai";
import { TurboClient } from "../src/index.js";

describe("TurboClient", () => {
  it("should create a class", () => {
    const turbo = new TurboClient();
    expect(turbo).to.be.instanceOf(TurboClient);
  });
});
