/**
 * `make serve` and `make stop` — the dev server in the background, proven.
 *
 * `make dev` holds a terminal. `make serve` starts the same dev server detached,
 * waits for its port, checks that the listener is the server it started and
 * that it listens on this machine alone, requests the page, and prints the URL
 * with the page's title. `make stop` stops what it started. Both stay in every
 * project, because a detached, proven server is as useful to a person or an
 * agent working on the app as it is right after the project is created.
 *
 * Every outcome is one verdict line, printed last, whose first word is stable:
 *
 *   serving, already-serving                     the page answered
 *   refused: not-loopback, refused: port-held,   nothing was started
 *   refused: no-lsof, refused: bad-port
 *   failed: not-listening, failed: exited,       what was started is stopped
 *   failed: page <status>, failed: interrupted
 *   stopped, not-running                         make stop
 *
 * Four rules make the verdict true rather than hopeful:
 *
 *  - **Loopback, before and after.** The app's Server Actions run methods with
 *    the key in the server's environment and nothing authenticates the browser
 *    calling them, so a server anyone on the network can reach spends the key
 *    for them from the moment its port opens. A host that is not loopback is
 *    refused before anything starts, and so is a `dev` script that does not bind
 *    the host it is given. Once the port opens, every socket the server listens
 *    on must be loopback, or it is stopped.
 *  - **A process group of its own.** The server is spawned in a new session, so
 *    the terminal's hangup does not reach it, and everything it starts shares
 *    its group. Stopping is one signal to the group, then a hard stop after a
 *    grace period. `.serve/state.json` records the group, and `make stop`
 *    signals it only while one of its processes still runs in this checkout,
 *    so a recycled process id is never signalled.
 *  - **The holder is known by its group.** A listener on the port belongs to the
 *    server serve started when it is in that group; a path is compared only to
 *    recognise a server a person started from this checkout, and then against
 *    the checkout's real path, in the letter case the disk has.
 *  - **Nothing unproven is left running.** A server whose port does not open in
 *    time, that exits, whose page does not answer `200`, or whose start is
 *    interrupted, is stopped with every process under it.
 *
 * Serve never stops what it did not start: a server a person started from this
 * checkout is reported and left alone, and a port another directory holds is
 * stepped around or refused, never taken.
 *
 * It needs `lsof`, and refuses without it rather than passing silently as
 * `port-check` does, since a proof that cannot check the listener is not one.
 */
import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { setTimeout as sleep } from "node:timers/promises";

// The project's root, anchored on this file as `shared.mts` anchors its own.
// Not imported from there, because that module loads the SDK, and serving the
// app should need nothing but Node and the app's own dev server.
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

export const EXIT_OK = 0;
export const EXIT_FAILED = 1;
export const EXIT_USAGE = 2;

/** Where serve keeps its state and the server's log, relative to the checkout. */
export const SERVE_DIR = ".serve";
export const STATE_FILE = path.join(SERVE_DIR, "state.json");
export const LOG_FILE = path.join(SERVE_DIR, "server.log");

/** The ports tried in turn when none is given, as `next dev` and Vite walk theirs. */
export const DEFAULT_PORTS: readonly number[] = Array.from({ length: 10 }, (_, i) => 4300 + i);

export const USAGE =
  "usage: serve.mts [serve] [--host <loopback host>] [--port <port>]\n       serve.mts stop";

export interface ServeConfig {
  /** The project's root: where the server runs and `.serve/` lives. */
  checkout: string;
  /** What starts the dev server, run in the checkout with `APP_HOST` and `APP_PORT` set. */
  command: readonly string[];
  /** `APP_HOST` as given; blank is the default, `127.0.0.1`. */
  host: string;
  /** A port the person named: the only one tried. */
  port?: number;
  /** The ports tried in turn when none is named. */
  ports: readonly number[];
  /** How long the port may take to open. */
  waitMs: number;
  /** How long the page may take to answer, first compilation included. */
  pageMs: number;
  /** How long a stopped group has between the polite signal and the hard one. */
  graceMs: number;
  /** The `lsof` to run; a test names one that does not exist. */
  lsof: string;
  print: (line: string) => void;
}

