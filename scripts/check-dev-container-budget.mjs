import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.join(root, "config", "dev.env.example");
const composeFile = path.join(root, "compose.dev.yml");

const result = spawnSync(
  process.platform === "win32" ? "docker.exe" : "docker",
  ["compose", "--env-file", envFile, "-f", composeFile, "config", "--format", "json"],
  { cwd: root, encoding: "utf8" },
);

if (result.status !== 0) {
  process.stderr.write(result.stderr || result.stdout || "Docker Compose configuration failed.\n");
  process.exit(result.status ?? 1);
}

const config = JSON.parse(result.stdout);
const expectedServices = ["proxy", "web", "api", "postgres"];
const serviceNames = Object.keys(config.services ?? {}).sort();

if (JSON.stringify(serviceNames) !== JSON.stringify(expectedServices.sort())) {
  throw new Error(`Expected ${expectedServices.join(", ")}; received ${serviceNames.join(", ")}.`);
}

const oneMiB = 1024 * 1024;
const maximumContainerBudget = 1536 * oneMiB;
const totalMemory = serviceNames.reduce((total, name) => {
  const value = Number(config.services[name].mem_limit ?? 0);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must define a positive mem_limit.`);
  }
  return total + value;
}, 0);

if (totalMemory > maximumContainerBudget) {
  throw new Error(`Container limits use ${totalMemory / oneMiB} MiB; maximum is 1536 MiB.`);
}

for (const privateService of ["web", "api", "postgres"]) {
  if ((config.services[privateService].ports ?? []).length > 0) {
    throw new Error(`${privateService} must not publish host ports.`);
  }
}

if ((config.services.proxy.ports ?? []).length !== 2) {
  throw new Error("Only the reverse proxy may publish the HTTP and HTTPS ports.");
}

console.log(`DEV container budget verified: ${totalMemory / oneMiB} MiB of 1536 MiB.`);
