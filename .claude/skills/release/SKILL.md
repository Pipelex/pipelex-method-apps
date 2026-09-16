---
name: release
description: >
  Cut a release of pipelex-method-apps, the family of templates for an app that
  runs MTHDS methods through the Pipelex API, which carries one version for
  every template: the release/vX.Y.Z worktree, the bump of VERSION and of each
  template's manifest and lock, the changelog entry, the gates, one commit, and
  a pull request to main. Use when the user says "release", "cut a release",
  "bump version", "prepare a release", "new version", "make a release", "ship
  it", "create release branch", "promote dev to main", or any variation of
  shipping a new version of the templates. Changelog content passed inline
  ("/release Added an empty-state hint") becomes the entry. The merge is landed
  by /ledger-land, never by this skill.
---

# Releasing the method-app templates

This skill releases the whole family from inside the Pipelex workspace: every template directory moves to the same version together, and none of them carries a release skill of its own. The procedure is the workspace release play, [`docs/workspace/releasing.md`](../../../../docs/workspace/releasing.md) at the workspace root — `../docs/workspace/releasing.md` from this repo's own root, which resolves the same from the main checkout and from any worktree. Read it first, then run it with what follows. The repo key is `pipelex-method-apps`, the base is `dev`, and the pull request targets `main`. The release worktree is `_pipelex-method-apps--release`, made with `wt add pipelex-method-apps release --branch release/vX.Y.Z`; the repo declares no `.worktree.toml`, so `wt` resolves the base from `origin/dev`, and provisioning runs the root Makefile's `install` target, which installs every template's dependencies and wires the pre-commit hook.

## What ships

**Nothing is published.** That is the whole answer: every template's manifest is private — `webapp-js/package.json` declares `"private": true` — so nothing goes to a registry. `.github/workflows/` holds the root twins of the templates' workflows, `webapp-js-lint-check.yml` and `webapp-js-tests-check.yml`, and the hand-written `family-check.yml`, and each of them opens with `on: pull_request:`. No workflow in this repo fires on a push to `main`, so the merge triggers no build, no publish and no tagger, and a template's own `.github/workflows/` never runs here at all, since GitHub reads workflows only at the root. The repo carries no tags and no GitHub Releases, and none are made by hand. What the merge produces is the family at its new version on `main`, the branch a new project's copy of a template is taken from.

The opening sentence is the declaration `ledger land` reads, spelled exactly so, and the `git show` lines below that read `origin/main` name the files it reads the version from. The landing has no publish to verify. Instead it checks that the merge commit is on `main`, that no workflow in that commit runs on the merge, and that each named file spells the release branch's version in the merge commit but not in its first parent. It then closes the release item on those readings. A workflow that starts firing on a push to `main` stops the landing until this section names it. By hand, from anywhere, the same readings are:

```bash
cd <main> && gh pr view <number> --json state,mergedAt,mergeCommit   # MERGED, and the merge commit
git -C <main> fetch --prune origin
git -C <main> show origin/main:VERSION                             # X.Y.Z
git -C <main> show origin/main:webapp-js/package.json | grep '"version"'   # X.Y.Z
git -C <main> show <sha>^1:VERSION                                 # the version before the merge, never X.Y.Z
```

## Version files and the lock

- **`VERSION`** — the family's version, one line, without a `v` prefix. It is the number the release is named by.
- **Each template's manifest** — `webapp-js/package.json`'s `"version"` field, set to the same number. A template keeps a version of its own because a project copied out of it keeps its manifest, and the root's `make check-versions` fails when any manifest disagrees with `VERSION`. A template added later joins this list, and the second `git show` line above gains its twin.
- **The lock** — `make lock` at the root, which runs `npm install --package-lock-only` in each template after the bump. It rewrites the `"version"` fields `webapp-js/package-lock.json` carries for the package, the top-level one and the one under `packages[""]`, and leaves `node_modules` alone. If it fails, stop and report it rather than committing a lock that disagrees with its manifest: `npm ci` refuses that pair, and `npm ci` is the first step of every workflow here.
- **Also stamped:** nothing. No README, doc or source file restates the number.

## Gates

Run at the root of the worktree, in this order, before the commit, and after the bump and the changelog entry are written. Every one of them is blocking.

