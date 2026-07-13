import { describe, it, expect, afterEach, vi } from "vitest";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeReports } from "../src/report.js";
import type { AuditReport } from "../src/types.js";

// The JSON report is what CI (42L-949) actually reads to gate a build.
// totals / passed / failOn must round-trip exactly as the orchestrator
// computed them — this is the contract, and it must stay stable.

let cwdSpy: ReturnType<typeof vi.spyOn> | undefined;
let workDir: string;

afterEach(() => {
  cwdSpy?.mockRestore();
  if (workDir) rmSync(workDir, { recursive: true, force: true });
});

function sampleReport(overrides: Partial<AuditReport> = {}): AuditReport {
  return {
    site: "mysite",
    baseUrl: "https://example.com",
    stamp: "250101-1200",
    startedAt: "2025-01-01T12:00:00.000Z",
    finishedAt: "2025-01-01T12:01:00.000Z",
    isLocalhost: false,
    allowActive: false,
    results: [
      {
        runnerId: "headers",
        domain: "security",
        status: "ok",
        findings: [{ id: "csp", title: "no CSP", severity: "high" }],
        durationMs: 42,
      },
      {
        runnerId: "deps",
        domain: "deps",
        status: "skipped",
        note: "no repoPath configured (white-box runner)",
        findings: [],
        durationMs: 0,
      },
    ],
    totals: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
    passed: false,
    failOn: "high",
    ...overrides,
  };
}

describe("writeReports — JSON contract", () => {
  it("writes a JSON file whose shape matches the AuditReport exactly", () => {
    workDir = mkdtempSync(join(tmpdir(), "lgtm-report-test-"));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(workDir);

    const report = sampleReport();
    const { json, html } = writeReports(report);

    expect(json).toBe(join(workDir, "reports", "mysite", "mysite-250101-1200.json"));
    const parsed = JSON.parse(readFileSync(json, "utf8"));
    expect(parsed.totals).toEqual({ critical: 0, high: 1, medium: 0, low: 0, info: 0 });
    expect(parsed.passed).toBe(false);
    expect(parsed.failOn).toBe("high");
    expect(parsed.site).toBe("mysite");
    expect(parsed.results).toHaveLength(2);

    // HTML is a rendering concern, not the CI contract — just confirm it was
    // produced and isn't empty, without asserting on markup.
    const htmlContents = readFileSync(html, "utf8");
    expect(htmlContents.length).toBeGreaterThan(0);
    expect(htmlContents).toContain("FAIL");
  });

  it("reflects a passing run's shape too (skipped-only, no real findings)", () => {
    workDir = mkdtempSync(join(tmpdir(), "lgtm-report-test-"));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(workDir);

    const report = sampleReport({
      results: [
        {
          runnerId: "headers",
          domain: "security",
          status: "ok",
          findings: [{ id: "headers-ok", title: "all good", severity: "info" }],
          durationMs: 10,
        },
      ],
      totals: { critical: 0, high: 0, medium: 0, low: 0, info: 1 },
      passed: true,
    });
    const { json } = writeReports(report);
    const parsed = JSON.parse(readFileSync(json, "utf8"));
    expect(parsed.passed).toBe(true);
    expect(parsed.totals.info).toBe(1);
  });
});
