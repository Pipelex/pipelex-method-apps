// @vitest-environment node
//
// `make serve` and `make stop`, each case against a fake dev server: a process
// that forks a child to listen, as `next dev` forks `next-server`, so that
// stopping "the server" is proven to stop everything it started. Every case
// runs in a checkout of its own, on ports found free, with the real lsof, and
// the cases that need lsof are skipped where there is none.

import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

import { afterEach, describe, expect, it } from "vitest";

import {
  devScriptBindsLoopback,
  isLoopbackAddress,
  isLoopbackHost,
  LOCK_FILE,
  parseServeArgs,
  serve,
  startTimeOf,
  stop,
  STATE_FILE,
  type ServeConfig,
  type ServeState,
} from "./serve.mts";

// Each case spawns servers and waits on lsof, which is slow on a busy machine.
const SPAWNS = { timeout: 60_000 };

// The cases that start a server read the real lsof. A slim Linux image may not
// ship it, and `make all` must stay green there, so those cases are skipped
// where it is missing; the refusal `make serve` gives there is tested anyway.
const HAS_LSOF = spawnSync("lsof", ["-v"], { stdio: "ignore" }).error === undefined;

const TEMPLATE_DEV = "next dev -H ${APP_HOST:-127.0.0.1} -p ${APP_PORT:-4300}";

/**
 * The fake dev server. The parent forks a child and stays, as `next dev` does;
 * the child listens on APP_HOST and APP_PORT. Every process appends its pid to
 * `pids` in the directory it runs in. Modes: `ok`, `wide` (binds every
 * interface), `extra` (serves on loopback, and opens a second port on every
 * interface), `silent` (never listens), `slow` (listens after a minute),
 * `exit` (the parent fails at once) and `500` (the page answers 500).
 */
const FAKE_DEV = `
import { fork } from "node:child_process";
import { appendFileSync } from "node:fs";
import http from "node:http";

const [role, mode] = process.argv.slice(2);
appendFileSync("pids", process.pid + "\\n");
const forever = () => setInterval(() => {}, 1 << 30);
if (role === "parent") {
  if (mode === "exit") {
    console.error("fake: cannot start");
    process.exit(3);
  }
  fork(import.meta.filename, ["child", mode], { stdio: "inherit" });
  forever();
} else {
  const listen = () => {
    if (mode === "extra") http.createServer().listen(0, "0.0.0.0");
    http
      .createServer((request, response) => {
        response.statusCode = mode === "500" ? 500 : 200;
        response.setHeader("content-type", "text/html");
        response.end("<html><head><title>Fake &amp; App</title></head><body></body></html>");
      })
      .listen(Number(process.env.APP_PORT), mode === "wide" ? "0.0.0.0" : process.env.APP_HOST);
  };
  if (mode === "silent") forever();
  else if (mode === "slow") setTimeout(listen, 60_000);
  else listen();
}
`;

const dirs: string[] = [];
const holders: ChildProcess[] = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    for (const pid of pidsIn(dir)) kill(pid, "SIGKILL");
    rmSync(dir, { recursive: true, force: true });
  }
  for (const holder of holders.splice(0)) {
    if (holder.pid !== undefined) kill(-holder.pid, "SIGKILL");
  }
});

function kill(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(pid, signal);
  } catch {
    // Already gone.
  }
}

function tempDir(prefix: string): string {
  // The real path: on macOS the temporary directory is reached through a
  // symlink, and the system reports a process's directory without it.
  const dir = realpathSync.native(mkdtempSync(path.join(tmpdir(), prefix)));
  dirs.push(dir);
  return dir;
}

/** A checkout whose `dev` script is `devScript`, holding the fake dev server. */
function checkoutWith(devScript = TEMPLATE_DEV): string {
  const dir = tempDir("serve-checkout-");
  writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "fake", private: true, scripts: { dev: devScript } }),
  );
  writeFileSync(path.join(dir, "fake-dev.mjs"), FAKE_DEV);
  return dir;
}

function pidsIn(dir: string): number[] {
  try {
    return readFileSync(path.join(dir, "pids"), "utf-8").split("\n").filter(Boolean).map(Number);
  } catch {
    return [];
  }
}

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Wait until none of `pids` runs, for `ms` at most, and say whether they are gone. */
async function allGone(pids: readonly number[], ms = 5_000): Promise<boolean> {
  const deadline = Date.now() + ms;
  while (pids.some(alive) && Date.now() < deadline) await sleep(50);
  return !pids.some(alive);
}

