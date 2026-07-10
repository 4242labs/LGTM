import type { Runner } from "../types.js";
import { headersRunner } from "./headers.js";
import { cookiesRunner } from "./cookies.js";
import { tlsRunner } from "./tls.js";
import { a11yRunner } from "./a11y.js";
import { lighthouseRunner } from "./lighthouse.js";
import { depsRunner } from "./deps.js";
import { secretsRunner } from "./secrets.js";
import { sastRunner } from "./sast.js";
import { zapRunner } from "./zap.js";
import { authzRunner } from "./authz.js";

// Registry order = report order. Fast black-box checks first, heavy scans last.
export const ALL_RUNNERS: Runner[] = [
  headersRunner,
  cookiesRunner,
  tlsRunner,
  a11yRunner,
  authzRunner,
  lighthouseRunner,
  depsRunner,
  secretsRunner,
  sastRunner,
  zapRunner,
];

export function runnerById(id: string): Runner | undefined {
  return ALL_RUNNERS.find((r) => r.id === id);
}