export const DEFAULT_CONFIG: ServeConfig = {
  checkout: REPO_ROOT,
  command: ["npm", "run", "dev"],
  host: "127.0.0.1",
  ports: DEFAULT_PORTS,
  waitMs: 60_000,
  pageMs: 120_000,
  graceMs: 5_000,
  lsof: "lsof",
  print: (line) => console.log(line),
};

/** What `.serve/state.json` records about the server serve started. */
export interface ServeState {
  pgid: number;
  port: number;
  url: string;
  log: string;
  checkout: string;
  startedAt: string;
}

class NoLsofError extends Error {}

// ── Hosts and addresses ─────────────────────────────────────────────────────

/**
 * Whether `APP_HOST` keeps the server on this machine: an address in
 * 127.0.0.0/8, `::1` or `localhost`, as the Makefile's warning reads it. Next
 * takes an IPv6 host bare, so `[::1]` is not a spelling of loopback here.
 */
export function isLoopbackHost(host: string): boolean {
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host) || host === "::1" || host === "localhost";
}

/**
 * Whether an address `lsof -n` reports for a listening socket is loopback:
 * `127.x.x.x` or `[::1]`. A wildcard (`*`) or any other address is not.
 */
export function isLoopbackAddress(address: string): boolean {
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(address) || address === "[::1]";
}

/**
 * Whether a `dev` script binds the host it is given, or a loopback address of
 * its own: `next dev` given no `-H` listens on every interface, and no
 * environment variable changes that.
 */
export function devScriptBindsLoopback(script: string): boolean {
  return /(^|\s)(-H|--hostname)(\s+|=)("?)(\$\{APP_HOST:-127\.0\.0\.1\}|127\.0\.0\.1|localhost|::1)\4(\s|$)/.test(
    script,
  );
}

function urlOf(address: string, port: number): string {
  return `http://${address}:${port}/`;
}

// ── What lsof says ──────────────────────────────────────────────────────────

/** One listening socket: the process, its group, and the address it is bound to. */
export interface Listener {
  pid: number;
  pgid: number;
  port: number;
  address: string;
}

/** Run lsof and return its field output; a missing lsof throws `NoLsofError`. */
function runLsof(lsof: string, args: readonly string[]): string {
  const result = spawnSync(lsof, args, { encoding: "utf-8" });
  if (result.error !== undefined) {
    if ((result.error as NodeJS.ErrnoException).code === "ENOENT") throw new NoLsofError();
    throw result.error;
  }
  // lsof exits 1 when nothing matched, which is an answer, not a failure.
  return result.stdout;
}

/** Parse lsof's `-F` output into one record per file, carrying its process's fields. */
function parseFields(output: string): Array<{ pid: number; pgid?: number; name: string }> {
  const files: Array<{ pid: number; pgid?: number; name: string }> = [];
  let pid = 0;
  let pgid: number | undefined;
  for (const line of output.split("\n")) {
    const value = line.slice(1);
    switch (line[0]) {
      case "p":
        pid = Number(value);
        pgid = undefined;
        break;
      case "g":
        pgid = Number(value);
        break;
      case "n":
        files.push({ pid, pgid, name: value });
        break;
    }
  }
  return files;
}

/** Every socket listening on one of `ports`. */
export function readListeners(lsof: string, ports: readonly number[]): Listener[] {
  const output = runLsof(lsof, ["-nP", `-iTCP:${ports.join(",")}`, "-sTCP:LISTEN", "-Fpgn"]);
  return parseFields(output).flatMap(({ pid, pgid, name }) => {
    const colon = name.lastIndexOf(":");
    const port = Number(name.slice(colon + 1));
    if (colon < 0 || !ports.includes(port)) return [];
    return [{ pid, pgid: pgid ?? -1, port, address: name.slice(0, colon) }];
  });
}