/** A port nothing listens on, and the one after it, both free. */
async function freePorts(count: number): Promise<number[]> {
  for (;;) {
    const first = await new Promise<number>((resolve, reject) => {
      const server = net.createServer();
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        const { port } = server.address() as net.AddressInfo;
        server.close(() => resolve(port));
      });
    });
    const ports = Array.from({ length: count }, (_, i) => first + i);
    if (ports.at(-1)! >= 65536) continue;
    const free = await Promise.all(ports.map(portFree));
    if (free.every(Boolean)) return ports;
  }
}

function portFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

async function listening(port: number, ms = 10_000): Promise<void> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const open = await new Promise<boolean>((resolve) => {
      const socket = net.connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (open) return;
    await sleep(50);
  }
  throw new Error(`nothing listened on ${port}`);
}

/** Start a process of its own group in `cwd`, as a person or another app would. */
function startOutside(cwd: string, args: readonly string[], env: Record<string, string> = {}) {
  const child = spawn(process.execPath, args, {
    cwd,
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ...env },
  });
  child.unref();
  holders.push(child);
  return child;
}

/** A foreign app: a listener in another directory. */
async function foreignHolder(port: number) {
  const dir = tempDir("serve-foreign-");
  const holder = startOutside(dir, [
    "-e",
    `require("node:net").createServer().listen(${port}, "127.0.0.1")`,
  ]);
  await listening(port);
  return { dir, pid: holder.pid! };
}

interface Run {
  code: number;
  lines: string[];
  /** The last line printed: the verdict. */
  verdict: string;
}

function configFor(
  checkout: string,
  mode: string,
  ports: readonly number[],
  overrides: Partial<ServeConfig> = {},
): ServeConfig & { lines: string[] } {
  const lines: string[] = [];
  return {
    checkout,
    command: [process.execPath, "fake-dev.mjs", "parent", mode],
    host: "127.0.0.1",
    ports,
    waitMs: 8_000,
    pageMs: 8_000,
    graceMs: 2_000,
    lsof: "lsof",
    print: (line) => lines.push(line),
    lines,
    ...overrides,
  };
}

async function run(
  action: typeof serve | typeof stop,
  config: ServeConfig & { lines: string[] },
): Promise<Run> {
  config.lines.length = 0;
  const code = await action(config);
  const lines = [...config.lines];
  return { code, lines, verdict: lines.at(-1) ?? "" };
}

function stateOf(checkout: string): ServeState | undefined {
  const file = path.join(checkout, STATE_FILE);
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf-8")) as ServeState) : undefined;
}

describe("the loopback rules", () => {
  it("accepts a loopback host and refuses any other", () => {
    for (const host of ["127.0.0.1", "127.0.0.2", "::1", "localhost"]) {
      expect(isLoopbackHost(host), host).toBe(true);
    }
    for (const host of ["0.0.0.0", "::", "[::1]", "192.168.1.20", "example.com", "127.0.0.1 ::"]) {
      expect(isLoopbackHost(host), host).toBe(false);
    }
  });

  it("reads lsof's addresses: loopback is 127.x.x.x or [::1], never a wildcard", () => {
    for (const address of ["127.0.0.1", "127.1.2.3", "[::1]"]) {
      expect(isLoopbackAddress(address), address).toBe(true);
    }
    for (const address of ["*", "[::]", "0.0.0.0", "192.168.1.20", "[::ffff:127.0.0.1]"]) {
      expect(isLoopbackAddress(address), address).toBe(false);
    }
  });

  it("accepts a dev script that binds the host it is given, or loopback itself", () => {
    for (const script of [
      TEMPLATE_DEV,
      'next dev -H "${APP_HOST:-127.0.0.1}" -p 4300',
      "next dev --hostname=127.0.0.1",
      "next dev -H localhost",
      "next dev -H ::1 -p 4300",
    ]) {
      expect(devScriptBindsLoopback(script), script).toBe(true);
    }
    for (const script of [
      "next dev",
      "next dev -p 4300",
      "next dev -H 0.0.0.0",
      "next dev -H ${APP_HOST}",
      "next dev -H 127.0.0.10",
      "",
    ]) {
      expect(devScriptBindsLoopback(script), script).toBe(false);
    }
  });

  it("reads its arguments, the action first", () => {
    expect(parseServeArgs([])).toEqual({ action: "serve" });
    expect(parseServeArgs(["stop"])).toEqual({ action: "stop" });
    expect(parseServeArgs(["serve", "--host", "::1", "--port", "4305"])).toEqual({
      action: "serve",
      host: "::1",
      port: 4305,
    });
    expect(parseServeArgs(["--port", "43o5"]).port).toBeNaN();
    expect(() => parseServeArgs(["--port"])).toThrow("--port needs a value");
    expect(() => parseServeArgs(["--pot", "1"])).toThrow("unknown argument --pot");
  });
});

