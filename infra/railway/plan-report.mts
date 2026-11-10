/*
 * Read-only report of a Railway plan (ADR-0018, docs/deployment/railway.md).
 *
 *   railway config plan --json | node --experimental-strip-types infra/railway/plan-report.mts
 *   (pnpm railway:report, make railway-report)
 *
 * Reads the plan JSON on stdin and prints what matters before an apply: region, image and
 * volumes of every database (now and as declared), the destructive changes, the custom
 * domains, the canvas groups and the variable names of every service. It never prints a
 * variable value, and changes nothing on Railway.
 */
type Json = Record<string, any>;

const chunks: Buffer[] = [];
for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
const raw = Buffer.concat(chunks).toString("utf8").trim();
if (!raw) {
  console.error("No input: pipe `railway config plan --json` into this script.");
  process.exit(1);
}
const start = raw.indexOf("{");
const plan: Json = JSON.parse(start > 0 ? raw.slice(start) : raw);

const current: Json[] = plan.currentGraph?.resources ?? [];
const desired: Json[] = plan.desiredGraph?.resources ?? [];
const changes: Json[] = plan.changeSet?.changes ?? [];
const diagnostics: Json[] = [...(plan.diagnostics ?? []), ...(plan.changeSet?.diagnostics ?? [])];
const currentEdges: Json[] = plan.currentGraph?.edges ?? [];

const byAddress = (list: Json[]) => new Map(list.map((resource) => [resource.address, resource]));
const now = byAddress(current);
const target = byAddress(desired);

function regions(resource: Json | undefined): string {
  const config = resource?.deploy?.multiRegionConfig;
  if (!config || typeof config !== "object") return resource?.deploy?.region ?? "(not reported)";
  const names = Object.entries(config)
    .filter(([, value]) => value !== null)
    .map(([name, value]) => `${name}×${(value as Json)?.numReplicas ?? 1}`);
  return names.length ? names.join(", ") : "(none)";
}

function image(resource: Json | undefined): string {
  return resource?.image ?? resource?.source?.image ?? "(not reported)";
}

function volumesOf(address: string): string {
  const mounted = currentEdges
    .filter((edge) => edge.type === "mount" && (edge.from === address || edge.to === address))
    .map((edge) => (edge.from === address ? edge.to : edge.from));
  const attachments = Object.values(now.get(address)?.volumeAttachments ?? {}).map(
    (attachment: any) => attachment?.volume,
  );
  const names = [...new Set([...mounted, ...attachments].filter(Boolean))];
  if (!names.length) return "(none reported)";
  return names
    .map((name) => {
      const volume = now.get(name);
      const config = volume?.config ?? {};
      return `${name} [region ${config.region ?? "?"}, ${config.sizeMB ?? "?"} MB]`;
    })
    .join("; ");
}

function line(text = "") {
  console.log(text);
}

const counts = { create: 0, update: 0, delete: 0 };
for (const change of changes) {
  if (change.kind === "resource.create" || change.kind === "domain.create") counts.create++;
  else if (change.kind === "resource.delete") counts.delete++;
  else counts.update++;
}

line(`Plan: ${counts.create} to add, ${counts.update} to change, ${counts.delete} to destroy`);
line(`Plan ok: ${plan.ok === true ? "yes" : "NO (see diagnostics)"}`);

line("\n== Databases (current → declared) ==");
const databases = new Set(
  [...current, ...desired].filter((r) => r.type === "database").map((r) => r.address as string),
);
for (const address of databases) {
  const before = now.get(address);
  const after = target.get(address);
  line(`${address}`);
  line(`  exists on Railway: ${before ? "yes" : "no (will be created)"}`);
  line(`  region:  ${before ? regions(before) : "-"}  →  ${after ? regions(after) : "(not declared)"}`);
  line(`  image:   ${before ? image(before) : "-"}  →  ${after ? image(after) : "-"}`);
  line(`  volumes: ${before ? volumesOf(address) : "-"}`);
  const proxies = Object.keys(before?.networking?.tcpProxies ?? {});
  line(`  public TCP proxy: ${proxies.length ? proxies.join(", ") : "none"}`);
}

line("\n== Destructive changes ==");
const destructive = changes.filter((change) => change.severity === "destructive");
if (!destructive.length) line("none");
for (const change of destructive) {
  line(`- [${change.kind}] ${change.summary ?? change.address}`);
  for (const detail of change.details ?? []) line(`    ${detail}`);
}

line("\n== Database image changes (not flagged destructive by Railway: check them) ==");
const imageChanges = changes.filter(
  (change) => String(change.address).startsWith("database.") && change.field === "source",
);
if (!imageChanges.length) line("none");
for (const change of imageChanges) line(`- ${change.summary}`);

line("\n== Services: group, domains, variables ==");
for (const resource of desired.filter((r) => r.type === "service")) {
  const before = now.get(resource.address);
  const domains = Object.keys(before?.networking?.customDomains ?? {});
  const wanted = Object.keys(resource.networking?.customDomains ?? {});
  const variables = Object.keys(resource.variables ?? {});
  const existing = Object.keys(before?.variables ?? {});
  line(`${resource.address}`);
  line(`  exists on Railway: ${before ? "yes" : "no (will be created)"}`);
  line(`  group: ${before?.groupId ?? "(none)"}  →  ${resource.groupId ?? "(none)"}`);
  line(`  custom domains on Railway: ${domains.join(", ") || "none"} | declared: ${wanted.join(", ") || "none"}`);
  line(`  variables declared (${variables.length}): ${variables.join(", ")}`);
  const removed = existing.filter((key) => !variables.includes(key));
  if (removed.length) line(`  variables on Railway NOT declared (would be deleted): ${removed.join(", ")}`);
}

line("\n== Diagnostics ==");
if (!diagnostics.length) line("none");
for (const diagnostic of diagnostics) {
  line(`- ${diagnostic.severity ?? "info"} ${diagnostic.path ?? ""}: ${diagnostic.message ?? ""}`);
}
