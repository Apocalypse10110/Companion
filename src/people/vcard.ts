/**
 * Read contact cards (.vcf) shared from the phone's Contacts app. This is how an iPhone (which never
 * lets a website read contacts) can still add people: Contacts -> a person -> Share Contact -> save,
 * then pick the file in Companion. Only names and phone numbers are kept; everything else is ignored.
 */

export interface CardContact {
  name: string;
  phones: string[];
}

/** vCard lines can be folded: a line starting with a space continues the previous one. */
function unfold(text: string): string[] {
  return text.replace(/\r\n?/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function unescape(v: string): string {
  return v.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1").trim();
}

function decodeQuotedPrintable(v: string): string {
  try {
    const bytes = v.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
    return decodeURIComponent(escape(bytes));
  } catch {
    return v;
  }
}

export function parseVCards(text: string, limit = 200): CardContact[] {
  const out: CardContact[] = [];
  let current: { fn?: string; n?: string; phones: string[] } | null = null;
  for (const line of unfold(text)) {
    const upper = line.toUpperCase();
    if (upper.startsWith("BEGIN:VCARD")) current = { phones: [] };
    else if (upper.startsWith("END:VCARD") && current) {
      const name = current.fn || current.n || current.phones[0];
      if (name && current.phones.length) out.push({ name: name.slice(0, 60), phones: [...new Set(current.phones)].slice(0, 5) });
      current = null;
      if (out.length >= limit) break;
    } else if (current) {
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const key = line.slice(0, colon).toUpperCase();
      let value = line.slice(colon + 1);
      if (key.includes("QUOTED-PRINTABLE")) value = decodeQuotedPrintable(value);
      const field = key.split(";")[0].split(".").pop();
      if (field === "FN") current.fn = unescape(value);
      else if (field === "N" && !current.n) {
        const [family = "", given = ""] = value.split(";").map(unescape);
        current.n = `${given} ${family}`.trim();
      } else if (field === "TEL") {
        const tel = unescape(value.replace(/^tel:/i, ""));
        if (/\d{3,}/.test(tel.replace(/\D/g, ""))) current.phones.push(tel);
      }
    }
  }
  return out;
}
