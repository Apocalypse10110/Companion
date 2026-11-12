import { vi } from "vitest";

/** Shared mutable stand-ins for next/navigation, so tests can steer and inspect routing. */
export const nav = {
  pathname: "/",
  push: vi.fn(),
  replace: vi.fn(),
};