1. **`make all`** — `check` (the family's own checks: `check-versions`, `check-workflows`, and Prettier over the root's Markdown, scripts and JSON; then each template's `make check`), then `test` (the root scripts' `node --test` suite, then each template's Vitest suite; `make agent-test` is the same run kept quiet on success), then `build` (each template's `next build`). It rewrites no tracked file, because every formatting step only checks: the cure for a red formatting check is `make format`, which does rewrite, and whatever it touches then joins the release commit. A red `check-versions` means a manifest was not bumped; a red `check-workflows` means a template's workflow changed without `make workflows`, whose output then joins the commit. No template ships a method, so each `codegen-check` passes by reporting nothing to check; a red one means a file landed under a template's `methods/` or `src/generated/`, which a template must not carry — remove it rather than regenerating.
2. **A scaffold run, whenever `PIPELEX_API_KEY` is set and the release touches a template's `scripts/` or `src/methods.ts`** — the template's own tests exercise the scaffold against recorded responses, and only a live run proves the files it writes still compile against the shipped chrome. For `webapp-js`, follow its `docs/ci.md` ("The live half of the proof for `make create`"): a `make create` against `https://api-dev.pipelex.com` for each input it names, each in a fresh scratch copy of the directory (never the release worktree itself), every one green, the copies discarded. No workflow does this, because no workflow is given an API key.
3. **`make test-e2e` inside a template, when the release touches its page, its registry or its app's identity** (for `webapp-js`: `src/app/`, `src/components/MethodPage.tsx`, `src/methods.ts`, `src/site.ts`). The template ships only the offline `home.spec.ts`, so the run costs nothing, though the target still prompts through `confirm-live-e2e`; pass `CONFIRM=1`. It starts `next dev`, and `next dev` re-writes the agent-rules block at the bottom of the template's `AGENTS.md`, a tracked file — if that leaves a change, it joins the release commit rather than being reverted.

## The release commit

`VERSION`, `CHANGELOG.md`, `webapp-js/package.json`, `webapp-js/package-lock.json`, plus anything `make format` rewrote and a template's `AGENTS.md` if `make test-e2e` re-wrote its agent-rules block — staged by name.

## CI on the release pull request

Every workflow at the root fires on `on: pull_request:` with no branch and no path filter, so the release pull request meets exactly what every pull request meets:

- **`family-check.yml`** — `npm ci` in `webapp-js/` for the Prettier the root borrows, then `make check-family` and `make test-family` at the root, on Node 22. This is the one version check CI runs: it fails when `VERSION` and a template's manifest disagree.
- **`webapp-js-lint-check.yml`** — `npm ci` then `make check`, inside `webapp-js/`, on Node 22.
- **`webapp-js-tests-check.yml`** — `npm ci`, then `make agent-test`, then `make build`, inside `webapp-js/`, on the same Node.

There is no changelog check and no branch guard here: nothing in CI asserts that `VERSION` agrees with the version in the branch name, that `CHANGELOG.md` carries the entry, that no `[Unreleased]` heading survives, or that a head into `main` is a `release/` branch at all. Those are the play's rules and this skill's job, held by nothing else. The `npm ci` steps are the one indirect gate on the lock — they fail when a template's `package-lock.json` and `package.json` disagree, which is what catches a skipped lock step.

## Particulars

- **The changelog is the family's**: `CHANGELOG.md` at the root, whose headings carry the `v` — `## [vX.Y.Z] - YYYY-MM-DD`. No `[Unreleased]` heading is left behind; the next change re-creates one. A template's own `CHANGELOG.md` only points at the root's until the bootstrap replaces it in a project, and a release never edits it.
- **No pre-release form.** Since no workflow reads the branch name, an `rc` would be caught by nothing at all — ship a plain `X.Y.Z`.
- **`.worktreeinclude` names the gitignored files a fresh worktree needs** — `.env` and `.env.local` at any depth, and every `.claude/settings.local.json` — and `wt add` provisions them. `PIPELEX_API_KEY` is read from a template's `.env.local`, so the scaffold run works from `_pipelex-method-apps--release` only because that file was copied in; a gate that fails there on a missing key means the file was not.
- **The Pipelex dependencies are bumped by each template's own skills, not by this play.** In `webapp-js`, `@pipelex/sdk` and `@pipelex/mthds-form` sit in `package.json` as pre-1.0 caret ranges, which npm never resolves across a minor, so moving either is a deliberate edit — `/bump-sdk` and `/bump-mthds-form`, run inside the template, are what make it. A release neither performs nor implies one.
- **Measure the gates against the npm-published packages.** `make use-local` swaps those same packages for tarballs packed from the workspace's `pipelex-sdk-js` and `mthds-form` checkouts, and installs them `--no-save`, so `package.json` records nothing and a green build proves only that the siblings work. A worktree freshly provisioned by `wt add` holds the published versions, which is the state to release from; `make use-npm` restores them.
- **The pre-commit hook formats only what a template carries.** The root's `.husky/pre-commit` runs each touched template's own hook from inside it, whose lint-staged sends that template's staged `*.{css,json,md}` through Prettier, so `webapp-js/package.json` is reformatted as the commit is made. The root's `VERSION` and `CHANGELOG.md` pass through no hook, which is why the gates run after the entry is written: `make all`'s `check-family` is what holds the entry to Prettier. Never reach for `--no-verify`.
- **The dev server's port is guarded, and the guard names the holder.** A template's `make test-e2e` runs through its `port-check`, which refuses `APP_PORT` (4300 by default) when another checkout is serving it and prints that checkout's directory. Every worktree of this repo wants the same port, so the holder is routinely another branch's copy of the same template — `APP_PORT=4301` on the target is the way past it.
