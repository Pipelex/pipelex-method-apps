// Git's reading of a destination inside another repository's work tree: which
// of its ignore sources count, and the paths `check-ignore` could misread. The
// family's table of cases covers a `.gitignore`; these cover what it does not
// vary.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { nearestExisting } from "../lib/destination.mjs";
import { readGit } from "../lib/git.mjs";
import { git, isolatedEnv, setupEnv, tempRoot } from "./support.mjs";

/** A repository with a commit, and what the enclosing `.gitignore` holds. */
function enclosing(gitignore = []) {
  const root = tempRoot("create-method-app-git-");
  const env = setupEnv(root);
  const repo = path.join(root, "theirs");
  fs.mkdirSync(repo);
  git(repo, ["init", "-q", "-b", "main"], env);
  fs.writeFileSync(path.join(repo, "README.md"), "theirs\n");
  if (gitignore.length > 0)
    fs.writeFileSync(path.join(repo, ".gitignore"), `${gitignore.join("\n")}\n`);
  git(repo, ["add", "-A"], env);
  git(repo, ["commit", "-q", "-m", "Their first commit"], env);
  return { root, repo, env: isolatedEnv(root) };
}

/** Read git at a destination that does not exist yet, as the preflight does. */
function readMissing(dest, env) {
  return readGit({
    dest,
    from: nearestExisting(dest),
    destExists: false,
    destHasGit: false,
    env,
  });
}

describe("readGit inside another repository's work tree", () => {
  it("reads a destination ignored only through the repository's info/exclude", () => {
    const { repo, env } = enclosing();
    fs.appendFileSync(path.join(repo, ".git", "info", "exclude"), "play/\n");
    fs.mkdirSync(path.join(repo, "play"));
    assert.deepEqual(readMissing(path.join(repo, "play", "my-app"), env), {
      kind: "ignored",
      toplevel: repo,
    });
  });

  it("reads a destination ignored only through the user's core.excludesFile", () => {
    const { root, repo, env } = enclosing();
    const excludes = path.join(root, "global-excludes");
    fs.writeFileSync(excludes, "scratch/\n");
    const config = path.join(root, "gitconfig");
    fs.writeFileSync(config, `[core]\n\texcludesFile = ${excludes}\n`);
    const reading = readMissing(path.join(repo, "scratch", "deep", "my-app"), {
      ...env,
      GIT_CONFIG_GLOBAL: config,
    });
    assert.deepEqual(reading, { kind: "ignored", toplevel: repo });
  });

  it("reads a path whose first name starts with a colon literally", () => {
    const { repo, env } = enclosing(["/:odd/"]);
    assert.deepEqual(readMissing(path.join(repo, ":odd", "my-app"), env), {
      kind: "ignored",
      toplevel: repo,
    });
  });

  it("reads an existing empty directory the repository ignores", () => {
    const { repo, env } = enclosing(["my-app/"]);
    const dest = path.join(repo, "my-app");
    fs.mkdirSync(dest);
    assert.deepEqual(readGit({ dest, from: dest, destExists: true, destHasGit: false, env }), {
      kind: "ignored",
      toplevel: repo,
    });
  });

  it("reads a destination under a tracked path as inside", () => {
    const { repo, env } = enclosing(["*.log"]);
    assert.deepEqual(readMissing(path.join(repo, "src", "my-app"), env), {
      kind: "inside",
      toplevel: repo,
    });
  });
});
