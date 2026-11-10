/*
 * DEV4INNOVA production on Railway, as code (ADR-0018, docs/deployment/railway.md).
 *
 *   railway config plan    # preview the changes, nothing is modified
 *   railway config apply   # apply them (asks for confirmation)
 *
 * This file owns the whole project: services, databases, buckets, domains and every variable of
 * every service ("managed" variables: a variable missing here is removed on apply).
 * Secrets are never written here: they are declared with preserve(), which keeps the value
 * stored in Railway, and are entered once with `make railway-secrets`.
 *
 * Only edit SETTINGS below. Values still set to CHANGE_ME stop the plan with an error.
 */
import {
  bucket,
  database,
  defineRailway,
  github,
  group,
  preserve,
  project,
  redis,
  service,
} from "railway/iac";

const CHANGE_ME = "CHANGE_ME";

/** Non-secret production settings (versioned on purpose). */
const SETTINGS = {
  repository: "dev4innova/refonte-dev4innova",
  branch: "main",
  /**
   * Railway region EU West (Amsterdam, NL). Placement (multiRegionConfig) takes the
   * deployment region ID, "europe-west4-drams3a"; "europe-west4" is only its provider-region
   * label (see `railway scale`).
   */
  region: "europe-west4-drams3a",
  /** Public site https://www.<domain> and API https://api.<domain>. */
  domain: "dev4innova.com",
  /** Railway Buckets region (Amsterdam), next to the services. */
  bucketRegion: "ams" as const,
  /** Seller details printed on every invoice (public legal information). */
  seller: {
    name: "DEV4INNOVA",
    legalForm: CHANGE_ME, // e.g. SAS au capital de 1 000 €
    address: CHANGE_ME,
    siren: CHANGE_ME,
    vatNumber: CHANGE_ME,
    email: CHANGE_ME,
  },
  schedules: {
    /** Database dump to S3 (UTC). */
    backup: "43 1 * * *",
    /** Purges of inactive AI sessions and never-unlocked diagnostics (UTC). */
    daily: "17 2 * * *",
  },
};

/** Fails the plan while a setting has not been filled in. */
function assertConfigured(value: unknown, path = "SETTINGS"): void {
  if (value === CHANGE_ME) throw new Error(`${path} is still CHANGE_ME in .railway/railway.ts`);
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) assertConfigured(child, `${path}.${key}`);
  }
}

