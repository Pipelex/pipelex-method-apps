#!/usr/bin/env node
/**
 * Render, or check, the root's twin of every template's CI workflows.
 *
 * GitHub reads a repository's workflows only from `.github/workflows/` at its
 * root, while each template keeps its own workflows in its directory, because
 * they travel into every project created from it. So the root runs a twin of
 * each: the same jobs and steps, run inside the template's directory. The twin
 * is rendered from the template's file rather than written by hand, so the two
 * cannot drift apart silently.
 *
 *   node scripts/workflows.mjs <template>...          write every twin
 *   node scripts/workflows.mjs --check <template>...  exit 1 on a missing, stale or orphaned twin
 *
 * The rendering is a text transform, not a YAML round trip, so the twin keeps
 * the source's comments and layout. It refuses a source it cannot render
 * faithfully rather than guessing: a quoted name, a job that already sets
 * `defaults`, a flow mapping, a cache other than npm's, and everything GitHub
 * resolves from the repository root rather than from the template's directory
 * — a key named for a path, a file or a directory, a local action, and
 * `hashFiles`. An action input that holds a path under any other name is not
 * recognised, so a new workflow's twin is read before it is committed.
 *
 * Zero dependencies; runs on the Node the templates already need.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const WORKFLOWS_DIR = ".github/workflows";

/** How a twin's first line opens, which is how a rendered file is told from a hand-written one. */
export const TWIN_MARKER = "# Rendered by `make workflows` from ";

export class TwinError extends Error {
  constructor(message) {
    super(message);
    this.name = "TwinError";
  }
}

/** The root file a template's workflow is twinned into. */
export function twinName(template, file) {
  return `${template}-${file}`;
}

