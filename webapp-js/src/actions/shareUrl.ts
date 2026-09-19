"use server";

import { getPipelexClient } from "@/lib/pipelexClient";
import { isStorageUri } from "@/lib/storageAsset";

/**
 * Mint a URL for a stored asset that works OUTSIDE this app — pasted into
 * another tab, another app, a colleague's message.
 *
 * The form kernel's `resolveShareUrl` seam, and the async twin of `assetPath`:
 * the display URL is a path on this origin, which is what keeps the credential
 * off the page and lets a picture outlive the store's signature — and which is
 * useless on a clipboard, since whoever pastes it reaches a server that may
 * not be running and a route that serves everyone the same key. So the copy
 * control asks for a URL that carries its own credential: a presigned link,
 * minted per click through the SDK's `resolveStorageUrl` rather than held,
 * because it starts expiring the moment it exists.
 *
 * A Server Action, so the key stays with `getPipelexClient()`. Anything that
 * is not a storage reference, and any failure to mint, answers `undefined`,
 * which is the kernel's contract for "fall back to the display URL" — a thrown
 * error would reach the copy control as a rejected promise it does not catch.
 */
export async function resolveShareUrl(uri: string): Promise<string | undefined> {
  if (!isStorageUri(uri)) return undefined;
  try {
    const { url } = await getPipelexClient().resolveStorageUrl({ uri });
    return typeof url === "string" && url !== "" ? url : undefined;
  } catch {
    return undefined;
  }
}
