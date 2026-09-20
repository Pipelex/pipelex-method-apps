# pipelex-method-apps

The family of Pipelex method templates: one directory per shape and language, each of which a project starts as a copy of. The root holds what belongs to the family, and [`docs/family.md`](docs/family.md) explains it.

## Layout

| Dir          | What it is                                                                                                                                                                                                                               |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `webapp-js/` | The Next.js 16 web app template, package `pipelex-method-webapp-js`: an app that renders each method's input form and result view from its contract. **Its own [`CLAUDE.md`](webapp-js/CLAUDE.md) is the guide for any work inside it.** |

The root carries the gate (`Makefile`), the family's version (`VERSION`) and changelog (`CHANGELOG.md`), the release skill (`.claude/skills/release/`) and the skill that moves every template onto a newer form kernel (`.claude/skills/bump-mthds-form/`), the root twins of the templates' workflows and `family-check.yml` (`.github/workflows/`), the pre-commit hook that runs each template's own (`.husky/pre-commit`), and the root's tooling with its tests (`scripts/`).

## Rules

- **A template directory must work on its own.** A project is a copy of that directory alone, so nothing in it may need the root: no import, script or config reaching above it. What a template says about this repository goes in a passage its bootstrap removes or a file its bootstrap replaces.
- **Work inside a template follows that template's `CLAUDE.md`**, and its gate runs the same from inside it or from here.
- **A workflow is edited in its template, then re-rendered.** After changing anything under `<template>/.github/workflows/`, run `make workflows` and commit the twins with it. Never edit a file under `.github/workflows/` that opens with `# Rendered by`: `make check` reports it as stale.
- **The family has one version.** Only the release moves it, and it moves `VERSION` and every template's manifest together; `make check` fails when they disagree.
- **Changelog entries go in the root `CHANGELOG.md`**, under `## [Unreleased]`. A template's own `CHANGELOG.md` only points here.
- **After any change, run `make all` at the root**, or `make agent-test` for the tests alone, quiet on success. `make format` fixes a formatting failure, at the root and in every template.
- **Pull requests target `dev`**; a `release/vX.Y.Z` branch targets `main`, and is cut by the `release` skill.
- **Adding a template** follows the steps at the end of [`docs/family.md`](docs/family.md).
