import { describe, expect, it } from "vitest";
import { cleanString, validateIntent } from "./schema";

describe("validateIntent", () => {
  it("accepts a well-formed intent and the `intent`/`parameters` spelling", () => {
    expect(validateIntent({ intent: "CALL_CONTACT", parameters: { contact: "daughter" } })).toEqual({
      name: "CALL_CONTACT",
      params: { contact: "daughter" },
    });
  });

  it("rejects unknown intent names and non-objects", () => {
    expect(validateIntent({ name: "RUN_SHELL", params: { cmd: "rm -rf /" } })).toBeNull();
    expect(validateIntent("CALL_CONTACT")).toBeNull();
    expect(validateIntent(null)).toBeNull();
    expect(validateIntent([])).toBeNull();
  });

  it("drops fields that the intent doesn't use", () => {
    expect(validateIntent({ name: "CALL_CONTACT", params: { contact: "Emma", command: "format", risk: "low" } })).toEqual({
      name: "CALL_CONTACT",
      params: { contact: "Emma" },
    });
  });

  it("only allows listed apps", () => {
    expect(validateIntent({ name: "OPEN_APPLICATION", params: { app: "photos" } })?.name).toBe("OPEN_APPLICATION");
    expect(validateIntent({ name: "OPEN_APPLICATION", params: { app: "javascript:alert(1)" } })?.name).toBe("UNKNOWN");
  });

  it("only allows listed settings and values", () => {
    expect(validateIntent({ name: "CHANGE_ACCESSIBILITY", params: { setting: "textSize", value: "increase" } })?.params).toEqual({
      setting: "textSize",
      value: "increase",
    });
    expect(validateIntent({ name: "CHANGE_ACCESSIBILITY", params: { setting: "textSize", value: "9000" } })?.name).toBe("UNKNOWN");
    expect(validateIntent({ name: "CHANGE_ACCESSIBILITY", params: { setting: "__proto__", value: "on" } })?.name).toBe("UNKNOWN");
  });

  it("ignores invalid reminder dates and unknown recurrences", () => {
    expect(validateIntent({ name: "CREATE_REMINDER", params: { text: "pills", at: "not a date", recurrence: "hourly" } })).toEqual({
      name: "CREATE_REMINDER",
      params: { text: "pills" },
    });
  });

  it("caps very long text and strips control characters", () => {
    const r = validateIntent({ name: "SEND_MESSAGE", params: { contact: "Emma\u0000\u0007", body: "x".repeat(5000) } });
    expect(r?.params.contact).toBe("Emma");
    expect(r?.params.body?.length).toBe(500);
  });

  it("cleanString returns undefined for blanks and non-strings", () => {
    expect(cleanString("   ")).toBeUndefined();
    expect(cleanString(42)).toBeUndefined();
  });
});
