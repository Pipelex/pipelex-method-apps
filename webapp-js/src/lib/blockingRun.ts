import { getPipelexClient } from "@/lib/pipelexClient";
import { classifyPipelineError, type PipelineError } from "@/lib/errors";
import { readClassifyEnv } from "@/lib/serverEnv";
import { buildUsageReport, type UsageReport } from "@/lib/usageReport";
// StartOptions ≡ RunOptions structurally (both `RunRequest & ExtensionOptions`),
// so the same `buildOptions` closure drives `execute` (blocking) and `start`
// (durable). `PipelexStartOptions` is that pure protocol shape plus the run
// extensions — `method_ref` and `method_id`, how a scaffolded action names a
// method that lives on the platform or in a published package rather than
// shipping its bundle inline. Every extension is optional, so an action that
// sends `mthds_contents` satisfies this type unchanged.
import { resultsFromExecute, type PipelexStartOptions, type RunResults } from "@pipelex/sdk";

export type BlockingOutcome<T> =
  | { ok: true; output: T; usage: UsageReport }
  | { ok: false; error: PipelineError };

/**
 * Run a pipeline the **blocking** way — one synchronous `POST /v1/execute` —
 * and narrow its output. Server-only (constructs the SDK client and reads
 * `process.env`).
 *
 * Behind the hosted gateway, `execute` is killed at ~30s and the SDK throws
 * `PipelineExecuteTimeoutError`; that (and every other SDK error) is caught and
 * classified, so the caller always gets a structured `BlockingOutcome`.
 *
 * The execute response is lifted onto `RunResults` by the SDK's own
 * `resultsFromExecute`, the mapping its durable fallback applies: the resolved
 * `main_stuff` (the SDK digs it out of the working memory), the working memory
 * itself, and the usage pair the runner carries on the extension-open
 * `pipe_output`. So a narrower, `buildUsageReport` and anything reading an
 * intermediate stuff read the blocking result exactly as they read the durable
 * one — one accessor each, no `pipe_output` search. A completed run that named no
 * locatable main stuff throws `MissingMainStuffError` on that lift, which the catch
 * below classifies like any other SDK error.
 */
export async function executeBlockingRun<T>(
  buildOptions: () => Promise<PipelexStartOptions>,
  parse: (results: RunResults) => T,
): Promise<BlockingOutcome<T>> {
  try {
    const options = await buildOptions();
    const response = await getPipelexClient().execute(options);
    const results = resultsFromExecute(response);
    return { ok: true, output: parse(results), usage: buildUsageReport(results) };
  } catch (err) {
    // `blocking: true` maps the gateway's 502/504 cap response to execute_timeout.
    return { ok: false, error: classifyPipelineError(err, readClassifyEnv(), { blocking: true }) };
  }
}
