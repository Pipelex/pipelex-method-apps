# pipelex-method-webapp-js

A Next.js 16 app that runs MTHDS methods through the [Pipelex](https://pipelex.com) API with [`@pipelex/sdk`](https://www.npmjs.com/package/@pipelex/sdk), rendering each method's input form and result view from its own contract.

This directory is a **template**. It is the `webapp-js/` member of the `pipelex-method-apps` mono-repo, and it ships the run chrome and the codegen kit and no method at all: `make create` turns a copy of it into the app for one method — scaffolding the method and naming the project after it — and a project adds more methods with `make add-method`. Keep the template small, generic and high-quality, and when adding anything ask whether every project created from it should inherit it. A worked demonstration of a method belongs in the gallery this template was extracted from, `pipelex-starter-js`, never here; [`docs/chrome-lineage.md`](docs/chrome-lineage.md) records that extraction and the rule that came out of it — **this template leads the run chrome**, so a fix to a file it carries lands here first and is filed as a twin task against the gallery, which nothing ports for you. The bootstrap rewrites this file by exact match, so three things stay as they are: the description line under the H1 is byte-identical to `CLAUDE_DESCRIPTION` in `.claude/skills/bootstrap/scripts/bootstrap.mjs`, this paragraph opens with the sentence the script looks for and ends at the first blank line, and the template's name appears only in the H1; `bootstrap.test.mjs` checks all three.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI**: React 19, TypeScript 5 (strict mode)
- **Styling**: Tailwind CSS 4 (minimal, no design system — keep classes inline and obvious), configured entirely in `src/app/globals.css`; plus the form kernel's shadcn semantic tokens, which the kernel's controls require and which v4 asks for as an `@theme inline` block
- **Testing**: Vitest 4 + Testing Library (happy-dom) for unit; Playwright for e2e
- **Linting**: ESLint 9 (flat config via `eslint-config-next`)
- **Formatting**: Prettier 3
- **Git hooks**: Husky + lint-staged
- **SDK**: [`@pipelex/sdk`](https://www.npmjs.com/package/@pipelex/sdk) (`PipelexApiClient`)
- **Forms**: [`@pipelex/mthds-form`](https://www.npmjs.com/package/@pipelex/mthds-form) — the headless kernel (`.`) plus its React control set (`./react`). Every method input is rendered from the method's own contract

## Project Structure

The template as shipped, then what `make add-method` adds for each method.

```
methods/
  README.md                   # one directory per method; the template ships none
scripts/                      # native-Node TypeScript (node --experimental-strip-types)
  codegen.mts                 # npm run codegen — CLI entry, one line over lib/generate
  codegen-check.mts           # npm run codegen:check — CLI entry over lib/check
  codegen-verify.mts          # npm run codegen:verify — CLI entry over lib/verify
  add-method.mts              # npm run add-method — CLI entry over lib/add-method
  lib/                        # the behavior, importable so it can be tested
    generate.mts              # runGenerate + generateMethod (= fetchGenerated + writeGenerated)
    check.mts                 # runCheck + checkMethod + summarizeVerdicts — the offline gate
    verify.mts                # runVerify — the keyed semantic gate
    shared.mts                # paths, tree walk, sha256, MethodSource, readManifest, sources.json
    api.mts                   # assertSelectorSupport + explainSelectorFailure — the network half
    add-method.mts            # planAddMethod + writeAddMethod — the scaffold, over generate.mts's two halves
    *.test.mts                # vitest over the lib (vitest's glob matches .mts)
    scaffold-tree.test.mts    # the scaffold's proof: a slice per source kind, compiled and checked in a copy
    fixtures/                 # recorded API responses, and the bundle the scaffold tests copy in
src/
  site.ts                     # SITE — the app's title and description, as string literals
  methods.ts                  # METHODS — the registry, with the two add-method anchors
  config.ts                   # ExecutionMode + DEFAULT_EXECUTION_MODE (client-safe)
  app/                        # Next.js App Router (layout, page, globals.css)
    api/assets/[...path]/route.ts  # GET/HEAD — streams a stored asset through the SDK's fetchArtifact (server)
  actions/
    shareUrl.ts               # "use server" — resolveShareUrl: a presigned link per click, for the copy-URL control
  lib/
    pipelexClient.ts          # PipelexApiClient singleton factory
    loadBundle.ts             # loadMethodBundles(name) — every .mthds file under methods/<name>/
    blockingRun.ts            # executeBlockingRun — the blocking `execute` path (server)
    durableRun.ts             # startDurableRun + pollDurableRun — the durable start/poll path (server)
    wireOutput.ts             # wireOutput + wireListOutput (plural) + describeSchemaFailure (pure; `import "server-only"` build-enforces the boundary)
    errors.ts                 # classifyPipelineError + classifyTransportError + PipelineError model
    serverEnv.ts              # readClassifyEnv + allowPlainHttpArtifacts — the process.env reads (server)
    runInputs.ts              # requireContract + requireInputForm + gateRunInputs — the server-side input gate (pure)
    resultField.ts            # requireResultField — the output descriptor + payload schema → one RunField (pure)
    resultUrls.ts             # scrubResultUrls — the result's URL policy, the output twin of fileEncoding's gate (pure)
    fileEncoding.ts           # checkFileInputs — the file scheme + MIME + size gate (pure)
    usageReport.ts            # buildUsageReport — the SDK's summarizeUsage, projected for the cost panel (pure)
    storageAsset.ts           # assetPath + storageUriFromSegments — pipelex-storage:// ⇄ /api/assets/… (pure, client-safe)
    assetHeaders.ts           # buildAssetHeaders — the assets route's three header rules (pure)
    clientFile.ts             # browser File → base64 data URL (client)
  hooks/
    useRun.ts                 # unified blocking|durable state machine (client)
    useRunInputs.ts           # form values + derived fields + readiness + wire shape (client)
    useFileInputs.ts          # drop → encode → write-back the FileValue; the kernel's file seam (client)
  components/
    MethodPage.tsx            # client component — empty state, one method, or tabs over METHODS
    RunInputsForm.tsx         # client component — the one kernel composition (FieldRenderer per field)
    ModeToggle.tsx            # client component — Blocking|Durable segmented control
    RunStatus.tsx             # live-status card (spinner + status label + elapsed)
    RunResult.tsx             # client component — the one kernel composition on the output side
    ResultEnv.tsx             # client component — the kernel's ResultEnvProvider with this app's resolvers, mounted in the layout
    CostReport.tsx            # per-run token usage + cost breakdown
    ErrorDisplay.tsx          # server component (renders classified PipelineError)
  types/
    pipelineError.ts          # BadPipelineOutputError (tagged)
  test/fixtures/contracts/    # recorded codegen output the shared code's tests run against
e2e/
  home.spec.ts                # offline — the page renders its title and either the empty state or a form
  liveApi.ts                  # requireLiveApi() — the key guard every live spec calls
  # template-only:begin
  resultTile.spec.ts          # LIVE — creates an app for an image method, runs it, pins the tile, the assets route's headers and the cost label
  fixtures/generate-image/    # the bundle that spec scaffolds
  # template-only:end
```

For a method named `<name>` (kebab-case; `<Pascal>` and `<camel>` are the same name in those cases), `make add-method` writes:

```
methods/<name>/                            # the bundle's .mthds files, copied in (or already there) —
  method.json                              #   or, for a method that lives elsewhere, the selector
src/generated/<name>/                      # COMMITTED and GENERATED — never hand-edit (see "Generated types")
  types.ts                                 # zod schemas + z.infer types, stamped
  binder.ts                                # parseXxx / serializeXxx over those schemas, stamped
  contracts.ts                             # PIPE_IO_CONTRACTS + INPUT_FORM + OUTPUT_FORM (unstamped)
  codegen.lock                             # pipelex trust-chain lock, written verbatim
  sources.json                             # app-owned sidecar — SHA-256 of each source + derived
src/types/<camel>Pipeline.ts               # the adapter: parse<Pascal>Output(RunResults)
src/actions/run<Pascal>Pipeline.ts         # "use server" — run<Pascal>Blocking + start<Pascal>Run + poll<Pascal>Run
src/actions/run<Pascal>Pipeline.test.ts    # one fixture-free test of the trust boundary
src/components/<Pascal>Form.tsx            # client component — the composition, no method-specific markup
src/methods.ts                             # + one import and one METHODS entry, at the anchors
```

The slice is the same for every source kind; only `methods/<name>/` and the way the action names its method differ (see "Adding a method" below).

### What lives where

- **`methods/`** — one directory per method, saying where that method lives: `.mthds` bundles (TOML) for a method authored here, or a `method.json` manifest naming one that lives on the platform or in a published package. Treat bundles as first-class artifacts, not embedded strings. Use the `/mthds-build`, `/mthds-edit`, `/mthds-check`, `/mthds-run` skills from the `mthds-plugins` marketplace to author and validate them.
- **`src/site.ts`** — the app's title and description. The page heading, the browser title and the meta description all read them, and the bootstrap rewrites them as string literals, so a title never lands in JSX text.
- **`src/methods.ts`** — the registry `<MethodPage>` renders: no entry is the empty state, one entry is the method's form as the whole page, several are tabs. The two `add-method:` anchor comments are a contract (see Gotchas).
- **`src/actions/`** — Server Actions (`"use server"`): one file per method once methods exist, plus `shareUrl.ts`, the template's own — `resolveShareUrl`, the presigned link the result view's copy-URL control mints per click through the SDK's `resolveStorageUrl`. With the `src/lib/` helpers and the assets route, the only places that call the Pipelex SDK. Each method exports a **trio**: `run<Name>Blocking` (the blocking `execute` path), `start<Name>Run` + `poll<Name>Run` (the durable start/poll path). They are thin: gate → build options → delegate to `executeBlockingRun` / `startDurableRun` / `pollDurableRun`.
- **`src/lib/`** — Server-side utilities. No React. `runInputs.ts` is pure (kernel core only, no `process.env`, no Node built-ins) so both sides import it — that shared import is the point. The two execution helpers `blockingRun.ts` and `durableRun.ts` are server-only (they construct the SDK client and read `process.env` through `serverEnv.ts`'s shared `readClassifyEnv`, so the two paths can't drift on classification env); `wireOutput.ts` is pure (it reads `main_stuff` — the generated schema does the shape-checking) and carries `import "server-only"`, so a `"use client"` import of a narrower fails the Next build instead of shipping zod plus every generated schema to the browser (vitest aliases the package to `vitest.server-only-stub.ts` so unit tests keep passing). Deliberate client-touching exceptions: `errors.ts` (its types cross the server→client boundary, and `classifyTransportError` + `buildClientTimeoutError` run client-side), and `clientFile.ts` (a browser `FileReader` wrapper imported only by client components). `fileEncoding.ts` and `resultUrls.ts` are pure (no React, no `process.env`) so they are safe to import from either side — `resultUrls.ts` is the output twin of `fileEncoding.ts`'s scheme gate and is imported by `<RunResult>`. `storageAsset.ts` is pure and client-safe too: `assetPath`, the kernel's synchronous `resolveUrl`, rewrites a `pipelex-storage://` reference onto `/api/assets/…`, and `storageUriFromSegments` is the route handler's inverse, so the two halves of that contract share one module. `assetHeaders.ts` is the pure half of the route — the three header rules a same-origin asset response needs, over the store's headers as `fetchArtifact` hands them on. Because `errors.ts` is bundled into the client, it imports the SDK error classes from **`@pipelex/sdk`**. That barrel is client-safe — `PipelexApiClient` is fetch-based and pulls no `node:fs` into the graph — so a client bundler handles it without breaking `make build`. Only `pipelexClient.ts` (server-only) constructs `PipelexApiClient`. The forms import `blockingRun`/`durableRun` **types only** (`import type`), so no server code leaks into the client bundle. Both helpers take a `() => Promise<PipelexStartOptions>`, not the pure-protocol `StartOptions`: the run selectors `method_ref` / `method_id` live on the SDK's Pipelex run extensions, which is what lets an action name a method that is not shipped as a bundle.
- **`src/hooks/`** — `useRun<TInput,TOutput>`, the unified client state machine (`idle → running → done|error`) that dispatches blocking vs durable by `mode`. Holds the durable poll loop, the staleness token, the elapsed ticker, the wall-clock ceiling, the `classifyTransportError` wrapping, and the **transient-failure budget** (a momentary 5xx/network blip on one poll tick — flagged `transient` by `pollDurableRun` — or a rejected poll await is retried up to `MAX_TRANSIENT_POLL_FAILURES`, surfacing `health: "retrying"` meanwhile, rather than abandoning a run that's still completing server-side). The running state's `health` field (`RunHealth | null`) names _why_ the poll loop is in a resilient state so `<RunStatus>` can show reassuring, cause-specific copy instead of one alarming "degraded" note: `"reconnecting"` when the **server** reported `degraded` (its status endpoint served a last-known DB status because Temporal was unreachable), `"retrying"` for a **client-side** poll blip, `null` when polling cleanly. A durable `start` that returns `lifecycle_unavailable` (the configured URL doesn't serve the durable run lifecycle) surfaces as an explicit error — `useRun` never silently downgrades durable to blocking. Forms never branch on mode — they just call `run(input)`. `useFileInputs` is the file seam — drop, size early-exit, encode through `fileToDataUrl`, write the `FileValue` back at the field's dotted path, and hold the id in the set the kernel reads as `uploadingIds` meanwhile — so a form with a file input composes it rather than restating it.
- **`src/components/`** — React components. `"use client"` only when the component uses hooks, event handlers, or browser APIs (`ModeToggle` does; `RunStatus` is a pure render). `RunResult` is the one kernel composition on the output side — `RunInputsForm`'s twin — and every method's form renders it: the kernel's `<StuffViewer>` under the same `presentation="app"` the form uses, inside a labelled `<section>` so the result is a region a screen reader can name and jump to. There is no per-output-shape component, and that is the point: a result view stops being a design decision the app has to take once the method's own declaration of what it produces is a committed artifact. `ResultEnv` is the kernel's `ResultEnvProvider` carrying this app's two resolvers, mounted once in the root layout — display through `assetPath`, sharing through `resolveShareUrl` — so every file arm in every result view paints a stored reference through the assets route.
- **`src/types/`** — the **adapter layer over `src/generated/`**, not a place where shapes are declared. Each `parseXxx(results: RunResults)` hands `wireOutput(results)` to the binder generated from that method's own contract, and translates a thrown `ZodError` into the app's tagged error model; the type itself is re-exported from the generated `types.ts`. Hand-written validation belongs here only where it adds semantics the concept does not declare. Narrowers throw on mismatch; that's deliberate (system boundary).
- **`src/test/fixtures/contracts/`** — recorded `contracts.ts` files, real codegen output for methods this app does not ship, so the shared code's tests (`runInputs`, `resultField`, `resultUrls`, `RunResult`, `ResultEnv`) run against the shapes a real method produces. They are test data, never imported by app code.

## Generated types (`src/generated/`)

**The output shapes are projected from the method, not hand-written.** `npm run codegen` sends every method under `methods/` to `POST /v1/codegen` and writes back, byte-for-byte, a `types.ts` (zod schemas plus their `z.infer` types), a `binder.ts` (`parseXxx` / `serializeXxx` over those schemas), and a `codegen.lock`. The narrowers in `src/types/` are thin adapters over those binders, so a method and its TypeScript cannot drift apart. The same run also asks `POST /v1/validate` for the method's IO contracts and **both** of its wire form descriptors (`views: ["input_form", "output_form"]`) and writes all three into a `contracts.ts` — the two halves of the same idea. On the way in, the forms derive their fields from `INPUT_FORM` (co-walking the contract) and the run gate validates against the contract; on the way out, `OUTPUT_FORM` says what the result IS and the contract's `output.json_schema` names the property its payload sits under, and the kernel's `buildResultField` pairs them into the one field the result view renders (see [`docs/input-form.md`](docs/input-form.md)). Design rationale and the decisions behind it: [`docs/codegen.md`](docs/codegen.md).

| Command                                          | Needs a key?                                   | When                                           |
| ------------------------------------------------ | ---------------------------------------------- | ---------------------------------------------- |
| `npm run codegen` / `make codegen`               | Yes, plus a base URL that serves `/v1/codegen` | After editing any method source                |
| `npm run codegen:check` / `make codegen-check`   | No — pure hashing, fully offline               | Every `make check`, so every `make all`        |
| `npm run codegen:verify` / `make codegen-verify` | Yes                                            | Before a release, or after touching `methods/` |

**Two source kinds.** A method directory says where its method lives, and there are two answers: `.mthds` files (the bundle is here) or a `method.json` manifest carrying exactly one selector — `method_ref` (a published package address) or `method_id` (a method in the key's org catalog). Never both in one directory; that is refused. `discoverMethods` returns a `MethodSource` discriminated on `kind`, with `name` and `sourceHashes` common, so every kind-blind gate reads those two: `sources.json` hashes the manifest the way it hashes a bundle, orphan detection is the same for both, and `npm run codegen` regenerates both kinds in one pass. Two consequences to hold on to: **a `method_id` slice regenerates only with a key of the same organization**; and a selector is resolved server-side, so the three keyed scripts ask `GET /v1/version` once and refuse when `extensions` lacks the kind, naming the base URL rather than surfacing a bare `403`. [`docs/add-method.md`](docs/add-method.md) is the reference for the scaffold that writes either kind and the app files around it.

**An app with no method is current.** With no `methods/` directory, or one holding no method, and no tree under `src/generated/`, `codegen:check` reports that there is nothing to check and exits `0`, which is what keeps `make all` green on the template as shipped. A tree left behind after its method was removed is still an orphan, and still fails.

The rules below are each load-bearing — breaking one produces a wrong verdict rather than an error:

- **Never hand-edit anything under `src/generated/`.** Artifacts are written verbatim and each carries a stamp hashing its own body, so any edit — a reformat included — makes `codegen:check` report `hand-edited` and fails `make check`. To customize a generated type, wrap it rather than edit it: `src/types/` is that wrapper layer.
- **`src/generated/` is excluded from Prettier and ESLint on purpose** (`.prettierignore`, `eslint.config.mjs`, plus `--no-warn-ignored` on lint-staged's ESLint entry). The emitter targets Prettier's defaults (80 columns); this repo prints at 100, so `prettier --write` would rejoin its lines and break every stamp. Do not "fix" that exclusion. `tsc` still covers the trees in full — they live under `src/` — and that is the check that matters.
- **Two staleness gates, because they answer different questions.** `codegen:check` proves each tree still matches its own lock, and compares `sources.json` (the SHA-256 of every source file) against the sources on disk — that is what catches "edited a method, forgot to regenerate". It cannot know whether the _engine_ would produce something different today; `codegen:verify` asks the server exactly that, comparing live `crate_fingerprint`s against the committed locks and writing nothing.
- **Exit codes are a contract**: `0` current, `1` drift or stale sources, `2` no verdict (a missing or malformed lock). `make check` fails on `1` and `2` alike.
- **An engine bump rewrites every artifact.** `engine_version` rides in the stamp, so an upstream pipelex release restamps the whole tree with zero semantic change (`crate_fingerprint` is the semantic signal, and it stays put). A whole-tree diff after such a release is correct behaviour, not drift — which is why `codegen:verify` reports an engine difference as a **note**, not a failure, leaving the restamp to a deliberate commit.
- **Regeneration currently wants `PIPELEX_BASE_URL=https://api-dev.pipelex.com`.** `api.pipelex.com` does not yet return `/v1/validate`'s `input_form` and `output_form` views, both of which codegen needs for **every** method, and does not advertise `method_ref`, which a package-sourced manifest needs. Both scripts name the missing capability rather than failing obscurely. `codegen:check` needs no server at all, so `make all` stays green offline regardless.
- **Field names stay wire-native snake_case, deliberately** — `doc_type`, `key_points`, `public_url`, `mime_type` travel unchanged from the method to the components. Do **not** add a camelCase mapping layer: a hand-maintained mirror of a generated shape is precisely the duplicated surface this removes.
- **`contracts.ts` is the one artifact the lock does not sign, and that is deliberate.** The SDK's orphan rule is "a _stamped_ file the lock does not track", and the writer deletes orphans — so a stamped `contracts.ts` would silently vanish on every regeneration. Its SHA-256 lives instead in `sources.json`'s `derived` map, written by the generator from the content it wrote and compared by `codegen:check`; `codegen:verify` re-fetches `/v1/validate` and compares the rendered bytes. It is still never hand-edited.
- **The `views` opt-in is declared once, as `VALIDATE_VIEWS` in `scripts/lib/shared.mts`.** `generate.mts` writes the bytes and `verify.mts` re-renders a live response to compare against them, so one script asking for a view the other does not would read as drift on a tree nobody touched. A view token is lenient-ignored by an API too old to serve it, so both scripts refuse on the absent payload instead — naming which view was missing, because a `contracts.ts` without `input_form` renders an empty form and one without `output_form` renders an empty result.

## Pipelex Integration Pattern

**Two execution modes, one hook.** Every method runs in either mode, chosen per method at runtime via a `<ModeToggle>`:

- **Blocking** (`client.execute`) — one synchronous request. Simple, but behind the hosted gateway it is cut off at ~30s, so long pipelines surface a classified `execute_timeout` error.
- **Durable** (`client.start` then poll) — survives the ~30s cap and streams coarse live status. Hosted-safe everywhere; the default (`NEXT_PUBLIC_EXECUTION_MODE`, defaults `"durable"`). When the configured URL doesn't serve the run lifecycle it surfaces an explicit `lifecycle_unavailable` error (naming the endpoint URL, steering to `PIPELEX_BASE_URL`) — no silent downgrade.

The forms are **mode-agnostic** — they call `useRun({ mode, blocking, start, poll })` and render by `state.phase`. Only the unified hook knows which Server Actions to call.

**Nothing about a method's IO is written by hand — neither the form nor the result view.** The two halves are the same idea applied to the two sides of one contract, and both are rendered by the `@pipelex/mthds-form` kernel from what `npm run codegen` committed.

**On the way out:** `requireResultField(OUTPUT_FORM, CONTRACT, …)` (`src/lib/resultField.ts`) pairs the pipe's output-form descriptor with the payload schema on its contract into one `RunField`, built at module level beside `CONTRACT` and `DESCRIPTOR`, and `<RunResult field value name>` renders it. The two artifacts answer different questions and neither is sufficient alone — the descriptor says what the result IS (its kind, its nesting, whether it is plural), the schema names the property the payload sits under — and a renderer holding one but not the other is back to inferring the other from the value. The `name` is app chrome, like the method's label: the descriptor's own name is the engine's `output` for every pipe, so only the caller knows what the reader is looking at.

**On the way in:** each form renders its inputs from the method's committed wire descriptor and contract through the same kernel — `useRunInputs(CONTRACT, DESCRIPTOR)` for values/readiness/wire shape (`DESCRIPTOR` from `requireInputForm(INPUT_FORM, …)`, `requireContract`'s twin), `<RunInputsForm>` for the controls — and the Server Action gates the contract with `gateRunInputs` (`src/lib/runInputs.ts`), which is the trust boundary and deliberately never needs the descriptor. Both sides take their rules from the one kernel, so no per-input guard sits on either side; the two calls differ deliberately, and **the server's must stay a strict superset of the browser's**. That superset is the kernel's own `gateRunInputs` — it validates shapes, re-applies readiness's own functions over the same derived fields, and builds the wire envelope — and `src/lib/runInputs.ts` is a thin shim that renders its refusal as a `bad_request` `PipelineError`. Do not re-assemble the gate from the kernel's lower-level steps: the emptiness step is where assemblies go wrong (`inputMustBeFilled` + `isFilled` is the trap — it agrees on every native concept and diverges on a structured one). The invariant is pinned by a test that runs both sides over one table (`src/lib/runInputs.test.ts`), not by a comment. Full reference: [`docs/input-form.md`](docs/input-form.md).

This is the trio `make add-method` writes for a method with no file input, abridged. Every name in it is derived from the method's own — a method called `text-stats` here, standing in for yours — so read `TextStats` as your method's PascalCase and `text_stats` as its domain:

```ts
// src/actions/runTextStatsPipeline.ts
"use server";
import MANIFEST from "@methods/text-stats/method.json";
import { PIPE_IO_CONTRACTS } from "@/generated/text-stats/contracts";
import { parseTextStatsOutput, type TextStatsOutput } from "@/types/textStatsPipeline";
import { executeBlockingRun, type BlockingOutcome } from "@/lib/blockingRun";
import {
  pollDurableRun,
  startDurableRun,
  type PollOutcome,
  type StartOutcome,
} from "@/lib/durableRun";
import { gateRunInputs, requireContract } from "@/lib/runInputs";
import type { PipelexStartOptions } from "@pipelex/sdk";

// The selector is read from the manifest, never copied: editing `method.json` and
// running `npm run codegen` moves the run together with the generated tree.
const METHOD_REF = MANIFEST.method_ref;
const PIPE_CODE = "analyze_text";

// The same generated contract the browser rendered the form from.
const CONTRACT = requireContract(PIPE_IO_CONTRACTS, "text_stats", PIPE_CODE);

// `execute` and `start` take the same options, so one closure drives both.
async function buildOptions(inputs: Record<string, unknown>): Promise<PipelexStartOptions> {
  return { method_ref: METHOD_REF, pipe_code: PIPE_CODE, inputs };
}

// The argument is the schema-shaped data dict, not a hand-typed `text: string`.
export async function runTextStatsBlocking(
  data: Record<string, unknown>,
): Promise<BlockingOutcome<TextStatsOutput>> {
  const gated = gateRunInputs(CONTRACT, data); // a bad_request PipelineError, or the wire inputs
  if (!gated.ok) return gated;
  return executeBlockingRun(() => buildOptions(gated.inputs), parseTextStatsOutput);
}
export async function startTextStatsRun(data: Record<string, unknown>): Promise<StartOutcome> {
  const gated = gateRunInputs(CONTRACT, data);
  if (!gated.ok) return gated;
  return startDurableRun(() => buildOptions(gated.inputs));
}
export async function pollTextStatsRun(runId: string): Promise<PollOutcome<TextStatsOutput>> {
  return pollDurableRun(runId, parseTextStatsOutput);
}
```

A method whose bundle is in this repo declares `const METHOD_DIR = "<name>";` in place of the manifest import and passes `mthds_contents: await loadMethodBundles(METHOD_DIR)` in place of the selector; `loadMethodBundles` (`src/lib/loadBundle.ts`) reads every `.mthds` file under `methods/<name>/`, in path order. With a file input, `buildOptions` reads the bundle once and hands the same strings to `prepareInputs` (`files: bundles.map((content) => ({ content }))`) and to the run.

The shared helpers in `src/lib/` own the SDK call + `classifyPipelineError` (server-side, where the SDK error classes still `instanceof`-match): `executeBlockingRun` wraps `client.execute` and **adapts its response onto `RunResults`** (`{ pipeline_run_id, main_stuff }`, reading the SDK-resolved `.main_stuff`) so one narrower serves both modes; `startDurableRun` wraps `client.start`; `pollDurableRun` does one `getRunStatus` (+ `getRunResult` on a terminal status) tick.

**One narrower contract — `parseXxx(results: RunResults)`, an adapter over the method's generated binder.** Both modes deliver the output the same way, so the narrower reads one field and hands it straight to the schema projected from the method:

- **`main_stuff`** is the single main output's **content directly** (not a `{ concept, content }` wrapper, not a working-memory map). On the durable path it is the `main_stuff.json` artifact; on the blocking `execute` path `@pipelex/sdk` resolves it out of the working memory via the response's `main_stuff_name` (its `PipelexExecuteResult.main_stuff` getter), so both paths carry the same resolved content.
- **`src/lib/wireOutput.ts` is the whole plumbing, and it validates nothing itself** — the generated zod schema owns that. `wireOutput(results)` returns `main_stuff`; `describeSchemaFailure(err, typeName)` renders a `ZodError` through `z.prettifyError` into the field-by-field list `<ErrorDisplay>` shows under Details, because a `ZodError`'s own `.message` is a JSON dump of its issue array and unreadable in a UI.
- **The runtime's explicit `null`s need no normalization.** The runtime serializes an unset optional concept field as `null`, and the ts-zod projection emits a non-required field as `.nullish()`, so the generated schema accepts the payload as it arrives. A tree regenerated against an engine that still emits `.optional()` rejects such a payload with a message naming the field; regenerate against a current engine rather than adding a strip step.
- **A plural output is read through `wireListOutput`, because the runtime renders a list two ways.** A `multiplicity` other than `single` is one `ListContent`, and `main_stuff` carries it as a `{ items: [...] }` envelope on the blocking path but as a **bare array** on the durable path whenever the worker cannot hydrate the concept's class — which is every concept a method declares itself. So a plural narrower types its output as `<Code>[]` and parses `z.array(<Code>Schema)` over `wireListOutput(results)`, which unwraps a top-level `{ items }` when it sees one and passes anything else through for the schema to reject. It normalizes values, never names, and it expires the day the runtime settles on one rendering. Never declare the envelope in an adapter.

There is no `pipe_output` search arm: the SDK resolving `.main_stuff` on both paths removed the shape-guessing, and `Schema.parse` rejects arrays, primitives, and `null` with a message naming the offending field. **Limitation:** `RunResults` surfaces only the main output, not the whole `working_memory` — a durable pipeline needing an _intermediate_ stuff would need an SDK addition upstream in `pipelex-sdk-js`.

Conventions:

- **The manifest is the one copy of a selector**: an action imports `methods/<name>/method.json` through the `@methods/*` alias (`tsconfig.json`, `vitest.config.mts`) and never restates the address or id it holds.
- **Bundle source**: a method authored here ships its `.mthds` files under `methods/<name>/` and they are read at request time with `loadMethodBundles`. Do **not** inline bundle TOML as a string in `.ts` — bundles are first-class.
- **One client**: instantiate `PipelexApiClient` once via `getPipelexClient()`. Never `new PipelexApiClient()` directly in actions or components.
- **Narrow at the boundary, but never re-declare the shape**: the SDK returns loosely-typed output, so always pass the whole `RunResults` through a `parseXxx(results)` narrower in `src/types/`. That narrower hands `wireOutput(results)` to the generated binder and translates the thrown `ZodError` into a tagged subclass of `Error` (`BadPipelineOutputError`) via `describeSchemaFailure`. Do not `as` your way through, and do not hand-write the shape it validates — the method already declares it and `npm run codegen` projects it.
- **Return classified errors, don't throw across the server→client boundary**: the shared helpers return `{ ok: true, ... } | { ok: false, error: PipelineError }`. Throwing works in dev but Next.js production builds strip server-action error messages to opaque digests, which destroys the developer-facing error UX. `executeBlockingRun` / `startDurableRun` / `pollDurableRun` wrap the SDK call in `try/catch`, hand the caught value to `classifyPipelineError(err, env)`, and return the structured error. Render it client-side with `<ErrorDisplay>`.
- **Classification stays server-side, in the helpers.** `classifyPipelineError` `instanceof`-matches SDK error classes, which only exist server-side (they're stripped to opaque digests crossing the boundary) — so it runs inside the helpers, never on a poll/blocking result the client received. The durable `failed` poll constructs a `RunFailedError` from the result lookup and classifies it there too.
- **Inputs are gated, never hand-guarded.** Every action starts with `gateRunInputs(CONTRACT, data)` over the method's committed contract — the same gate the browser ran for the Run button — and returns its `{ ok: false, error }` unchanged. Do not add a per-input `if (!x) return badRequest()` beside it. What legitimately sits _after_ the gate is a check the contract cannot express — the file byte/MIME/scheme check is the one example, and it runs over the _gated_ inputs.
- **Add new error kinds in `src/lib/errors.ts`**: extend `PipelineErrorKind`, add an `instanceof` branch in `classifyPipelineError` (import the class from `@pipelex/sdk`), and cover it in `src/lib/errors.test.ts`. Keep `classifyPipelineError` pure — env passed in by caller, no `process.env` reads inside. The dual-mode kinds (`execute_timeout`, `run_still_running`, `run_failed`, `run_timeout`, `lifecycle_unavailable`) follow this pattern. Two exceptions build a `PipelineError` inline (no thrown error to classify): pre-flight validation (`file_too_large`, `unsupported_file_type`, `bad_request`) in a Server Action, and the client-side poll ceiling (`buildClientTimeoutError`, kind `run_timeout`) in `useRun`.
- **`lifecycle_unavailable` has two sources.** A 404 from a URL that doesn't serve the run-lifecycle routes arrives as the SDK's `RunLifecycleUnavailableError` (`instanceof` branch → `classifyLifecycleUnavailable`); a `/start` against a deployment whose orchestrator is blocking-only (the in-process `direct` mode) arrives as a 400 `ApiResponseError` with `error_type: "StartRequiresAsyncOrchestration"`, matched by an `errorType` branch in `classifyResponse` → `classifyStartRequiresAsync`. Both restate the runtime's vocabulary ("orchestration mode", "fire-and-forget") in this app's term — **durable execution** — and frame the configured URL as the problem, steering to `PIPELEX_BASE_URL`; the messages differ because the root causes differ.
- **`apiMessage` shows the raw API response alongside our interpretation.** When `classifyPipelineError` _re-frames_ a server message (rather than echoing it), set `apiMessage` to the verbatim `err.serverMessage`; `<ErrorDisplay>` renders it as its own "What the Pipelex API returned" block. Omit it when our `message` already is the server's text. `classifyStartRequiresAsync` is the canonical example.
- **The blocking cap is a 502/504, not the SDK timeout.** Behind the hosted gateway, a synchronous `execute` that overruns ~30s comes back as `ApiResponseError` HTTP 502/504 — a _response_, so the SDK does **not** raise `PipelineExecuteTimeoutError` (its own client-side timeout is longer). `executeBlockingRun` passes `{ blocking: true }` to `classifyPipelineError`, which maps a blocking-path 502/504 to `execute_timeout` (the "switch to Durable" guidance). The `PipelineExecuteTimeoutError` branch is kept for configs where the SDK timeout fires first. A 502/504 on the **durable** poll path is left as a transient `server_error` — the `blocking` flag scopes the mapping.
- **Transport-reject wrapping lives in `useRun`, not the forms.** Even though a helper's catch turns application errors into `{ ok: false, error }`, the awaited Server Action call itself can still reject (network drop, dev server crash, stale Server Action ID after a deploy). The hook wraps every awaited boundary (start, blocking, each poll) in `try/catch` → `classifyTransportError(err)`, so the rejection becomes a `<ErrorDisplay>` error instead of escaping to React's error boundary. Forms just call `run(input)`.

### File & image inputs

Text inputs are plain strings. File inputs (PDFs, images) take one extra step, and `make add-method` writes it for any method that declares one:

- **The kernel never uploads — the host does.** `DocumentField` fires `env.onDropFile(id, file)` and waits; `useFileInputs` encodes and writes a `FileValue` (`{url, filename}`) back at the field's **dotted path** with `setValueAtPath`. While the id sits in `env.uploadingIds` the kernel shuts **every door into that value** — the dropzone, the "paste a URL instead" toggle and the URL input behind it — which is why no staleness token is needed for a second selection mid-encode and why the form's `disabled` is plain run state. The one write path that guarantee cannot cover is the host's own chrome: a shortcut button a host adds to fill the field must disable itself while the field is resolving (`running || encodingIds.size > 0`).
- **Encode client-side, never cross the boundary with a `File`.** The browser reads the `File` into a base64 data URL via `fileToDataUrl` (`src/lib/clientFile.ts`). Server Actions accept only serializable arguments — the value that crosses is the `string` data URL inside the form value, never a `File`, `Blob`, or `FormData`.
- **Validate server-side, then let the SDK upload.** The action runs the shape gate, then `checkFileInputs(DESCRIPTOR, gated.inputs, …)` over the **gated** inputs (`src/lib/fileEncoding.ts` — the authoritative scheme + MIME + size gate, which walks the pipe's wire descriptor to find every file position: top-level, inside a list, nested in a structured concept), then hands the inputs to `client.prepareInputs()`, which reads the method's declared signature, uploads the bytes to Pipelex storage, and rewrites the input to a small `pipelex-storage://` URI. **`prepareInputs` takes the kernel's `{concept, content}` envelope as readily as a bare value** and preserves it on output, so no conversion sits at that seam. It throws a typed `InputPreparationError` _before any run starts_, and because the options closure runs inside `executeBlockingRun` / `startDurableRun`'s `try/catch`, that error is classified like any other SDK error.
- **The scheme is checked before the bytes, and refused by default.** The kernel's file control offers "paste a URL instead", so a file input can arrive carrying no bytes — but "nothing to size-check" is not "nothing to verify". `prepareInputs` resolves any string it does not recognise as `data:`, `http(s)://` or `pipelex-storage://` as a **local filesystem path**, reads it and uploads it, so a Server Action that waves through every non-`data:` URL is an arbitrary server-side file read. `checkFileInputs` validates against a closed set first (`data:`, `https://`, `pipelex-storage://` — no cleartext `http://`), then MIME and size for `data:` only. It finds the files by walking the method's **wire descriptor**, never by an input's name and never by sniffing values for a `url` key: a name-keyed gate fails open the day the method renames that input, and a value-keyed one cannot tell a text field named `url` from a `Document` two levels down.
- **Re-validate on the server.** The browser's own size check is an early exit that saves an encode (past `MAX_FILE_BYTES` the payload cannot fit the body limit anyway), reading the same exported constant — not a second rule. The Server Action's `checkFileInputs` call is the gate. `useFileInputs` also takes a `prepareFile` option, an _encoding_ fix for browsers that report `file.type === ""` for a valid file; a scaffolded form passes none, so such a file is refused by the server's MIME check.
- **Mind the Server Action body limit.** Next.js caps Server Action bodies at 1 MB by default; base64 inflates payloads ~37%. `next.config.js` raises `serverActions.bodySizeLimit`, and `MAX_FILE_BYTES` in `fileEncoding.ts` caps the raw file size with margin.
- **Keep Server Function logging off.** `next dev` logs each Server Function call with its arguments, and an uploaded file travels to its action as a base64 `data:` URL, so with the default every file a user drops in lands in the dev log in full. `next.config.js` sets `logging.serverFunctions: false`; do not remove it to debug an action — log the action's name instead.
- **File/image outputs come back as a URL** — a storage URL or a base64 data URL — in the output content. On the hosted durable path the runtime returns both a non-web `url` (`pipelex-storage://…`) and a web `public_url` (a signed S3 URL that expires in minutes and is the credential to the object). The kernel's file arms ask the host's resolver about `url` first and read `public_url` only without one, and this app mounts one (the next bullet), so a hosted run's files paint through the assets route and the signed link is never what the browser fetches. It is still in the payload the client receives — the kernel's JSON view renders the receipt verbatim — so what the resolver removes is the _sink_, not the credential. **The result view applies a URL policy of its own, and it is the one thing it re-reads.** The form kernel decides what to paint, link and frame from its own `isViewableUrl`, which accepts `http:`, **any** `data:` media type and `blob:` — and one of the sinks behind that verdict is a `DocumentPreview` `<iframe>` with no `sandbox` attribute, offered whenever the payload's own `filename` or `mime_type` looks previewable. So `scrubResultUrls` (`src/lib/resultUrls.ts`) walks the result descriptor exactly as `checkFileInputs` walks the input one, and removes any file URL the kernel would act on that is not `https:` or a PNG/JPEG/WebP `data:` URL, reporting what it removed so `<RunResult>` can say so rather than quietly differ. It normalizes an accepted URL too, so the string this judged is the string the kernel gets. A reference the kernel would never touch on its own (`pipelex-storage://`) is left verbatim, and the resolver's answer — this app's own path — is never judged: the route's headers guard it. **This is a stopgap owned upstream** — the fixes belong in `@pipelex/mthds-form` — and it does not cover the markdown a `native.Text` result carries, where a `![](https://…)` in the model's own answer loads on paint.
- **A `pipelex-storage://` reference on its own resolves nowhere in a browser**, and the kernel's seam for exchanging one is `<ResultEnvProvider>`, which `src/components/ResultEnv.tsx` mounts once in the root layout — one provider high in the tree, never a prop threaded through `<RunResult>`. Its `resolveUrl` is `assetPath` (`src/lib/storageAsset.ts`), a pure, synchronous rewrite onto `/api/assets/…`, because the kernel's seam is synchronous by design: a resolver that rewrites has no round trip to make. `src/app/api/assets/[...path]/route.ts` streams that path through the SDK's `fetchArtifact` on the server, under `buildAssetHeaders` (`src/lib/assetHeaders.ts`) — `nosniff`; a sandboxing CSP on a document-capable type (SVG, HTML, XML), never on a PDF, whose viewer it would break; `inline` only for what the kernel previews; private caching. It is not a redirect and not an open proxy: the only input is a storage path, and a reference the key cannot see answers `404` like one that names nothing. It needs a platform serving `POST /v1/resolve-storage-url/bulk`, the route `fetchArtifact` mints through; a deployment without it answers `502` naming the route, even though the single-reference route beside it may work. Its `resolveShareUrl` is the Server Action in `src/actions/shareUrl.ts`, which mints a presigned link per click through `resolveStorageUrl` — a same-origin path is useless pasted elsewhere — and answers `undefined` on any failure, the kernel's contract for "copy the display URL instead". The key never leaves `getPipelexClient()`. A plain-http store link is fetched only when `PIPELEX_BASE_URL` itself is plain http (the local compose stack); `allowPlainHttpArtifacts` in `serverEnv.ts` decides. **The route and the share action are unauthenticated, deliberately and only for a single-tenant app**: both resolve any reference with the deployment's one API key, so a deployment serving more than one person has to close `mayRead` in the route and ask the same question in the action — the route's `404` hides _which_ objects exist, and that seam decides _who_ may read one.

## Adding a method

**Every method is added with `make add-method METHOD=<method>`**, whatever form it takes:

- **a bundle** — a `.mthds` file or a directory of them, copied into `methods/<name>/`; a path already inside `methods/<name>/` is scaffolded in place, all of that directory's files. Author or edit one with `/mthds-build` and `/mthds-edit` first;
- **a catalog id** (`mt_…`) or **a published address** (`github.com/owner/repo[/pkg][@tag]`), named by a `methods/<name>/method.json` the gesture writes.

It writes the generated tree, the adapter, the action trio, an action test, the form and the registry entry, refusing rather than overwriting anything that already exists, and takes back everything it wrote if the write fails part-way. [`docs/add-method.md`](docs/add-method.md) is the reference, including how to remove a method again. **Do not write a slice by hand**: if the scaffold cannot express what a method needs, the fix belongs in `scripts/lib/add-method.mts` and its tests, so every later slice gets it too.

After the slice exists, the files under `src/types/`, `src/actions/` and `src/components/` are yours to edit, and `npm run codegen` is the only refresh: it rewrites the generated tree and never touches them.

<!-- template-only:begin -->

## Creating an app from the template (`make create`)

**`make create METHOD=<method>` is the template's one-shot gesture**, and the bootstrap removes it from every project it creates. It runs `add-method`'s read-only half (one fetch), derives the package name, title and description from the method (`NAME=`, `TITLE=`, `DESCRIPTION=` override; `METHOD_NAME=` names the method's directory), checks those values with the bootstrap's `--dry-run`, then scaffolds the method, runs the bootstrap with `--clean`, writes `.env.local` from the shell with exactly one base-URL line, re-syncs `package-lock.json`, runs `make all`, and removes the bootstrap skill once it is green. It asks nothing: a value it cannot derive is a refusal naming the flag. [`docs/create.md`](docs/create.md) is the reference, and [`docs/ci.md`](docs/ci.md) says how the keyed half of its proof is taken: by hand, on a local run, since no workflow holds an API key.

The template-only files are the `make create` gesture — `scripts/create.mts`, `scripts/lib/create.mts` and its test, and `docs/create.md` — and the tile e2e with its fixture, `e2e/resultTile.spec.ts` and `e2e/fixtures/generate-image`; the bootstrap's `REMOVALS` lists them, and its `package.json` transform drops the `create` script. **A passage of a file a project keeps that only makes sense in the template sits between two marker lines** — the words `template-only` followed by `:begin`, then by `:end`, in whatever comment the file uses — in the Makefile, this file, `AGENTS.md` and `docs/ci.md`, and the bootstrap removes it with its markers. Keep each marker on a line of its own, never inside a table, and never spell a marker out anywhere else in those files: the bootstrap matches the words on any line. A test in `bootstrap.test.mjs` fails when a file a project keeps names the create gesture outside such a passage.

## The mono-repo around this directory

**This template is developed inside `pipelex-method-apps`, and a project is a copy of this directory alone.** The mono-repo's root holds what belongs to the family rather than to any one template, and none of it travels: its `README.md` gives the copy-out recipe, its `Makefile` delegates `install`, `check`, `test` and `all` to every template, and its `CLAUDE.md` describes the rest. This directory behaves differently there than in a project in the ways below, each of them deliberate:

- **This directory's `.github/workflows/` never runs in the mono-repo**, because GitHub reads workflows only at a repository's root. The root carries a twin of each, rendered from these files by the root's `make workflows` with `working-directory: webapp-js`, and the root's `make check` fails when a twin has drifted. Edit the workflows here, then re-render.
- **The version is the family's.** The root `VERSION` file is the one the release reads, and `package.json`'s `version` is kept equal to it by the root's `make check`; the history is the root `CHANGELOG.md`, and this directory's changelog only points there until the bootstrap replaces it. The release skill is the root's too.
- **The pre-commit hook is wired from the root.** `npm install` here prints the Husky `.git can't be found` notice, because the repository's `.git` is one level up; the root's `make install` installs a root hook that runs this directory's `.husky/pre-commit` from inside it.
- **The sibling packages are two levels up.** The root's `make use-local` passes `SIBLINGS_DIR` pointing at the workspace, and running the target here needs `SIBLINGS_DIR=../..`.

<!-- template-only:end -->

## Component Conventions

- **Named exports** for all components: `export function MyComponent() {}`
- **Default exports** only for App Router pages/layouts (`export default function Page()`)
- Add `"use client"` only when the component needs hooks, event handlers, or browser APIs
- Use the `@/` path alias for all imports (maps to `./src/`)
- **No barrel files** (`index.ts` re-exports) — import directly from the source file
- **No relative imports** across folders — always use `@/`

## Code Style (Prettier)

Configured in `.prettierrc`:

- Double quotes
- Semicolons
- Trailing commas (all)
- Print width: 100
- Tab width: 2 (spaces)

Enforced via Husky + lint-staged on commit.

## Testing

### Unit (Vitest, default)

- **Runner**: Vitest with happy-dom environment
- **Library**: `@testing-library/react` + `@testing-library/jest-dom`
- **Location**: co-located `.test.ts` / `.test.tsx` next to the source file
- **Queries**: prefer accessible queries (`getByRole`, `getByLabelText`) over `getByTestId`
- **The template ships no method, so the shared code is tested against fixtures.** `src/test/fixtures/contracts/` holds recorded codegen output; a test that needs a real contract imports one from there, never from `src/generated/`, which is empty until a method is added.
- **The scaffold is proven by building with it.** `scripts/lib/scaffold-tree.test.mts` copies the tree to a temporary directory, scaffolds one slice per source kind from the complete API responses recorded in `scripts/lib/fixtures/recorded/`, and runs `tsc`, ESLint, the offline codegen check and the emitted action tests over the copy. A change to what `add-method` emits, or to the shared code an emitted file imports, is verified there; [`docs/ci.md`](docs/ci.md) says how the recordings are refreshed.
- **Mocking the SDK**: mock `@/lib/pipelexClient` with `vi.mock`, returning the methods the code under test calls — `{ execute, start, getRunStatus, getRunResult }`, or `fetchArtifact` for the assets route and `resolveStorageUrl` for the share action (each a `vi.fn()`). Do **not** mock the `@pipelex/sdk` package directly — it's harder to wire as a constructor and the indirection adds noise. **Use `mockResolvedValueOnce`/`mockRejectedValueOnce`, not the persistent `mockResolvedValue`/`mockRejectedValue`, on these spies**: a persistent resolved mock followed by a rejected one on the same spy trips vitest's async-result tracking and reports a spurious unhandled rejection.
- **Mocking the actions (form/hook tests)**: mock `@/actions/run<Name>Pipeline` returning `{ run<Name>Blocking, start<Name>Run, poll<Name>Run }` as `vi.fn()`s. `useRun`'s durable poll loop runs on `setTimeout`/`setInterval`, so durable form/hook tests use `vi.useFakeTimers()` and drive with `await vi.advanceTimersByTimeAsync(...)` inside `act()`, querying synchronously (`getByRole`/`getByText`) — `findBy`/`waitFor` conflict with fake timers. A test that drives a file encode keeps **real** timers (`FileReader` needs them) and has the durable poll complete on the first tick so `findBy` works.

### E2E (Playwright)

- **Location**: `e2e/*.spec.ts`
- **`home.spec.ts` is offline** and runs with no key: the page renders its title from `src/site.ts`, and either the empty state or a form. It holds whether or not methods have been added.
<!-- template-only:begin -->

- **`resultTile.spec.ts` is live, and it is the whole-result proof.** It copies the template to a temporary directory, installs it (`npm ci --prefer-offline` — Turbopack refuses a symlinked `node_modules`), scaffolds `e2e/fixtures/generate-image/` with `add-method`, starts that app's own `next dev` on a free port, runs the method, and checks that the picture's `src` is `/api/assets/…` and decoded, that the route's header rules are on the response, and that the cost panel's footer follows the labelling rule the table shows. It saves a screenshot of the tile and of the cost panel under `test-results/`. It costs one image generation and needs a base URL that serves the form views. It proves the **template**, so the bootstrap removes it with its fixture: in a project that already registers a method the fixture's panel is a non-active tab, hidden from the accessibility tree, and the spec's first control never resolves.

<!-- template-only:end -->

- **A live-API spec is optional, and gated.** A spec that runs a method hits the live Pipelex API using `PIPELEX_API_KEY` from `.env.local` and costs an LLM call. Two guards make this safe: (1) it calls `requireLiveApi()` from `e2e/liveApi.ts`, which **auto-skips** when no key is set, and `playwright.config.ts` loads `.env.local` via `@next/env` so a configured key is visible to the runner; (2) `make test-e2e` **prompts for confirmation** before spending (the `confirm-live-e2e` target — skipped in CI / non-TTY shells, bypass with `CONFIRM=1`). A method addressed by `method_ref` additionally needs a base URL that advertises it.
- **Excluded from `make all`** — run explicitly with `make test-e2e`
- **First-time setup**: `npx playwright install chromium`
- **Excluded from**: `vitest.config.mts` (`exclude: ["e2e/**", ...]`) and the base `tsconfig.json` (`exclude: [..., "e2e"]`) so unit-test infra and Next's build typecheck don't pick up Playwright specs
- **Still type-checked and linted**, just not by the base config: `tsconfig.e2e.json` (a thin `extends` of the base, scoped to `e2e/**`) type-checks the specs via `make typecheck`, and `lint` (`eslint .`) covers the whole repo, e2e specs included — so `make all` lints exactly the files the pre-commit hook (lint-staged) does, and never passes while the commit gate fails.

## Scripts (via Make)

| Target                | Purpose                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------- |
| `make dev`            | Start the Next.js dev server                                                                                |
| `make build`          | Production build                                                                                            |
| `make lint`           | ESLint                                                                                                      |
| `make format`         | Prettier write                                                                                              |
| `make format-check`   | Prettier check (CI)                                                                                         |
| `make typecheck`      | `tsc --noEmit` (app) + `tsc -p tsconfig.e2e.json` (e2e) + `tsc -p tsconfig.scripts.json`                    |
| `make codegen`        | Regenerate `src/generated/` from `methods/` (needs `PIPELEX_API_KEY`; **not** in `make all`)                |
| `make codegen-check`  | Prove `src/generated/` is current — offline, no key. Part of `make check`                                   |
| `make codegen-verify` | Ask the engine whether the committed crates are still current (needs a key; not in `make all`)              |
| `make add-method`     | Scaffold a method into the app — `METHOD=<bundle path \| mt_… \| address>` (needs a key)                    |
| `make test`           | Vitest single pass                                                                                          |
| `make agent-test`     | Vitest, silent on success (preferred for AI agents)                                                         |
| `make test-e2e`       | Optional Playwright e2e (live specs cost an LLM call; prompts first, auto-skip without a key)               |
| `make check`          | lint + format-check + typecheck + codegen-check                                                             |
| `make all`            | check + test + build (does **not** include e2e, `codegen`, or `codegen-verify`)                             |
| `make use-local`      | Pack and install siblings `../pipelex-sdk-js` + `../mthds-form`, or from `SIBLINGS_DIR=<dir>` (alias: `ul`) |
| `make use-local-form` | Pack and install sibling `../mthds-form` alone, or from `SIBLINGS_DIR=<dir>`                                |
| `make use-npm`        | Restore the `@pipelex/sdk` + `@pipelex/mthds-form` versions the lockfile pins (alias: `un`)                 |
| `make use-npm-form`   | Restore the `@pipelex/mthds-form` version the lockfile pins                                                 |
| `make local-status`   | Say whether each package comes from a sibling checkout or from npm                                          |

## Local package development (`use-local`)

When working on this app alongside the SDK or the form kernel, use `make use-local` to install the siblings `../pipelex-sdk-js` and `../mthds-form` into `node_modules/@pipelex/sdk` and `node_modules/@pipelex/mthds-form` instead of the npm packages, or `make use-local-form` to install the kernel alone. The siblings are looked for in the parent directory, and `SIBLINGS_DIR=<dir>` names another one. The target builds each sibling, packs it with `npm pack` into a temporary directory, then installs the tarballs — in **one** `npm install` call, deliberately: an `--no-save` install re-reconciles `node_modules` against the lockfile and silently puts any earlier tarball back on the registry version. For the same reason `make use-local-form` and `make use-npm-form` refuse to run while the SDK is local, and name `make use-local` or `make use-npm`, which switch both.

We use a tarball install rather than a symlink (`ln -s`) because Next.js 16's Turbopack does not follow symlinked workspace packages — both `npm run dev` and `npm run build` fail with `Module not found: Can't resolve '@pipelex/sdk'` against a symlinked entry. **Re-run `make use-local` after every edit to either sibling** to pick up changes.

`make use-npm` switches back, and `make use-npm-form` switches the kernel alone. Both install the version `package-lock.json` pins, `--no-save`, so leaving local mode never rewrites `package.json` or the lockfile: moving a range is a reviewed change with a changelog to read, which is what the `/bump-mthds-form` and `/bump-sdk` skills are for. A newer release published while you worked locally therefore does not arrive by switching back.

`make local-status` says which mode `node_modules` is in, package by package. The version cannot tell you, because a local build carries the version it will be published as, so the target reads where npm's hidden lockfile (`node_modules/.package-lock.json`) says each package was installed from.

## Workflow Rules

**After any code change, run `make all`.** It runs `check` (lint + format-check + typecheck + the offline codegen check) + `test` + `build`, which catches the failure classes that block CI: ESLint violations, Prettier formatting drift, TypeScript errors, generated types that no longer match their methods, and broken unit tests / production build. Do not declare a task done if `make all` doesn't pass cleanly.

**After editing anything under `methods/`, run `npm run codegen`.** `make check` compares each generated tree against a hash of the source files it was projected from, so a source edit without a regeneration fails with "Run `npm run codegen` to regenerate." rather than shipping types that quietly lie. Regeneration needs `PIPELEX_API_KEY` and, for now, `PIPELEX_BASE_URL=https://api-dev.pipelex.com`. Commit the regenerated tree in the same commit as the source edit. The same applies to a `methods/<name>/method.json` manifest: bumping its tag is a source edit.

If `make format-check` fails, run `make format` to auto-fix and re-run `make all`. Don't hand-edit files to satisfy Prettier — let the formatter do it.

Other targets that matter:

- **`make agent-test`** instead of `make test` when an AI agent runs the suite. It's silent on success; only failures hit the context.
- **`make test-e2e`** before shipping changes that touch the SDK call path (`src/actions/`, `src/lib/pipelexClient.ts`, `src/lib/loadBundle.ts`, `src/lib/blockingRun.ts`, `src/lib/durableRun.ts`, `src/lib/wireOutput.ts`, `src/lib/errors.ts`, `src/lib/fileEncoding.ts`, `src/lib/resultUrls.ts`, `src/hooks/useRun.ts`, `src/app/api/assets/`, `src/components/ResultEnv.tsx`, `src/actions/shareUrl.ts`, `src/generated/`, `methods/`). Unit tests mock the SDK; only e2e exercises the real API, the durable poll loop, and the rendered error UX. Not part of `make all`.
- **`make use-local`** (or `make use-local-form` for the kernel alone) after editing the sibling `../pipelex-sdk-js` SDK or `../mthds-form` form kernel, before re-running tests or the dev server. The tarball install only refreshes when the target re-runs.

## Git Workflow

- **PR target branch**: `dev`. The one exception is a `release/vX.Y.Z` branch, which targets `main`.
- **Branch naming**: prefix with `feature/`, `fix/`, `refactor/`, `docs/`, or `chore/` (e.g. `feature/Durable-runs`).

## Anti-patterns to Avoid

- **No bundle TOML inlined in `.ts` files** — bundles live under `methods/<name>/`.
- **No raw `fetch()` to the Pipelex API** — always go through `PipelexApiClient`. (If you find a missing capability in the SDK, fix it upstream in `pipelex-sdk-js`, don't bypass it here.)
- **No `as` casts on SDK output** — go through the `parseXxx()` narrower instead.
- **No hand-written output shapes** — the method declares them and `npm run codegen` projects them. If a type in `src/types/` lists fields, it is duplicating the method.
- **No hand-rolled input markup for method inputs** — no `<textarea>`, `<input>`, or file picker for something a method declares. The method declares it, `contracts.ts` carries it, and `<RunInputsForm>` renders it. App chrome (mode toggle, submit button, a host's own shortcut buttons) is still hand-written, as it should be.
- **No per-input validation beside the gate** — one `gateRunInputs` call per action, and no client-side twin of it. A check the contract genuinely cannot express (the file byte cap) runs _after_ the gate, over its output, and reads a shared constant.
- **No hand-rolled result markup for a method's output** — no headings, lists or `<img>` for something the method declares. `OUTPUT_FORM` carries the declaration and `<RunResult>` renders it. Write a bespoke view only where a specific output genuinely earns one, and never by inspecting the payload to work out what it is: the descriptor already says.
- **No edits to `src/generated/`** — reformatting included. Wrap it from `src/types/`; a stamped file that changed is a `make check` failure.
- **No camelCase mirror of a generated type** — keys stay wire-native (`doc_type`, `public_url`) all the way to the components.
- **No `try/catch` that swallows errors silently** in narrowers — throw a tagged subclass. The action's outer catch routes it through `classifyPipelineError`.
- **No `throw new Error(...)` from server actions for known failure modes** — return `{ ok: false, error: classifyPipelineError(err, env) }` so the structured error survives the server→client boundary in production.
- **No shared code that imports a method** — `src/lib/`, `src/hooks/` and the shared components must build and test with `src/generated/` empty. A test that needs a real contract reads a fixture.
- **No title or description in JSX text** — both live in `src/site.ts`.
- **No relative imports** across folders — always `@/`.
- **No default exports** for components (only for App Router pages/layouts).
- **No `index.ts` barrel files**.
- **No inline styles** — use Tailwind classes.

## Gotchas

- **A `make` variable counts only when it is given on the command line, and not blank.** The Makefile's `given` helper reads a variable's origin before its value, so a `NAME` or `LABEL` the shell exports is not taken as a request, and `NAME=` clears a value rather than passing an empty one; `opt`, `flag` and `require` build on it, `flag` also treating `0` as not given, and `shq` hands the value to the script exactly as typed. A new gesture's variables go through the same helpers — never `$(if $(NAME),--name $(NAME))`, which both inherits the environment and lets the shell reinterpret the value. `scripts/lib/makefile.test.mts` pins the expansions with `make -n`.
- **The two `add-method:` anchor comments in `src/methods.ts` are a contract — never move, reword or delete the marker tokens.** `make add-method` inserts one import line above `// add-method:imports` and one `METHODS` entry above `// add-method:tabs`, and refuses when it cannot find either. The match is on the token alone, so the prose after a marker can be reworded freely; the tokens themselves cannot move. A test in `scripts/lib/add-method.test.mts` reads the real file, so an edit that loses one fails the suite rather than the next scaffold run. The same is why each entry carries its `Component` and `<MethodPage>` maps over them: a hand-written panel per form would make a scaffolded method a second insertion point.
- **The servers listen on loopback by default, and that default is a security property — never drop the `-H`.** The Server Actions run methods with the `PIPELEX_API_KEY` in the server's environment and nothing authenticates the browser calling them, so a server anyone on the network can reach spends the developer's key for them. `next dev` and `next start` given no host bind every interface, which is why both scripts pass `-H ${APP_HOST:-127.0.0.1}`. The host is declared once, as `APP_HOST` in the `Makefile`, beside `APP_PORT` and exported with it; `make dev APP_HOST=0.0.0.0` widens it for a container or another device, and `make run` and `make start` print a warning whenever the host is not loopback. Unlike a gesture's variables, the two are taken from the shell too, so a container can set them in its environment. `scripts/lib/makefile.test.mts` pins the default, the scripts' expansion and the warning.
- **The dev server runs on port 4300, and it must not go back to 4100.** The number is declared once, as `APP_PORT` in the `Makefile`, which exports it; `package.json`'s `dev`/`start` scripts and `playwright.config.ts` each read it and each default to 4300 on their own, so `npm run dev` outside make still works. Override it per invocation — `make run APP_PORT=4301` — which is what lets a second checkout run beside one that already holds the port. The variables are deliberately not the ambient `HOST`, `HOSTNAME` or `PORT`: the shell sets `HOSTNAME` to the machine's name, and hosting platforms, other dev servers and shell profiles export the others, so inheriting one would widen or move this server without saying so. 4100 is avoided because the Pipelex server's local stack publishes its build-chatbot sandbox on `127.0.0.1:4100`. On the loopback default that collision is loud: `next dev` fails with `EADDRINUSE`. With `APP_HOST` widened it is silent: Docker holds IPv4 loopback, so `next dev` still binds the wildcard and prints `Ready`, while Playwright's health check on `127.0.0.1` reaches the container's 404 forever and fails with `Timed out waiting 120000ms from config.webServer`. When e2e times out with the app apparently up, run `lsof -nP -iTCP:4300 -sTCP:LISTEN` before believing anything else.
- **`make run`, `make start` and `make test-e2e` refuse a port held by another checkout, and that guard is worth keeping.** Several checkouts of the same app all want 4300, so the holder is routinely another checkout — which answers on `http://127.0.0.1:4300` and looks entirely right in a browser. The `port-check` target reads the holder's own working directory (`lsof -a -p <pid> -d cwd`) and compares it against `$(CURDIR)`, so the refusal names the directory actually serving the port instead of printing Node's bare `EADDRINUSE`; when the holder is this checkout, it also names the address that server listens on. The e2e targets pass `ALLOW_OWN=1`, which accepts a server started from **this** directory (Playwright's `reuseExistingServer` is meant to reuse it) and still refuses a foreign one.
- **Husky `prepare` warning**: `npm install` prints `.git can't be found` when this directory is not the root of a git repository — before `git init`, for instance. Harmless — just re-run `npm install` after `git init` to wire `.husky/_/`.
- **Renaming App Router directories**: delete `.next/` before running `make check` — stale type references in `.next/types/` will fail typecheck.
- **`next-env.d.ts` is generated** (gitignored). Next regenerates it on dev/build. Don't edit by hand.
- **`.worktreeinclude` names the gitignored files a fresh git worktree needs copied** (`.env`, `.env.local`, the local Claude Code settings), so a worktree starts with the API key instead of an unexplained `api_unreachable`. A pattern copies a file only when it is gitignored, so a tracked file can never be duplicated through it.
- **Tailwind is configured in CSS, not in a JS config — there is no `tailwind.config.ts`.** Everything lives at the top of `src/app/globals.css`: the `@import`s, the `@source` directive pointing at the form kernel's bundle, the `@custom-variant dark`, and the `@theme inline` token block. Source scanning is automatic for the repo's own tree; only a path Tailwind would not walk on its own — a dependency's `dist`, an ignored directory — needs an `@source` of its own.
- **A kernel-rendered control has no label of your choosing, and sometimes no label at all.** Labels are `humanizeFieldName` of the contract's input name (`image_prompt` → "Image prompt"), so a method rename breaks selectors. Query by **role plus name** (`getByRole("textbox", { name: "Text" })`): the humanized names are short and collide with page chrome under strict-mode queries. The file control links no label at all — reach its `input[type="file"]` directly.
- **The result region contains the kernel's own chrome, so `getByRole("img")` inside it is ambiguous.** `<RunResult>` labels a section and hands the inside to `StuffViewer`, which renders its Download control with a lucide icon — an inline `<svg>`, which ARIA counts as role `img` exactly like a rendered picture does. Reach a rendered file with `result.locator("img")`: kernel icons are always `<svg>` and a rendered file is always an `<img>`. Its `alt` is not a handle either — the kernel fills it with the payload's caption or filename and only falls back to "Preview".
- **The form kernel's classes live in its package bundle, not in `src/`.** `src/app/globals.css` must keep `@source "../../node_modules/@pipelex/mthds-form/dist/**/*.js"`, or the controls render _mostly_ styled — a silent failure that looks like a broken design system. Keep the `/**/*.js` glob rather than the bare directory: `dist` also ships sourcemaps, and Tailwind scans a `.map` as readily as the compiled JS. The deterministic check is diffing the built stylesheet with and without it; see [`docs/input-form.md`](docs/input-form.md).
- **The kernel needs Tailwind v4, and a v3 build fails silently.** Its controls are written in v4's vocabulary (`outline-hidden`, `aria-invalid:`, `data-placeholder:`, `wrap-break-word`, `field-sizing-content`, the `(--radix-…)` variable form); v3 compiles those names to nothing. The same applies to the tokens: since kernel 0.8.0 each is a **whole colour**, so the `@theme inline` mapping is a bare `var(--border)` — re-wrapping it as `hsl(var(--border))` yields `hsl(hsl(…))`, which the browser discards.
- **A whole-tree diff in `src/generated/` after an upstream pipelex release is expected.** `engine_version` is part of the stamp, so a new engine restamps every artifact with no semantic change. `npm run codegen:verify` calls that out as a note rather than failing.
- **`scripts/*.mts` is skipped by the pre-commit hook.** lint-staged's globs (`*.{ts,tsx}`, `*.{css,json,md}`, `*.mjs`) do not match `.mts`. Nothing ships unlinted — `make check` covers those files fully via `format:check`'s explicit `mts` glob, `eslint .`, and `typecheck:scripts` — but do not rely on the commit hook to catch a script.
- **`next dev` writes the `BEGIN:nextjs-agent-rules` block at the bottom of `AGENTS.md`**, when it detects that an AI coding agent is driving (`node_modules/next/dist/server/lib/generate-agent-files.js`). Next prefers an `AGENTS.md` over this file when one exists, and this repo has one, so the block lives there. Next.js manages it and re-adds it on the next dev run, so it is committed rather than deleted each time; treat it as generated, keep hand-written guidance above it, and do not reword it. **Never write that marker verbatim in prose** (that is why this bullet names it without the surrounding comment delimiters): Next locates the block by searching for its opening marker, so the upsert would treat the first match as the block's start and swallow everything between your sentence and the real block.
