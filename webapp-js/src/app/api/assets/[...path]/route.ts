import {
  ApiResponseError,
  ApiUnreachableError,
  ArtifactFetchError,
  artifactFilename,
} from "@pipelex/sdk";
import { buildAssetHeaders } from "@/lib/assetHeaders";
import { getPipelexClient } from "@/lib/pipelexClient";
import { allowPlainHttpArtifacts } from "@/lib/serverEnv";
import { storageUriFromSegments } from "@/lib/storageAsset";

/**
 * `GET /api/assets/{...storage path}` — stream a stored asset from this app's
 * own origin.
 *
 * The browser addresses an object by its `pipelex-storage://` path, built by
 * `assetPath` (`src/lib/storageAsset.ts`), and this handler turns it back into
 * the reference, hands it to the SDK's `fetchArtifact` — which mints a fresh
 * presigned link through the API key and returns the store's response as a
 * bounded stream: timed out, redirects refused, the byte cap enforced
 * mid-stream, no credential forwarded — and pipes the bytes back under the
 * headers `buildAssetHeaders` owns. The presigned link never reaches the
 * client, and the key never leaves `getPipelexClient()`.
 *
 * Deliberately NOT a redirect to the store: a 3xx would put the presigned link
 * back in the browser, which is the problem the route exists to remove.
 *
 * Deliberately NOT an arbitrary-URL proxy: the only input is a storage path, so
 * the route can never be pointed at a host of the caller's choosing — the
 * classic open-proxy shape of an "image proxy" endpoint.
 *
 * The body is streamed, never buffered: a run's outputs include multi-megabyte
 * PDFs and images.
 *
 * Errors are HTTP errors, because the consumer is an `<img>` or an `<object>`
 * that needs a non-2xx to fall back: a malformed path is `400`, a reference the
 * key cannot see or that names nothing is `404` for both — the route must not
 * be usable to probe for objects — and everything that failed on this side of
 * the store or inside it is `502`. The JSON body names the reason for whoever
 * opens the path by hand.
 */

interface RouteContext {
  params: Promise<{ path: string[] }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return serveAsset(request, context, "GET");
}

/**
 * `<object data>` PDF viewers and media elements probe with HEAD before they
 * fetch, and a 405 makes them fall back to their error state.
 */
export async function HEAD(request: Request, context: RouteContext): Promise<Response> {
  return serveAsset(request, context, "HEAD");
}

async function serveAsset(
  request: Request,
  context: RouteContext,
  method: "GET" | "HEAD",
): Promise<Response> {
  const { path } = await context.params;
  const uri = storageUriFromSegments(path);
  if (uri === undefined) {
    return refusal(400, "invalid_asset_path", "The path is not a stored asset's path.");
  }

  let upstream: Response;
  try {
    upstream = await getPipelexClient().fetchArtifact(uri, {
      signal: request.signal,
      allowHttp: allowPlainHttpArtifacts(),
    });
  } catch (err) {
    return refusalFor(err);
  }

  const headers = buildAssetHeaders(upstream.headers, {
    filename: artifactFilename(uri, upstream.headers.get("content-type"), 0),
  });

  if (method === "HEAD") {
    await upstream.body?.cancel();
    return new Response(null, { status: upstream.status, headers });
  }
  return new Response(upstream.body, { status: upstream.status, headers });
}

/**
 * The reference's own refusals — the resolve route's per-reference verdicts
 * (`invalid_storage_uri`, `forbidden`), a store that has no such object, and a
 * store refusing a freshly minted signature — all answer `404`, so a `403`
 * cannot be told from a `404` from outside. Everything else the fetch boundary
 * reports is this side's failure to reach the bytes.
 */
const NOT_FOUND_CODES = new Set(["invalid_storage_uri", "forbidden", "not_found", "store_refused"]);

function refusalFor(err: unknown): Response {
  if (err instanceof ArtifactFetchError) {
    if (NOT_FOUND_CODES.has(err.code)) {
      return refusal(404, "asset_not_found", "No stored asset at this path.");
    }
    return refusal(
      502,
      "asset_unavailable",
      `The stored asset could not be fetched (${err.code}).`,
    );
  }
  if (err instanceof ApiResponseError) {
    // The resolve route refused the whole request: the key, the route's
    // absence on this deployment, or a malformed request — a server-side
    // configuration problem, never the caller's. A 404 is the one worth
    // naming: `fetchArtifact` mints its link through the platform's bulk
    // resolve route, and a deployment that does not serve it cannot serve
    // this route either, whatever the single-reference route says.
    return refusal(
      502,
      "resolve_failed",
      err.status === 404
        ? "The configured Pipelex API does not serve POST /v1/resolve-storage-url/bulk, which the assets route needs to resolve a stored asset."
        : `The Pipelex API refused to resolve the asset (HTTP ${err.status}).`,
    );
  }
  if (err instanceof ApiUnreachableError) {
    return refusal(502, "api_unreachable", "The Pipelex API could not be reached.");
  }
  return refusal(502, "asset_unavailable", "The stored asset could not be fetched.");
}

function refusal(status: number, code: string, message: string): Response {
  return Response.json(
    { error: { code, message } },
    {
      status,
      headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
    },
  );
}
