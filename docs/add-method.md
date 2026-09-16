# `make add-method`: adding a method to the app

This app ships no method. `make add-method` is how one arrives: it fetches the method's projection from the Pipelex API and writes everything the app needs around it — the method's directory, the generated tree, the typed narrower, the Server Action trio, a test, the form and the registry entry — so no app file is written by hand.

```bash
make add-method METHOD=path/to/cv_screening/                        # a bundle
make add-method METHOD=github.com/Pipelex/methods/text_stats@v0.1.1  # a published method
make add-method METHOD=mt_ca0aa9d3-61ac-4db1-8b46-fb0cc75787df       # a method in your catalog
```

## The gesture

|            |                                                                                                                                                              |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Make       | `make add-method METHOD=<method> [PIPE=…] [NAME=…] [LABEL=…] [DRY_RUN=1]`                                                                                    |
| npm        | `npm run add-method -- <method> [--pipe …] [--name …] [--label …] [--dry-run]`                                                                               |
| Needs      | `PIPELEX_API_KEY`, and a base URL that serves the form views and, for a selector, advertises its kind (see [The handshake](#the-handshake-and-the-base-url)) |
| Exit codes | `0` written (or rehearsed), `1` refused or failed — never a thrown stack                                                                                     |

It is out of `make all` for the same reason `codegen` and `test-e2e` are: it needs a key and a network.

`METHOD` is the one required argument, and it is one of three forms:

- **A bundle** — a path to a `.mthds` file, or to a directory holding several (at any depth). The files are copied into `methods/<name>/`, keeping their paths relative to what you named, and the action sends them inline as `mthds_contents`. A path inside `methods/<name>/` — the directory or any file in it — scaffolds that directory **in place**, all of its `.mthds` files, since that is what `npm run codegen` reads. A relative path is read from the directory the command was typed in (for `make`, the app's root), and `~/` is your home directory.
- **A catalog id** — `mt_…`, a method saved under your key's organization on [app.pipelex.com](https://app.pipelex.com). Sent as `method_id`.
- **An address** — `github.com/<owner>/<repo>[/<package>][@<tag>]`, a published MTHDS package, with or without an `https://` prefix. Sent as `method_ref`, normalized to the bare form.

An address always starts with its host, and a host has a dot in it, so the argument is read as a path when it ends in `.mthds`, starts with `/`, `./`, `../` or `~/`, or has no dot in its first segment (`bundles/cv`). Everything else is parsed as an address, and refused naming all three forms when it is not one.

A bundle is refused when the path does not exist, when a file is not a `.mthds` file, when a directory holds none, when it contains a symlink or a file that is not UTF-8, when the directory contains this app, when it names `methods/` itself or a file sitting directly in it (no method is read from there), and when a method directory in place also holds a `method.json`.

The optional arguments:

| Argument                  | What it does                                                                                     | Default                                   |
| ------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------- |
| `PIPE` / `--pipe`         | Which pipe of the method to wire, bare (`analyze_text`) or qualified (`text_stats.analyze_text`) | The pipe rule below                       |
| `NAME` / `--name`         | The kebab-case slug every derived name is built from                                             | Derived from the method                   |
| `LABEL` / `--label`       | The method's label: its tab when the app runs several, and its Run button                        | The catalog name, else the humanized slug |
| `DRY_RUN=1` / `--dry-run` | Fetch, derive and print the whole plan; write nothing                                            | off                                       |

A flag whose value is missing — or is itself another flag, which is what `--label --dry-run` looks like when the real label was dropped — is refused rather than swallowed. Through `make`, only a variable given on the command line counts (a `NAME` your shell exports is ignored), and each value is passed to the script exactly as typed.

## What it writes

For `METHOD=github.com/Pipelex/methods/text_stats@v0.1.1`, with no other arguments:

```
methods/text-stats/method.json          # { "method_ref": "github.com/Pipelex/methods/text_stats@v0.1.1" }
src/generated/text-stats/               # types.ts, binder.ts, contracts.ts, codegen.lock, sources.json
src/types/textStatsPipeline.ts          # the narrower over the generated binder
src/actions/runTextStatsPipeline.ts     # the blocking + start + poll trio
src/actions/runTextStatsPipeline.test.ts
src/components/TextStatsForm.tsx        # useRunInputs + RunInputsForm + useRun + RunResult
src/methods.ts                          # one import line, one registry entry
```

For a bundle, `methods/<name>/` holds the copied `.mthds` files instead of a manifest — or nothing new at all, for a bundle already there — and the rest is the same file set.

**Nothing is written until everything has been fetched, derived and formatted.** The gesture runs in two halves: a read-only half that parses the argument, reads the bundle or shakes hands with the API, fetches the projection and the contracts, chooses the pipe, binds the output, derives every name, checks every collision, locates the anchors in `src/methods.ts` and renders every file in memory; and a write half that runs only once all of that has passed. Every refusal happens in the first half, with nothing on disk changed. `--dry-run` stops at the boundary and prints the plan.

**A failure in the write half takes back what the write half wrote.** The method directory it created, the generated tree it created, every app file it created and its edit to `src/methods.ts` are removed or restored, and the refusal says so — so a failed run leaves no partial slice for the next run to collide with. What was there before the gesture, such as a bundle scaffolded in place, is left alone. Every app file is also written create-only: one that appeared after the plan was made is refused, never replaced.

**The emitted files are formatted through this repo's own Prettier config** before anything is written. They land under `src/`, which `make check` runs `prettier --check` over, so a slice whose names pushed one line past the print width would otherwise fail the very first `make all` after being scaffolded. A Prettier that cannot be loaded writes unformatted and says so; a Prettier that loads and then throws is a broken template and propagates, from the read-only half.

## The method directory is the source

`methods/<name>/` is where the method lives in the app, and both of its forms keep `methods/` the source of truth and `src/generated/` purely derived.

### A bundle

The `.mthds` files are the method. The action reads every one of them at request time with `loadMethodBundles("<name>")` — the directory's name is the only thing it holds, never a copy of the bundle — and sends them as `mthds_contents`, in the sorted path order `npm run codegen` projects them in. **To change the method, edit the files and run `npm run codegen`**: `sources.json` hashes each file, so `make check` fails with the usual remedy until you do, and the run follows the edit on its own.

A bundle is validated and projected under the names you gave it, so a diagnostic names the file you pointed at; the generated tree then records each file under its path in `methods/<name>/`, which is what the offline check compares. The name a file is sent under does not reach the artifacts, so the tree is exactly the one `npm run codegen` writes afterwards.

A method whose pipe takes a file hands `prepareInputs` the same bundle the run sends (`files: bundles.map((content) => ({ content }))`), read once per run.

### A manifest

`methods/<name>/method.json` holds exactly the selector and nothing else:

```json
{ "method_ref": "github.com/Pipelex/methods/text_stats@v0.1.1" }
```

It sits under `methods/` rather than beside the generated tree, and that placement is why the codegen scripts treat it like a bundle. `methods/` stays the source of truth and `src/generated/` stays purely derived, so every rule the [trust chain](codegen.md#the-trust-chain) rests on holds by construction: `sources.json` hashes the manifest the way it hashes a bundle, orphan detection still reads "a generated tree with no `methods/<name>/`", and `npm run codegen` regenerates selector-sourced trees beside file-sourced ones. A method directory holds either `.mthds` files or a `method.json`, never both — the two would disagree about where the tree came from, and the check refuses that naming both.

**To move to another version of a published method, edit the tag and run `npm run codegen`.** That is the whole upgrade: the manifest's hash changes, `make check` fails with the usual "run `npm run codegen`" remedy until you do, and the regenerated diff shows what the new tag changed. The run follows without an edit, because the scaffolded action does not carry a copy of the selector: it imports the manifest (`import MANIFEST from "@methods/<name>/method.json"`, the `@methods/*` alias being declared in `tsconfig.json` and `vitest.config.mts`) and sends `MANIFEST.method_ref` or `MANIFEST.method_id`. Switching a manifest from one selector kind to the other is the one edit that also needs the action changed, and `tsc` says so. See [Two source kinds](codegen.md#two-source-kinds) for the mechanics.

## One-shot, on purpose

The gesture never overwrites. Run it for a name that already exists and it refuses, naming the collision and the two ways forward: `npm run codegen` to refresh the tree, or [removing the method](#removing-a-method) to start over. A `--force` that rewrote the app files would delete work you had done in them to save you an `rm`, and the four files it writes are explicitly yours to edit from the moment they land — each carries a header saying so.

The refresh is therefore always `npm run codegen`, and it refreshes only the generated tree. A bundle scaffolded in place is the one exception to "never overwrites" on the generated side: if you had already run `npm run codegen` on it, its tree is regenerated rather than refused, because nothing in a generated tree is yours to lose. It does not re-derive the action, the narrower, the form or the registry entry: those are yours now, and a method change that alters what they need — a renamed output concept, say — surfaces as a type error against the regenerated tree, which is the loud failure you want.

Two escapes if you actually want a second slice of the same method: `--name` scaffolds beside the existing one, and `--pipe` is what makes that useful, since a package with several pipes is the usual reason.

## How each name is derived

Everything comes from one kebab-case slug.

- **The slug** is `--name` when given; otherwise the domain of the chosen pipe for a bundle, the catalog method's `name` for an id (a person chose it) and the address's last path segment for a ref — the package, falling back to the repository for an address naming no package. A bundle in place is named by its directory, which must itself be a usable slug, and a `--name` that disagrees with it is refused. It is kebab-cased (`text_stats` → `text-stats`, `CV screening` → `cv-screening`) and validated: a name that cannot be a directory, a registry id and the stem of four source files is a refusal here, not a broken import later. It must start with a letter, because it also becomes TypeScript identifiers — `3D model` is refused and needs `--name`.
- **`TextStats`** (Pascal) names the component, the three actions and the output type; **`textStats`** (camel) names the adapter module; **`Text stats`** (humanized) is the fallback label.
- **The registry id** is the slug.

## The pipe rule

A published package can carry several pipes, so the pipe is chosen by a rule that ends in a refusal rather than a guess. In order:

1. `PIPE`, if given — bare or qualified, refused if the method declares no such pipe (the message lists the ones it does), and refused as ambiguous if a bare code matches more than one domain.
2. The validate report's `default_pipe_ref`, when the method names one. This is read in preference to `bundle_blueprint.main_pipe` because it is typed and because it is the field a **package manifest's** entry pipe arrives in — `github.com/Pipelex/methods/documents` has no bundle-level main pipe and still has a default here.
3. The only pipe, when the method declares exactly one.
4. Otherwise a refusal listing the pipes and asking for `PIPE`.

The chosen ref is split at its last dot: the domain and the code are what `requireContract` and `requireInputForm` take, and the action sends the bare `pipe_code` beside the selector or the bundle. The rule reads `default_pipe_ref` for a bundle too — for a bundle, it is the pipe named by `main_pipe`.

## The output: a typed narrower, a generic view

**The narrower is typed.** The ts-zod projection emits a schema and a binder for every concept the crate materializes, natives included, so `src/types/<camel>Pipeline.ts` re-exports the concept type under the slice's own name and hands `wireOutput(results)` to `parse<Code>` inside the `try/catch` that rethrows a `BadPipelineOutputError`. The concept code is the segment after the last dot of the pipe's `output.concept_ref`, and the scaffold **confirms those exports exist** in the artifacts it just fetched before writing anything — so an emitter naming change is a refusal with nothing written, not a type error in a file you did not write.

A **plural** output (a `multiplicity` other than `single`) is typed as a list of the concept — `export type <Pascal>Output = <Code>[]` — and parsed with `z.array(<Code>Schema)` over `wireListOutput(results)` rather than `wireOutput`. The runtime renders one `ListContent` two ways, and which one you get depends on the execution path, not on the method (measured live on 2026-09-05): the blocking `execute` response carries a `{ items: [ … ] }` envelope, and so does a durable run's `main_stuff.json` when the worker can hydrate the concept's class (a native concept such as `native.Page`); a durable run of a concept the method declares itself falls back to a bare array. `wireListOutput` (`src/lib/wireOutput.ts`) accepts both and hands back the array, so the generated element schema owns the verdict and no shape is declared in the adapter. It is confined to the one function a plural narrower calls.

**The result view is projected too.** `codegen` commits `OUTPUT_FORM` beside `INPUT_FORM`, the scaffold writes a module-level `RESULT_FIELD = requireResultField(OUTPUT_FORM, CONTRACT, …)` and one `<RunResult field={RESULT_FIELD} value={state.output} name="<slug_in_snake_case>" />`, and the result renders from what the method declares — a structured concept as a labelled record, a plural one as a table, a `native.Text` as its typeset markdown, an image as the picture. A bespoke view is a choice you make for a specific output, not a hole the scaffold leaves behind.

## The form, and file inputs

The scaffolded form is the kernel composition every method gets: `useRunInputs(CONTRACT, DESCRIPTOR)` for values, readiness and the wire shape, `<RunInputsForm>` for the controls, `useRun({ mode, blocking, start, poll })` for the run, `<ModeToggle>`, `<RunStatus>`, `<ErrorDisplay>`. **No field, label or control is written** — they come from the method's own descriptor. The full reference is [`docs/input-form.md`](input-form.md).

When the method's descriptor declares a `document` or `image` input **at any depth** — top-level, inside a list (`cvs: Document[]`), or nested in a structured concept — the scaffolded action gates it before the run: the shape gate, then `checkFileInputs` over the gated inputs with a media-type set chosen by the kinds of every file position (`application/pdf` for a document; PNG/JPEG/WebP for an image — emitted as a named constant with a comment saying it is yours to widen) and `MAX_FILE_BYTES` as the cap, then `prepareInputs` inside `buildOptions`, given the selector or the bundle and the qualified `pipe_ref`. The form gets the drop seam through `src/hooks/useFileInputs.ts`; the kernel's list and object controls hand a nested file to the same `onDropFile` seam at its dotted id, so the form needs nothing more for a plural file input than for a single one.

**A form with a file input holds the run while a file is encoding.** `useFileInputs` unsets the field's value while it reads the file, and the form's `ready` speaks only for the inputs the gate refuses empty — so a form whose file input is optional, or a list the gate accepts empty, would otherwise run without the file just dropped. The Run button is disabled while `encodingIds` is not empty, and the submit handler returns early on the same condition.

Depth is not a special case because the file gate does not read the value's shape to find the files: it walks the pipe's wire descriptor — the same `INPUT_FORM` entry the form is rendered from, looked up with `requireInputForm` beside the contract — exactly as the SDK's `prepareInputs` does to decide what to upload. The two walks agree by construction on where the files are, so every position the SDK would resolve is one the gate has verified first. The plan the scaffold prints names those positions on a `files:` line (`cvs[]`, `packet.scan`).

## The emitted test

The scaffold writes one test file, `src/actions/run<Name>Pipeline.test.ts`, and it is deliberately fixture-free. A test that guessed input fixtures from a descriptor would be a liability the day it guessed wrong. What can be asserted without inventing data is the trust boundary: when the pipe has a gating input, `run<Name>Blocking({})` and `start<Name>Run({})` return a `bad_request` **without calling the SDK**; when it has none, `{}` reaches `execute` carrying the method — the selector read from the manifest, or the bundle read with `loadMethodBundles` — and the bare `pipe_code`.

What the scaffold emits is itself proven inside `make test`: `scripts/lib/scaffold-tree.test.mts` scaffolds one slice of each source kind into a temporary copy of the app from recorded API responses, and runs `tsc`, ESLint, the offline codegen check and the emitted tests over the result. [`ci.md`](ci.md) describes it.

Everything else the slice does is covered by the shared code's own tests (`useRun`, `RunInputsForm`, `runInputs`, `blockingRun`, `durableRun`, `MethodPage`).

## The registry, and the two anchors

`src/methods.ts` holds the one array the page is rendered from: `METHODS`, one `{ id, label, Component }` per method. `<MethodPage>` reads it and renders an empty state when it is empty, the one method as the whole page when it holds one, and a tab per method from the second. Nothing else in the app names a method, which is what makes a scaffolded method **one** insertion point.

The file carries two marker comments, and they are the scaffold's whole contract with it:

```
// add-method:imports
// add-method:tabs
```

The scaffold inserts one import line directly above the first and one array entry directly above the second, refusing if either marker is missing or if the id or the component is already registered. The match is on the **token alone**, not the full comment line, so the prose after the marker can be reworded freely — but **the tokens themselves must not move, be reworded, or be deleted.** A test in `scripts/lib/add-method.test.mts` reads the real file, so a template edit that loses an anchor fails the suite rather than the next person's scaffold run.

## The handshake, and the base URL

A bundle needs no handshake: it travels inline, and the base URL only has to serve `/v1/codegen` and `/v1/validate`'s form views. A selector is resolved **server-side**, so the API has to forward it. `GET /v1/version`'s `extensions` array is the SDK's documented handshake for that, and the three keyed scripts — `add-method`, `codegen` and `codegen:verify` — ask it once per run whenever a selector is involved, before anything is fetched or written. A missing extension is a refusal naming the base URL, the missing kind and what does advertise it, rather than the bare `403` an env-scoped key otherwise produces.

Two cases deliberately **proceed** rather than refuse, because in both the handshake has no verdict to give and the real call's own error is the better message: the handshake itself failing, and a response that advertises no capabilities at all.

**On 2026-09-16 `api.pipelex.com` advertised `runs` and `method_id`, not `method_ref`** (hosted `0.10.1`), and did not yet serve `/v1/validate`'s `input_form` and `output_form` views — which `npm run codegen` and this gesture need for **every** method. So both currently want `PIPELEX_BASE_URL=https://api-dev.pipelex.com`. Nothing in `make all` depends on it: `codegen:check` is pure hashing, so `git clone && make all` stays green with no key and no network.

A selector that the API cannot resolve — an unknown package, a foreign-org id — comes back as a 404, and the server's own message is printed **verbatim** under a line naming the selector. For a bad address that message lists the packages the repository does contain, which is far more useful than a guess about `PIPELEX_BASE_URL` would be.

## Removing a method

In one commit, delete:

1. `methods/<name>/` **and** `src/generated/<name>/` — `make check` fails on either half without the other. For a bundle, `methods/<name>/` is the method itself: keep a copy of the files if you want the method back.
2. `src/types/<camel>Pipeline.ts`, `src/actions/run<Name>Pipeline.ts` and its `.test.ts`, `src/components/<Name>Form.tsx` and any test or e2e spec you wrote for it.
3. The import line and the `METHODS` entry in `src/methods.ts` — leaving both anchors in place.

Then `make all`. `tsc` names any dangling reference itself. Removing the last method brings the page back to its empty state.

## What this deliberately does not do

- **No result component per output shape.** `<RunResult>` renders the method's own output contract, so there is nothing per-shape left to write.
- **No prose edits.** The page heading and description come from `src/site.ts`, and the scaffold leaves them to you.
- **No `--force`, no refresh mode.** `npm run codegen` is the refresh.
- **No bundle authoring.** A bundle is copied as it is; writing or editing one is `/mthds-build` and `/mthds-edit`.
- **A warning, not a refusal, for a catalog id.** A `method_id` is scoped to one organization, so regenerating an id-sourced slice needs a key of that same organization; the gesture says so when it writes one. A published address is the portable form.

## What it leaves room for

A generative arm — a `design.ts` projection written beside `contracts.ts`, and a `make design` gesture run on a slice that already exists — is planned for the gallery first and may follow here. Nothing in the scaffold precludes it: the generated tree already holds app-derived artifacts beside the codegen ones (`DERIVED_ARTIFACTS`), a scaffolded form is yours to extend with a second import, and a registry entry is an object that can grow a field without disturbing the anchors.

## References

- [`docs/codegen.md`](codegen.md) — the trust chain this extends, and the two source kinds in full.
- [`docs/input-form.md`](input-form.md) — the kernel composition every scaffolded form is an instance of.
- `scripts/lib/add-method.mts` — the behavior, with the pure helpers each unit-tested over a table in `add-method.test.mts`.
- `@pipelex/sdk` `dist/client.d.ts` — `validate` / `codegen` / `prepareInputs` selectors, and `version().extensions`.
