// A whole run, against the stub make: what reaches make create, what is
// printed, and what never is.

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";

import { decodePack } from "../lib/pack.mjs";
import { git, makeRecord, packs, runEnv, runInitializer, tempRoot } from "./support.mjs";

const KEY = "pk_test_never_printed_8d1f";

/** A fresh root with a `work/` directory to run from. */
function workspace() {
  const root = tempRoot("create-method-app-run-");
  const work = path.join(root, "work");
  fs.mkdirSync(work);
  return { root, work };
}

describe("a run", () => {
  it("forwards every create value to make as one NAME=value word, in the contract's order", async () => {
    const { root, work } = workspace();
    const tricky = (name) => `${name} Bob's "$5" \`x\` $(no) 'q'`;
    const flags = [
      ["--method", "METHOD", "mt_forward"],
      ["--name", "NAME", "my-pkg"],
      ["--title", "TITLE", tricky("TITLE")],
      ["--description", "DESCRIPTION", tricky("DESCRIPTION")],
      ["--pipe", "PIPE", "main_pipe"],
      ["--author-name", "AUTHOR_NAME", tricky("AUTHOR_NAME")],
      ["--author-email", "AUTHOR_EMAIL", "a@example.com"],
      ["--repo-url", "REPO_URL", "https://example.com/r"],
      ["--license", "LICENSE", "mit"],
      ["--license-holder", "LICENSE_HOLDER", tricky("LICENSE_HOLDER")],
      ["--license-year", "LICENSE_YEAR", "2026"],
      ["--method-name", "METHOD_NAME", "receipts"],
      ["--label", "LABEL", tricky("LABEL")],
    ];
    const argv = [
      "app",
      ...flags.reverse().flatMap(([flag, , value]) => [flag, value]),
      "--dry-run",
    ];
    const env = { ...runEnv(root), MAKEFLAGS: "NAME=from-an-enclosing-make", MAKELEVEL: "1" };
    const { verdict, output } = await runInitializer(argv, { cwd: work, env });
    assert.equal(verdict, "copied", output);
    const record = makeRecord(root);
    assert.deepEqual(record.args, [
      "create",
      "METHOD=mt_forward",
      "NAME=my-pkg",
      `TITLE=${tricky("TITLE")}`,
      `DESCRIPTION=${tricky("DESCRIPTION")}`,
      "PIPE=main_pipe",
      `AUTHOR_NAME=${tricky("AUTHOR_NAME")}`,
      "AUTHOR_EMAIL=a@example.com",
      "REPO_URL=https://example.com/r",
      "LICENSE=mit",
      `LICENSE_HOLDER=${tricky("LICENSE_HOLDER")}`,
      "LICENSE_YEAR=2026",
      "DRY_RUN=1",
      "METHOD_NAME=receipts",
      `LABEL=${tricky("LABEL")}`,
    ]);
    assert.equal(record.cwd, path.join(work, "app"));
    assert.equal(
      record.makeflags,
      "unset",
      "an enclosing make's variables do not reach make create",
    );
    assert.equal(record.sawKey, true);
  });

  it("makes a relative --method path absolute, and forwards anything else unchanged", async () => {
    const { root, work } = workspace();
    fs.mkdirSync(path.join(work, "methods"));
    fs.writeFileSync(path.join(work, "methods", "receipt.mthds"), 'domain = "receipt"\n');
    await runInitializer(["one", "--method", "methods/receipt.mthds"], {
      cwd: work,
      env: runEnv(root),
    });
    assert.ok(
      makeRecord(root).args.includes(`METHOD=${path.join(work, "methods", "receipt.mthds")}`),
    );

    for (const method of [
      "mt_abc123",
      "github.com/Pipelex/methods/text_stats@v0.1.1",
      "./no/such/bundle.mthds",
    ]) {
      const again = workspace();
      await runInitializer(["two", "--method", method], {
        cwd: again.work,
        env: runEnv(again.root),
      });
      assert.ok(makeRecord(again.root).args.includes(`METHOD=${method}`), method);
    }
  });

  it("prints the gesture's warnings once each, then the git outcome, then the verdict", async () => {
    const { root, work } = workspace();
    const { output } = await runInitializer(["app", "--method", "mt_1"], {
      cwd: work,
      env: runEnv(root),
    });
    const lines = output.trimEnd().split("\n");
    const summary = lines.slice(lines.indexOf("warnings from make create:"));
    assert.deepEqual(summary.slice(0, 3), [
      "warnings from make create:",
      "  ! the method declares no description",
      "  warning: LICENSE copyright line left untouched — pass --license-holder to claim it.",
    ]);
    assert.match(
      summary[3],
      /^git: made a repository on main and committed the template as [0-9a-f]{12}, "Start from /,
    );
    assert.equal(
      summary[4],
      `created ${path.join(work, "app")}; next: cd ${path.join(work, "app")} && make serve`,
    );
    assert.equal(summary.length, 5);
    assert.ok(output.includes("create: 5/6 run make all"), "the stream reaches the output");
  });

  it("with --quiet, writes make create's output to a log and prints its path", async () => {
    const { root, work } = workspace();
    const tmpDir = tempRoot();
    const { output, verdict } = await runInitializer(["app", "--method", "mt_1", "--quiet"], {
      cwd: work,
      env: runEnv(root),
      tmpDir,
    });
    assert.equal(verdict, "created");
    assert.ok(!output.includes("create: 5/6 run make all"), "the stream stays out of the output");
    const logFile = /its output goes to (\S+)$/m.exec(output)[1];
    assert.ok(logFile.startsWith(tmpDir));
    const log = fs.readFileSync(logFile, "utf8");
    assert.ok(log.includes("create: 5/6 run make all"));
    assert.ok(
      output.includes("  ! the method declares no description"),
      "the warnings still reach the summary",
    );
  });

  it("with --quiet, names the log when make create fails", async () => {
    const { root, work } = workspace();
    const { output, verdict } = await runInitializer(["app", "--method", "mt_1", "--quiet"], {
      cwd: work,
      env: runEnv(root, { makeExit: 2 }),
      tmpDir: tempRoot(),
    });
    assert.equal(verdict, "failed: create");
    assert.match(
      output.trimEnd().split("\n").at(-1),
      /make create exited 2\. The copy and its commit stand in .*the end of its log, \/.*make-create\.log, says what to run next/,
    );
  });

  it("never prints the key, whatever the verdict", async () => {
    const runs = [
      [["app", "--method", "mt_1"], {}],
      [["app", "--method", "mt_1", "--quiet"], {}],
      [["app", "--method", "mt_1"], { makeExit: 2 }],
      [["app"], {}],
      [["app", "--method", "mt_1", "--colour", "x"], {}],
      [["app", "--method", "mt_1"], { tools: ["git"] }],
    ];
    for (const [argv, options] of runs) {
      const { root, work } = workspace();
      const tmpDir = tempRoot();
      const { output } = await runInitializer(argv, {
        cwd: work,
        env: runEnv(root, options),
        tmpDir,
      });
      assert.ok(!output.includes(KEY), `${argv.join(" ")} printed the key`);
      for (const dir of fs.readdirSync(tmpDir)) {
        const log = path.join(tmpDir, dir, "make-create.log");
        if (fs.existsSync(log)) assert.ok(!fs.readFileSync(log, "utf8").includes(KEY));
      }
    }
  });

  it("makes the pristine commit with the family version and the source the pack names", async () => {
    const { root, work } = workspace();
    await runInitializer(["app", "--no-create"], { cwd: work, env: runEnv(root) });
    const pack = decodePack(fs.readFileSync(path.join(packs(), "webapp-js.pack")));
    const env = runEnv(root);
    assert.equal(
      git(path.join(work, "app"), ["log", "-1", "--format=%s"], env),
      `Start from Pipelex/pipelex-method-apps/webapp-js ${pack.version} (${pack.source})`,
    );
    assert.equal(
      git(path.join(work, "app"), ["log", "-1", "--format=%an <%ae>"], env),
      "Case Runner <cases@example.com>",
    );
  });

  it("ends in failed: commit, with the copy standing, when git refuses the commit", async () => {
    const { root, work } = workspace();
    const env = runEnv(root);
    const hooks = path.join(root, "hooks");
    fs.mkdirSync(hooks);
    fs.writeFileSync(
      path.join(hooks, "pre-commit"),
      "#!/bin/sh\necho 'a global hook said no' >&2\nexit 1\n",
      { mode: 0o755 },
    );
    fs.appendFileSync(env.GIT_CONFIG_GLOBAL, `[core]\n\thooksPath = ${hooks}\n`);
    const { output, verdict, code } = await runInitializer(["app", "--method", "mt_1"], {
      cwd: work,
      env,
    });
    assert.equal(verdict, "failed: commit");
    assert.equal(code, 1);
    assert.ok(output.includes("a global hook said no"));
    assert.match(
      output.trimEnd().split("\n").at(-1),
      /commit it with git -C .* add -A && git -C .* commit -m 'Start from .*', then run cd .* && make create METHOD=mt_1$/,
    );
    assert.ok(fs.existsSync(path.join(work, "app", "package.json")), "the copy stands");
    assert.equal(makeRecord(root), null, "make create did not run");
  });

  it("names the copy and the next make create after --no-create", async () => {
    const { root, work } = workspace();
    const { output } = await runInitializer(["my app", "--no-create", "--title", "Bob's app"], {
      cwd: work,
      env: runEnv(root),
    });
    const dest = path.join(work, "my app");
    assert.equal(
      output.trimEnd().split("\n").at(-1),
      `copied ${dest}; next: cd '${dest}' && make create METHOD=<method> 'TITLE=Bob'\\''s app'`,
    );
  });

  it("refuses a Node below the template's floor", async () => {
    const { root, work } = workspace();
    let output = "";
    const { run } = await import("../lib/main.mjs");
    const code = await run(["app", "--method", "mt_1"], {
      cwd: work,
      env: runEnv(root),
      out: { write: (text) => (output += text) },
      packDir: packs(),
      nodeVersion: "22.11.9",
    });
    assert.equal(code, 1);
    assert.match(
      output,
      /^refused: node-too-old — webapp-js needs Node 22\.12\.0 or later, and this is Node 22\.11\.9/m,
    );
    assert.equal(fs.existsSync(path.join(work, "app")), false);
  });

  it("ends in failed: write, having removed what it created, when interrupted", async () => {
    const { root, work } = workspace();
    const controller = new AbortController();
    const { output, verdict } = await (async () => {
      let text = "";
      const { run } = await import("../lib/main.mjs");
      const out = {
        write: (chunk) => {
          text += chunk;
          if (chunk.includes("writing webapp-js")) controller.abort("SIGINT");
        },
      };
      await run(["app", "--method", "mt_1"], {
        cwd: work,
        env: runEnv(root),
        out,
        packDir: packs(),
        signal: controller.signal,
      });
      return { output: text, verdict: text.trimEnd().split("\n").at(-1).split(" — ")[0] };
    })();
    assert.equal(verdict, "failed: write", output);
    assert.deepEqual(fs.readdirSync(work), []);
    assert.equal(makeRecord(root), null);
  });

  it("ends in failed: write when the package carries no pack", async () => {
    const { root, work } = workspace();
    let output = "";
    const { run } = await import("../lib/main.mjs");
    await run(["app", "--method", "mt_1"], {
      cwd: work,
      env: runEnv(root),
      out: { write: (text) => (output += text) },
      packDir: tempRoot(),
    });
    assert.match(
      output,
      /^failed: write — this copy of the initializer carries no packed webapp-js/m,
    );
    assert.deepEqual(fs.readdirSync(work), []);
  });

  it("prints its help and its version, and exits 0", async () => {
    const { root, work } = workspace();
    const help = await runInitializer(["--help"], { cwd: work, env: runEnv(root) });
    assert.equal(help.code, 0);
    assert.match(help.output, /usage: npm create @pipelex\/method-app@latest <dir> -- --method/);
    const version = await runInitializer(["--version"], { cwd: work, env: runEnv(root) });
    assert.equal(
      version.output.trim(),
      JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8")).version,
    );
  });
});