/** The working directory of a process, as the system reports it. */
function cwdOf(lsof: string, pid: number): string | undefined {
  const output = runLsof(lsof, ["-a", "-p", String(pid), "-d", "cwd", "-Fn"]);
  return parseFields(output)[0]?.name;
}

/** The working directory of every process in a group; empty when the group is gone. */
function groupCwds(lsof: string, pgid: number): string[] {
  const output = runLsof(lsof, ["-a", "-g", String(pgid), "-d", "cwd", "-Fn"]);
  return parseFields(output).map((file) => file.name);
}

// ── The process group ───────────────────────────────────────────────────────

function groupAlive(pgid: number): boolean {
  try {
    process.kill(-pgid, 0);
    return true;
  } catch (error) {
    // EPERM means a process of the group exists but is not ours to signal.
    return (error as NodeJS.ErrnoException).code === "EPERM";
  }
}

function signalGroup(pgid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pgid, signal);
  } catch {
    // The group is already gone.
  }
}

/** Stop a whole group: a polite signal, then a hard one once the grace period runs out. */
export async function stopGroup(pgid: number, graceMs: number): Promise<void> {
  signalGroup(pgid, "SIGTERM");
  const deadline = Date.now() + graceMs;
  while (groupAlive(pgid) && Date.now() < deadline) await sleep(100);
  if (groupAlive(pgid)) {
    signalGroup(pgid, "SIGKILL");
    const hardDeadline = Date.now() + 2_000;
    while (groupAlive(pgid) && Date.now() < hardDeadline) await sleep(50);
  }
}

// ── The state file ──────────────────────────────────────────────────────────

function readState(checkout: string): ServeState | undefined {
  try {
    const state = JSON.parse(readFileSync(path.join(checkout, STATE_FILE), "utf-8")) as ServeState;
    return Number.isInteger(state.pgid) && state.pgid > 1 ? state : undefined;
  } catch {
    return undefined;
  }
}

function writeState(checkout: string, state: ServeState): void {
  const file = path.join(checkout, STATE_FILE);
  writeFileSync(`${file}.tmp`, `${JSON.stringify(state, null, 2)}\n`);
  renameSync(`${file}.tmp`, file);
}

function removeState(checkout: string): void {
  rmSync(path.join(checkout, STATE_FILE), { force: true });
}

/**
 * Whether the group a state file names is still serve's server in this
 * checkout: `gone` when no process of it runs, `foreign` when its processes run
 * elsewhere, which is a recycled id or a checkout copied with its `.serve/`.
 */
function ownership(lsof: string, state: ServeState, checkout: string): "ours" | "gone" | "foreign" {
  if (!groupAlive(state.pgid)) return "gone";
  const cwds = groupCwds(lsof, state.pgid);
  if (cwds.length === 0) return "gone";
  return cwds.includes(checkout) ? "ours" : "foreign";
}

// ── The page ────────────────────────────────────────────────────────────────

type PageAnswer =
  | { status: number; title?: string }
  | { status: "no-answer" | "exited" | "interrupted" };

/** Decode the few entities a `<title>` carries. */
function decodeTitle(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .trim();
}

/**
 * Request the page until it answers, for `pageMs` at most: the first request
 * waits out the page's first compilation, and a refused connection is retried.
 * Any answer is final, and only `200` proves the page. `interrupt` ends a
 * request in flight at once, rather than when its time runs out.
 */
async function requestPage(
  url: string,
  pageMs: number,
  alive: () => boolean,
  interrupt?: AbortSignal,
): Promise<PageAnswer> {
  const deadline = Date.now() + pageMs;
  while (Date.now() < deadline) {
    if (interrupt?.aborted) return { status: "interrupted" };
    if (!alive()) return { status: "exited" };
    const timeout = AbortSignal.timeout(Math.max(1, deadline - Date.now()));
    try {
      const response = await fetch(url, {
        signal: interrupt ? AbortSignal.any([timeout, interrupt]) : timeout,
      });
      const body = await response.text();
      const match = /<title[^>]*>([^<]*)<\/title>/i.exec(body);
      return { status: response.status, title: match ? decodeTitle(match[1]) : undefined };
    } catch {
      if (interrupt?.aborted) return { status: "interrupted" };
      await sleep(500);
    }
  }
  return { status: "no-answer" };
}

