import { execaCommand } from "execa";
import { readFile, writeFile, mkdir, rm, access } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

const NSS_DIR = join(homedir(), ".nss");
const TRAEFIK_DIR = join(NSS_DIR, "traefik");
const DYNAMIC_DIR = join(TRAEFIK_DIR, "dynamic");
const CERTS_DIR = join(TRAEFIK_DIR, "certs");
const REGISTRY_PATH = join(NSS_DIR, "registry.json");

const DOCKER_NETWORK = "nss-traefik";
const CONTAINER_NAME = "nss-traefik";

// ─── Port allocation bases ───────────────────────
const PORT_BASES = { web: 3000, api: 1337, db: 5432 };

// ─── Helpers ─────────────────────────────────────

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function run(cmd, cwd) {
  return execaCommand(cmd, { cwd, stdio: "pipe" });
}

// ─── Docker checks ───────────────────────────────

export async function checkDockerAvailable() {
  try {
    await run("docker info");
  } catch {
    throw new Error(
      "Docker is not running. Please start Docker Desktop and try again."
    );
  }
}

export async function isTraefikRunning() {
  try {
    const { stdout } = await run(
      `docker inspect -f "{{.State.Running}}" ${CONTAINER_NAME}`
    );
    return stdout.trim() === "true";
  } catch {
    return false;
  }
}

// ─── Registry ────────────────────────────────────

export async function loadRegistry() {
  try {
    const raw = await readFile(REGISTRY_PATH, "utf-8");
    const data = JSON.parse(raw);
    if (!data.projects || !Array.isArray(data.projects)) {
      throw new Error("malformed");
    }
    return data;
  } catch {
    return { projects: [] };
  }
}

export async function saveRegistry(registry) {
  await mkdir(NSS_DIR, { recursive: true });
  await writeFile(REGISTRY_PATH, JSON.stringify(registry, null, 2) + "\n");
}

export async function registerProject(name, projectDir, ports, domains) {
  const registry = await loadRegistry();
  // Remove existing entry for this project name (idempotent)
  registry.projects = registry.projects.filter((p) => p.name !== name);
  registry.projects.push({
    name,
    path: projectDir,
    ports,
    domains,
    createdAt: new Date().toISOString(),
  });
  await saveRegistry(registry);
}

// ─── Port allocation ─────────────────────────────

export async function getNextAvailablePorts() {
  const registry = await loadRegistry();
  const usedWeb = new Set(registry.projects.map((p) => p.ports?.web));
  const usedApi = new Set(registry.projects.map((p) => p.ports?.api));
  const usedDb = new Set(registry.projects.map((p) => p.ports?.db));

  let web = PORT_BASES.web;
  while (usedWeb.has(web)) web++;

  let api = PORT_BASES.api;
  while (usedApi.has(api)) api++;

  let db = PORT_BASES.db;
  while (usedDb.has(db)) db++;

  return { web, api, db };
}

// ─── Shared Traefik setup ────────────────────────

export async function ensureSharedTraefik() {
  // 1. Create directory structure
  await mkdir(DYNAMIC_DIR, { recursive: true });
  await mkdir(CERTS_DIR, { recursive: true });

  // 2. Generate wildcard cert if missing
  if (!(await fileExists(join(CERTS_DIR, "nss-local.crt")))) {
    await generateWildcardCert();
  }

  // 3. Write docker-compose.yml (always overwrite to keep up-to-date)
  await writeFile(join(TRAEFIK_DIR, "docker-compose.yml"), traefikCompose());

  // 4. Write shared TLS config
  await writeFile(join(DYNAMIC_DIR, "_tls.yml"), tlsConfig());

  // 5. Create Docker network if missing
  await ensureDockerNetwork();

  // 6. Start Traefik if not running
  if (!(await isTraefikRunning())) {
    await run("docker compose up -d", TRAEFIK_DIR);
  }
}

async function generateWildcardCert() {
  const certPath = join(CERTS_DIR, "nss-local.crt");
  const keyPath = join(CERTS_DIR, "nss-local.key");

  // Try mkcert first
  try {
    await run(
      `mkcert -cert-file "${certPath}" -key-file "${keyPath}" "localhost" "*.localhost"`,
      CERTS_DIR
    );
    return;
  } catch {
    // mkcert not available, fall back to openssl
  }

  // Fallback: openssl self-signed
  await run(
    `openssl req -x509 -newkey rsa:2048 -nodes ` +
      `-keyout "${keyPath}" -out "${certPath}" -days 365 ` +
      `-subj "/CN=localhost" ` +
      `-addext "subjectAltName=DNS:localhost,DNS:*.localhost"`,
    CERTS_DIR
  );
}

async function ensureDockerNetwork() {
  try {
    await run(`docker network inspect ${DOCKER_NETWORK}`);
  } catch {
    await run(`docker network create ${DOCKER_NETWORK}`);
  }
}

// ─── Project routing ─────────────────────────────

export async function addProjectRouting(name, domains, ports) {
  const routingFile = join(DYNAMIC_DIR, `${name}.yml`);
  await writeFile(routingFile, projectRoutingConfig(name, domains, ports));
}

export async function removeProjectRouting(name) {
  const routingFile = join(DYNAMIC_DIR, `${name}.yml`);
  if (await fileExists(routingFile)) {
    await rm(routingFile);
  }
}

// ─── Config templates ────────────────────────────

function traefikCompose() {
  return `name: nss-traefik

services:
  traefik:
    image: traefik:v3.4
    container_name: ${CONTAINER_NAME}
    restart: unless-stopped
    command:
      - "--api.insecure=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--providers.file.directory=/etc/traefik/dynamic"
      - "--providers.file.watch=true"
      - "--log.level=WARN"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"
    volumes:
      - ${DYNAMIC_DIR}:/etc/traefik/dynamic:ro
      - ${CERTS_DIR}:/etc/traefik/certs:ro
    networks:
      - ${DOCKER_NETWORK}
    extra_hosts:
      - "host.docker.internal:host-gateway"

networks:
  ${DOCKER_NETWORK}:
    external: true
`;
}

function tlsConfig() {
  return `tls:
  stores:
    default:
      defaultCertificate:
        certFile: /etc/traefik/certs/nss-local.crt
        keyFile: /etc/traefik/certs/nss-local.key
`;
}

function projectRoutingConfig(name, domains, ports) {
  const webHost = domains.web;
  const apiHost = domains.api;
  const webPort = ports.web;
  const apiPort = ports.api;

  return `http:
  routers:
    ${name}-web:
      rule: "Host(\`${webHost}\`)"
      entryPoints:
        - websecure
      service: ${name}-web
      tls: {}
    ${name}-api:
      rule: "Host(\`${apiHost}\`)"
      entryPoints:
        - websecure
      service: ${name}-api
      tls: {}

  services:
    ${name}-web:
      loadBalancer:
        servers:
          - url: "http://host.docker.internal:${webPort}"
    ${name}-api:
      loadBalancer:
        servers:
          - url: "http://host.docker.internal:${apiPort}"
`;
}
