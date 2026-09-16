// @vitest-environment node
//
// Anchor-drift and behavior tests for the bootstrap script.
//
// Some of the script's transforms hang on exact string anchors in living
// template files (CLAUDE.md, src/site.ts). These tests copy the real target
// files into a temp dir and run the real CLI against them, so any template edit
// that breaks an anchor fails CI here instead of silently rotting the bootstrap
// on a consumer's machine.
//
// A bootstrapped project no longer carries those anchors — that is what the
// bootstrap does — so every test that reads the real files runs only while this
// repo is still the template. Without that guard the project's own `make all`
// would fail between the bootstrap and the step that deletes this skill.

import { afterAll, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import vm from "node:vm";
import { URL, fileURLToPath } from "node:url";

import {
  REMOVALS,
  RESET_VERSION,
  TARGETS,
  TEMPLATE_NAME,
  TEMPLATE_TITLE,
  TEMPLATE_URL,
  resolveLicense,
  titleFromName,
  transformSite,
} from "./bootstrap.mjs";

const SCRIPT = fileURLToPath(new URL("./bootstrap.mjs", import.meta.url));
const REPO_ROOT = path.resolve(path.dirname(SCRIPT), "../../../..");
const IS_TEMPLATE =
  JSON.parse(fs.readFileSync(path.join(REPO_ROOT, "package.json"), "utf8")).name === TEMPLATE_NAME;

// Formatting the rewritten files through Prettier needs the repo's own config
// beside them, or the temp copies would print at Prettier's defaults.
const SUPPORT_FILES = [".prettierrc", ".prettierignore"];

const tempRoots = [];
afterAll(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true });
});

function copyInto(root, rel) {
  const src = path.join(REPO_ROOT, rel);
  const dest = path.join(root, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.cpSync(src, dest, { recursive: true });
}

/** Copy the script's real target files from the repo into a fresh temp dir. */
function makeTempRepo() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bootstrap-test-"));
  tempRoots.push(root);
  for (const { rel } of TARGETS) copyInto(root, rel);
  for (const rel of [...REMOVALS, ...SUPPORT_FILES]) copyInto(root, rel);
  return root;
}

function runScript(args) {
  return spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
}

/** An empty temp dir to use as a harmless --root for failure-path tests. */
function makeEmptyRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bootstrap-empty-"));
  tempRoots.push(root);
  return root;
}

function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

/**
 * The values `src/site.ts` holds, read by evaluating its object literal rather
 * than by matching text: the formatter is free to pick either quote style.
 */
function siteValues(text) {
  const match = /export const SITE = (\{[\s\S]*?\n\});/.exec(text);
  if (!match) throw new Error("src/site.ts: `export const SITE = {…};` not found");
  return { ...vm.runInNewContext(`(${match[1]})`) };
}

function baseArgs(root, overrides = {}) {
  const values = {
    "--root": root,
    "--name": "invoice-extractor",
    "--title": "Invoice Extractor",
    "--description": "Extracts invoices.",
    ...overrides,
  };
  return Object.entries(values).flat();
}