function describePage(url: string, title: string | undefined): string {
  return title ? `${url} — "${title}"` : url;
}

// ── The log ─────────────────────────────────────────────────────────────────

function printLogTail(config: ServeConfig, log: string, lines = 20): void {
  let text: string;
  try {
    text = readFileSync(log, "utf-8");
  } catch {
    return;
  }
  const tail = text.trimEnd().split("\n").slice(-lines);
  if (tail.length === 0 || (tail.length === 1 && tail[0] === "")) return;
  config.print(`the last lines of ${LOG_FILE}:`);
  for (const line of tail) config.print(`  ${line}`);
}

// ── serve ───────────────────────────────────────────────────────────────────

function readDevScript(checkout: string): string {
  try {
    const pkg = JSON.parse(readFileSync(path.join(checkout, "package.json"), "utf-8")) as {
      scripts?: Record<string, string>;
    };
    return pkg.scripts?.dev ?? "";
  } catch {
    return "";
  }
}

/** The loopback address a group listens on for a port, IPv4 first. */
function loopbackAddressOf(listeners: readonly Listener[]): string {
  const addresses = listeners.map((listener) => listener.address);
  return addresses.find((address) => address.startsWith("127.")) ?? addresses[0];
}

/**
 * Start the dev server in the background and prove its page, or report the one
 * already serving this checkout. Prints its verdict last and returns the exit
 * code; never throws for an outcome it can name.
 */
export async function serve(config: ServeConfig): Promise<number> {
  const { print } = config;
  const checkout = realpathSync.native(config.checkout);
  const host = config.host.trim() || "127.0.0.1";

  if (!isLoopbackHost(host)) {
    print(
      `refused: not-loopback — APP_HOST=${host} would open the server beyond this machine, ` +
        `where anyone who can reach it runs methods on your key. make serve listens on loopback ` +
        `only; make dev APP_HOST=${host} runs it in the foreground, with a warning.`,
    );
    return EXIT_FAILED;
  }
  const script = readDevScript(checkout);
  if (!devScriptBindsLoopback(script)) {
    print(
      `refused: not-loopback — the dev script in package.json (${JSON.stringify(script)}) ` +
        "does not bind the server to this machine, so make serve does not start it. " +
        "Give it -H ${APP_HOST:-127.0.0.1}, as the template's does.",
    );
    return EXIT_FAILED;
  }
  if (
    config.port !== undefined &&
    !(Number.isInteger(config.port) && config.port > 0 && config.port < 65536)
  ) {
    print(`refused: bad-port — APP_PORT=${config.port} is not a port number.`);
    return EXIT_FAILED;
  }

  try {
    return await serveChecked(config, checkout, host);
  } catch (error) {
    if (error instanceof NoLsofError) {
      print(
        `refused: no-lsof — make serve reads who holds the port with lsof, and ${config.lsof} ` +
          "is not on the PATH. Install lsof, or run make dev in the foreground.",
      );
      return EXIT_FAILED;
    }
    throw error;
  }
}

