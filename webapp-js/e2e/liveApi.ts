import { test } from "@playwright/test";

/**
 * Guard for a live-API e2e spec — one that runs a method end to end.
 *
 * Such a spec hits the real Pipelex API: it costs an LLM call and needs
 * PIPELEX_API_KEY. When the key is absent (e.g. a fresh clone that hasn't
 * configured credentials) the suite skips cleanly instead of failing with a
 * confusing auth error. `playwright.config.ts` loads `.env.local`, so a key set
 * there is visible here. Call it at the top of the spec file.
 *
 * The offline page spec (home.spec.ts) is deliberately NOT guarded — it needs
 * no key and runs out of the box.
 */
export function requireLiveApi() {
  test.beforeEach(() => {
    test.skip(
      !process.env.PIPELEX_API_KEY,
      "Live-API e2e: set PIPELEX_API_KEY in .env.local to run.",
    );
  });
}