export default defineRailway(() => {
  assertConfigured(SETTINGS);
  const { region, domain, bucketRegion, seller, schedules } = SETTINGS;
  const siteUrl = `https://www.${domain}`;
  const apiUrl = `https://api.${domain}`;

  // Deployed from main once every CI check is green ("Wait for CI").
  const source = github(SETTINGS.repository, { branch: SETTINGS.branch, checkSuites: true });
  const oneReplica = { [region]: 1 };

  // PostgreSQL 17, like CI, Docker Compose and the backup image (pg_dump must not be older
  // than the server). Railway's postgres() helper would pick the latest major version.
  const postgres = database("postgres", "postgres", {
    image: "ghcr.io/railwayapp-templates/postgres-ssl:17",
    output: "DATABASE_URL",
    defaultMountPath: "/var/lib/postgresql/data",
    region,
  });
  const cache = redis("redis", { region });
  // Private network only: the services reach both databases on *.railway.internal. Railway
  // opens a public TCP proxy when it creates PostgreSQL; a null entry removes it (on the
  // next apply after a creation) and is a no-op when no proxy exists.
  postgres.networking = { tcpProxies: { "5432": null } };
  cache.networking = { tcpProxies: { "6379": null } };

  /** Settings read by the API and by the scheduled jobs (same image, same guard). */
  const apiSettings = {
    APP_ENV: "production",
    LOG_LEVEL: "INFO",
    DATABASE_URL: postgres.env.DATABASE_URL, // postgresql://…, the API adds the asyncpg driver
    REDIS_URL: cache.env.REDIS_URL,
    SITE_URL: siteUrl,
    API_PUBLIC_URL: apiUrl,
    CORS_ALLOWED_ORIGINS: JSON.stringify([siteUrl]),
  };

  // Railway Buckets (ADR-0019): private, S3-compatible, one set of credentials each. Their
  // name, endpoint and keys come from each bucket's Credentials tab (make railway-secrets).
  const mediaBucket = bucket("media", { region: bucketRegion });
  const portalBucket = bucket("portal", { region: bucketRegion });
  const backupBucket = bucket("backups", { region: bucketRegion });

  const api = service("api", {
    source,
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "infra/docker/api.Dockerfile",
      watchPatterns: ["apps/api/**", "infra/docker/api.Dockerfile"],
    },
    // Migrations run before the new version takes traffic; on failure nothing switches.
    preDeploy: "alembic upgrade head",
    healthcheck: "/api/v1/health/ready",
    healthcheckTimeout: 120,
    deploy: {
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
      // Zero downtime: both versions overlap, then the old one finishes its requests.
      overlapSeconds: 30,
      drainingSeconds: 30,
    },
    replicas: oneReplica,
    // Public: media of the website are served from here; the web app uses the private network.
    domains: [{ domain: `api.${domain}`, port: 8000 }],
    env: {
      ...apiSettings,
      PORT: "8000",
      // Only the web app and Railway's proxy reach the API.
      TRUST_FORWARDED_FOR: "true",
      // The bucket is private: media are served by this API.
      MEDIA_PUBLIC_BASE_URL: `${apiUrl}/api/v1/media`,
      BILLING_SELLER_NAME: seller.name,
      BILLING_SELLER_LEGAL_FORM: seller.legalForm,
      BILLING_SELLER_ADDRESS: seller.address,
      BILLING_SELLER_SIREN: seller.siren,
      BILLING_SELLER_VAT_NUMBER: seller.vatNumber,
      BILLING_SELLER_EMAIL: seller.email,
      // Secrets and bucket credentials: entered with `make railway-secrets`, never here.
      MEDIA_S3_BUCKET: preserve(),
      MEDIA_S3_ENDPOINT_URL: preserve(),
      MEDIA_S3_REGION: preserve(),
      MEDIA_S3_ACCESS_KEY_ID: preserve(),
      MEDIA_S3_SECRET_ACCESS_KEY: preserve(),
      PORTAL_S3_BUCKET: preserve(),
      PORTAL_S3_ENDPOINT_URL: preserve(),
      PORTAL_S3_REGION: preserve(),
      PORTAL_S3_ACCESS_KEY_ID: preserve(),
      PORTAL_S3_SECRET_ACCESS_KEY: preserve(),
      ANTHROPIC_API_KEY: preserve(),
      OPENAI_API_KEY: preserve(),
      GEMINI_API_KEY: preserve(),
      BILLING_SELLER_IBAN: preserve(),
      BILLING_SELLER_BIC: preserve(),
    },
  });

  const web = service("web", {
    source,
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "infra/docker/web.Dockerfile",
      watchPatterns: ["apps/web/**", "packages/**", "pnpm-lock.yaml", "infra/docker/web.Dockerfile"],
    },
    healthcheck: "/api/health",
    healthcheckTimeout: 120,
    deploy: {
      restartPolicyType: "ON_FAILURE",
      restartPolicyMaxRetries: 5,
      overlapSeconds: 30,
      drainingSeconds: 30,
    },
    replicas: oneReplica,
    domains: [{ domain: `www.${domain}`, port: 3000 }],
    env: {
      PORT: "3000",
      // Private network (IPv6): the API listens on IPv4 and IPv6 (uvicorn --host "").
      API_URL: "http://${{api.RAILWAY_PRIVATE_DOMAIN}}:8000",
      // Also a Docker build argument: Railway passes service variables to the build.
      SITE_URL: siteUrl,
      ALLOW_INDEXING: "true",
    },
  });

  const jobs = service("jobs", {
    source,
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "infra/docker/api.Dockerfile",
      watchPatterns: ["apps/api/**", "infra/docker/api.Dockerfile"],
    },
    start: "python -m app.cli daily",
    deploy: { cronSchedule: schedules.daily, restartPolicyType: "NEVER" },
    replicas: oneReplica,
    env: apiSettings,
  });

  const backup = service("backup", {
    source,
    build: {
      builder: "DOCKERFILE",
      dockerfilePath: "infra/docker/backup.Dockerfile",
      watchPatterns: ["infra/backup/**", "infra/docker/backup.Dockerfile"],
    },
    deploy: { cronSchedule: schedules.backup, restartPolicyType: "NEVER" },
    replicas: oneReplica,
    env: {
      DATABASE_URL: postgres.env.DATABASE_URL,
      BACKUP_RETENTION_DAYS: "30",
      // Credentials of the "backups" bucket (its own key: no access to the other buckets).
      BACKUP_S3_BUCKET: preserve(),
      BACKUP_S3_ENDPOINT_URL: preserve(),
      AWS_DEFAULT_REGION: preserve(),
      AWS_ACCESS_KEY_ID: preserve(),
      AWS_SECRET_ACCESS_KEY: preserve(),
    },
  });

  return project("dev4innova", {
    resources: [
      group("Application", [web, api]),
      group("Data", [postgres, cache, mediaBucket, portalBucket, backupBucket]),
      group("Scheduled jobs", [jobs, backup]),
    ],
  });
});
