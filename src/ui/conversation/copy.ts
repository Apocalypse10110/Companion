import type { AssistantErrorCode, VoiceInputErrorCode } from "@/contracts";

/** Every message the person might see when something goes wrong: short, kind, and says what to do. */

export const ASSISTANT_ERRORS: Record<AssistantErrorCode, string> = {
  unavailable: "I'm not connected yet, so I can't answer right now. Please try again a little later.",
  network: "I can't reach the internet right now. Please check your connection and try again.",
  timeout: "That is taking too long. Please try again.",
  unknown: "Something went wrong on my side. Please try again.",
};

export const VOICE_ERRORS: Record<VoiceInputErrorCode, string> = {
  "no-speech": "I didn't hear anything. Tap the microphone and try again, or type to me instead.",
  "permission-denied":
    "The microphone is turned off for this app. To turn it on, open your phone's Settings, find this app or your browser, and allow the microphone. Until then, you can type to me.",
  "no-microphone": "I couldn't find a microphone on this device. You can type to me instead.",
  network: "I couldn't hear you because the internet isn't working right now. You can type to me instead.",
  unknown: "Something went wrong while listening. Please try again, or type to me instead.",
};

export const VOICE_UNSUPPORTED =
  "Talking to me isn't available on this device yet. You can type to me instead.";

export const MIC_EXPLAINER =
  "To hear you, I need to use your microphone. I only listen while you are tapping the microphone button.";

export const SPEECH_FAILED = "I couldn't read that out loud. You can still read it on the screen.";

export const CANCELLED = "Okay, I've stopped.";
