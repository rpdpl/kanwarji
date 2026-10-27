const { verifyInstamojoMac } = require("../../src/utils/instamojoMac");
const crypto = require("crypto");

function buildMac(payload, salt) {
  const data = { ...payload };
  delete data.mac;
  const keys = Object.keys(data).sort((a, b) =>
    a.toLowerCase().localeCompare(b.toLowerCase())
  );
  const message = keys.map((k) => String(data[k] ?? "")).join("|");
  return crypto.createHmac("sha1", salt).update(message).digest("hex");
}

describe("verifyInstamojoMac", () => {
  const salt = "test-private-salt";

  it("accepts a valid MAC", () => {
    const payload = {
      amount: "100.00",
      buyer: "a@b.com",
      buyer_name: "Test",
      buyer_phone: "9999999999",
      currency: "INR",
      fees: "2.00",
      payment_id: "MOJO123",
      payment_request_id: "req-abc",
      purpose: "Order X",
      status: "Credit",
    };
    payload.mac = buildMac(payload, salt);
    expect(verifyInstamojoMac(payload, salt)).toBe(true);
  });

  it("rejects a tampered payload", () => {
    const payload = {
      amount: "100.00",
      payment_id: "MOJO123",
      payment_request_id: "req-abc",
      status: "Credit",
    };
    payload.mac = buildMac(payload, salt);
    payload.amount = "999.00";
    expect(verifyInstamojoMac(payload, salt)).toBe(false);
  });

  it("rejects missing salt or mac", () => {
    expect(verifyInstamojoMac({ mac: "abc", status: "Credit" }, "")).toBe(
      false
    );
    expect(verifyInstamojoMac({ status: "Credit" }, salt)).toBe(false);
  });
});
