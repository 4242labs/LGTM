import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import pc from "picocolors";
import type { AuditReport, RunnerResult, Severity } from "./types.js";
import { gradeFor } from "./scoring.js";

const SEV_COLOR: Record<Severity, (s: string) => string> = {
  critical: pc.magenta,
  high: pc.red,
  medium: pc.yellow,
  low: pc.blue,
  info: pc.dim,
};

const SEV_HEX: Record<Severity, string> = {
  critical: "#a021c4",
  high: "#d92d20",
  medium: "#dc9a0e",
  low: "#2570eb",
  info: "#6b7280",
};

/** Write JSON + HTML artifacts; return their paths. */
export function writeReports(report: AuditReport): { json: string; html: string } {
  const dir = reportDir(report);
  mkdirSync(dir, { recursive: true });
  const base = `${report.site}-${report.stamp}`;
  const jsonPath = join(dir, `${base}.json`);
  const htmlPath = join(dir, `${base}.html`);
  writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  writeFileSync(htmlPath, renderHtml(report));
  return { json: jsonPath, html: htmlPath };
}

function reportDir(report: AuditReport): string {
  return join(process.cwd(), "reports", report.site);
}

/** Console summary printed at the end of a run. */
export function consoleSummary(report: AuditReport): string {
  const lines: string[] = [];
  lines.push("");
  lines.push(pc.bold(`  lgtm — ${report.site}  ${pc.dim(report.baseUrl)}`));
  lines.push(pc.dim(`  ${report.stamp}  ·  ${report.isLocalhost ? "localhost" : "remote"}${report.allowActive ? " · active" : ""}`));
  lines.push("");
  lines.push(pc.dim("  domain          grade  issues"));
  for (const r of report.results) {
    const n = r.findings.filter((f) => f.severity !== "info").length;
    const grade = gradeFor(r);
    const gcol =
      grade === "A" ? pc.green : grade === "F" || grade === "D" ? pc.red : grade === "—" || grade === "?" ? pc.dim : pc.yellow;
    const detail =
      r.status === "error"
        ? pc.red(`error${r.note ? ` — ${r.note}` : ""}`)
        : r.status === "skipped"
          ? pc.dim(`skipped${r.note ? ` — ${r.note}` : ""}`)
          : n > 0
            ? sevBreakdown(r)
            : pc.green("clean");
    lines.push(`  ${r.runnerId.padEnd(14)}  ${gcol(grade.padEnd(5))}  ${detail}`);
  }
  lines.push("");
  const t = report.totals;
  lines.push(
    `  totals: ${SEV_COLOR.critical(`${t.critical} critical`)} · ${SEV_COLOR.high(`${t.high} high`)} · ${SEV_COLOR.medium(`${t.medium} medium`)} · ${SEV_COLOR.low(`${t.low} low`)}`,
  );
  lines.push(
    report.passed
      ? pc.green(`  PASS `) + pc.dim(`(no findings ≥ ${report.failOn})`)
      : pc.red(`  FAIL `) + pc.dim(`(findings ≥ ${report.failOn} threshold)`),
  );
  lines.push("");
  return lines.join("\n");
}

function sevBreakdown(r: RunnerResult): string {
  const c: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of r.findings) c[f.severity]++;
  const parts: string[] = [];
  (["critical", "high", "medium", "low"] as Severity[]).forEach((s) => {
    if (c[s]) parts.push(SEV_COLOR[s](`${c[s]}${s[0]}`));
  });
  return parts.join(" ");
}

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

