// The workflow twins: what a rendering carries, what it refuses, and what the
// check reports. Run with `node --test` — the root has no dependencies.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";

import {
  ROOT,
  TWIN_MARKER,
  TwinError,
  WORKFLOWS_DIR,
  compareTwins,
  renderTwin,
  writeTwins,
} from "./workflows.mjs";

const SOURCE = `name: Lint check

on:
  pull_request:

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "npm"

      - name: Run check
        run: make check
`;

const roots = [];
after(() => {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
});

/** A throwaway family with one template carrying the given workflows. */
function family(workflows) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-twins-"));
  roots.push(root);
  const dir = path.join(root, "app-js", WORKFLOWS_DIR);
  fs.mkdirSync(dir, { recursive: true });
  for (const [file, text] of Object.entries(workflows))
    fs.writeFileSync(path.join(dir, file), text);
  return root;
}

describe("renderTwin", () => {
  const twin = renderTwin("app-js", "lint-check.yml", SOURCE);

  it("opens with the marker naming its source", () => {
    assert.ok(twin.startsWith(`${TWIN_MARKER}app-js/${WORKFLOWS_DIR}/lint-check.yml`));
  });

  it("names the template in the workflow and the job", () => {
    assert.match(twin, /^name: Lint check \(app-js\)$/m);
    assert.match(twin, /^ {4}name: Lint \(app-js\)$/m);
    assert.match(twin, /^ {6}- name: Set up Node.js$/m);
  });

  it("runs every step inside the template, with the template's npm cache", () => {
    assert.match(
      twin,
      /runs-on: ubuntu-latest\n {4}defaults:\n {6}run:\n {8}working-directory: app-js\n/,
    );
    assert.match(twin, /cache: "npm"\n {10}cache-dependency-path: app-js\/package-lock\.json\n/);
  });

  it("keeps everything else as it was", () => {
    const body = twin.split("\n").slice(3).join("\n");
    const stripped = body
      .replace(/ \(app-js\)$/gm, "")
      .replace(/\n {4}defaults:\n {6}run:\n {8}working-directory: app-js/, "")
      .replace(/\n {10}cache-dependency-path: app-js\/package-lock\.json/, "");
    assert.equal(stripped, SOURCE);
  });

  it("points every spelling of the npm cache at the template's lock file", () => {
    for (const spelling of ["cache: npm", "cache: 'npm'", 'cache: "npm" # the lock file']) {
      const rendered = renderTwin(
        "app-js",
        "lint-check.yml",
        SOURCE.replace('cache: "npm"', spelling),
      );
      assert.ok(
        rendered.includes(
          `          ${spelling}\n          cache-dependency-path: app-js/package-lock.json\n`,
        ),
        spelling,
      );
    }
  });

  it("refuses what it cannot carry faithfully", () => {
    const cases = [
      SOURCE.replace("name: Lint check", 'name: "Lint check"'),
      SOURCE.replace(
        "    runs-on: ubuntu-latest",
        "    runs-on: ubuntu-latest\n    defaults:\n      run:\n        shell: bash",
      ),
      SOURCE.replace(
        '          cache: "npm"',
        '          cache: "npm"\n          cache-dependency-path: package-lock.json',
      ),
      SOURCE.replace(
        "        run: make check",
        "        run: make check\n        working-directory: sub",
      ),
      SOURCE.replace("  pull_request:", "  pull_request:\n    paths:\n      - src/**"),
      SOURCE.replace("  pull_request:", "  pull_request:\n    paths-ignore:\n      - docs/**"),
      SOURCE.replace('          node-version: "22"', "          node-version-file: .nvmrc"),
      SOURCE.replace("      - uses: actions/checkout@v4", "      - uses: ./.github/actions/setup"),
      SOURCE.replace(
        '          cache: "npm"',
        "          cache: \"npm\"\n          key: ${{ hashFiles('package-lock.json') }}",
      ),
      SOURCE.replace('          cache: "npm"', "          cache: yarn"),
      SOURCE.replace(
        '        with:\n          node-version: "22"\n          cache: "npm"',
        '        with: { node-version: "22", cache: "npm" }',
      ),
      SOURCE.replace("name: Lint check\n", ""),
    ];
    for (const source of cases) {
      assert.throws(() => renderTwin("app-js", "lint-check.yml", source), TwinError);
    }
  });
});

describe("compareTwins and writeTwins", () => {
  it("renders the missing twins, then finds nothing to do", () => {
    const root = family({ "lint-check.yml": SOURCE });
    assert.deepEqual(compareTwins(root, ["app-js"]).problems, [
      { file: "app-js-lint-check.yml", kind: "missing" },
    ]);
    writeTwins(root, ["app-js"]);
    assert.deepEqual(compareTwins(root, ["app-js"]).problems, []);
  });

  it("reports a twin whose source changed, and re-renders it", () => {
    const root = family({ "lint-check.yml": SOURCE });
    writeTwins(root, ["app-js"]);
    fs.writeFileSync(
      path.join(root, "app-js", WORKFLOWS_DIR, "lint-check.yml"),
      SOURCE.replace("make check", "make lint"),
    );
    assert.deepEqual(compareTwins(root, ["app-js"]).problems, [
      { file: "app-js-lint-check.yml", kind: "stale" },
    ]);
    writeTwins(root, ["app-js"]);
    assert.match(
      fs.readFileSync(path.join(root, WORKFLOWS_DIR, "app-js-lint-check.yml"), "utf8"),
      /make lint/,
    );
  });

  it("reports a hand edit of a twin as stale", () => {
    const root = family({ "lint-check.yml": SOURCE });
    writeTwins(root, ["app-js"]);
    const twin = path.join(root, WORKFLOWS_DIR, "app-js-lint-check.yml");
    fs.appendFileSync(twin, "# a note\n");
    assert.deepEqual(compareTwins(root, ["app-js"]).problems, [
      { file: "app-js-lint-check.yml", kind: "stale" },
    ]);
  });

  it("removes a twin whose source is gone, and leaves a hand-written workflow alone", () => {
    const root = family({ "lint-check.yml": SOURCE });
    writeTwins(root, ["app-js"]);
    fs.writeFileSync(path.join(root, WORKFLOWS_DIR, "family-check.yml"), "name: Family\n");
    fs.rmSync(path.join(root, "app-js", WORKFLOWS_DIR, "lint-check.yml"));
    assert.deepEqual(compareTwins(root, ["app-js"]).problems, [
      { file: "app-js-lint-check.yml", kind: "orphaned" },
    ]);
    writeTwins(root, ["app-js"]);
    assert.deepEqual(fs.readdirSync(path.join(root, WORKFLOWS_DIR)), ["family-check.yml"]);
  });

  it("refuses a template directory that does not exist", () => {
    const root = family({});
    assert.throws(() => compareTwins(root, ["cli-js"]), TwinError);
  });
});

describe("this repository", () => {
  it("carries a current twin of every template workflow", () => {
    const makefile = fs.readFileSync(path.join(ROOT, "Makefile"), "utf8");
    const templates = /^TEMPLATES := (.+)$/m.exec(makefile)[1].trim().split(/\s+/);
    assert.deepEqual(compareTwins(ROOT, templates).problems, []);
  });
});
