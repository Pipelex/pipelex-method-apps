---
name: release
description: >
  Cut a release of pipelex-method-app, the Next.js template for an app that
  runs MTHDS methods through @pipelex/sdk: the release/vX.Y.Z worktree, the
  package.json bump and the package-lock.json that follows, the changelog entry,
  the gates, one commit, and a pull request to main. Use when the user says
  "release", "cut a release", "bump version", "prepare a release", "new
  version", "make a release", "ship it", "create release branch", "promote dev
  to main", or any variation of shipping a new version of the template.
  Changelog content passed inline ("/release Added an empty-state hint")
  becomes the entry. The merge is landed by /ledger-land, never by this skill.
---

# Releasing pipelex-method-app

This skill releases the template from inside the Pipelex workspace, and the bootstrap removes it from every project created from the template. The procedure is the workspace release play, [`docs/workspace/releasing.md`](../../../../docs/workspace/releasing.md) at the workspace root — `../docs/workspace/releasing.md` from this repo's own root, which resolves the same from the main checkout and from any worktree. Read it first, then run it with what follows. The repo key is `pipelex-method-app`, the base is `dev`, and the pull request targets `main`. The release worktree is `_pipelex-method-app--release`, made with `wt add pipelex-method-app release --branch release/vX.Y.Z`; the repo declares no `.worktree.toml`, so `wt` resolves the base from `origin/dev`, and provisioning runs the Makefile's `install` target, which is the `npm install` that puts the `node_modules` every gate below needs into the worktree.

## What ships

**Nothing is published.** That is the whole answer: `package.json` declares `"private": true`, so nothing goes to npm. `.github/workflows/` holds `lint-check.yml` and `tests-check.yml`, which both open with `on: pull_request:`, and `create-live.yml`, which opens with `on: workflow_dispatch:` and runs when someone starts it by hand. No workflow in this repo fires on a push to `main`, so the merge triggers no build, no publish and no tagger. The repo carries no tags and no GitHub Releases, and none are made by hand. What the merge produces is the template at its new version on `main`, which is this repo's default branch and therefore what GitHub's **Use this template** copies into a new repository.

The opening sentence is the declaration `ledger land` reads, spelled exactly so, and the `git show origin/main:package.json` below is where it reads the version from. The landing has no publish to verify. Instead it checks three things: the merge commit is on `main`, no workflow in that commit runs on the merge, and `package.json` spells the release branch's version in the merge commit but not in its first parent. It then closes the release item on those readings. A workflow that starts firing on a push to `main` stops the landing until this section names it. By hand, from anywhere, the same readings are:

```bash
cd <main> && gh pr view <number> --json state,mergedAt,mergeCommit   # MERGED, and the merge commit
git -C <main> fetch --prune origin
git -C <main> show origin/main:package.json | grep '"version"'   # X.Y.Z
git -C <main> show <sha>^1:package.json | grep '"version"'   # the version before the merge, never X.Y.Z
```

## Version files and the lock

- **`package.json`** — the `"version"` field, without a `v` prefix. It is the only place in the tree the number is written: nothing in `src/`, the docs or the README restates it.
- **The lock** — `make lock` (`npm install --package-lock-only`), run after the bump. It rewrites the two `"version"` fields `package-lock.json` carries for this package — the top-level one and the one under `packages[""]` — and leaves `node_modules` alone. If it fails, stop and report it rather than committing a lock that disagrees with `package.json`: `npm ci` refuses that pair, and `npm ci` is the first step of both CI workflows.
- **Also stamped:** nothing.

## Gates

Run in the worktree, in this order, before the commit. Every one of them is blocking.