function renderHtml(report: AuditReport): string {
  const sections = report.results
    .map((r) => {
      const issues = r.findings.filter((f) => f.severity !== "info");
      const rows = (issues.length ? issues : r.findings)
        .map(
          (f) => `<tr class="sev-${f.severity}">
        <td><span class="pill" style="background:${SEV_HEX[f.severity]}">${f.severity}</span></td>
        <td>${esc(f.title)}${f.standard ? `<div class="std">${esc(f.standard)}</div>` : ""}</td>
        <td class="loc">${f.location ? esc(f.location) : ""}</td>
        <td class="rem">${f.remediation ? esc(f.remediation) : ""}</td>
      </tr>`,
        )
        .join("");
      const grade = gradeFor(r);
      return `<section>
      <h2><span class="grade grade-${grade}">${grade}</span> ${esc(r.runnerId)} <small>${esc(r.domain)} · ${r.status}${r.note ? " · " + esc(r.note) : ""} · ${r.durationMs}ms</small></h2>
      <table><thead><tr><th>sev</th><th>finding</th><th>location</th><th>remediation</th></tr></thead><tbody>${rows}</tbody></table>
    </section>`;
    })
    .join("\n");

  const t = report.totals;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>lgtm — ${esc(report.site)} — ${esc(report.stamp)}</title>
<style>
  :root{color-scheme:light dark;--bg:#fff;--fg:#111827;--muted:#6b7280;--line:#e5e7eb;--card:#f9fafb}
  @media(prefers-color-scheme:dark){:root{--bg:#0b0e14;--fg:#e5e7eb;--muted:#9aa4b2;--line:#232a36;--card:#131822}}
  *{box-sizing:border-box}body{margin:0;font:14px/1.5 ui-sans-serif,system-ui,-apple-system,sans-serif;background:var(--bg);color:var(--fg)}
  .wrap{max-width:1100px;margin:0 auto;padding:32px 20px}
  h1{font-size:22px;margin:0 0 4px}.sub{color:var(--muted);margin:0 0 20px}
  .verdict{display:inline-block;padding:6px 14px;border-radius:8px;font-weight:700;color:#fff}
  .pass{background:#12b76a}.fail{background:#d92d20}
  .totals{margin:16px 0 28px;display:flex;gap:8px;flex-wrap:wrap}
  .chip{padding:4px 10px;border-radius:999px;color:#fff;font-weight:600;font-size:12px}
  section{border:1px solid var(--line);border-radius:12px;margin:14px 0;overflow:hidden;background:var(--card)}
  h2{font-size:15px;margin:0;padding:12px 16px;border-bottom:1px solid var(--line);display:flex;align-items:center;gap:10px}
  h2 small{color:var(--muted);font-weight:400;font-size:12px}
  .grade{display:inline-flex;width:26px;height:26px;align-items:center;justify-content:center;border-radius:6px;font-weight:800;color:#fff;font-size:13px}
  .grade-A{background:#12b76a}.grade-B{background:#84cc16}.grade-C{background:#dc9a0e}.grade-D{background:#f97316}.grade-F{background:#d92d20}.grade-\\—{background:#6b7280}.grade-\\?{background:#6b7280}
  .tablewrap{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:13px}
  th{text-align:left;color:var(--muted);font-weight:600;padding:8px 16px;border-bottom:1px solid var(--line)}
  td{padding:9px 16px;border-bottom:1px solid var(--line);vertical-align:top}
  tr:last-child td{border-bottom:0}
  .pill{color:#fff;padding:2px 8px;border-radius:999px;font-size:11px;text-transform:uppercase;letter-spacing:.02em}
  .std{color:var(--muted);font-size:11px;margin-top:3px}.loc{font-family:ui-monospace,monospace;font-size:12px;word-break:break-all;max-width:260px}
  .rem{color:var(--muted);max-width:320px}
</style></head><body><div class="wrap">
  <h1>lgtm — ${esc(report.site)}</h1>
  <p class="sub">${esc(report.baseUrl)} · ${esc(report.stamp)} · ${report.isLocalhost ? "localhost" : "remote"}${report.allowActive ? " · active scan" : ""}</p>
  <span class="verdict ${report.passed ? "pass" : "fail"}">${report.passed ? "PASS" : "FAIL"} · threshold ≥ ${report.failOn}</span>
  <div class="totals">
    <span class="chip" style="background:${SEV_HEX.critical}">${t.critical} critical</span>
    <span class="chip" style="background:${SEV_HEX.high}">${t.high} high</span>
    <span class="chip" style="background:${SEV_HEX.medium}">${t.medium} medium</span>
    <span class="chip" style="background:${SEV_HEX.low}">${t.low} low</span>
  </div>
  ${sections}
  <p class="sub" style="margin-top:24px">Generated by lgtm ${esc(report.startedAt)} → ${esc(report.finishedAt)}</p>
</div></body></html>`;
}