describe("what is refused or answered before a server is looked for", () => {
  it("refuses a host beyond loopback before starting anything", async () => {
    const checkout = checkoutWith();
    const result = await run(
      serve,
      configFor(checkout, "ok", await freePorts(1), { host: "0.0.0.0" }),
    );
    expect(result.code).toBe(1);
    expect(result.verdict).toMatch(/^refused: not-loopback — APP_HOST=0\.0\.0\.0 /);
    expect(pidsIn(checkout)).toEqual([]);
  });

  it("refuses a dev script that binds no loopback host before starting anything", async () => {
    const checkout = checkoutWith("next dev -p ${APP_PORT:-4300}");
    const result = await run(serve, configFor(checkout, "ok", await freePorts(1)));
    expect(result.verdict).toMatch(/^refused: not-loopback — the dev script in package\.json/);
    expect(pidsIn(checkout)).toEqual([]);
  });

  it("refuses without lsof, before starting anything", async () => {
    const checkout = checkoutWith();
    const result = await run(
      serve,
      configFor(checkout, "ok", await freePorts(1), { lsof: "lsof-that-is-not-installed" }),
    );
    expect(result.verdict).toMatch(/^refused: no-lsof — /);
    expect(pidsIn(checkout)).toEqual([]);
  });

  it("says so when nothing was started", async () => {
    const checkout = checkoutWith();
    const result = await run(stop, configFor(checkout, "ok", []));
    expect(result.code).toBe(0);
    expect(result.verdict).toBe(
      "not-running — make serve has no server recorded in this checkout.",
    );
  });
});

