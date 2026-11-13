/**
 * Sample inbox and calendar: lets anyone (judges included) try "read my email" and "what's on
 * tomorrow?" without connecting a real account. Turned on in Settings -> Connected accounts.
 * Everything read from it is introduced as "the sample inbox" / "the sample calendar", so it is
 * never mistaken for real mail. Kept on this phone only.
 */

const KEY = "companion.sample-accounts.v1";

export function isSampleOn(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function setSampleOn(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEY, "on");
    else localStorage.removeItem(KEY);
  } catch {
    /* not remembered; nothing breaks */
  }
}

export interface SampleEmail {
  from: string;
  subject: string;
  date: string;
  unread: boolean;
}

export interface SampleEvent {
  title: string;
  start: string;
  allDay: boolean;
  location?: string;
}

const minutesAgo = (now: Date, m: number) => new Date(now.getTime() - m * 60_000).toISOString();

export function sampleEmails(now: Date): { unread: number; items: SampleEmail[] } {
  const items: SampleEmail[] = [
    { from: "Sarah", subject: "Lunch on Sunday?", date: minutesAgo(now, 40), unread: true },
    { from: "Riverside Surgery", subject: "Your flu jab appointment", date: minutesAgo(now, 180), unread: true },
    { from: "Amazon", subject: "Your parcel was delivered", date: minutesAgo(now, 60 * 26), unread: true },
    { from: "Tom", subject: "Photos from the weekend", date: minutesAgo(now, 60 * 50), unread: false },
  ];
  return { unread: items.filter((e) => e.unread).length, items };
}

/** A few appointments over the next days, placed relative to today so they always look current. */
export function sampleEvents(now: Date): SampleEvent[] {
  const at = (dayOffset: number, h: number, m = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  return [
    { title: "Phone call with Tom", start: at(0, 15), allDay: false },
    { title: "Dentist", start: at(1, 10, 30), allDay: false, location: "Smile Dental" },
    { title: "Coffee with Jean", start: at(2, 11), allDay: false, location: "the garden centre" },
    { title: "Hairdresser", start: at(4, 14), allDay: false },
  ];
}
