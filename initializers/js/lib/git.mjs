/**
 * Git, read before anything is written, and one outcome for each case:
 *
 *   inside no work tree                    → a new repository on main, then the pristine commit
 *   the root of a repository with no commit → the pristine commit, its first
 *   the root of a repository with history  → refused: repository-has-history
 *   inside another repository's work tree  → no repository and no commit
 *   inside a checkout of a template        → refused: inside-template-checkout
 *
 * A directory holding only `.git` whose repository has commits is one whose
 * working tree shows every tracked file deleted, and landing the template on it
 * would fold that deletion into the commit. A repository planted inside another
 * one's work tree makes the enclosing one fail `git add -A` until the nested
 * one has a commit, and then see an embedded repository, so the project becomes
 * new files in the enclosing repository instead, as `create-next-app` does.
 */

import { spawnSync } from "node:child_process";

/**
 * The repositories whose checkouts are templates, read from `origin`: the
 * family's own, and the starters. Running the initializer inside one would
 * make a project of a template's checkout.
 */
export const TEMPLATE_ORIGINS =
  /[/:](pipelex\/(pipelex-method-apps|pipelex-starter-js|pipelex-starter-python)|mthds-ai\/mthds-starter-js)(\.git)?\/?$/i;

/**
 * Variables that point git at a repository other than the one it would find
 * from the directory it runs in. A hook or a wrapper can leave them set, and
 * the reading must be about the destination.
 */
const REDIRECTING = [
  "GIT_DIR",
  "GIT_WORK_TREE",
  "GIT_INDEX_FILE",
  "GIT_OBJECT_DIRECTORY",
  "GIT_COMMON_DIR",
  "GIT_NAMESPACE",
  "GIT_PREFIX",
];

export function gitEnv(env) {
  const clean = { ...env };
  for (const name of REDIRECTING) delete clean[name];
  return clean;
}

/** Run git, returning its status and trimmed output. */
export function git(args, { cwd, env }) {
  const result = spawnSync("git", args, { cwd, env: gitEnv(env), encoding: "utf8" });
  if (result.error) return { status: null, stdout: "", stderr: result.error.message };
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
}

/**
 * Read git at the destination. `from` is the destination when it exists, or
 * its nearest existing ancestor. Returns one of:
 *
 *   { kind: "outside" }
 *   { kind: "template-checkout", origin }
 *   { kind: "root", history: boolean }
 *   { kind: "inside", toplevel }
 *   { kind: "unreadable-git" }   the destination holds a `.git` git does not read as its repository
 */
export function readGit({ dest, from, destExists, destHasGit, env }) {
  const top = git(["rev-parse", "--show-toplevel"], { cwd: from, env });
  if (top.status !== 0) return destHasGit ? { kind: "unreadable-git" } : { kind: "outside" };

  const origin = templateOrigin({ from, env });
  if (origin !== null) return { kind: "template-checkout", origin };

  // `--show-prefix` prints nothing at a repository's root, which needs no path
  // comparison and so survives symlinks and letter case.
  if (destExists) {
    const prefix = git(["rev-parse", "--show-prefix"], { cwd: dest, env });
    if (prefix.status === 0 && prefix.stdout === "") {
      const head = git(["rev-parse", "-q", "--verify", "HEAD"], { cwd: dest, env });
      return { kind: "root", history: head.status === 0 };
    }
    if (destHasGit) return { kind: "unreadable-git" };
  }
  return { kind: "inside", toplevel: top.stdout };
}

/** The `origin` of the repository `from` stands in when it is a template's own, or null. */
export function templateOrigin({ from, env }) {
  const origin = git(["remote", "get-url", "origin"], { cwd: from, env });
  return origin.status === 0 && TEMPLATE_ORIGINS.test(origin.stdout) ? origin.stdout : null;
}

/** Whether git can name an author and a committer, as a commit needs. */
export function hasIdentity({ cwd, env }) {
  return (
    git(["var", "GIT_AUTHOR_IDENT"], { cwd, env }).status === 0 &&
    git(["var", "GIT_COMMITTER_IDENT"], { cwd, env }).status === 0
  );
}

/** The pristine commit's message, in the scaffold skill's format. */
export function pristineMessage({ template, version, source }) {
  return `Start from Pipelex/pipelex-method-apps/${template} ${version} (${source})`;
}

/**
 * Initialize when asked, then make the pristine commit of exactly `paths`, the
 * files the write created. Returns the commit's SHA, or throws with git's own
 * message. Git's output is not shown on success.
 *
 * The repository is born on `main` through `symbolic-ref` rather than
 * `init -b`, which git before 2.28 does not know. The paths are added with
 * `--force` and read literally: a user's `core.excludesFile` or the
 * repository's `info/exclude` must not silently drop a file of the template
 * from a commit that claims to hold it as it came, and the template ignores
 * none of its own files.
 */
export function commitPristine({ dest, init, paths, message, env }) {
  const steps = [
    ...(init
      ? [
          ["init", ["init", "-q"]],
          ["symbolic-ref", ["symbolic-ref", "HEAD", "refs/heads/main"]],
        ]
      : []),
    ["add", ["--literal-pathspecs", "add", "--force", "--", ...paths]],
    ["commit", ["commit", "-q", "-m", message]],
  ];
  for (const [name, args] of steps) {
    const result = git(args, { cwd: dest, env });
    if (result.status !== 0) {
      const said = [result.stderr, result.stdout].filter(Boolean).join("\n");
      throw new Error(`git ${name} failed${said ? `:\n${said}` : ""}`);
    }
  }
  return git(["rev-parse", "HEAD"], { cwd: dest, env }).stdout;
}

/**
 * The commands a person runs to make the pristine commit by hand, once the
 * copy stands, joined with `&&` for a shell. `quote` quotes one word.
 */
export function pristineByHand({ dest, init, message, quote }) {
  const at = `git -C ${quote(dest)}`;
  return [
    ...(init ? [`${at} init -q`, `${at} symbolic-ref HEAD refs/heads/main`] : []),
    `${at} add --force -A`,
    `${at} commit -m ${quote(message)}`,
  ].join(" && ");
}
