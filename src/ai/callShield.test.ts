import { describe, expect, it } from "vitest";
import { findCallSigns } from "./callShield";

const ids = (t: string) => findCallSigns(t).map((s) => s.id);

describe("Scam Call Shield signs", () => {
  it("flags requests for codes, PINs and gift cards as serious", () => {
    expect(ids("Please read me the verification code we just sent")).toContain("code");
    expect(ids("I need your PIN to confirm")).toContain("pin");
    expect(ids("You must pay with Google Play cards")).toContain("giftcard");
    expect(findCallSigns("move your savings to a safe account").every((s) => s.serious)).toBe(true);
  });

  it("flags secrecy, threats, urgency and impersonation as warnings", () => {
    expect(ids("This is your bank. Don't tell anyone, you will be arrested if you don't act right now")).toEqual(
      expect.arrayContaining(["secret", "threat", "urgent", "impersonation"]),
    );
  });

  it("an ordinary call raises nothing", () => {
    expect(ids("Hi Mum, just calling to say we'll be there for lunch on Sunday. Do you need anything from the shops?")).toEqual([]);
    expect(ids("This is the dentist reminding you of your appointment on Thursday at ten")).toEqual([]);
  });
});