/** Render the root twin of one template workflow, or throw a TwinError naming what it cannot carry. */
export function renderTwin(template, file, source) {
  const origin = `${template}/${WORKFLOWS_DIR}/${file}`;
  const refuse = (line, why) => {
    throw new TwinError(`${origin}: cannot render "${line.trim()}": ${why}`);
  };
  const out = [];
  let names = 0;
  let jobs = 0;
  let inJobs = false;
  for (const line of source.replace(/\n$/, "").split("\n")) {
    if (line === "jobs:") inJobs = true;
    const name = /^( {4})?name: (.*)$/.exec(line);
    if (name && (name[1] === undefined || inJobs)) {
      if (/^["']/.test(name[2])) refuse(line, "a quoted name");
      out.push(`${line} (${template})`);
      if (name[1] === undefined) names += 1;
      continue;
    }
    if (/^\s+(- )?[\w-]*(path|paths|file|files|directory)(-ignore)?:/.test(line)) {
      refuse(line, "a key naming a path is read from the repository root");
    }
    if (/^\s+(- )?uses:\s*["']?\.\//.test(line)) {
      refuse(line, "a local action is read from the repository root");
    }
    if (line.includes("hashFiles(")) refuse(line, "hashFiles reads from the repository root");
    if (/^\s+(- )?[\w-]+:\s*\{(?!\{)/.test(line)) {
      refuse(line, "the keys of a flow mapping are not read");
    }
    if (inJobs && /^ {4}defaults:/.test(line)) refuse(line, "the job already sets defaults");
    out.push(line);
    if (inJobs && /^ {4}runs-on: /.test(line)) {
      out.push("    defaults:", "      run:", `        working-directory: ${template}`);
      jobs += 1;
    }
    const cache = /^(\s+)(- )?cache:(.*)$/.exec(line);
    if (cache) {
      const value = cache[3]
        .replace(/\s+#.*$/, "")
        .trim()
        .replace(/^(["'])(.*)\1$/, "$2");
      if (value !== "npm") refuse(line, "only an npm cache is pointed at the template's lock file");
      const indent = cache[1] + (cache[2] ? "  " : "");
      out.push(`${indent}cache-dependency-path: ${template}/package-lock.json`);
    }
  }
  if (names !== 1) throw new TwinError(`${origin}: expected one top-level name, found ${names}`);
  if (jobs === 0)
    throw new TwinError(`${origin}: no job with a runs-on line to run in ${template}`);
  const header = [
    `${TWIN_MARKER}${origin} — edit that file and re-render.`,
    "# GitHub reads workflows only at the repository root, and the template's own copy travels",
    "# into every project created from it, so the root runs this twin inside the template.",
  ];
  return `${[...header, ...out].join("\n")}\n`;
}

/** The workflow files a template carries, sorted. */
export function templateWorkflows(root, template) {
  const dir = path.join(root, template, WORKFLOWS_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((file) => /\.ya?ml$/.test(file))
    .sort();
}

/** Every twin the templates call for, keyed by its root file name. */
export function expectedTwins(root, templates) {
  const twins = new Map();
  for (const template of templates) {
    if (!fs.existsSync(path.join(root, template))) {
      throw new TwinError(`${template}: no such template directory`);
    }
    for (const file of templateWorkflows(root, template)) {
      const source = fs.readFileSync(path.join(root, template, WORKFLOWS_DIR, file), "utf8");
      twins.set(twinName(template, file), renderTwin(template, file, source));
    }
  }
  return twins;
}

/** The rendered files already at the root, by name. Hand-written workflows are not listed. */
export function renderedAtRoot(root) {
  const dir = path.join(root, WORKFLOWS_DIR);
  if (!fs.existsSync(dir)) return new Map();
  const found = new Map();
  for (const file of fs.readdirSync(dir).sort()) {
    const text = fs.readFileSync(path.join(dir, file), "utf8");
    if (text.startsWith(TWIN_MARKER)) found.set(file, text);
  }
  return found;
}

/** What differs between the twins on disk and the ones the templates call for. */
export function compareTwins(root, templates) {
  const expected = expectedTwins(root, templates);
  const present = renderedAtRoot(root);
  const problems = [];
  for (const [file, text] of expected) {
    const onDisk = fs.existsSync(path.join(root, WORKFLOWS_DIR, file))
      ? fs.readFileSync(path.join(root, WORKFLOWS_DIR, file), "utf8")
      : null;
    if (onDisk === null) problems.push({ file, kind: "missing" });
    else if (onDisk !== text) problems.push({ file, kind: "stale" });
  }
  for (const file of present.keys()) {
    if (!expected.has(file)) problems.push({ file, kind: "orphaned" });
  }
  return { expected, problems };
}

export function writeTwins(root, templates) {
  const { expected, problems } = compareTwins(root, templates);
  fs.mkdirSync(path.join(root, WORKFLOWS_DIR), { recursive: true });
  for (const { file, kind } of problems) {
    const target = path.join(root, WORKFLOWS_DIR, file);
    if (kind === "orphaned") fs.rmSync(target);
    else fs.writeFileSync(target, expected.get(file), "utf8");
  }
  return problems;
}

export function main(argv) {
  const check = argv.includes("--check");
  const templates = argv.filter((arg) => arg !== "--check");
  if (templates.length === 0) {
    console.error("usage: node scripts/workflows.mjs [--check] <template>...");
    return 2;
  }
  try {
    if (check) {
      const { problems } = compareTwins(ROOT, templates);
      if (problems.length === 0) {
        console.log("Workflow twins are current.");
        return 0;
      }
      for (const { file, kind } of problems) console.error(`${kind}: ${WORKFLOWS_DIR}/${file}`);
      console.error("Run `make workflows` to re-render them, and commit the result.");
      return 1;
    }
    const changed = writeTwins(ROOT, templates);
    for (const { file, kind } of changed) {
      console.log(`${kind === "orphaned" ? "removed" : "rendered"} ${WORKFLOWS_DIR}/${file}`);
    }
    if (changed.length === 0) console.log("Workflow twins are already current.");
    return 0;
  } catch (err) {
    if (err instanceof TwinError) {
      console.error(`error: ${err.message}`);
      return 2;
    }
    throw err;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