1. **`make all`** — `check` (ESLint, Prettier's `--check`, the three `tsc` passes over the app, the Playwright specs and `scripts/`, and the offline `codegen-check`), then `test` (the Vitest suite; `make agent-test` is the same run kept quiet on success), then `build` (`next build`). It rewrites no tracked file, because the formatting step only checks: the cure for a red `format-check` is `make format`, which does rewrite, and whatever it touches then joins the release commit. The template ships no method, so `codegen-check` passes by reporting nothing to check; a red one means a file landed under `methods/` or `src/generated/`, which the template must not carry — remove it rather than regenerating.
2. **A scaffold run, whenever `PIPELEX_API_KEY` is set and the release touches `scripts/` or `src/methods.ts`** — the template's own tests exercise the scaffold against recorded responses, and only a live run proves the files it writes still compile against the shipped chrome. In a scratch copy of the worktree (never the release worktree itself), run `PIPELEX_BASE_URL=https://api-dev.pipelex.com make add-method METHOD=github.com/Pipelex/methods/text_stats@v0.1.1`, then `make all`; both must pass, and the copy is discarded. `make codegen-verify` has nothing to verify in the template, which ships no method.
3. **`make test-e2e`, when the release touches the page, the registry or the app's identity** (`src/app/`, `src/components/MethodPage.tsx`, `src/methods.ts`, `src/site.ts`). The template ships only the offline `home.spec.ts`, so the run costs nothing, though the target still prompts through `confirm-live-e2e`; pass `CONFIRM=1`. It starts `next dev`, and `next dev` re-writes the agent-rules block at the bottom of `AGENTS.md`, a tracked file — if that leaves a change, it joins the release commit rather than being reverted.

## The release commit

`package.json`, `package-lock.json`, `CHANGELOG.md`, plus anything `make format` rewrote and `AGENTS.md` if `make test-e2e` re-wrote its agent-rules block — staged by name.

## CI on the release pull request

Two of the repo's workflows fire on `on: pull_request:` with no branch and no path filter, so the release pull request meets exactly what every pull request meets; the third, `create-live.yml`, runs only when someone starts it by hand and never on a pull request:

- **`lint-check.yml`** — `npm ci` then `make check` on Node 22.
- **`tests-check.yml`** — `npm ci`, then `make agent-test`, then `make build`, on the same Node.

There is no version check, no changelog check and no branch guard here: nothing in CI asserts that `package.json` agrees with the version in the branch name, that `CHANGELOG.md` carries the entry, that no `[Unreleased]` heading survives, or that a head into `main` is a `release/` branch at all. Those are the play's rules and this skill's job, held by nothing else. The `npm ci` step is the one indirect gate — it fails when `package-lock.json` and `package.json` disagree, which is what catches a skipped lock step.

## Particulars

- **The changelog headings carry the `v`** — `## [vX.Y.Z] - YYYY-MM-DD`, which is also the shape the bootstrap writes into a new project's changelog. No `[Unreleased]` heading is left behind; the next change re-creates one.
- **The first release is `0.1.0`.** `package.json` already carries it and `CHANGELOG.md` holds its entries under `[Unreleased]`, so that release renames the heading and bumps nothing.
- **No pre-release form.** Since no workflow reads the branch name, an `rc` would be caught by nothing at all — ship a plain `X.Y.Z`.
- **`.worktreeinclude` names the gitignored files a fresh worktree needs** — `.env`, `.env.local` and `.claude/settings.local.json` — and `wt add` provisions them. `PIPELEX_API_KEY` is read from `.env.local`, so the scaffold run works from `_pipelex-method-app--release` only because that file was copied in; a gate that fails there on a missing key means the file was not.
- **The two Pipelex dependencies are bumped by their own skills, not by this play.** `@pipelex/sdk` and `@pipelex/mthds-form` sit in `package.json` as pre-1.0 caret ranges, which npm never resolves across a minor, so moving either is a deliberate edit — `/bump-sdk` and `/bump-mthds-form` are what make it, each reading the package's changelog and applying the renames. A release neither performs nor implies one.
- **Measure the gates against the npm-published packages.** `make use-local` swaps those same two packages for tarballs packed from the sibling `../pipelex-sdk-js` and `../mthds-form` checkouts, and it installs them `--no-save`, so `package.json` records nothing and a green build proves only that the siblings work. A worktree freshly provisioned by `wt add` holds the published versions, which is the state to release from; `make use-npm` restores them.
- **The pre-commit hook rewrites the files the release commit carries.** `.husky/pre-commit` runs `npx lint-staged`, whose configuration sends every staged `*.{css,json,md}` through `prettier --write` and re-stages what it changed, so `package.json` and `CHANGELOG.md` are reformatted as the commit is made; `package-lock.json` sits in `.prettierignore` and passes through untouched. That is what keeps a hand-written changelog entry from failing `lint-check.yml`, whose `make check` formats against `**/*.md` and `**/*.json` — the entry and the bump are both written after the gates have run, so the hook is the only formatter that ever sees them. Expect the committed text to differ from what was typed, and never reach for `--no-verify`, which is the one way an unformatted entry reaches CI.
- **The dev server's port is guarded, and the guard names the holder.** `make test-e2e` runs through `port-check`, which refuses `APP_PORT` (4300 by default) when another checkout is serving it and prints that checkout's directory. Every worktree of this repo wants the same port, so the holder is routinely another branch's copy of this same app — `APP_PORT=4301` on the target is the way past it.
