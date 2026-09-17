# Changelog

## [Unreleased]

### Added

- **`make use-local-form`, `make use-npm-form` and `make local-status`**: the web app template switches the form kernel alone to the workspace's `mthds-form` checkout and back, and says package by package whether `node_modules` holds a local build or the published release, which the version cannot tell apart. A switch of the kernel alone refuses while the SDK is local, since its install would silently put the SDK back on npm; `make use-local` and `make use-npm` still switch both. The root runs each target in every template.
- **A durable run shows its id**: the web app template's status card prints the run id while a run is going and its error display prints it when one fails, each selectable in a click, and the dev server logs it once when the run starts. A run started from a bundle in the project has no catalog id, so the id is the only way to look it up afterwards — in the back office, through the API, or in the workshop.

### Changed

- **`make use-npm` restores the versions the lockfile pins (Breaking)**: switching the web app template back from local packages installs the `@pipelex/sdk` and `@pipelex/mthds-form` versions `package-lock.json` pins, and no longer installs `@latest` and rewrites `package.json` and the lockfile. A release published while you worked locally arrives through the `bump-sdk` and `bump-mthds-form` skills, which read its changelog first.
- **The web app template runs on `@pipelex/mthds-form` 0.9.0**: a nested record in a result table is named by its first text field instead of printing its JSON, a value that wraps in a record's label-and-value rows aligns left while a one-line value still ends at the right edge, and a file a form holds as a `data:` URL shows its format and size rather than its base64. The kernel's `./generative` entry comes with it.
- **A derived title or label keeps an acronym's capitals**: `make create` and `make add-method` respell a word the method itself spells with an interior capital, so a `cv_screening` method gives "CV Screening" and a Run button reading "Run CV screening" where both said "Cv". A `--title` or a `--label` given on the command line, and a catalog name, are left exactly as written.
- **The web app template leads the run chrome**: `docs/chrome-lineage.md` says so, and says what a session changing a carried file owes the gallery it was extracted from. It described the opposite direction.

### Fixed

- **A created project's `bump-mthds-form` and `bump-sdk` skills recognise a breaking change**: both read the `(Breaking)` marker that the form kernel's and the SDK's changelogs put at the end of an entry's title, where they looked for a `Breaking —` prefix neither writes. `bump-mthds-form` also treats a renamed `InputForm`, `OutputForm` or `PipeIOContracts` as a change to the project's own `renderContracts`, which writes that import into every `contracts.ts`, instead of sending it to the engine.
- **The dev server no longer prints uploaded files**: the web app template sets `logging.serverFunctions: false`, because `next dev` logs each Server Function call with its arguments and a file reaches its Server Action as a base64 `data:` URL — so every document dropped into a form was written to the log in full.
- **A created project's docs no longer illustrate themselves with a method it never had**: `CLAUDE.md` names the example it walks through as one, and `docs/codegen.md`'s tree sketch uses placeholders.

- **`loadMethodBundles` refuses a name that starts with a digit**: the web app template's bundle loader holds a method directory name to the rule `make add-method` derives one by, kebab-case with a letter first, so a name such as `3d-model`, which the scaffold refuses, is refused by the loader too.
- **`loadMethodBundles` reads a bundle in codegen's order on Windows**: the loader sorts on each file's path inside the method directory written with `/`, as `npm run codegen` does, so a run sends `mthds_contents` in the order the generated types were projected from on every platform, where it used to put `steps2.mthds` before `steps/score.mthds` on Windows.
- **`make add-method` runs one write at a time**: the write half holds a lock file, `.add-method.lock` at the app's root, and a second run that reaches it meanwhile is refused before writing anything, so a run that fails can no longer remove a generated tree another run has just written. A lock left by a run that was killed is named in the refusal, with whether its pid is still running, and is removed by hand.
- **`make add-method` refuses a symlinked bundle path, `methods/` or `src/generated/`**: a `.mthds` link is no longer read through to its target, as a link inside a bundle directory already was not, and the refusal for either no longer says the rule applies only under `methods/` and `src/generated/`. A symlinked `methods/` or `src/generated/` is refused before anything is fetched, as `npm run codegen` refuses it, instead of having the slice written through the link.

## [v0.2.0] - 2026-09-16

### Highlights

**The repository is now a family of templates.** Each template is a directory of its own, `webapp-js/` first, and a project starts as a copy of that directory. **The web app is safer by default**: it listens on loopback, so it no longer serves methods billed to the developer's API key to every network the machine is on, and it runs on a Next.js release clear of two critical remote-code-execution advisories.

