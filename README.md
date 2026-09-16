# pipelex-method-app

A Next.js 16 template for an app that runs [MTHDS](https://mthds.ai) methods through the [Pipelex](https://pipelex.com) API with [`@pipelex/sdk`](https://www.npmjs.com/package/@pipelex/sdk). Each method's input form and result view are rendered from the method's own contract, so adding a method writes no form fields and no result markup.

The template ships no method. It ships what every method needs: blocking and durable execution, a server-side input gate, file uploads, classified errors, a cost report, and the codegen kit that projects a method into typed code. You add methods with one command.

Looking for worked examples instead? [`pipelex-starter-js`](https://github.com/Pipelex/pipelex-starter-js) is the gallery this template was extracted from, with several demo methods presented as tabs.

## Use this template

1. Click **Use this template** at the top-right of the GitHub page to create your own repository, then clone it.
2. Open it in [Claude Code](https://claude.com/claude-code) and run `/bootstrap`. It names the project, writes its title and description into `src/site.ts`, renders the project's own README, resets the version and changelog, applies your license, and runs the checks.
3. Add your first method:

   ```bash
   cp .env.example .env.local   # set PIPELEX_API_KEY
   make install
   PIPELEX_BASE_URL=https://api-dev.pipelex.com make add-method METHOD=github.com/Pipelex/methods/text_stats@v0.1.1
   make dev                     # http://localhost:4300
   ```

`METHOD` is a published package address or a method id from your organization's catalog (`mt_…`, from [app.pipelex.com](https://app.pipelex.com)).

## What a method looks like here

With no method, the page shows an empty state that names the command above. With one method, its form is the page. With several, they are tabs. The registry is `src/methods.ts`.

`make add-method` writes one vertical slice per method:

- `methods/<name>/method.json` — the selector naming where the method lives. The method is never copied into the repository; moving to another version is editing the tag and running `npm run codegen`.
- `src/generated/<name>/` — the method's zod schemas, binders, input and output contracts, and the codegen lock. Committed, and never edited by hand.
- `src/types/`, `src/actions/`, `src/components/` — a typed narrower, the Server Actions for both execution modes with a test, and the form.
- `src/methods.ts` — one import and one registry entry.

The command refuses rather than overwriting a slice that already exists, and `DRY_RUN=1` prints the plan without writing anything. [`docs/add-method.md`](docs/add-method.md) is the reference, including how to remove a method.

## How it works

1. A form renders the method's inputs from its committed input-form descriptor with `@pipelex/mthds-form`, and calls the `useRun` hook, which dispatches to the Server Actions for the chosen mode.
2. The Server Action gates the inputs against the same committed contract — a Server Action is a public endpoint, so the browser's check is only UX — and checks any file reference's scheme, type and size.
3. The SDK runs the method: `execute` in **Blocking** mode, or `start` and a poll loop in **Durable** mode, the default, which survives the hosted gateway's ~30s synchronous cap and streams live status.
4. A narrower validates the main output against the zod schema generated from the method's contract.
5. `<RunResult>` renders the validated output from the method's output-form descriptor, or `<ErrorDisplay>` shows a classified error.

[`docs/input-form.md`](docs/input-form.md) covers the forms and result views, and [`docs/codegen.md`](docs/codegen.md) covers the generated types and the checks that keep them current.

## Prerequisites

- Node.js 22.12+.
- Access to the **hosted Pipelex API**, currently in private beta. Join the waitlist at [go.pipelex.com/waitlist](https://go.pipelex.com/waitlist); once you have access, get an API key at [app.pipelex.com](https://app.pipelex.com).

## Environment variables

| Variable                     | Purpose                                                                                           | Default                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------- | ------------------------- |
| `PIPELEX_API_KEY`            | Bearer token used by the SDK                                                                      | (required at runtime)     |
| `PIPELEX_BASE_URL`           | Pipelex API base URL                                                                              | `https://api.pipelex.com` |
| `NEXT_PUBLIC_EXECUTION_MODE` | Default execution mode for every method — `durable` or `blocking`. Each method also has a toggle. | `durable`                 |

**`make add-method`, `npm run codegen` and `npm run codegen:verify` currently need `PIPELEX_BASE_URL=https://api-dev.pipelex.com`.** `api.pipelex.com` does not yet serve the form views codegen asks for, nor the `method_ref` selector a package address needs. Each script names the missing capability rather than failing obscurely. `make all` needs neither a key nor a network.

A variable already exported in your shell wins over `.env.local`.

## Make targets

| Target                | Purpose                                                                                               |
| --------------------- | ----------------------------------------------------------------------------------------------------- |
| `make dev`            | Start the Next.js dev server on port 4300                                                             |
| `make build`          | Production build                                                                                      |
| `make add-method`     | Scaffold a method into the app — `METHOD=<mt_… \| address>` (needs an API key)                        |
| `make codegen`        | Regenerate `src/generated/` from `methods/` (needs an API key)                                        |
| `make codegen-check`  | Prove `src/generated/` is current — offline, no key                                                   |
| `make codegen-verify` | Ask the API whether the committed types still match the methods (needs an API key)                    |
| `make test`           | Unit tests                                                                                            |
| `make test-e2e`       | **Optional** Playwright e2e — a live spec costs an LLM call (prompts first; auto-skips without a key) |
| `make check`          | lint + format-check + typecheck + codegen-check                                                       |
| `make all`            | check + test + build                                                                                  |
| `make use-local`      | Install the sibling `../pipelex-sdk-js` and `../mthds-form` checkouts into `node_modules`             |
| `make use-npm`        | Restore the published `@pipelex/sdk` and `@pipelex/mthds-form`                                        |

`make help` lists them all.

## Stack

Next.js 16 (App Router), React 19, TypeScript 5 (strict), Tailwind CSS 4 (configured in CSS), Vitest 4 with Testing Library, Playwright, ESLint 9, Prettier 3, Husky with lint-staged, [`@pipelex/sdk`](https://www.npmjs.com/package/@pipelex/sdk) and [`@pipelex/mthds-form`](https://www.npmjs.com/package/@pipelex/mthds-form).

## Documentation

- [`docs/add-method.md`](docs/add-method.md) — adding a method, and removing one.
- [`docs/codegen.md`](docs/codegen.md) — the generated types and the checks that keep them current.
- [`docs/input-form.md`](docs/input-form.md) — how the input form and the result view are rendered from a method's contract.
- [`docs/chrome-lineage.md`](docs/chrome-lineage.md) — what this template took from the gallery, and what it changed.
- [`CLAUDE.md`](CLAUDE.md) — the project guide for coding agents.

## License

This project is licensed under the [MIT license](LICENSE). Runtime dependencies are distributed under their own licenses via npm.
