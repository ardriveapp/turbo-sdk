import { expect } from "chai";

import { Winc } from "./winc.js";

describe("Winc class", () => {
  describe("constructor", () => {
    it("constructor throws an exception when a negative Winc value is provided", () => {
      expect(() => new Winc(-1)).to.throw(Error);
      expect(() => new Winc("-1")).to.throw(Error);
    });

    it("constructor throws an exception when a non-integer Winc value is provided", () => {
      expect(() => new Winc(0.5)).to.throw(Error);
      expect(() => new Winc("0.5")).to.throw(Error);
      expect(() => new Winc("abc")).to.throw(Error);
      expect(() => new Winc("!!!")).to.throw(Error);
      expect(() => new Winc("-")).to.throw(Error);
      expect(() => new Winc("+")).to.throw(Error);
    });

    it("constructor builds Winc values for positive integer number values without throwing an error", () => {
      expect(() => new Winc(0)).to.not.throw(Error);
      expect(() => new Winc(1)).to.not.throw(Error);
      expect(() => new Winc(Number.MAX_SAFE_INTEGER)).to.not.throw(Error);
    });

    // Not concerned with other number notations for now, e.g. scientific notation
    it("constructor builds Winc values for positive integer strings without throwing an error", () => {
      expect(() => new Winc("0")).to.not.throw(Error);
      expect(() => new Winc("1")).to.not.throw(Error);
    });

    it("constructor builds Winc values for positive BigNumber integer strings", () => {
      expect(() => new Winc("18014398509481982")).to.not.throw(Error);
    });
  });

  describe("plus function", () => {
    it("correctly sums up Winc values", () => {
      expect(new Winc(1).plus(new Winc(2)).toString()).to.equal("3");
    });

    it("correctly sums up Winc values in the BigNumber ranges", () => {
      expect(
        new Winc(Number.MAX_SAFE_INTEGER)
          .plus(new Winc(Number.MAX_SAFE_INTEGER))
          .toString(),
      ).to.equal("18014398509481982");
    });
  });

  describe("minus function", () => {
    it("correctly subtracts Winc values", () => {
      expect(new Winc(2).minus(new Winc(1)).toString()).to.equal("1");
    });

    it("correctly subtracts Winc values in the BigNumber ranges", () => {
      expect(
        new Winc("18014398509481982")
          .minus(new Winc(Number.MAX_SAFE_INTEGER))
          .toString(),
      ).to.equal("9007199254740991");
    });

    it("throws an error when the subtraction result is less than 0", () => {
      expect(() => new Winc(1).minus(new Winc(2))).to.throw(Error);
    });
  });

  describe("times function", () => {
    it("correctly multiplies Winc values by whole and fractional numbres", () => {
      expect(new Winc(2).times(3).toString()).to.equal("6");
      expect(new Winc(2).times(1.5).toString()).to.equal("3");
    });

    it("correctly multiplies Winc values by whole and fractional BigNumbers", () => {
      expect(new Winc(2).times(Number.MAX_SAFE_INTEGER).toString()).to.equal(
        "18014398509481982",
      );
      expect(new Winc(2).times("18014398509481982").toString()).to.equal(
        "36028797018963964",
      );
    });

    it("rounds down multiplications that result in fractional numbers", () => {
      expect(new Winc(2).times(1.6).toString()).to.equal("3");
      expect(new Winc(Number.MAX_SAFE_INTEGER).times(1.5).toString()).to.equal(
        "13510798882111486",
      );
    });

    it("throws an error when the multiplying by negative numbers", () => {
      expect(() => new Winc(1).times(-1)).to.throw(Error);
    });
  });

  describe("dividedBy function", () => {
    it("correctly divides Winc values by whole and fractional numbers", () => {
      expect(new Winc(6).dividedBy(3).toString()).to.equal("2");
      expect(new Winc(6).dividedBy(1.5).toString()).to.equal("4");
    });

    it("correctly divides Winc values by whole and fractional BigNumbers", () => {
      expect(
        new Winc("18014398509481982")
          .dividedBy(Number.MAX_SAFE_INTEGER)
          .toString(),
      ).to.equal("2");
      expect(
        new Winc("36028797018963965")
          .dividedBy("18014398509481982.5")
          .toString(),
      ).to.equal("2");
    });

    it("rounds up divisions that result in fractional numbers by default", () => {
      expect(new Winc(3).dividedBy(2).toString()).to.equal("2");
      expect(new Winc("13510798882111487").dividedBy(2).toString()).to.equal(
        "6755399441055744",
      );
    });

    it("rounds down divisions that result in fractional numbers when ROUND_DOWN is specified", () => {
      expect(new Winc(3).dividedBy(2, "ROUND_DOWN").toString()).to.equal("1");
      expect(new Winc("13510798882111487").dividedBy(2).toString()).to.equal(
        "6755399441055744",
      );
    });

    it("throws an error when dividing by negative numbers", () => {
      expect(() => new Winc(1).dividedBy(-1)).to.throw(Error);
    });
  });

  describe("isGreaterThan function", () => {
    it("returns false when other Winc is greater", () => {
      expect(new Winc(1).isGreaterThan(new Winc(2))).to.be.false;
    });

    it("returns true when other Winc is lesser", () => {
      expect(new Winc(2).isGreaterThan(new Winc(1))).to.be.true;
    });

    it("returns false when other Winc is equal", () => {
      expect(new Winc(2).isGreaterThan(new Winc(2))).to.be.false;
    });
  });

  describe("isGreaterThanOrEqualTo function", () => {
    it("returns false when other Winc is greater", () => {
      expect(new Winc(1).isGreaterThanOrEqualTo(new Winc(2))).to.be.false;
    });

    it("returns true when other Winc is lesser", () => {
      expect(new Winc(2).isGreaterThanOrEqualTo(new Winc(1))).to.be.true;
    });

    it("returns true when other Winc is equal", () => {
      expect(new Winc(2).isGreaterThanOrEqualTo(new Winc(2))).to.be.true;
    });
  });

  describe("difference function", () => {
    it("can return a positive difference between Wincs", () => {
      expect(Winc.difference(new Winc(2), new Winc(1))).to.equal("1");
    });

    it("can return a negative difference between Wincs", () => {
      expect(Winc.difference(new Winc(1), new Winc(2))).to.equal("-1");
    });
  });

  describe("toString function", () => {
    it("returns the Winc value as a BigNumber string", () => {
      expect(new Winc(0).toString()).to.equal("0");
      expect(new Winc(1).toString()).to.equal("1");
      expect(new Winc("18014398509481982").toString()).to.equal(
        "18014398509481982",
      );
    });
  });

  describe("valueOf function", () => {
    it("returns the Winc value as a BigNumber string", () => {
      expect(new Winc(0).valueOf()).to.equal("0");
      expect(new Winc(1).valueOf()).to.equal("1");
      expect(new Winc("18014398509481982").valueOf()).to.equal(
        "18014398509481982",
      );
    });
  });

  describe("max function", () => {
    it("correctly computes the max Winc value from an aritrarily large list of Winc values", () => {
      expect(
        `${Winc.max(
          new Winc("18014398509481982"),
          new Winc(Number.MAX_SAFE_INTEGER),
          new Winc(1),
          new Winc(0),
        )}`,
      ).to.equal("18014398509481982");
    });
  });
});