async function serveChecked(config: ServeConfig, checkout: string, host: string): Promise<number> {
  const { print, lsof } = config;

  // The server serve started earlier, when it still runs here.
  const state = readState(checkout);
  if (state !== undefined) {
    const owner = ownership(lsof, state, checkout);
    if (owner === "ours") {
      const listening = readListeners(lsof, [state.port]).filter(
        (listener) => listener.pgid === state.pgid,
      );
      if (listening.length > 0) return reportOwnServer(config, checkout, state, listening);
      // Ours, but not listening: a start that never finished. It proves
      // nothing, so it goes before a fresh one starts.
      print(
        `the server make serve started earlier (process group ${state.pgid}) is not listening; stopping it.`,
      );
      await stopGroup(state.pgid, config.graceMs);
    }
    removeState(checkout);
  }

  const candidates = config.port !== undefined ? [config.port] : config.ports;
  const listeners = readListeners(lsof, candidates);

  // A server a person started from this checkout, with `make dev`: never
  // stepped around, never stopped.
  const cwds = new Map<number, string | undefined>();
  for (const listener of listeners) {
    if (!cwds.has(listener.pid)) cwds.set(listener.pid, cwdOf(lsof, listener.pid));
  }
  const personal = listeners.find((listener) => cwds.get(listener.pid) === checkout);
  if (personal !== undefined) {
    const sockets = listeners.filter(
      (listener) => listener.pid === personal.pid && listener.port === personal.port,
    );
    return reportPersonalServer(config, personal, sockets);
  }

  let port: number;
  if (config.port !== undefined) {
    const holder = listeners[0];
    if (holder !== undefined) {
      print(
        `refused: port-held — port ${config.port} is held by pid ${holder.pid}, running in ` +
          `${cwds.get(holder.pid) ?? "an unknown directory"}, which is not this checkout. Leave it ` +
          "alone, and give another APP_PORT, or none to take the first free port from " +
          `${config.ports[0]}.`,
      );
      return EXIT_FAILED;
    }
    port = config.port;
  } else {
    const held = new Set(listeners.map((listener) => listener.port));
    const free = config.ports.find((candidate) => !held.has(candidate));
    if (free === undefined) {
      print(
        `refused: port-held — every port from ${config.ports[0]} to ${config.ports.at(-1)} is held ` +
          "by another directory. Give another one with APP_PORT=<port>.",
      );
      return EXIT_FAILED;
    }
    port = free;
  }

  return start(config, checkout, host, port);
}

async function reportOwnServer(
  config: ServeConfig,
  checkout: string,
  state: ServeState,
  listening: readonly Listener[],
): Promise<number> {
  const { print } = config;
  if (!listening.every((listener) => isLoopbackAddress(listener.address))) {
    await stopGroup(state.pgid, config.graceMs);
    removeState(checkout);
    print(
      `refused: not-loopback — the server make serve started listened beyond this machine ` +
        `(${listening.map((l) => l.address).join(", ")}), so it was stopped.`,
    );
    return EXIT_FAILED;
  }
  const url = urlOf(loopbackAddressOf(listening), state.port);
  const page = await requestPage(url, config.pageMs, () => groupAlive(state.pgid));
  if (page.status !== 200) {
    await stopGroup(state.pgid, config.graceMs);
    removeState(checkout);
    printLogTail(config, path.join(checkout, LOG_FILE));
    print(
      `failed: page ${page.status} — the server make serve started earlier did not answer ${url} ` +
        "with 200, so it was stopped.",
    );
    return EXIT_FAILED;
  }
  const title = "title" in page ? page.title : undefined;
  print(`already-serving ${describePage(url, title)} (log ${LOG_FILE}); stop it with: make stop`);
  return EXIT_OK;
}

async function reportPersonalServer(
  config: ServeConfig,
  personal: Listener,
  sockets: readonly Listener[],
): Promise<number> {
  const { print } = config;
  const where = `pid ${personal.pid}, started outside make serve`;
  if (!sockets.every((listener) => isLoopbackAddress(listener.address))) {
    print(
      `refused: not-loopback — this checkout's server on port ${personal.port} (${where}) listens ` +
        `beyond this machine (${sockets.map((l) => l.address).join(", ")}). make serve stops only ` +
        "what it started, so it is still running: stop it yourself.",
    );
    return EXIT_FAILED;
  }
  const url = urlOf(loopbackAddressOf(sockets), personal.port);
  const page = await requestPage(url, config.pageMs, () => true);
  if (page.status !== 200) {
    print(
      `failed: page ${page.status} — this checkout's server on ${url} (${where}) did not answer ` +
        "with 200. make serve did not start it, so it is still running.",
    );
    return EXIT_FAILED;
  }
  const title = "title" in page ? page.title : undefined;
  print(`already-serving ${describePage(url, title)} (${where}, so make stop leaves it alone)`);
  return EXIT_OK;
}

