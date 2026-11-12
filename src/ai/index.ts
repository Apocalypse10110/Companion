/**
 * Developer B's assistant, ready to plug into `src/integration/index.ts`.
 * On-device rules always work; the server AI (`/api/assistant`) is used only if configured there.
 */
import { createAssistant } from "./assistant";
import { createRemoteProvider } from "./providers/remote";

export { createAssistant } from "./assistant";
export type { AIProvider } from "./providers/types";

export const assistant = createAssistant({ provider: createRemoteProvider() });