describe.skipIf(!IS_TEMPLATE)("bootstrap.mjs against the template's files", () => {
  it("rewrites every target file with zero warnings", () => {
    const root = makeTempRepo();
    const res = runScript([
      ...baseArgs(root),
      "--author-name",
      "Ada Lovelace",
      "--author-email",
      "ada@example.com",
      "--repo-url",
      "https://github.com/acme/invoice-extractor",
      "--license-holder",
      "Acme Corp",
      "--clean",
    ]);
    expect(res.status).toBe(0);
    // Any "warning:" here means a template file drifted away from an anchor.
    expect(res.stderr).toBe("");
    for (const { rel } of TARGETS) {
      expect(res.stdout).toContain(`edited  ${rel}`);
    }

    const pkg = JSON.parse(read(root, "package.json"));
    expect(pkg.name).toBe("invoice-extractor");
    expect(pkg.version).toBe(RESET_VERSION);
    expect(pkg.license).toBe("MIT");
    expect(pkg.author).toBe("Ada Lovelace <ada@example.com>");
    expect(pkg.repository).toBe("https://github.com/acme/invoice-extractor");
    expect(pkg.description).toBe("Extracts invoices.");

    // The README is the project's own; the template is named once, as provenance.
    const readme = read(root, "README.md");
    expect(readme.startsWith("# Invoice Extractor\n\nExtracts invoices.\n")).toBe(true);
    expect(readme).not.toContain(TEMPLATE_TITLE);
    const provenance = `[${TEMPLATE_NAME}](${TEMPLATE_URL})`;
    expect(readme.split(provenance)).toHaveLength(2);
    expect(readme.replace(provenance, "")).not.toContain(TEMPLATE_NAME);
    expect(readme).toContain("[MIT license](LICENSE)");

    const claude = read(root, "CLAUDE.md");
    expect(claude).not.toContain(TEMPLATE_NAME);
    expect(claude).not.toContain("This repo is a **template**.");
    expect(claude).toContain("# invoice-extractor");
    expect(claude).toContain("Extracts invoices.");

    expect(read(root, "AGENTS.md")).not.toContain(TEMPLATE_NAME);

    expect(siteValues(read(root, "src/site.ts"))).toEqual({
      title: "Invoice Extractor",
      description: "Extracts invoices.",
    });

    const year = new Date().getFullYear();
    expect(read(root, "LICENSE")).toContain(`Copyright (c) ${year} Acme Corp`);
    expect(read(root, "CHANGELOG.md")).toMatch(/## \[v0\.1\.0\] - \d{4}-\d{2}-\d{2}/);

    // The template's own release skill does not travel into a project.
    for (const rel of REMOVALS) {
      expect(res.stdout).toContain(`removed ${rel}/`);
      expect(fs.existsSync(path.join(root, rel))).toBe(false);
    }
  });

  it("names the template in CLAUDE.md's heading and nowhere else", () => {
    // A token pass renames every occurrence, so a mention in prose would be
    // renamed into a sentence about the project that no longer makes sense.
    const claude = read(REPO_ROOT, "CLAUDE.md");
    expect(claude.startsWith(`# ${TEMPLATE_NAME}\n`)).toBe(true);
    expect(claude.split(TEMPLATE_NAME)).toHaveLength(2);
    expect(claude).not.toContain(TEMPLATE_TITLE);
  });

  it("keeps $-patterns in user values literal instead of expanding them", () => {
    const root = makeTempRepo();
    const res = runScript([
      ...baseArgs(root, {
        "--name": "cash-tracker",
        "--title": "Cash $$ Tracker",
        "--description": "Costs $' and $& and $$ per month.",
      }),
      "--license-holder",
      "AT&T $& Holdings",
      "--clean",
    ]);
    expect(res.status).toBe(0);
    expect(read(root, "README.md")).toContain("Costs $' and $& and $$ per month.");
    expect(siteValues(read(root, "src/site.ts")).title).toBe("Cash $$ Tracker");
    const license = read(root, "LICENSE");
    expect(license).toContain("AT&T $& Holdings");
    expect(license).not.toContain("{holder}");
  });

  it("writes a JSX-significant title as a string literal, never as markup", () => {
    const root = makeTempRepo();
    const title = 'Bob\'s <Lab> & {Co} "Quoted"';
    const res = runScript([...baseArgs(root, { "--title": title }), "--clean"]);
    expect(res.status).toBe(0);
    // Prettier may re-quote the literal; what matters is the value it holds.
    expect(siteValues(read(root, "src/site.ts")).title).toBe(title);
  });

  it("--dry-run reports the plan without modifying any file", () => {
    const root = makeTempRepo();
    const before = new Map(TARGETS.map(({ rel }) => [rel, read(root, rel)]));
    // --license-holder so LICENSE registers a change too (MIT without a
    // holder deliberately leaves it untouched).
    const res = runScript([
      ...baseArgs(root),
      "--license-holder",
      "Acme Corp",
      "--clean",
      "--dry-run",
    ]);
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("dry run");
    for (const { rel } of TARGETS) {
      expect(res.stdout).toContain(`edit    ${rel}`);
      expect(read(root, rel)).toBe(before.get(rel));
    }
    for (const rel of REMOVALS) {
      expect(res.stdout).toContain(`remove  ${rel}/`);
      expect(fs.existsSync(path.join(root, rel))).toBe(true);
    }
  });

  it("refuses to run on a non-template repo unless --force is passed", () => {
    const root = makeTempRepo();
    expect(runScript([...baseArgs(root), "--clean"]).status).toBe(0);

    // The repo is now bootstrapped — a plain re-run must hard-fail...
    const rerun = runScript([...baseArgs(root, { "--name": "other-app" })]);
    expect(rerun.status).toBe(1);
    expect(rerun.stderr).toContain("--force");

    // ...and --force is the explicit opt-in.
    expect(runScript([...baseArgs(root, { "--name": "other-app" }), "--force"]).status).toBe(0);
  });

  it("warns when default MIT keeps the template's copyright holder", () => {
    const root = makeTempRepo();
    const before = read(root, "LICENSE");
    const res = runScript([...baseArgs(root), "--clean"]);
    expect(res.status).toBe(0);
    expect(res.stderr).toContain("--license-holder");
    expect(read(root, "LICENSE")).toBe(before);
  });

  it("warns when the MIT license field is applied over a non-MIT LICENSE body", () => {
    const root = makeTempRepo();
    fs.writeFileSync(
      path.join(root, "LICENSE"),
      "Copyright (c) 2026 Acme Corp\n\nAll rights reserved.\n",
    );
    const res = runScript([...baseArgs(root), "--license-holder", "Acme Corp", "--clean"]);
    expect(res.status).toBe(0);
    expect(res.stderr).toContain("does not look like the MIT");
  });

  it("states a proprietary license in the README it renders", () => {
    const root = makeTempRepo();
    const res = runScript([
      ...baseArgs(root),
      "--license",
      "proprietary",
      "--license-holder",
      "Acme Corp",
      "--clean",
    ]);
    expect(res.status).toBe(0);
    expect(read(root, "README.md")).toContain("This project is proprietary");
    expect(JSON.parse(read(root, "package.json")).license).toBe("UNLICENSED");
  });
});

describe("bootstrap.mjs input guards", () => {
  it("rejects a flag value that was swallowed by the next flag", () => {
    const res = runScript([
      "--root",
      makeEmptyRoot(),
      "--name",
      "my-app",
      "--description",
      "--dry-run",
    ]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("missing value for --description");
  });

  it.each([
    [["--description", "d."], "--name is required"],
    [["--name", "my-app"], "--description is required"],
    [["--name", "Bad Name", "--description", "d."], "invalid package name"],
    [["--name", "my-app", "--description", "d.", "--title", "   "], "--title is empty"],
    [["--name", "my-app", "--description", "   "], "--description is empty"],
    [["--name", "my-app", "--description", "d.", "--license-year", "2026abc"], "license-year"],
    [["--name", "my-app", "--description", "d.", "--author-email", "a@b.c"], "--author-name"],
    [["--name", "my-app", "--description", "d.", "--oops", "x"], "unknown argument"],
  ])("fails fast on bad input: %j", (args, message) => {
    // Pin --root to an empty temp dir: if a case ever passes validation
    // unexpectedly, the run hits "no package.json found" instead of
    // bootstrapping the real repo (--root defaults to ".").
    const res = runScript(["--root", makeEmptyRoot(), ...args]);
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(message);
  });
});

describe("bootstrap.mjs helpers", () => {
  it("derives titles from package names, scope stripped", () => {
    expect(titleFromName("invoice-extractor")).toBe("Invoice Extractor");
    expect(titleFromName("@acme/invoice-extractor")).toBe("Invoice Extractor");
    expect(titleFromName("my_cool.app")).toBe("My Cool App");
  });

  it("resolves license choices to npm field values", () => {
    expect(resolveLicense(undefined, null, 2026).npmField).toBe("MIT");
    expect(resolveLicense("Proprietary", "Acme", 2026).npmField).toBe("UNLICENSED");
    expect(resolveLicense("Apache-2.0", "Acme", 2026)).toMatchObject({
      kind: "other",
      npmField: "Apache-2.0",
    });
  });

  it("rewrites only the SITE object, leaving the doc comment that names its keys", () => {
    const source = [
      "/** The title: and description: below are the app's identity. */",
      "export const SITE = {",
      '  title: "Old",',
      "  description:",
      '    "Old description.",',
      "};",
      "",
    ].join("\n");
    const updated = transformSite(source, { title: "New" }, { description: 'A "quoted" one.' });
    expect(updated).toContain("/** The title: and description: below are the app's identity. */");
    expect(updated).toContain('title: "New",');
    expect(updated).toContain('description:\n    "A \\"quoted\\" one.",');
  });
});
