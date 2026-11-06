import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom lacks ResizeObserver, used by Radix primitives (e.g. Checkbox inside a <form>).
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;

afterEach(() => {
  cleanup();
});
