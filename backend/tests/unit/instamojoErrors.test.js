const {
  formatInstamojoError,
  validateInstamojoBuyer,
} = require("../../src/utils/instamojoErrors");

describe("formatInstamojoError", () => {
  it("flattens field arrays from Instamojo", () => {
    const msg = formatInstamojoError({
      email: ["Enter a valid email address"],
      phone: ["Enter a valid phone"],
    });
    expect(msg).toContain("Email:");
    expect(msg).toContain("Phone:");
  });

  it("uses message string when present", () => {
    expect(formatInstamojoError({ message: "Invalid user" })).toBe(
      "Invalid user"
    );
  });
});

describe("validateInstamojoBuyer", () => {
  it("rejects bad email", () => {
    expect(
      validateInstamojoBuyer({
        email: "not-an-email",
        phone: "9876543210",
        amount: 100,
      })
    ).toMatch(/Invalid email/i);
  });

  it("rejects short phone", () => {
    expect(
      validateInstamojoBuyer({
        email: "a@b.com",
        phone: "123",
        amount: 100,
      })
    ).toMatch(/Invalid phone/i);
  });

  it("accepts valid buyer", () => {
    expect(
      validateInstamojoBuyer({
        email: "a@b.com",
        phone: "9876543210",
        amount: 99.5,
      })
    ).toBeNull();
  });
});
