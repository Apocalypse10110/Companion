import { describe, expect, it } from "vitest";
import { classify } from "./rules";
import { validateIntent, type Intent } from "./schema";

// Wednesday 11 Nov 2026, 9:00 am local time.
const NOW = new Date(2026, 10, 11, 9, 0, 0);

function intent(text: string): Intent | null {
  const raw = classify(text, NOW);
  return raw ? validateIntent(raw) : null;
}

describe("local intent rules", () => {
  it.each([
    ["Call my daughter.", { contact: "daughter" }],
    ["call emma", { contact: "emma" }],
    ["Could you please call Emma for me?", { contact: "emma" }],
    ["Ring my son", { contact: "son" }],
    ["Phone the doctor", { contact: "doctor" }],
    ["Give Anna a call", { contact: "anna" }],
    ["I want to talk to my sister", { contact: "sister" }],
    ["Call her", { contact: "her" }],
    ["Call", {}],
    ["I want to make a call.", {}],
  ])("CALL_CONTACT: %s", (text, params) => {
    expect(intent(text)).toEqual({ name: "CALL_CONTACT", params });
  });

  it.each([
    ["Send Emma a message saying I'll be home soon.", { contact: "emma", body: "i'll be home soon" }],
    ["Could you tell Emma that I am running late?", { contact: "emma", body: "i am running late" }],
    ["Text my son that dinner is ready", { contact: "son", body: "dinner is ready" }],
    ["Send a message to my daughter saying I love you", { contact: "daughter", body: "i love you" }],
    ["Let John know I'm on my way", { contact: "john", body: "i'm on my way" }],
    ["Tell them yes", { contact: "them", body: "yes" }],
    ["Send a message", {}],
  ])("SEND_MESSAGE: %s", (text, params) => {
    expect(intent(text)).toEqual({ name: "SEND_MESSAGE", params });
  });

  it.each(["Read my latest message.", "Do I have any new messages?", "Check my texts"])("READ_MESSAGES: %s", (text) => {
    expect(intent(text)?.name).toBe("READ_MESSAGES");
  });

  it.each([
    ["Open my photos.", "photos"],
    ["I want to see my pictures.", "photos"],
    ["Show me my pictures", "photos"],
    ["Open the camera", "camera"],
    ["Open my calendar", "calendar"],
    ["open settings", "settings"],
  ])("OPEN_APPLICATION: %s", (text, app) => {
    expect(intent(text)).toEqual({ name: "OPEN_APPLICATION", params: { app } });
  });

  it("finds the way home with maps", () => {
    expect(intent("Help me find my way home.")).toEqual({ name: "OPEN_APPLICATION", params: { app: "maps", destination: "home" } });
    expect(intent("Take me to the pharmacy")).toEqual({ name: "OPEN_APPLICATION", params: { app: "maps", destination: "pharmacy" } });
  });

  it("refuses to open apps it doesn't know", () => {
    expect(intent("open the nuclear launch codes")?.name).toBe("UNKNOWN");
  });

  it.each([
    ["Make my text bigger.", "textSize", "increase"],
    ["Make the text bigger", "textSize", "increase"],
    ["Can you make everything on my phone easier to read?", "textSize", "increase"],
    ["The writing is too small", "textSize", "increase"],
    ["Make the text smaller", "textSize", "decrease"],
    ["Turn on high contrast", "highContrast", "on"],
    ["Turn off high contrast", "highContrast", "off"],
    ["Switch to dark mode", "theme", "dark"],
    ["Make the buttons bigger", "extraLargeButtons", "on"],
    ["Please speak slower", "speechRate", "slower"],
    ["You talk too fast", "speechRate", "slower"],
    ["Louder please", "volume", "louder"],
    ["Stop the animations", "motion", "reduce"],
    ["Make the text bold", "boldText", "on"],
  ])("CHANGE_ACCESSIBILITY: %s", (text, setting, value) => {
    expect(intent(text)).toEqual({ name: "CHANGE_ACCESSIBILITY", params: { setting, value } });
  });

  it("CREATE_REMINDER with a bare hour picks the next 8 o'clock", () => {
    const r = intent("Remind me to take my medication at 8.");
    expect(r?.name).toBe("CREATE_REMINDER");
    expect(r?.params.text).toBe("take my medication");
    expect(new Date(r!.params.at!)).toEqual(new Date(2026, 10, 11, 20, 0));
  });

  it("CREATE_REMINDER for tomorrow with no time defaults to the morning", () => {
    const r = intent("Remind me about my appointment tomorrow");
    expect(r?.params.text).toBe("my appointment");
    expect(new Date(r!.params.at!)).toEqual(new Date(2026, 10, 12, 9, 0));
  });

  it("CREATE_REMINDER every day", () => {
    const r = intent("Set a reminder to take my pills every day at 9am");
    expect(r?.params.text).toBe("take my pills");
    expect(r?.params.recurrence).toBe("daily");
    expect(new Date(r!.params.at!)).toEqual(new Date(2026, 10, 12, 9, 0));
  });

  it("CREATE_REMINDER without a time leaves `at` empty so the assistant asks", () => {
    const r = intent("Remind me to call the bank");
    expect(r).toEqual({ name: "CREATE_REMINDER", params: { text: "call the bank" } });
  });

  it.each([
    ["What appointments do I have today?", "today"],
    ["What's my next reminder?", "next"],
    ["Read my latest reminder", "next"],
    ["What are my reminders?", "all"],
    ["What do I have today?", "today"],
  ])("LIST_REMINDERS: %s", (text, which) => {
    expect(intent(text)).toEqual({ name: "LIST_REMINDERS", params: { which } });
  });

  it.each([
    ["What time is it?", "time"],
    ["What's the time", "time"],
    ["What day is it today?", "date"],
  ])("READ_TIME: %s", (text, what) => {
    expect(intent(text)).toEqual({ name: "READ_TIME", params: { what } });
  });

  it.each(["What's the weather like?", "Will it rain today?"])("CHECK_WEATHER: %s", (text) => {
    expect(intent(text)?.name).toBe("CHECK_WEATHER");
  });

  it.each(["Help", "I need some help.", "Can you help me use my phone?", "I don't understand this notification.", "What can you do?"])(
    "HELP: %s",
    (text) => {
      expect(intent(text)?.name).toBe("HELP");
    },
  );

  it.each(["Yes", "yeah", "Okay", "Go ahead", "Do it", "Yes please"])("CONFIRM: %s", (text) => {
    expect(intent(text)?.name).toBe("CONFIRM");
  });

  it.each(["No", "No thanks", "Cancel", "Never mind", "Stop"])("DENY: %s", (text) => {
    expect(intent(text)?.name).toBe("DENY");
  });

  it("returns null for things it can't place", () => {
    expect(classify("who won the football last night", NOW)).toBeNull();
    expect(classify("", NOW)).toBeNull();
  });
});
