# The family layout

`pipelex-method-apps` holds one template per shape and language. A project is a copy of one template directory, and nothing else from this repository ever reaches it. This document describes what the root adds around the templates, and why each piece is shaped the way it is.

## Why one repository

The templates are inputs to a generator gesture, not showcases: a person or a coding agent copies one out and runs its `make create`, and nobody browses a template that ships no method. Keeping them together buys one contract for the scaffold that drives them, one gate that runs all of them, one version, one release, and changes that land in every template at once when the codegen contract or the SDK moves. What it costs is described below: workflows that the root has to twin, a root gate that delegates, and an acquisition recipe that copies a directory out of a clone instead of cloning a repository.

GitHub's **Use this template** button is not the way in. It copies a whole repository, and a copy of a shell with no method in it is not an app anyone wanted.

## The layout

```
Makefile                  the root gate: family checks, then each template's targets
VERSION                   the family's version, one line
CHANGELOG.md              the family's changelog
.claude/skills/release/   the one release skill
.github/workflows/        the root twins of each template's workflows, and family-check.yml
.husky/pre-commit         runs each touched template's own hook from inside it
scripts/                  the root's own tooling (workflows.mjs, versions.mjs) and its tests
webapp-js/                the Next.js web app template — a complete project on its own
```

Planned directories, not here yet: `cli-js/`, `cli-python/` and `webapp-python/`.

**A template directory is complete on its own.** It has its own `Makefile`, `CLAUDE.md`, `.gitignore`, `.github/workflows/` and checks, and works from inside its directory exactly as it will in a project. What it says about this repository sits in passages its bootstrap removes, or in files its bootstrap replaces, so a project never inherits a sentence about a mono-repo it is not in.

## The root gate

The root `Makefile` names the templates once, in `TEMPLATES`, and each of `install`, `check`, `lint`, `format`, `format-check`, `typecheck`, `test`, `agent-test`, `build`, `lock`, `clean`, `use-local` and `use-npm` runs the same target in every template, stopping at the first failure. `check` and `test` first run what belongs to the family:

- **`check-versions`** — `scripts/versions.mjs`. The family carries one version, in `VERSION`. Each template's manifest carries a version too, because a project keeps that manifest, and the check fails when any of them disagrees with `VERSION`. It reads a template's `package.json`, or the `[project]` table of its `pyproject.toml`.
- **`check-workflows`** — `scripts/workflows.mjs --check`, described in the next section.
- **Prettier over the root's own Markdown, scripts and JSON**, with the root's `.prettierrc`. A template's files are formatted by that template, with its own configuration and exclusions, so the root's command leaves out every directory `TEMPLATES` names. The root has no `.prettierignore` on purpose: an editor opened at the root reads the ignore file at the workspace folder first, and one listing the templates would stop it formatting any of their files, while without one it finds each template's own.
- **`test-family`** — `node --test` over `scripts/*.test.mjs`, which covers the root's scripts and runs each check against this repository itself.

The root has no package manager of its own. Its Prettier and Husky are the first template's installed binaries, which is why `make install` comes first.

## The workflow twins

GitHub reads a repository's workflows only from `.github/workflows/` at its root. A template's own workflows have to stay in its directory, because they travel into every project created from it, so they never run in this repository. The root therefore runs a **twin** of each: `.github/workflows/<template>-<file>`, rendered by `make workflows` from `<template>/.github/workflows/<file>`.

A twin is the source with these changes and no others: a header naming the source, the template's name added to the workflow's name and to each job's name, `defaults.run.working-directory` set to the template on every job, and `cache-dependency-path` pointing at the template's lock file beside every npm `cache:` line. The rendering is a text transform rather than a YAML round trip, so the twin keeps the source's comments and layout.

The working directory reaches only `run:` steps, and GitHub resolves everything else from the repository root, so the rendering refuses a source it cannot carry faithfully rather than guessing: a quoted name, a job that already sets `defaults`, a flow mapping (`with: { … }`), a cache other than npm's, a key named for a path, a file or a directory (`paths-ignore`, `node-version-file` and `working-directory` among them), a local action (`uses: ./…`), and `hashFiles`. An action input that holds a path under any other name is not recognised, so read a new workflow's twin before committing it.

`make check-workflows` renders every twin in memory and compares it with the file on disk. It reports a twin that is **missing**, one that is **stale** (its source changed, or the twin was edited by hand), and one that is **orphaned** (its source is gone), and `make workflows` fixes each of them. A workflow at the root that does not open with the rendering's header, such as `family-check.yml`, is hand-written and left alone.

**So a workflow is edited in its template, then re-rendered, in the same commit.**

## The version and the release

`VERSION` is the family's version, and the release reads it. The release skill, `.claude/skills/release/SKILL.md`, bumps `VERSION` and every template's manifest together, re-locks each template, writes the entry in the root `CHANGELOG.md`, and runs `make all`. Nothing is published: every template's manifest is private, and no workflow runs on a push to `main`. The release is the family at its new version on `main`.

A template's own `CHANGELOG.md` only points at the root's. Its bootstrap replaces it with a project's first entry.

## The pre-commit hook

A template wires its hook with Husky's `prepare` script, which needs the repository's `.git` in the directory it runs in. Here, a template's `npm install` prints Husky's `.git can't be found` notice instead, and wires nothing. The root's `make install` runs Husky from the root, which sets git's hooks path to `.husky/_`, the same path a template sets when it is a repository of its own. The root's `.husky/pre-commit` then runs, for each template the commit touches, that template's own `.husky/pre-commit` from inside its directory, where lint-staged only sees that template's staged files.

The root's own files pass through no hook; `make check-family` holds them to Prettier, locally and in `family-check.yml`.

## The sibling packages

In the Pipelex workspace, the `pipelex-sdk-js` and `mthds-form` checkouts sit beside this repository, two levels above a template's directory. A template's `make use-local` looks for them in its parent directory unless `SIBLINGS_DIR` says otherwise, and the root's `make use-local` passes `SIBLINGS_DIR=../..` to every template.

## Adding a template

A new template is a directory that works on its own, then joins the family:

1. It carries a `Makefile` with every target the root delegates, a manifest whose version is the family's, a `CLAUDE.md`, and whatever its projects need, including its own `.github/workflows/`.
2. Its name joins `TEMPLATES` in the root `Makefile`.
3. `make workflows` renders its twins, and the renderer's refusals say what to change in its workflows if it cannot. A template that is not a Node project needs the renderer's cache line taught its own lock file first.
4. The release skill names its manifest under **Version files and the lock** and adds a `git show origin/main:<its manifest>` line under **What ships**, and the root `README.md` lists it.
5. If its hook is not a Husky hook, `.husky/pre-commit` learns to run it.
6. `make all` at the root is green.
