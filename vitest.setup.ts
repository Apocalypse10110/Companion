import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, beforeEach, expect, vi } from "vitest";
import { createElement, type ReactNode } from "react";
import * as axeMatchers from "vitest-axe/matchers";
import { nav } from "./src/ui/testing/mocks";

expect.extend(axeMatchers);

// Routing stand-ins: tests steer `nav.pathname` and inspect `nav.push` / `nav.replace`.
vi.mock("next/navigation", () => ({
  usePathname: () => nav.pathname,
  useRouter: () => ({ push: nav.push, replace: nav.replace, back: vi.fn(), prefetch: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode } & Record<string, unknown>) =>
    createElement("a", { href, ...rest }, children),
}));

// jsdom gaps that real browsers fill in.
beforeEach(() => {
  nav.pathname = "/";
  nav.push.mockClear();
  nav.replace.mockClear();
  window.localStorage.clear();
  document.documentElement.removeAttribute("style");
  for (const a of ["theme", "contrast", "motion", "bold", "buttons", "spacing"]) delete document.documentElement.dataset[a];

  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;

  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute("open");
    };
  }
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
