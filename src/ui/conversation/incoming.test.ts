import { describe, expect, it } from "vitest";
import { takeSessionShare } from "./useIncoming";

describe("shared text handed over by the /share fallback", () => {
  it("is read once from sessionStorage, then removed", () => {
    sessionStorage.setItem("companion.shared-text", "Your parcel is held");
    expect(takeSessionShare(sessionStorage)).toBe("Your parcel is held");
    expect(sessionStorage.getItem("companion.shared-text")).toBeNull();
    expect(takeSessionShare(sessionStorage)).toBeNull();
  });
});
