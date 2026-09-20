import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ResultEnv } from "./ResultEnv";
import { RunResult } from "./RunResult";
import { requireResultField } from "@/lib/resultField";
import { requireContract } from "@/lib/runInputs";
import { OUTPUT_FORM, PIPE_IO_CONTRACTS } from "@/test/fixtures/contracts/generate-image";

const resolveShareUrl = vi.fn();
vi.mock("@/actions/shareUrl", () => ({
  resolveShareUrl: (uri: string) => resolveShareUrl(uri),
}));

const CONTRACT = requireContract(PIPE_IO_CONTRACTS, "generate_image", "generate_image");
const FIELD = requireResultField(OUTPUT_FORM, CONTRACT, "generate_image", "generate_image");

const STORAGE_URI = "pipelex-storage://org_1/runs/01J/outputs/illustration.png";
const SIGNED_URL = "https://bucket.s3.amazonaws.com/illustration.png?X-Amz-Signature=expiring";

// What the hosted runtime returns for a `native.Image`: the durable reference
// in `url`, and the store's signed link in `public_url`.
const IMAGE = { url: STORAGE_URI, public_url: SIGNED_URL, mime_type: "image/png" };

beforeEach(() => resolveShareUrl.mockReset());

describe("ResultEnv", () => {
  it("paints a stored image through the assets route rather than the signed link", () => {
    const { container } = render(
      <ResultEnv>
        <RunResult field={FIELD} value={IMAGE} name="generate_image" />
      </ResultEnv>,
    );

    // A rendered file is always an `<img>`; the kernel's icons are `<svg>`.
    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img).toHaveAttribute("src", "/api/assets/org_1/runs/01J/outputs/illustration.png");
    // The signed link — the credential — is nowhere in the page.
    expect(container.innerHTML).not.toContain("X-Amz-Signature");
  });

  it("is what makes the difference: without it the kernel falls back to the signed link", () => {
    const { container } = render(<RunResult field={FIELD} value={IMAGE} name="generate_image" />);
    expect(container.querySelector("img")).toHaveAttribute("src", SIGNED_URL);
  });

  it("leaves a payload that carries no storage reference to the kernel's own reading", () => {
    const { container } = render(
      <ResultEnv>
        <RunResult
          field={FIELD}
          value={{ url: "https://cdn.example/picture.png" }}
          name="generate_image"
        />
      </ResultEnv>,
    );
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "https://cdn.example/picture.png",
    );
  });

  it("hands the copy-URL control the storage reference to mint a share link from", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
    resolveShareUrl.mockResolvedValueOnce("https://bucket.example/fresh?sig=1");

    render(
      <ResultEnv>
        <RunResult field={FIELD} value={IMAGE} name="generate_image" />
      </ResultEnv>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Copy the URL" }));

    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("https://bucket.example/fresh?sig=1"),
    );
    expect(resolveShareUrl).toHaveBeenCalledWith(STORAGE_URI);
  });
});
