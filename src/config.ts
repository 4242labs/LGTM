import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve, isAbsolute, dirname } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import type { SiteConfig } from "./types.js";

const AuthSchema = z.union([
  z.object({ type: z.literal("none") }),
  z.object({ type: z.literal("storageState"), path: z.string() }),
]);

const SiteSchema = z.object({
  name: z.string(),
  label: z.string().optional(),
  baseUrl: z.string().url(),
  repoPath: z.string().optional(),
  routes: z.array(z.string()).default([]),
  auth: AuthSchema.default({ type: "none" }),
  failOn: z
    .enum(["critical", "high", "medium", "low", "info"])
    .default("high"),
  skip: z.array(z.string()).optional(),
});

/** Load and validate a site config. Resolves relative repoPath / auth.path
 *  against the config file's directory. */
export function loadSite(configPath: string): SiteConfig {
  const raw = parse(readFileSync(configPath, "utf8"));
  const parsed = SiteSchema.parse(raw);
  const base = dirname(resolve(configPath));
  // `~/…` → home (stable across worktree/main); absolute stays; else relative
  // to the config file's dir.
  const abs = (p: string) =>
    p.startsWith("~/")
      ? resolve(homedir(), p.slice(2))
      : isAbsolute(p)
        ? p
        : resolve(base, p);

  return {
    ...parsed,
    repoPath: parsed.repoPath ? abs(parsed.repoPath) : undefined,
    auth:
      parsed.auth.type === "storageState"
        ? { type: "storageState", path: abs(parsed.auth.path) }
        : parsed.auth,
  };
}

/** Build the full de-duped URL list from baseUrl + routes. */
export function resolveUrls(baseUrl: string, routes: string[]): string[] {
  const urls = new Set<string>([baseUrl.replace(/\/$/, "") || baseUrl]);
  for (const r of routes) {
    if (/^https?:\/\//.test(r)) urls.add(r);
    else urls.add(new URL(r, baseUrl).toString());
  }
  return [...urls];
}