async function start(
  config: ServeConfig,
  checkout: string,
  host: string,
  port: number,
): Promise<number> {
  const { print, lsof } = config;
  const log = path.join(checkout, LOG_FILE);
  mkdirSync(path.join(checkout, SERVE_DIR), { recursive: true });
  const output = openSync(log, "w");

  const [command, ...args] = config.command;
  const child = spawn(command, args, {
    cwd: checkout,
    // A new session: a group of its own for one signal to stop, and out of
    // reach of the terminal's hangup.
    detached: true,
    stdio: ["ignore", output, output],
    env: { ...process.env, APP_HOST: host, APP_PORT: String(port) },
  });
  closeSync(output);
  child.unref();
  let exit: string | undefined;
  child.on("exit", (code, signal) => {
    exit = signal ? `signal ${signal}` : `code ${code}`;
  });
  const spawned = await new Promise<Error | undefined>((resolve) => {
    child.once("spawn", () => resolve(undefined));
    child.once("error", (error) => resolve(error));
  });
  if (spawned !== undefined || child.pid === undefined) {
    print(`failed: exited — could not run ${command}: ${spawned?.message ?? "no process id"}`);
    return EXIT_FAILED;
  }
  const pgid = child.pid;
  const planned = urlOf(host.includes(":") ? `[${host}]` : host, port);
  writeState(checkout, {
    pgid,
    port,
    url: planned,
    log: LOG_FILE,
    checkout,
    startedAt: new Date().toISOString(),
  });
  print(`starting the dev server on port ${port} (process group ${pgid}, log ${LOG_FILE})`);

  // Until the verdict, an interruption stops what was started: the server is in
  // a session of its own, so the terminal's Ctrl-C does not reach it.
  let interrupted: NodeJS.Signals | undefined;
  const interrupt = new AbortController();
  const onSignal = (signal: NodeJS.Signals) => {
    interrupted = signal;
    interrupt.abort();
  };
  process.on("SIGINT", onSignal);
  process.on("SIGTERM", onSignal);
  const giveUp = async (verdict: string, tail = true): Promise<number> => {
    await stopGroup(pgid, config.graceMs);
    removeState(checkout);
    if (tail) printLogTail(config, log);
    print(verdict);
    return EXIT_FAILED;
  };
  const interruptedVerdict = () =>
    `failed: interrupted — ${interrupted} arrived before the page was proven, so the server was stopped.`;

  try {
    // The port opens when a process of this group listens on it.
    const deadline = Date.now() + config.waitMs;
    let listening: Listener[] = [];
    for (;;) {
      if (interrupted) return await giveUp(interruptedVerdict(), false);
      listening = readListeners(lsof, [port]).filter((listener) => listener.pgid === pgid);
      if (listening.length > 0) break;
      if (exit !== undefined) {
        return await giveUp(
          `failed: exited — the dev server exited (${exit}) before it listened on port ${port}.`,
        );
      }
      if (Date.now() >= deadline) {
        return await giveUp(
          `failed: not-listening — nothing of the dev server listened on port ${port} within ` +
            `${Math.round(config.waitMs / 1000)}s, so it was stopped with everything it started.`,
        );
      }
      await sleep(200);
    }

    const beyond = (sockets: readonly Listener[]) =>
      sockets.filter((listener) => !isLoopbackAddress(listener.address));
    if (beyond(listening).length > 0) {
      return await giveUp(
        `refused: not-loopback — the dev server listened beyond this machine ` +
          `(${beyond(listening)
            .map((l) => l.address)
            .join(", ")}), so it was stopped before ` +
          "anything could reach it.",
        false,
      );
    }

    const url = urlOf(loopbackAddressOf(listening), port);
    writeState(checkout, {
      pgid,
      port,
      url,
      log: LOG_FILE,
      checkout,
      startedAt: new Date().toISOString(),
    });
    const page = await requestPage(url, config.pageMs, () => exit === undefined, interrupt.signal);
    if (interrupted) return await giveUp(interruptedVerdict(), false);
    if (page.status === "exited") {
      return await giveUp(
        `failed: exited — the dev server exited (${exit}) before its page answered.`,
      );
    }
    if (page.status !== 200) {
      return await giveUp(
        `failed: page ${page.status} — ${url} did not answer with 200, so the server was stopped.`,
      );
    }

    // Listening sockets can be added after the first one; look once more.
    const after = readListeners(lsof, [port]).filter((listener) => listener.pgid === pgid);
    if (beyond(after).length > 0) {
      return await giveUp(
        `refused: not-loopback — the dev server listened beyond this machine ` +
          `(${beyond(after)
            .map((l) => l.address)
            .join(", ")}), so it was stopped.`,
        false,
      );
    }

    print(`serving ${describePage(url, page.title)} (log ${LOG_FILE}); stop it with: make stop`);
    return EXIT_OK;
  } finally {
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
  }
}

