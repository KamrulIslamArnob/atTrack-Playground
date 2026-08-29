/**
 * Master Verification Runner for atTrack Hardening Across All 9 Dimensions (R1–R9)
 *
 * Runs the full hardening verification test suite sequentially:
 * - R1: scripts/verify-r1-port-discovery.ts
 * - R2: scripts/verify-r2-server-lifecycle.ts
 * - R3: scripts/verify-r3-sqlite-safety.ts
 * - R4: scripts/verify-r4-extension-cors-queue.ts
 * - R5: scripts/verify-r5-packaging-artifacts.ts
 * - R6: scripts/verify-r6-ai-circuit-breaker.ts
 * - R7/R8/R9: scripts/verify-r7-r8-r9-security-memory.ts
 *
 * Output: Unified ASCII test matrix and overall pass/fail status.
 * Run via: npx tsx scripts/verify-all-hardening.ts
 */

import { spawn } from "node:child_process";
import path from "node:path";

interface SuiteResult {
  dimension: string;
  subsystem: string;
  script: string;
  passed: boolean;
  exitCode: number;
  durationMs: number;
  stdout: string;
  stderr: string;
  checksPassed: number;
  checksFailed: number;
}

const SUITES = [
  {
    dimension: "R1",
    subsystem: "Port Binding & Network Discovery",
    script: "scripts/verify-r1-port-discovery.ts",
  },
  {
    dimension: "R2",
    subsystem: "Server Lifecycle & Logs",
    script: "scripts/verify-r2-server-lifecycle.ts",
  },
  {
    dimension: "R3",
    subsystem: "SQLite Safety & Checkpointing",
    script: "scripts/verify-r3-sqlite-safety.ts",
  },
  {
    dimension: "R4",
    subsystem: "Extension CORS & Offline Queue",
    script: "scripts/verify-r4-extension-cors-queue.ts",
  },
  {
    dimension: "R5",
    subsystem: "Packaging & Platform Artifacts",
    script: "scripts/verify-r5-packaging-artifacts.ts",
  },
  {
    dimension: "R6",
    subsystem: "AI Circuit Breaker & Timeouts",
    script: "scripts/verify-r6-ai-circuit-breaker.ts",
  },
  {
    dimension: "R7, R8, R9",
    subsystem: "Memory, SSRF & Window Hygiene",
    script: "scripts/verify-r7-r8-r9-security-memory.ts",
  },
];

function runScript(scriptRelativePath: string): Promise<{ stdout: string; stderr: string; exitCode: number; durationMs: number }> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const isWindows = process.platform === "win32";
    const tsxCmd = isWindows ? "npx.cmd" : "npx";

    const child = spawn(tsxCmd, ["tsx", scriptRelativePath], {
      cwd: process.cwd(),
      env: { ...process.env, FORCE_COLOR: "0" },
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (exitCode) => {
      const durationMs = Date.now() - startTime;
      resolve({
        stdout,
        stderr,
        exitCode: exitCode ?? 0,
        durationMs,
      });
    });

    child.on("error", (err) => {
      const durationMs = Date.now() - startTime;
      resolve({
        stdout,
        stderr: stderr + `\n${err.message}`,
        exitCode: 1,
        durationMs,
      });
    });
  });
}

function parseCheckCounts(output: string): { passed: number; failed: number } {
  const match = output.match(/Completed:\s*(\d+)\s*passed,\s*(\d+)\s*failed/i);
  if (match) {
    return {
      passed: parseInt(match[1], 10),
      failed: parseInt(match[2], 10),
    };
  }

  // Fallback: count checkmarks
  const checkPasses = (output.match(/✓/g) || []).length;
  const checkFails = (output.match(/✗/g) || []).length;
  return { passed: checkPasses, failed: checkFails };
}

async function main() {
  console.log("\n===============================================================================");
  console.log("             atTrack ARCHITECTURAL HARDENING VERIFICATION MASTER SUITE         ");
  console.log("                             Dimensions R1 through R9                          ");
  console.log("===============================================================================\n");

  const results: SuiteResult[] = [];
  let totalPassedChecks = 0;
  let totalFailedChecks = 0;
  const masterStart = Date.now();

  for (let i = 0; i < SUITES.length; i++) {
    const suite = SUITES[i];
    const progress = `[${i + 1}/${SUITES.length}]`;
    process.stdout.write(`${progress} Running ${suite.dimension} (${suite.subsystem})... `);

    const { stdout, stderr, exitCode, durationMs } = await runScript(suite.script);
    const { passed, failed } = parseCheckCounts(stdout + "\n" + stderr);

    const isSuccess = exitCode === 0 && failed === 0;

    results.push({
      dimension: suite.dimension,
      subsystem: suite.subsystem,
      script: suite.script,
      passed: isSuccess,
      exitCode,
      durationMs,
      stdout,
      stderr,
      checksPassed: passed,
      checksFailed: failed,
    });

    totalPassedChecks += passed;
    totalFailedChecks += failed;

    if (isSuccess) {
      console.log(`PASS (${passed} checks, ${(durationMs / 1000).toFixed(2)}s)`);
    } else {
      console.log(`FAIL (${failed} failed, ${(durationMs / 1000).toFixed(2)}s)`);
    }
  }

  const masterDurationMs = Date.now() - masterStart;

  // Print Consolidated Summary Table
  console.log("\n==========================================================================================");
  console.log("                                 CONSOLIDATED TEST MATRIX                                 ");
  console.log("==========================================================================================");
  console.log(" Dim     | Subsystem                      | Status | Checks | Duration | Script");
  console.log("---------+--------------------------------+--------+--------+----------+-----------------------------------");

  for (const r of results) {
    const dim = r.dimension.padEnd(7, " ");
    const sub = r.subsystem.slice(0, 30).padEnd(30, " ");
    const status = r.passed ? "  PASS " : "  FAIL ";
    const checks = `${r.checksPassed}p/${r.checksFailed}f`.padEnd(6, " ");
    const duration = `${(r.durationMs / 1000).toFixed(2)}s`.padStart(8, " ");
    const script = r.script;
    console.log(` ${dim} | ${sub} | ${status} | ${checks} | ${duration} | ${script}`);
  }

  console.log("==========================================================================================");
  console.log(` Total Suites  : ${SUITES.length}`);
  console.log(` Total Checks  : ${totalPassedChecks + totalFailedChecks} (${totalPassedChecks} passed, ${totalFailedChecks} failed)`);
  console.log(` Total Duration: ${(masterDurationMs / 1000).toFixed(2)}s`);
  console.log("==========================================================================================\n");

  // If there are failures, print the detailed failure logs
  const failures = results.filter((r) => !r.passed);
  if (failures.length > 0) {
    console.log("------------------------------------------------------------------------------------------");
    console.log("                                    FAILURE DETAILS                                       ");
    console.log("------------------------------------------------------------------------------------------\n");

    for (const f of failures) {
      console.log(`=== Suite: ${f.dimension} - ${f.subsystem} (${f.script}) ===`);
      if (f.stderr.trim()) {
        console.log("STDERR:\n" + f.stderr);
      }
      if (f.stdout.trim()) {
        console.log("STDOUT:\n" + f.stdout);
      }
      console.log("");
    }

    console.log("Verification FAILED. Please review the failed assertions above.\n");
    process.exit(1);
  } else {
    console.log("==========================================================================================");
    console.log("  >>> ALL HARDENING VERIFICATION SUITES PASSED SUCCESSFULLY (R1–R9 VERIFIED) <<<  ");
    console.log("==========================================================================================\n");
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Fatal error in master hardening verification runner:", err);
  process.exit(1);
});