### Changed

- **The repository is the `pipelex-method-apps` family of templates (Breaking)**: the GitHub repository is renamed from `pipelex-method-app`, whose URLs redirect, and is no longer marked as a template. The web app template moved into `webapp-js/`, and a project now starts as a copy of that directory rather than from GitHub's **Use this template** button — clone the repository shallowly, copy `webapp-js/` into a new directory, run `git init` there, then `make create`. The family carries one version, in the root `VERSION` file, and one changelog, this one, and the root `make all` runs every template's checks, tests and build.
- **The web app template's package is `pipelex-method-webapp-js` (Breaking)**: `make create` and the bootstrap run only while `package.json` carries that name, and a created project's first changelog entry links the template's directory.
- **`make use-local` takes `SIBLINGS_DIR`**: the sibling `pipelex-sdk-js` and `mthds-form` checkouts are built from the directory given, and from the parent directory when none is.

### Fixed

- **`make create` on a busy machine**: the web app template's tests that spawn `make`, or run the bootstrap script, allow a minute each instead of five seconds, so the gesture's closing `make all` no longer fails, and leaves the project half-finished, when the machine is loaded.

### Removed

- **The live `make create` workflow**: no workflow runs the gesture against the API, because none is given an API key. The template's `docs/ci.md` describes the local run that takes its place.

### Security

- **The web app's servers listen on loopback by default (Breaking)**: `make dev`, `make start`, `npm run dev` and `npm run start` bind `127.0.0.1` instead of every network interface, because anyone who could reach the server ran methods billed to the developer's `PIPELEX_API_KEY`. `APP_HOST`, beside `APP_PORT`, widens it — `make dev APP_HOST=0.0.0.0` for a container or another device — and the Makefile warns whenever a server starts beyond loopback.
- **Next.js 16.3.5**: the web app template requires `next` and `eslint-config-next` at `^16.3.5` and locks 16.3.5, past the two critical remote-code-execution advisories that affect every Next.js 16 release before 16.3.3 (GHSA-p293-qw3h-jr36, GHSA-2xp9-vwfh-vxw4). The lock also takes the patched `vitest`, `sharp`, `browserslist` and `js-yaml`, so `npm audit` reports nothing.

## [v0.1.0] - 2026-09-16

### Added

- **The template**: a Next.js 16 app that runs MTHDS methods through the Pipelex API and ships no method of its own. With no method it renders an empty state that names `make add-method`; with one it renders that method's form as the page; with several it renders them as tabs.
- **`src/methods.ts`, the method registry**: `METHODS` lists each method's id, label and form component, and carries the two `add-method:` anchors the scaffold inserts at.
- **`src/site.ts`, the app's identity**: the page heading, the browser title and the meta description all read `SITE.title` and `SITE.description`, so renaming the app edits one file.
- **`make create`**: turns a fresh copy of the template into the app for one method in one command (`make create METHOD=<method>`). It derives the project's name, title and description from the method, adds the method, runs the bootstrap, writes `.env.local` from the shell, re-syncs `package-lock.json` and runs `make all`; it asks nothing, refuses a value it cannot derive by naming the flag that supplies it, and is removed from the project once it has run.
- **`make add-method`**: scaffolds a method into the app from a local bundle (`METHOD=path/to/method.mthds` or a directory of them, copied into `methods/<name>/`), from the platform (`METHOD=mt_…`) or from a published package (`METHOD=github.com/owner/repo[/pkg][@tag]`), writing its generated tree, adapter, Server Action trio, action test, form and registry entry. It renders every file before writing any, refuses rather than overwrite a slice that already exists, and removes what it wrote if a write fails. A selector's action reads it from `methods/<name>/method.json`, so moving to another version of the method is editing that file and running `npm run codegen`.
- **Generated types and contracts**: `npm run codegen` projects each method under `methods/` into `src/generated/<name>/`, and `npm run codegen:check` proves the tree current offline, reporting an app with no method as current.
- **`loadMethodBundles(name)`**: reads every `.mthds` file under `methods/<name>/`, in path order, for a method authored in the app.
- **The run chrome**: blocking and durable execution behind one `useRun` hook, input forms and result views rendered by `@pipelex/mthds-form` from each method's contract, a server-side input gate, a file-input gate that checks scheme, type and size, a result URL policy, classified errors and a per-run cost report.
- **The `/bootstrap` skill**: turns a repository created from the template into a named project, rendering its own README, writing its title and description into `src/site.ts`, resetting its version and changelog, applying its license, removing what only the template needs, and formatting every file it writes.
