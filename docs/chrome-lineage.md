# Chrome lineage: what this template took from the gallery

This template was extracted from [`pipelex-starter-js`](https://github.com/Pipelex/pipelex-starter-js), the gallery app that presents several demo methods as tabs. The gallery keeps its demos; this template keeps the parts every method needs — the run chrome and the codegen kit — and ships no method. This document records where the extraction started, what was carried unchanged, what was adapted and why, and what was left behind, so that a later fix in either repository can be carried to the other deliberately.

## The source

The extraction was taken from the gallery at commit `3bf44f0fbd3d967b8e50d171454da2278593ee95`. A file listed below as carried unchanged is byte-identical to the gallery's copy at that commit, as extracted.

The two repositories are not kept in sync by any tool. When the gallery's chrome changes, compare against this commit to see whether the template holds the same code, and port the change by hand.

## Carried unchanged

- **The run chrome**: `src/hooks/useRun.ts`, `src/hooks/useRunInputs.ts`, `src/lib/blockingRun.ts`, `src/lib/clientFile.ts`, `src/lib/resultField.ts`, `src/lib/runInputs.ts`, `src/lib/serverEnv.ts`, `src/lib/usageReport.ts`, and the components `CostReport`, `ErrorDisplay`, `RunResult` and `RunStatus`, with their tests where the gallery had them (`useRun`, `CostReport`, `ModeToggle`, `RunInputsForm`, `RunStatus`, `globals.css`).
- **The codegen kit**: the CLI entries `scripts/codegen.mts`, `scripts/codegen-check.mts`, `scripts/codegen-verify.mts` and `scripts/add-method.mts`, and `scripts/lib/api.mts` and `scripts/lib/verify.mts`, with the tests of `api.mts` and `generate.mts` and the scaffold's test fixtures.
- **The configuration**: the ESLint, Prettier, PostCSS and Playwright configurations, `tsconfig.e2e.json` and `tsconfig.scripts.json`, the Vitest setup files, the Husky hook, the CI workflows, `.gitattributes`, `.worktreeinclude`, `.vscode/settings.json` and `LICENSE`.

## Adapted

- **The page and its registry.** The gallery's `ExampleTabs` hard-wired its demo forms and carried the `add-method:` anchors. The template replaces it with `src/methods.ts`, a registry that starts empty and carries the same anchors, and `src/components/MethodPage.tsx`, which renders an empty state, one method as the whole page, or tabs over several. The scaffold's `insertTab` became `registerMethod` and writes to `src/methods.ts`.
- **The app's identity.** The title and description moved out of `src/app/page.tsx` and `src/app/layout.tsx` into `src/site.ts`, as string literals both files read.
- **The bundle loader.** The gallery had one loader function per demo. The template has one generic `loadMethodBundles(name)`, which reads every `.mthds` file under `methods/<name>/`, in path order, and refuses a name that is not kebab-case.
- **Output reading.** `wireOutput` returns `main_stuff` unchanged and `wireListOutput` only unwraps the `{ items }` envelope; neither takes a schema any more. The gallery's `dropWireNulls` is not carried, because the ts-zod projection now emits `.nullish()` and accepts the runtime's explicit `null`s as they arrive. The adapters `make add-method` writes were updated to match.
- **Errors.** The image-specific `bad_image_output` kind, `BadImageOutputError` and its classifier are removed, because they served one demo's output check. The error messages no longer name demo files or tabs.
- **File inputs.** `MAX_PDF_BYTES` is renamed `MAX_FILE_BYTES`, since the cap applies to any file a method takes.
- **The codegen gate.** `discoverMethods` treats a missing `methods/` directory as no method, and `codegen:check` reports an app with no method and no generated tree as current, so `make all` passes on the template as shipped. A tree left behind after its method was removed still fails.
- **The shared tests.** Tests that imported a demo's generated contract now import a recorded copy from `src/test/fixtures/contracts/`, and tests that named a demo pipe use a neutral one.
- **The bootstrap skill.** The script renders the project's README whole instead of renaming tokens inside the template's, writes the title and description into `src/site.ts` through `JSON.stringify`, formats every file it writes through the repository's Prettier, and removes the template's own `release` skill. Its test checks the real template files only while the package still carries the template's name.
- **The documentation.** `README.md`, `CLAUDE.md`, `AGENTS.md`, `CHANGELOG.md`, `docs/add-method.md`, `docs/codegen.md` and `docs/input-form.md` were rewritten or trimmed to describe an app with no demo. The comments in the other adapted files lost their references to demos.
- **The scaffold's names and selector.** A slug must start with a letter, and a scaffolded action imports its selector from `methods/<name>/method.json` through a new `@methods/*` alias in `tsconfig.json` and `vitest.config.mts`. Both fix defects listed at the end of this document. The scaffold's tests start from the registry emptied of registered methods, and `MethodPage`'s test mocks the registry, so neither depends on which methods a project has added.
- **Comment-only changes.** `.env.example`, `.gitignore`, `next.config.js`, `scripts/lib/generate.mts`, `src/app/globals.css`, `src/components/ModeToggle.tsx`, `src/components/RunInputsForm.tsx`, `src/config.ts`, `src/lib/durableRun.ts`, `src/lib/pipelexClient.ts` and `src/lib/resultUrls.ts` differ from the gallery in comments only, `e2e/liveApi.ts` in comments and one skip message, and the `Makefile` in its comments and help text, which now say the keyed targets need the api-dev base URL for the time being.
- **The version.** The template starts its own history at `0.1.0`.

## New

- `src/site.ts`, `src/methods.ts`, `src/components/MethodPage.tsx` and its test.
- `src/test/fixtures/contracts/`, recorded from the gallery's generated `contracts.ts` files at the source commit, each under a banner that says so.
- `e2e/home.spec.ts`, an offline spec that checks the page renders its title and either the empty state or a form.
- `methods/README.md` and this document.

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
