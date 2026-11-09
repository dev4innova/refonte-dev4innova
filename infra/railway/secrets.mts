/*
 * Lists the secrets of .railway/railway.ts: every variable declared with preserve(),
 * one "<service> <VARIABLE>" line each. Used by infra/railway/secrets.sh, so the list of
 * secrets to enter can never drift from the configuration.
 */
import { createRailwayContext, project } from "railway/iac";

import program from "../../.railway/railway.ts";

const definition = await program(createRailwayContext({ environment: "production" }), project);
for (const resource of definition.resources ?? []) {
  const node = resource as { type?: string; name?: string; variables?: Record<string, { type?: string }> };
  if (node.type !== "service") continue;
  for (const [key, value] of Object.entries(node.variables ?? {})) {
    if (value.type === "preserve") console.log(`${node.name} ${key}`);
  }
}
