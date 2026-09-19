import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiResponseError } from "@pipelex/sdk";

const resolveStorageUrl = vi.fn();

vi.mock("@/lib/pipelexClient", () => ({
  getPipelexClient: () => ({ resolveStorageUrl }),
}));

import { resolveShareUrl } from "./shareUrl";

beforeEach(() => resolveStorageUrl.mockReset());

describe("resolveShareUrl", () => {
  it("mints a presigned link for a storage reference through the SDK", async () => {
    resolveStorageUrl.mockResolvedValueOnce({
      url: "https://bucket.example/x.png?X-Amz-Signature=abc",
      expires_at: "2026-09-19T20:00:00Z",
      content_type: "image/png",
    });

    await expect(resolveShareUrl("pipelex-storage://org/x.png")).resolves.toBe(
      "https://bucket.example/x.png?X-Amz-Signature=abc",
    );
    expect(resolveStorageUrl).toHaveBeenCalledWith({ uri: "pipelex-storage://org/x.png" });
  });

  it("answers undefined, without a request, for anything that is not a storage reference", async () => {
    await expect(resolveShareUrl("https://elsewhere.example/x.png")).resolves.toBeUndefined();
    await expect(resolveShareUrl("/api/assets/org/x.png")).resolves.toBeUndefined();
    // A Server Action is a public endpoint: the argument is not trusted to be a string.
    await expect(resolveShareUrl(42 as unknown as string)).resolves.toBeUndefined();
    expect(resolveStorageUrl).not.toHaveBeenCalled();
  });

  it("answers undefined rather than throwing when the mint fails — the kernel then copies the display URL", async () => {
    resolveStorageUrl.mockRejectedValueOnce(
      new ApiResponseError(
        "forbidden",
        "https://api.test",
        403,
        "Forbidden",
        "",
        undefined,
        undefined,
        undefined,
        undefined,
      ),
    );
    await expect(resolveShareUrl("pipelex-storage://org/x.png")).resolves.toBeUndefined();
  });
});
