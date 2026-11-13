/**
 * Scam Call Shield: warning signs in what a caller says, found on the phone as the words arrive.
 * These are plain-words rules, fast and private. They flag, they don't judge: the full call can also
 * be checked by the assistant. A warning is never a guarantee either way.
 */

export interface CallSign {
  id: string;
  /** What to tell the person, in plain words. */
  warning: string;
  /** Serious: stop sharing information right now. */
  serious: boolean;
}

const RULES: Array<CallSign & { test: RegExp }> = [
  {
    id: "code",
    test: /\b(one[- ]time|verification|security|6[- ]digit|confirmation)\s+(code|number|pin)\b|\b(read|tell|give)\s+(me|us)\s+(the\s+)?code\b|\bcode\s+(we|i)\s+(just\s+)?sent\b/i,
    warning: "They're asking for a code sent to your phone. No real bank or company ever asks for this.",
    serious: true,
  },
  {
    id: "pin",
    test: /\b(your|the)\s+(pin|password|passcode)\b|\bcard\s+number\b|\b(long|16[- ]digit)\s+number\s+on\s+(the\s+)?(front|card)\b|\bsecurity\s+number\s+on\s+the\s+back\b/i,
    warning: "They're asking for your PIN, password or card number. Legitimate organisations don't ask for these on a call.",
    serious: true,
  },
  {
    id: "giftcard",
    test: /\bgift\s*cards?\b|\b(itunes|google\s+play|amazon|steam)\s+(cards?|vouchers?)\b|\bbitcoin\b|\bcrypto\b|\bwire\s+transfer\b|\bwestern\s+union\b/i,
    warning: "They want payment by gift card, crypto or wire transfer. That's a classic scam.",
    serious: true,
  },
  {
    id: "safe-account",
    test: /\bsafe\s+account\b|\bmove\s+(your\s+)?(money|savings|funds)\b|\btransfer\s+(your\s+)?(money|savings|funds)\b/i,
    warning: "They're asking you to move money to a “safe account”. Banks never do this.",
    serious: true,
  },
  {
    id: "remote",
    test: /\b(anydesk|teamviewer|remote\s+access|quick\s*support|download\s+(this|an|the)\s+app|install\s+(this|an|the)\s+app)\b/i,
    warning: "They want you to install an app or let them into your device. Don't.",
    serious: true,
  },
  {
    id: "secret",
    test: /\b(don'?t|do\s+not)\s+(tell|talk\s+to)\s+(anyone|anybody|your\s+(family|bank|son|daughter))\b|\bkeep\s+(this|it)\s+(a\s+)?secret\b|\bconfidential\s+investigation\b/i,
    warning: "They're telling you to keep it secret. Scammers do this so no one can warn you.",
    serious: false,
  },
  {
    id: "threat",
    test: /\b(arrest(ed)?|warrant|police\s+will|you\s+will\s+be\s+(fined|charged|sued)|legal\s+action|account\s+(will\s+be\s+)?(closed|suspended|frozen)|deport)/i,
    warning: "They're making threats. Real organisations give you time and send letters.",
    serious: false,
  },
  {
    id: "urgent",
    test: /\b(right\s+now|immediately|urgent(ly)?|within\s+(the\s+next\s+)?\d+\s+(minutes|hours)|today\s+or|before\s+it'?s\s+too\s+late)\b/i,
    warning: "They're rushing you. Pressure is a warning sign: it's always fine to hang up and check.",
    serious: false,
  },
  {
    id: "impersonation",
    test: /\b(this\s+is|calling\s+from|i'?m\s+from)\s+(your\s+bank|the\s+bank|hmrc|the\s+irs|irs|medicare|social\s+security|the\s+police|microsoft|amazon|apple|bt|your\s+internet\s+provider)\b|\bgrandma\b.*\b(trouble|jail|hospital)\b|\bit'?s\s+me,?\s+your\s+(grandson|granddaughter)\b/i,
    warning: "They say they're from a bank, the government, a big company or family. Anyone can claim that on a call.",
    serious: false,
  },
];

/** Every warning sign found in the words so far, in the order of the rules. */
export function findCallSigns(transcript: string): CallSign[] {
  return RULES.filter((r) => r.test.test(transcript)).map(({ id, warning, serious }) => ({ id, warning, serious }));
}
