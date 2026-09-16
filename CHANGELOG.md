# Changelog

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