// ── stop ────────────────────────────────────────────────────────────────────

/** Stop the server make serve started here, when it is still this checkout's. */
export async function stop(config: ServeConfig): Promise<number> {
  const { print } = config;
  const checkout = realpathSync.native(config.checkout);
  const state = readState(checkout);
  if (state === undefined) {
    print("not-running — make serve has no server recorded in this checkout.");
    return EXIT_OK;
  }
  let owner: "ours" | "gone" | "foreign";
  try {
    owner = ownership(config.lsof, state, checkout);
  } catch (error) {
    if (!(error instanceof NoLsofError)) throw error;
    print(
      `refused: no-lsof — make stop checks that process group ${state.pgid} still runs in this ` +
        `checkout before signalling it, and ${config.lsof} is not on the PATH.`,
    );
    return EXIT_FAILED;
  }
  removeState(checkout);
  if (owner === "gone") {
    print(
      `not-running — the server make serve started (process group ${state.pgid}) has already exited.`,
    );
    return EXIT_OK;
  }
  if (owner === "foreign") {
    print(
      `not-running — process group ${state.pgid} no longer runs in this checkout, so it was ` +
        "left alone.",
    );
    return EXIT_OK;
  }
  await stopGroup(state.pgid, config.graceMs);
  print(`stopped ${state.url} (process group ${state.pgid})`);
  return EXIT_OK;
}

// ── The command line ────────────────────────────────────────────────────────

export interface ServeArgs {
  action: "serve" | "stop";
  host?: string;
  port?: number;
}

export class UsageError extends Error {}

export function parseServeArgs(argv: readonly string[]): ServeArgs {
  const args: ServeArgs = { action: "serve" };
  const rest = [...argv];
  if (rest[0] === "serve" || rest[0] === "stop") args.action = rest.shift() as ServeArgs["action"];
  while (rest.length > 0) {
    const flag = rest.shift()!;
    const value = rest.shift();
    if (value === undefined) throw new UsageError(`${flag} needs a value`);
    if (flag === "--host") args.host = value;
    else if (flag === "--port") args.port = /^\d+$/.test(value.trim()) ? Number(value.trim()) : NaN;
    else throw new UsageError(`unknown argument ${flag}`);
  }
  return args;
}

/** The whole command, exit code included. */
export async function runServe(
  argv: readonly string[],
  overrides: Partial<ServeConfig> = {},
): Promise<number> {
  let args: ServeArgs;
  try {
    args = parseServeArgs(argv);
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(`serve: ${error.message}\n${USAGE}`);
    return EXIT_USAGE;
  }
  const config: ServeConfig = {
    ...DEFAULT_CONFIG,
    ...(args.host !== undefined ? { host: args.host } : {}),
    ...(args.port !== undefined ? { port: args.port } : {}),
    ...overrides,
  };
  if (!existsSync(config.checkout)) throw new Error(`no checkout at ${config.checkout}`);
  return args.action === "stop" ? stop(config) : serve(config);
}