describe.skipIf(!HAS_LSOF)("make serve", SPAWNS, () => {
  it("starts the server, proves its page, and reports it once", async () => {
    const checkout = checkoutWith();
    const ports = await freePorts(2);
    const config = configFor(checkout, "ok", ports);

    const first = await run(serve, config);
    expect(first.code, first.lines.join("\n")).toBe(0);
    expect(first.verdict).toBe(
      `serving http://127.0.0.1:${ports[0]}/ — "Fake & App" (log .serve/server.log); stop it with: make stop`,
    );
    const pids = pidsIn(checkout);
    expect(pids).toHaveLength(2);
    expect(stateOf(checkout)).toMatchObject({ pgid: pids[0], port: ports[0], checkout });

    const second = await run(serve, config);
    expect(second.code).toBe(0);
    expect(second.verdict).toMatch(
      new RegExp(`^already-serving http://127\\.0\\.0\\.1:${ports[0]}/ — "Fake & App"`),
    );
    expect(pidsIn(checkout)).toEqual(pids);

    const stopped = await run(stop, config);
    expect(stopped.verdict).toBe(
      `stopped http://127.0.0.1:${ports[0]}/ (process group ${pids[0]})`,
    );
    expect(await allGone(pids)).toBe(true);
    expect(stateOf(checkout)).toBeUndefined();
  });

  it("stops a server that listens beyond loopback, with its whole group", async () => {
    const checkout = checkoutWith();
    const result = await run(serve, configFor(checkout, "wide", await freePorts(1)));
    expect(result.code).toBe(1);
    expect(result.verdict).toMatch(/^refused: not-loopback — the dev server listened beyond/);
    expect(pidsIn(checkout)).toHaveLength(2);
    expect(await allGone(pidsIn(checkout))).toBe(true);
    expect(stateOf(checkout)).toBeUndefined();
  });

  it("stops a server whose group listens beyond loopback on another port", async () => {
    const checkout = checkoutWith();
    const result = await run(serve, configFor(checkout, "extra", await freePorts(1)));
    expect(result.code).toBe(1);
    expect(result.verdict).toMatch(
      /^refused: not-loopback — the dev server listened beyond this machine \(\*:\d+\)/,
    );
    expect(await allGone(pidsIn(checkout))).toBe(true);
    expect(stateOf(checkout)).toBeUndefined();
  });

  it("takes turns with another make serve in the same checkout, so one server runs", async () => {
    const checkout = checkoutWith();
    const ports = await freePorts(2);
    const runs = await Promise.all([
      run(serve, configFor(checkout, "ok", ports)),
      run(serve, configFor(checkout, "ok", ports)),
    ]);
    const [second, first] = [...runs].sort((a, b) => a.verdict.localeCompare(b.verdict));
    expect(first.verdict).toMatch(new RegExp(`^serving http://127\\.0\\.0\\.1:${ports[0]}/`));
    expect(second.verdict).toMatch(
      new RegExp(`^already-serving http://127\\.0\\.0\\.1:${ports[0]}/`),
    );
    expect(second.lines[0]).toMatch(/^waiting for another make serve or make stop \(pid \d+\)/);
    const pids = pidsIn(checkout);
    expect(pids).toHaveLength(2);
    expect(stateOf(checkout)?.pgid).toBe(pids[0]);
    expect(existsSync(path.join(checkout, LOCK_FILE))).toBe(false);

    expect((await run(stop, configFor(checkout, "ok", ports))).verdict).toMatch(/^stopped /);
    expect(await allGone(pids)).toBe(true);
  });

  it("refuses while a killed run's lock remains, and starts nothing", async () => {
    const checkout = checkoutWith();
    const gone = spawnSync(process.execPath, ["-e", ""]).pid;
    mkdirSync(path.join(checkout, ".serve"));
    writeFileSync(path.join(checkout, LOCK_FILE), `${gone}\nleft-behind\n`);

    const result = await run(serve, configFor(checkout, "ok", await freePorts(1)));
    expect(result.code).toBe(1);
    expect(result.verdict).toMatch(
      new RegExp(
        `^refused: busy — \\.serve/lock is held by pid ${gone}, which is no longer running`,
      ),
    );
    expect(pidsIn(checkout)).toEqual([]);
    expect(existsSync(path.join(checkout, LOCK_FILE))).toBe(true);
  });

  it("stops what it started when an error breaks the start", async () => {
    const checkout = checkoutWith();
    // An lsof that stops being runnable once serve looks at the group's
    // sockets, so the look after the page throws.
    const lsof = path.join(tempDir("serve-lsof-"), "lsof");
    writeFileSync(
      lsof,
      '#!/bin/sh\ncase " $* " in *" -g "*" -iTCP "*) chmod -x "$0" ;; esac\nexec lsof "$@"\n',
    );
    chmodSync(lsof, 0o755);

    await expect(serve(configFor(checkout, "ok", await freePorts(1), { lsof }))).rejects.toThrow(
      /EACCES/,
    );
    expect(pidsIn(checkout)).toHaveLength(2);
    expect(await allGone(pidsIn(checkout))).toBe(true);
    expect(stateOf(checkout)).toBeUndefined();
    expect(existsSync(path.join(checkout, LOCK_FILE))).toBe(false);
  });

  it("steps around a port another directory holds, and leaves it alone", async () => {
    const checkout = checkoutWith();
    const ports = await freePorts(2);
    const foreign = await foreignHolder(ports[0]);

    const result = await run(serve, configFor(checkout, "ok", ports));
    expect(result.verdict).toMatch(new RegExp(`^serving http://127\\.0\\.0\\.1:${ports[1]}/`));
    expect(alive(foreign.pid)).toBe(true);
  });

  it("refuses a given port another directory holds, naming the holder", async () => {
    const checkout = checkoutWith();
    const ports = await freePorts(2);
    const foreign = await foreignHolder(ports[0]);

    const result = await run(serve, configFor(checkout, "ok", ports, { port: ports[0] }));
    expect(result.code).toBe(1);
    expect(result.verdict).toMatch(
      new RegExp(
        `^refused: port-held — port ${ports[0]} is held by pid ${foreign.pid}, running in `,
      ),
    );
    expect(result.verdict).toContain(foreign.dir);
    expect(pidsIn(checkout)).toEqual([]);
    expect(alive(foreign.pid)).toBe(true);
  });

  it("refuses when every port it may try is held", async () => {
    const checkout = checkoutWith();
    const ports = await freePorts(1);
    await foreignHolder(ports[0]);
    const result = await run(serve, configFor(checkout, "ok", ports));
    expect(result.verdict).toMatch(/^refused: port-held — every port from /);
    expect(pidsIn(checkout)).toEqual([]);
  });

  it("stops a server that never opens its port, with every process under it", async () => {
    const checkout = checkoutWith();
    const result = await run(
      serve,
      configFor(checkout, "silent", await freePorts(1), { waitMs: 1_500 }),
    );
    expect(result.code).toBe(1);
    expect(result.verdict).toMatch(/^failed: not-listening — /);
    expect(pidsIn(checkout)).toHaveLength(2);
    expect(await allGone(pidsIn(checkout))).toBe(true);
    expect(stateOf(checkout)).toBeUndefined();
  });

  it("stops a server still starting when the wait ends", async () => {
    const checkout = checkoutWith();
    const result = await run(
      serve,
      configFor(checkout, "slow", await freePorts(1), { waitMs: 1_500 }),
    );
    expect(result.verdict).toMatch(/^failed: not-listening — /);
    expect(await allGone(pidsIn(checkout))).toBe(true);
  });

  it("reports a server that exits before it listens, with the log's tail", async () => {
    const checkout = checkoutWith();
    const result = await run(serve, configFor(checkout, "exit", await freePorts(1)));
    expect(result.code).toBe(1);
    expect(result.verdict).toMatch(/^failed: exited — the dev server exited \(code 3\)/);
    expect(result.lines).toContain("  fake: cannot start");
    expect(stateOf(checkout)).toBeUndefined();
  });

  it("stops a server whose page does not answer 200", async () => {
    const checkout = checkoutWith();
    const ports = await freePorts(1);
    const result = await run(serve, configFor(checkout, "500", ports));
    expect(result.code).toBe(1);
    expect(result.verdict).toMatch(
      new RegExp(`^failed: page 500 — http://127\\.0\\.0\\.1:${ports[0]}/ did not answer with 200`),
    );
    expect(await allGone(pidsIn(checkout))).toBe(true);
  });

  it("reports a server a person started here, and make stop leaves it alone", async () => {
    const checkout = checkoutWith();
    const ports = await freePorts(2);
    // On the second port, so the walk must find it rather than take the first.
    const person = startOutside(checkout, ["fake-dev.mjs", "parent", "ok"], {
      APP_HOST: "127.0.0.1",
      APP_PORT: String(ports[1]),
    });
    await listening(ports[1]);

    // Reached through a symlink, and, where the disk ignores letter case as
    // macOS's does by default, in another case: the system reports the
    // server's directory as the disk spells it.
    const link = path.join(tempDir("serve-link-"), "checkout");
    symlinkSync(checkout, link);
    const spelled = existsSync(link.toUpperCase()) ? link.toUpperCase() : link;
    const config = configFor(spelled, "ok", ports);

    const result = await run(serve, config);
    expect(result.code, result.lines.join("\n")).toBe(0);
    expect(result.verdict).toBe(
      `already-serving http://127.0.0.1:${ports[1]}/ — "Fake & App" (pid ${pidsIn(checkout)[1]}, ` +
        "started outside make serve, so make stop leaves it alone)",
    );
    expect(pidsIn(checkout)).toHaveLength(2);

    const stopped = await run(stop, config);
    expect(stopped.verdict).toMatch(/^not-running — /);
    expect(alive(person.pid!)).toBe(true);
  });

  it("refuses a server a person started here beyond loopback, and leaves it running", async () => {
    const checkout = checkoutWith();
    const ports = await freePorts(1);
    const person = startOutside(checkout, ["fake-dev.mjs", "parent", "wide"], {
      APP_PORT: String(ports[0]),
    });
    await listening(ports[0]);

    const result = await run(serve, configFor(checkout, "ok", ports));
    expect(result.verdict).toMatch(/^refused: not-loopback — this checkout's server on port /);
    expect(result.verdict).toContain("still running");
    expect(alive(person.pid!)).toBe(true);
  });
});

describe.skipIf(!HAS_LSOF)("make stop", SPAWNS, () => {
  it("never signals a recorded group that no longer runs in this checkout", async () => {
    const checkout = checkoutWith();
    const elsewhere = tempDir("serve-recycled-");
    const other = startOutside(elsewhere, ["-e", "setInterval(() => {}, 1 << 30)"]);
    await sleep(200);
    mkdirSync(path.join(checkout, ".serve"));
    const recycled: ServeState = {
      pgid: other.pid!,
      leaderStart: startTimeOf(other.pid!)!,
      port: 4300,
      url: "http://127.0.0.1:4300/",
      log: ".serve/server.log",
      checkout,
      startedAt: new Date().toISOString(),
    };
    writeFileSync(path.join(checkout, STATE_FILE), JSON.stringify(recycled));

    const result = await run(stop, configFor(checkout, "ok", []));
    expect(result.verdict).toMatch(
      /^not-running — process group \d+ is no longer the server make serve started here/,
    );
    expect(alive(other.pid!)).toBe(true);
    expect(stateOf(checkout)).toBeUndefined();
  });

  it("never signals a recorded group whose first process is another one, even here", async () => {
    // A stale record whose id now names a process started in this checkout —
    // a shell, an editor, or the make running the command.
    const checkout = checkoutWith();
    const other = startOutside(checkout, ["-e", "setInterval(() => {}, 1 << 30)"]);
    await sleep(200);
    mkdirSync(path.join(checkout, ".serve"));
    const stale: ServeState = {
      pgid: other.pid!,
      leaderStart: "a process that ended long ago",
      port: 4300,
      url: "http://127.0.0.1:4300/",
      log: ".serve/server.log",
      checkout,
      startedAt: new Date().toISOString(),
    };
    writeFileSync(path.join(checkout, STATE_FILE), JSON.stringify(stale));

    const result = await run(stop, configFor(checkout, "ok", []));
    expect(result.verdict).toMatch(
      /^not-running — process group \d+ is no longer the server make serve started here/,
    );
    expect(alive(other.pid!)).toBe(true);
    expect(stateOf(checkout)).toBeUndefined();
  });
});

describe.skipIf(!HAS_LSOF)("the command that started it", SPAWNS, () => {
  const LIB = path.join(import.meta.dirname, "serve.mts");

  /** Run serve in a process of its own, as `make serve` does, and hand it back. */
  function serveInProcess(
    checkout: string,
    mode: string,
    ports: readonly number[],
    waitMs: number,
  ) {
    const script = path.join(checkout, "run-serve.mts");
    writeFileSync(
      script,
      `import { serve } from ${JSON.stringify(LIB)};\n` +
        `process.exitCode = await serve({ checkout: ${JSON.stringify(checkout)}, ` +
        `command: [process.execPath, "fake-dev.mjs", "parent", ${JSON.stringify(mode)}], ` +
        `host: "127.0.0.1", ports: ${JSON.stringify(ports)}, waitMs: ${waitMs}, pageMs: 8000, ` +
        `graceMs: 2000, lsof: "lsof", print: (line) => console.log(line) });\n`,
    );
    const child = spawn(process.execPath, ["--experimental-strip-types", "--no-warnings", script], {
      cwd: checkout,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => (output += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (output += chunk.toString()));
    const exited = new Promise<number | null>((resolve) => child.on("exit", resolve));
    return { child, exited, output: () => output };
  }

  it("leaves the server running after the command exits", async () => {
    const checkout = checkoutWith();
    const ports = await freePorts(1);
    const started = serveInProcess(checkout, "ok", ports, 8_000);
    expect(await started.exited, started.output()).toBe(0);
    expect(started.output().trimEnd().split("\n").at(-1)).toMatch(/^serving /);

    const response = await fetch(`http://127.0.0.1:${ports[0]}/`);
    expect(response.status).toBe(200);

    const stopped = await run(stop, configFor(checkout, "ok", ports));
    expect(stopped.verdict).toMatch(/^stopped /);
    expect(await allGone(pidsIn(checkout))).toBe(true);
  });

  it("stops what it started when it is interrupted", async () => {
    const checkout = checkoutWith();
    const started = serveInProcess(checkout, "slow", await freePorts(1), 30_000);
    const deadline = Date.now() + 10_000;
    while (!started.output().includes("starting the dev server") && Date.now() < deadline) {
      await sleep(50);
    }
    expect(started.output()).toContain("starting the dev server");
    started.child.kill("SIGINT");

    expect(await started.exited).toBe(1);
    expect(started.output().trimEnd().split("\n").at(-1)).toMatch(/^failed: interrupted — SIGINT/);
    expect(pidsIn(checkout)).toHaveLength(2);
    expect(await allGone(pidsIn(checkout))).toBe(true);
    expect(stateOf(checkout)).toBeUndefined();
  });
});
