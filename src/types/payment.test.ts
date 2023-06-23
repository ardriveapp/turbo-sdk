import { expect } from "chai";
import { InvalidPaymentAmount } from "../utils/errors";
import { Payment } from "./payment";

describe("Payment class", () => {
  describe("constructor", () => {
    it("throws an error when provided an un-supported payment amount", () => {
      expect(() => new Payment({ amount: -5, type: "usd" })).to.throw(
        InvalidPaymentAmount,
        "The provided payment amount (-5) is invalid; it must be a positive non-decimal integer!"
      );
      expect(() => new Payment({ amount: 123.456, type: "gbp" })).to.throw(
        InvalidPaymentAmount,
        "The provided payment amount (123.456) is invalid; it must be a positive non-decimal integer!"
      );
      expect(
        () => new Payment({ amount: 123456789.456123, type: "jpy" })
      ).to.throw(
        InvalidPaymentAmount,
        "The provided payment amount (123456789.456123) is invalid; it must be a positive non-decimal integer!"
      );
      expect(
        () => new Payment({ amount: Number.MAX_SAFE_INTEGER + 1, type: "aud" })
      ).to.throw(
        InvalidPaymentAmount,
        "The provided payment amount (9007199254740992) is invalid; it must be a positive non-decimal integer!"
      );
      expect(
        () => new Payment({ amount: Number.POSITIVE_INFINITY, type: "sgd" })
      ).to.throw(
        InvalidPaymentAmount,
        "The provided payment amount (Infinity) is invalid; it must be a positive non-decimal integer!"
      );
      expect(() => new Payment({ amount: NaN, type: "inr" })).to.throw(
        InvalidPaymentAmount,
        "The provided payment amount (NaN) is invalid; it must be a positive non-decimal integer!"
      );
    });
  });
});
