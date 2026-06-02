/**
 * Wraps `next build`, tees output, and fails if Next prints an edge-runtime
 * warning. Next exits 0 on these — the bundle ships broken and every request
 * 500s. Treat the warning as fatal.
 *
 * Run via `npm run build:ci`, both in CI and locally before pushing.
 */
import { spawn } from "node:child_process";

const PATTERN = /not supported in the Edge Runtime|node module in edge runtime/i;
const DOCS_URL = "https://nextjs.org/docs/messages/node-module-in-edge-runtime";

// On Windows, npm/npx are .cmd shims — spawn the platform-specific binary
// directly so we don't need shell:true (which trips Node's DEP0190 warning).
const npx = process.platform === "win32" ? "npx.cmd" : "npx";
const child = spawn(npx, ["next", "build"], {
  stdio: ["inherit", "pipe", "pipe"],
});

let captured = "";
const tee = (stream: NodeJS.ReadableStream, sink: NodeJS.WriteStream) => {
  stream.on("data", (chunk: Buffer) => {
    captured += chunk.toString("utf8");
    sink.write(chunk);
  });
};
tee(child.stdout!, process.stdout);
tee(child.stderr!, process.stderr);

child.on("close", (code) => {
  if (PATTERN.test(captured)) {
    const lines = captured.split(/\r?\n/);
    const hitIdx = lines.findIndex((l) => PATTERN.test(l));
    const context = lines
      .slice(Math.max(0, hitIdx - 4), Math.min(lines.length, hitIdx + 2))
      .join("\n");
    process.stderr.write(
      `\n::error::Edge runtime violation in build output. ` +
        `A Node.js built-in was imported from code that runs on the edge ` +
        `(middleware.ts, an edge route, or any module either transitively imports).\n` +
        `Offending excerpt:\n${context}\n` +
        `Fix: replace the Node built-in with a WebCrypto / Fetch-API equivalent, ` +
        `or move the code off the edge runtime.\n` +
        `See ${DOCS_URL}\n`
    );
    process.exit(1);
  }
  process.exit(code ?? 1);
});
