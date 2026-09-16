# Changelog

## [Unreleased]

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
