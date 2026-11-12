/** Developer B's voice services, ready to plug into `src/integration/index.ts`. */
import { createWebSpeechInput } from "./webSpeechInput";
import { createWebSpeechOutput } from "./webSpeechOutput";

export { createWebSpeechInput } from "./webSpeechInput";
export { createWebSpeechOutput } from "./webSpeechOutput";
export { speakable } from "./speakable";

export const voiceInput = createWebSpeechInput();
export const voiceOutput = createWebSpeechOutput();
