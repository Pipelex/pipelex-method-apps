# Chrome lineage: the template leads, and what it took from the gallery

This template was extracted from [`pipelex-starter-js`](https://github.com/Pipelex/pipelex-starter-js), the gallery app that presents several demo methods as tabs. The gallery keeps its demos; this template keeps the parts every method needs — the run chrome and the codegen kit — and ships no method. This document records where the extraction started, what was carried unchanged, what was adapted and why, and what was left behind, so that a later fix in either repository can be carried to the other deliberately.

## The direction: this template is the reference copy

Decided on 2026-09-17, after weighing a published package and a one-way sync gesture against the cost of a new release train. **The run chrome stays copied by hand, and this template leads it.** A fix to the chrome lands here first and is carried to `pipelex-starter-js` as a twin task filed against the gallery; the reverse direction is a correction, not the norm. Nothing keeps the two in sync by itself, and no tool is coming: the question reopens the day a third app needs the same chrome.

So a session changing anything under "Carried unchanged" below owes the gallery a twin — file it before the change lands, naming the files and what the fix was, because whoever ports it there will not have this context. A session changing only what is listed under "Adapted" owes nothing: those files have already diverged deliberately.

## The source

The extraction was taken from the gallery at commit `3bf44f0fbd3d967b8e50d171454da2278593ee95`, which is the history rather than the rule: a file listed below as carried unchanged was byte-identical to the gallery's copy at that commit, and a file the template changed after the extraction is listed under "Adapted" and says what changed. To see whether the gallery still holds the same code, compare against that commit and the changes since.

## Carried unchanged

- **The run chrome**: `src/hooks/useRun.ts`, `src/hooks/useRunInputs.ts`, `src/lib/blockingRun.ts`, `src/lib/clientFile.ts`, `src/lib/resultField.ts`, `src/lib/runInputs.ts`, `src/lib/serverEnv.ts`, `src/lib/usageReport.ts`, and the components `CostReport`, `ErrorDisplay`, `RunResult` and `RunStatus`, with their tests where the gallery had them (`useRun`, `CostReport`, `ModeToggle`, `RunInputsForm`, `RunStatus`, `globals.css`).
- **The codegen kit**: the CLI entries `scripts/codegen.mts`, `scripts/codegen-check.mts`, `scripts/codegen-verify.mts` and `scripts/add-method.mts`, and `scripts/lib/api.mts` and `scripts/lib/verify.mts`, with the test of `api.mts` and the scaffold's test fixtures (`scripts/lib/fixtures/add-method-fixtures.mts`).
- **The configuration**: the ESLint, Prettier, PostCSS and Playwright configurations, `tsconfig.e2e.json` and `tsconfig.scripts.json`, the Vitest setup files, the Husky hook, the CI workflows, `.gitattributes`, `.worktreeinclude`, `.vscode/settings.json` and `LICENSE`.

## Adapted

- **The page and its registry.** The gallery's `ExampleTabs` hard-wired its demo forms and carried the `add-method:` anchors. The template replaces it with `src/methods.ts`, a registry that starts empty and carries the same anchors, and `src/components/MethodPage.tsx`, which renders an empty state, one method as the whole page, or tabs over several. The scaffold's `insertTab` became `registerMethod` and writes to `src/methods.ts`.
- **The app's identity.** The title and description moved out of `src/app/page.tsx` and `src/app/layout.tsx` into `src/site.ts`, as string literals both files read.
- **The bundle loader.** The gallery had one loader function per demo. The template has one generic `loadMethodBundles(name)`, which reads every `.mthds` file under `methods/<name>/`, in path order, and refuses a name `add-method` would not derive: one that is not kebab-case or does not start with a letter.
- **Output reading.** `wireOutput` returns `main_stuff` unchanged and `wireListOutput` only unwraps the `{ items }` envelope; neither takes a schema any more. The gallery's `dropWireNulls` is not carried, because the ts-zod projection now emits `.nullish()` and accepts the runtime's explicit `null`s as they arrive. The adapters `make add-method` writes were updated to match.
- **Errors.** The image-specific `bad_image_output` kind, `BadImageOutputError` and its classifier are removed, because they served one demo's output check. The error messages no longer name demo files or tabs.
- **File inputs.** `MAX_PDF_BYTES` is renamed `MAX_FILE_BYTES`, since the cap applies to any file a method takes.
- **The codegen gate.** `discoverMethods` treats a missing `methods/` directory as no method, and `codegen:check` reports an app with no method and no generated tree as current, so `make all` passes on the template as shipped. A tree left behind after its method was removed still fails.
- **The shared tests.** Tests that imported a demo's generated contract now import a recorded copy from `src/test/fixtures/contracts/`, and tests that named a demo pipe use a neutral one.
- **The bootstrap skill.** The script renders the project's README whole instead of renaming tokens inside the template's, writes the title and description into `src/site.ts` through `JSON.stringify`, formats every file it writes through the repository's Prettier, and removes what only the template needs: its own `release` skill, the one-shot gesture listed under "New", and the passages of shared files that describe that gesture, which sit between marker lines. Its test checks the real template files only while the package still carries the template's name.
- **The documentation.** `README.md`, `CLAUDE.md`, `AGENTS.md`, `CHANGELOG.md`, `docs/add-method.md`, `docs/codegen.md` and `docs/input-form.md` were rewritten or trimmed to describe an app with no demo. The comments in the other adapted files lost their references to demos.
- **The scaffold's names and selector.** A slug must start with a letter, and a scaffolded action imports its selector from `methods/<name>/method.json` through a new `@methods/*` alias in `tsconfig.json` and `vitest.config.mts`. Both fix defects listed at the end of this document. The scaffold's tests start from the registry emptied of registered methods, and `MethodPage`'s test mocks the registry, so neither depends on which methods a project has added.
- **The scaffold's bundle arm.** The gallery's `add-method` takes only a catalog id or a published address. The template's also takes a path to a `.mthds` file or to a directory of them, copies the bundle into `methods/<name>/` (or scaffolds a directory already there in place), and writes an action that names its directory once and reads the bundle through `loadMethodBundles`. `scripts/lib/add-method.mts` and its test differ from the gallery throughout because of it.
- **The scaffold's write half.** The gallery's `runAddMethod` is split into `planAddMethod`, which fetches, derives and renders and formats every file without writing anything, and `writeAddMethod`, which writes only files that do not exist yet and removes what it created if a write fails. The scaffolded form of a method with a file input waits for every file to finish encoding before it runs, and the emitted action test imports only the actions it calls. Each fixes a defect listed at the end of this document.
- **The generator.** `scripts/lib/generate.mts` and its test differ from the gallery beyond comments: the guard that keeps the server from overwriting a file the generator owns normalizes the artifact's path and covers `codegen.lock` and `sources.json` as well as `contracts.ts`, and the fetch also returns the domain's and the pipes' descriptions from the bundle blueprint, which the template reads to describe a project.
- **The Makefile.** Besides its comments and help text, which say the keyed targets need the api-dev base URL for the time being, the `add-method` target reads only the non-blank variables given on the `make` command line and passes their values to the script exactly as typed, through the `shq`, `given`, `opt`, `flag` and `require` helpers, which `scripts/lib/makefile.test.mts` pins. The gallery's target tests `METHOD` inside a shell string, where a value holding `$(…)` is executed. The local-package targets differ too: the template adds `use-local-form`, `use-npm-form` and `local-status`, packs into a temporary directory, refuses a one-package switch while the SDK is local, and switches back to the versions the lockfile pins where the gallery's `use-npm` re-pins `@latest`.
- **Comment-only changes.** `.env.example`, `.gitignore`, `next.config.js`, `src/app/globals.css`, `src/components/ModeToggle.tsx`, `src/components/RunInputsForm.tsx`, `src/config.ts`, `src/lib/durableRun.ts`, `src/lib/pipelexClient.ts` and `src/lib/resultUrls.ts` differ from the gallery in comments only, and `e2e/liveApi.ts` in comments and one skip message.
- **The version.** The template starts its own history at `0.1.0`.

## New

- `src/site.ts`, `src/methods.ts`, `src/components/MethodPage.tsx` and its test.
- `src/test/fixtures/contracts/`, recorded from the gallery's generated `contracts.ts` files at the source commit, each under a banner that says so.
- `e2e/home.spec.ts`, an offline spec that checks the page renders its title and either the empty state or a form.
- `methods/README.md`, `docs/ci.md` and this document.
- `scripts/lib/scaffold-tree.test.mts`, which copies the template to a temporary directory, scaffolds one method of each source kind into the copy from recorded API responses, and runs the type check, ESLint, the offline codegen check and the emitted action tests over it. The recordings are under `scripts/lib/fixtures/recorded/`, and the bundle it copies in is `scripts/lib/fixtures/bundles/receipt-review/`.
- The one-shot gesture that turns a copy of the template into a project, with its test, its document and its CI workflow. The bootstrap removes all of it, so a project created from the template does not carry it.

## Not carried

- **The demos**: everything under `methods/` and `src/generated/`, the demo Server Actions in `src/actions/`, the demo adapters in `src/types/`, the demo forms and `ExampleTabs`, `public/sample-invoice.pdf`, and the demo e2e specs.
- **`e2e/error-display.spec.ts`.** It checks the offline error display by driving a demo form, so it could not be separated from the demo; `home.spec.ts` takes its place as the offline spec, and the error display is covered by its unit tests.
- **`docs/adopt-in-an-existing-project.md`**, which uses the gallery as its worked example.
- **The gallery's `CHANGELOG.md`**, which chronicles the gallery.

## Defects the gallery shipped that the template does not

- **The bootstrap test failed in a bootstrapped project.** It read the real template files and expected the template's name, so it failed as soon as the project was renamed. The template's test skips those checks once the package name has changed.
- **The bootstrap garbled the README and could write the title as markup.** It renamed tokens across a README that described the template, and wrote the title into JSX text. The template's bootstrap renders a new README and writes the title only into `src/site.ts`, as a string literal.
- **A schema-guided null strip ran on every output.** `dropWireNulls` had outlived the projection change that made it unnecessary. The template does not carry it.
- **An upgrade by manifest left the run on the old method.** The gallery's scaffold copied the selector into the action as a literal, so editing `method.json` and regenerating moved the contracts and the form to the new version while the run still named the old one, and `make check` stayed green. The template's action reads the manifest.
- **A slug starting with a digit produced a slice that could not compile.** `3D model` became `3d-model` and then `3dModelForm`, and the failure came after the manifest and the generated tree were written, so a retry was refused. The template refuses such a slug before it fetches the method's generated tree or writes anything.
- **A failed scaffold left a partial slice that blocked a retry.** The gallery writes the manifest and the generated tree before it formats the app files, so a formatting failure leaves files behind that the next run refuses as a collision. The template renders and formats every file before its first write, and removes what it wrote when a write fails.
- **An optional file input could be submitted while it was still encoding.** The gallery's scaffolded form enables its Run button as soon as the required inputs are filled, so a run started while an optional file was still being read went without it. The template's form waits until no file is encoding.
- **The emitted action test did not compile for a method that gates on nothing.** It imported the durable start action without calling it, which the type check refuses. The template imports it only in the test that uses it.
- **The server could overwrite a file the generator owns.** The gallery's guard compared the raw artifact path with `contracts.ts` alone, so an artifact named `nested/../contracts.ts`, `codegen.lock` or `sources.json` would replace the app's own file. The template normalizes the path and checks all three.
- **The `add-method` target could execute its argument.** The gallery's Makefile tests `METHOD` inside a shell string and takes `NAME` and `LABEL` from the environment too. The template's reads only command-line variables and passes them literally.
