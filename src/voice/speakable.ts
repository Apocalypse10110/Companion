/**
 * Make text pleasant to hear: no emoji, links, markdown or symbols read out letter by letter.
 * Owner: Developer B.
 */
export function speakable(text: string): string {
  return text
    .replace(/https?:\/\/\S+/g, "a link")
    .replace(/[*_#`~>|]+/g, " ")
    .replace(/[“”"]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/\p{Extended_Pictographic}️?/gu, "")
    .replace(/\s*&\s*/g, " and ")
    .replace(/\s*%/g, " percent")
    .replace(/\s+([.,!?])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Split long text into sentence-sized pieces. Some phone speech engines stop
 * part-way through very long utterances, and short pieces can be interrupted quickly.
 */
export function splitForSpeech(text: string, max = 220): string[] {
  const sentences = text.match(/[^.!?;:]+[.!?;:]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";
  for (const raw of sentences) {
    const s = raw.trim();
    if (!s) continue;
    if (s.length > max) {
      if (current) chunks.push(current), (current = "");
      // Break very long sentences at commas, then spaces.
      let rest = s;
      while (rest.length > max) {
        let cut = rest.lastIndexOf(", ", max);
        if (cut < max / 2) cut = rest.lastIndexOf(" ", max);
        if (cut <= 0) cut = max;
        chunks.push(rest.slice(0, cut + 1).trim());
        rest = rest.slice(cut + 1).trim();
      }
      if (rest) current = rest;
      continue;
    }
    if ((current + " " + s).trim().length > max) {
      chunks.push(current);
      current = s;
    } else current = (current + " " + s).trim();
  }
  if (current) chunks.push(current);
  return chunks;
}
