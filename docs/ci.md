# Continuous integration

Two workflows run on every pull request, and neither needs a key or a network beyond the package registry.

| Workflow                            | Runs                            | What it proves                                                                                                               |
| ----------------------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/lint-check.yml`  | `make check`                    | ESLint, Prettier, `tsc` over the app, the e2e specs and the scripts, and the offline codegen check over every generated tree |
| `.github/workflows/tests-check.yml` | `make agent-test`, `make build` | The unit tests, and a production build                                                                                       |

## What the unit tests prove about `make add-method`

The scaffold writes code into files nobody reviews line by line, so what it writes is proven twice inside `make test`:

- **`scripts/lib/add-method.test.mts`** pins every decision the scaffold takes — the argument, the bundle it reads, the names, the pipe, the output binding, the files it renders — and the order of its two halves: every refusal before the first write, and a failed write that removes what it wrote.
- **`scripts/lib/scaffold-tree.test.mts`** copies the whole tree to a temporary directory, runs the real `add-method` there once for each source kind — a published address, a catalog id, and a bundle copied in — against complete API responses recorded under `scripts/lib/fixtures/recorded/`, then runs `tsc` over the copy, ESLint over the emitted files, the offline codegen check over each new generated tree, and vitest over each emitted action test. A change to the shared code that breaks what the scaffold emits fails here rather than in the next project. The slices it writes are named `fixture-…`, so the test runs unchanged in a project that has methods of its own.

The recorded responses are real: they were returned by `api-dev.pipelex.com` for `github.com/Pipelex/methods/text_stats@v0.1.1` and for the bundle in `scripts/lib/fixtures/bundles/receipt-review/`, and kept verbatim for the fields the scripts read, stamps included. Re-record them when a change to the API's responses matters to the scaffold, with the two requests `fetchGenerated` sends:

- `validate` (or `validateFiles` for the bundle) with `views: ["input_form", "output_form"]`, keeping `is_valid`, `pipe_io_contracts`, `input_form`, `output_form`, `default_pipe_ref`, and from `bundle_blueprint` its `domain`, `description`, `main_pipe` and each pipe's `description`, into `<name>.validate.json`;
- `codegen` with `kind: "types"` and `target: "ts-zod"`, keeping `is_valid`, `kind`, `target`, `crate_fingerprint`, `engine_version`, `artifacts`, `lock` and `lock_filename`, into `<name>.codegen.json`.

<!-- template-only:begin -->

## The live create job (template only)

`.github/workflows/create-live.yml` runs `make create` for real on a fresh checkout of the template: once with the bundle fixture, once with the `text_stats` package address. It then checks that the project is what the gesture promised — the template's name, the bootstrap, the release skill and the gesture itself gone, `.env.local` holding exactly one base URL line, the one the job ran against — and serves the page with the offline e2e spec, which finds the project's title and the method's form. It runs no method, so it spends no model call.

- **Trigger**: by hand only (`workflow_dispatch`), from the Actions tab or with `gh workflow run create-live.yml`. It never runs on a pull request.
- **Input**: `base_url`, the API the gesture runs against, defaulting to `https://api-dev.pipelex.com` until production serves the form views and `method_ref`.
- **Secret**: `PIPELEX_API_KEY`, a repository secret holding a key for that API. **When the secret is not set, the job runs nothing**: it succeeds with a warning saying so, in the run's summary and as an annotation. Add the secret under Settings → Secrets and variables → Actions to make the job meaningful.

The bootstrap removes this workflow, and this section, from every project the template creates: a project has no `make create` to prove.

<!-- template-only:end -->
