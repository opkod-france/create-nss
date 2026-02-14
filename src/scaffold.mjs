import { execaCommand } from "execa";
import { readFile, writeFile, cp, access } from "node:fs/promises";
import { resolve, join } from "node:path";
import { randomBytes } from "node:crypto";
import chalk from "chalk";
import ora from "ora";
import { uploadProviders, emailProviders, strapiPlugins } from "./catalog.mjs";
import {
  checkDockerAvailable,
  ensureSharedTraefik,
  addProjectRouting,
  registerProject,
} from "./traefik.mjs";

const TEMPLATE_REPO = "opkod-france/nextjs-strapi-starter";

function secret() {
  return randomBytes(32).toString("base64");
}

async function run(cmd, cwd) {
  return execaCommand(cmd, { cwd, stdio: "pipe" });
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function replaceAll(content, search, replace) {
  return content.split(search).join(replace);
}

export async function scaffold(answers, options = {}) {
  const useCurrentDir = answers.useCurrentDir === true;
  const projectDir = useCurrentDir
    ? process.cwd()
    : resolve(process.cwd(), answers.name);
  const ports = answers.ports;

  // ─── Preflight checks ──────────────────────────
  await checkDockerAvailable();

  if (!useCurrentDir && !options.force && (await exists(join(projectDir, "package.json")))) {
    throw new Error(
      `Project directory "${answers.name}" already contains a package.json. ` +
        "Use --force to overwrite."
    );
  }

  // ─── 1. Clone template ─────────────────────────
  if (useCurrentDir) {
    const cloneSpinner = ora("Downloading template into current directory...").start();
    try {
      // Clone into a temp dir, then move contents into cwd
      const tmpDir = join(projectDir, ".nss-tmp");
      await run(
        `git clone https://github.com/${TEMPLATE_REPO}.git .nss-tmp`,
        projectDir
      );
      // Move all files (including hidden) from tmp into cwd
      await run("rsync -a --exclude .git .nss-tmp/ ./", projectDir);
      await run("rm -rf .nss-tmp", projectDir);
      cloneSpinner.succeed("Template downloaded into current directory");
    } catch (err) {
      cloneSpinner.fail("Failed to download template");
      throw err;
    }
  } else {
    const cloneSpinner = ora("Cloning template...").start();
    try {
      await run(
        `gh repo create ${answers.name} --template ${TEMPLATE_REPO} --clone --public`,
        process.cwd()
      );
      cloneSpinner.succeed("Template cloned");
    } catch {
      cloneSpinner.text = "gh clone failed, trying git clone...";
      try {
        await run(
          `git clone https://github.com/${TEMPLATE_REPO}.git ${answers.name}`,
          process.cwd()
        );
        // Remove origin so it's a fresh project
        await run("git remote remove origin", projectDir);
        cloneSpinner.succeed("Template cloned");
      } catch (err) {
        cloneSpinner.fail("Failed to clone template");
        throw err;
      }
    }
  }

  // ─── 2. Rename project ─────────────────────────
  const renameSpinner = ora("Configuring project...").start();

  // Root package.json
  const rootPkg = join(projectDir, "package.json");
  let rootPkgContent = await readFile(rootPkg, "utf-8");
  rootPkgContent = replaceAll(rootPkgContent, "nextjs-strapi-starter", answers.name);
  await writeFile(rootPkg, rootPkgContent);

  // Web package.json
  const webPkg = join(projectDir, "apps/web/package.json");
  let webPkgContent = await readFile(webPkg, "utf-8");
  webPkgContent = replaceAll(webPkgContent, '"web"', `"@${answers.name}/web"`);
  await writeFile(webPkg, webPkgContent);

  // API package.json
  const apiPkg = join(projectDir, "apps/api/package.json");
  let apiPkgContent = await readFile(apiPkg, "utf-8");
  apiPkgContent = replaceAll(apiPkgContent, '"api"', `"@${answers.name}/api"`);
  apiPkgContent = replaceAll(
    apiPkgContent,
    "Strapi v5 backend",
    `${answers.description} — API`
  );
  apiPkgContent = replaceAll(apiPkgContent, "to-be-generated", randomBytes(16).toString("hex"));
  await writeFile(apiPkg, apiPkgContent);

  // Next.js layout
  const layoutPath = join(projectDir, "apps/web/app/layout.tsx");
  let layoutContent = await readFile(layoutPath, "utf-8");
  layoutContent = replaceAll(layoutContent, "Next.js + Strapi Starter", answers.name);
  layoutContent = replaceAll(
    layoutContent,
    "A full-stack starter with Next.js 15, Strapi v5, and PostgreSQL",
    answers.description
  );
  await writeFile(layoutPath, layoutContent);

  renameSpinner.succeed("Project configured");

  // ─── 3. Generate .env ──────────────────────────
  const envSpinner = ora("Generating .env...").start();

  const envExamplePath = join(projectDir, ".env.example");
  const envPath = join(projectDir, ".env");
  let envContent = await readFile(envExamplePath, "utf-8");

  // Database
  envContent = replaceAll(envContent, "DATABASE_NAME=strapi_db", `DATABASE_NAME=${answers.dbName}`);
  envContent = replaceAll(envContent, "DATABASE_USERNAME=strapi", `DATABASE_USERNAME=${answers.dbUser}`);
  envContent = replaceAll(envContent, "DATABASE_PORT=5432", `DATABASE_PORT=${answers.dbPort}`);
  envContent = replaceAll(envContent, "DATABASE_PASSWORD=changeme", `DATABASE_PASSWORD=${randomBytes(16).toString("hex")}`);

  // Secrets
  envContent = replaceAll(envContent, "JWT_SECRET=", `JWT_SECRET=${secret()}`);
  envContent = replaceAll(envContent, "ADMIN_JWT_SECRET=", `ADMIN_JWT_SECRET=${secret()}`);
  envContent = replaceAll(envContent, "API_TOKEN_SALT=", `API_TOKEN_SALT=${secret()}`);
  envContent = replaceAll(envContent, "TRANSFER_TOKEN_SALT=", `TRANSFER_TOKEN_SALT=${secret()}`);
  envContent = replaceAll(envContent, "APP_KEYS=", `APP_KEYS=${secret()},${secret()}`);

  // Domains
  envContent = replaceAll(envContent, "LOCAL_DOMAIN=app.localhost", `LOCAL_DOMAIN=${answers.localDomain}`);
  envContent = replaceAll(envContent, "LOCAL_API_DOMAIN=api.localhost", `LOCAL_API_DOMAIN=${answers.localApiDomain}`);

  // Ports
  envContent = replaceAll(envContent, "WEB_PORT=3000", `WEB_PORT=${ports.web}`);
  envContent = replaceAll(envContent, "API_PORT=1337", `API_PORT=${ports.api}`);

  envContent = replaceAll(
    envContent,
    "NEXT_PUBLIC_STRAPI_URL=http://localhost:1337",
    `NEXT_PUBLIC_STRAPI_URL=https://${answers.localApiDomain}`
  );

  // Provider env vars
  if (answers.uploadEnv) {
    for (const [key, value] of Object.entries(answers.uploadEnv)) {
      envContent = replaceAll(envContent, `${key}=`, `${key}=${value}`);
    }
  }
  if (answers.emailEnv) {
    for (const [key, value] of Object.entries(answers.emailEnv)) {
      envContent = replaceAll(envContent, `${key}=`, `${key}=${value}`);
    }
  }

  await writeFile(envPath, envContent);
  envSpinner.succeed(".env generated with secrets");

  // ─── 4. Configure Strapi plugins.ts ────────────
  const pluginsSpinner = ora("Configuring Strapi providers & plugins...").start();

  const selectedUpload = uploadProviders.find((p) => p.value === answers.uploadProvider);
  const selectedEmail = emailProviders.find((p) => p.value === answers.emailProvider);

  let pluginsTs = "export default ({ env }) => ({\n";

  // Upload provider config
  if (selectedUpload.value !== "local") {
    pluginsTs += generateUploadConfig(selectedUpload);
  }

  // Email provider config
  if (selectedEmail.value !== "sendmail") {
    pluginsTs += generateEmailConfig(selectedEmail);
  }

  // Extra plugins
  for (const pluginValue of answers.plugins) {
    const plugin = strapiPlugins.find((p) => p.value === pluginValue);
    pluginsTs += `  ${plugin.value}: {\n    enabled: true,\n  },\n`;
  }

  pluginsTs += "});\n";

  await writeFile(join(projectDir, "apps/api/config/plugins.ts"), pluginsTs);
  pluginsSpinner.succeed("Strapi providers & plugins configured");

  // ─── 5. Install deps ───────────────────────────
  if (!options.skipInstall) {
    const installSpinner = ora("Installing dependencies...").start();

    // Collect extra packages to add to Strapi
    const extraPkgs = [];
    if (selectedUpload.pkg) extraPkgs.push(selectedUpload.pkg);
    if (selectedEmail.pkg) extraPkgs.push(selectedEmail.pkg);
    for (const pluginValue of answers.plugins) {
      const plugin = strapiPlugins.find((p) => p.value === pluginValue);
      extraPkgs.push(plugin.pkg);
    }

    // Ensure corepack activates the correct package manager version
    try {
      await run("corepack enable", projectDir);
      const pkg = JSON.parse(await readFile(rootPkg, "utf-8"));
      if (pkg.packageManager) {
        await run(`corepack prepare ${pkg.packageManager} --activate`, projectDir);
      }
    } catch {
      // corepack may not be available; fall through to yarn install
    }

    // Install root workspace
    try {
      await run("yarn install", projectDir);
      installSpinner.text = "Dependencies installed, adding extra packages...";

      // Add extra packages to api workspace
      if (extraPkgs.length) {
        await run(
          `yarn add ${extraPkgs.join(" ")}`,
          join(projectDir, "apps/api")
        );
      }

      installSpinner.succeed("Dependencies installed");
    } catch (err) {
      installSpinner.fail("Installation failed");
      console.error(chalk.dim(err.stderr || err.message));
    }
  } else {
    console.log(chalk.dim("  Skipping dependency installation (--skip-install)"));
  }

  // ─── 6. Shared Traefik & routing ───────────────
  const traefikSpinner = ora("Setting up shared Traefik...").start();
  try {
    await ensureSharedTraefik();
    traefikSpinner.succeed("Shared Traefik running");
  } catch (err) {
    traefikSpinner.warn(`Shared Traefik setup failed: ${err.message}`);
  }

  const routingSpinner = ora("Registering project routing...").start();
  try {
    const domains = { web: answers.localDomain, api: answers.localApiDomain };
    await addProjectRouting(answers.name, domains, ports);
    await registerProject(answers.name, projectDir, ports, domains);
    routingSpinner.succeed("Project routing registered");
  } catch (err) {
    routingSpinner.warn(`Routing registration failed: ${err.message}`);
  }

  // ─── Done ──────────────────────────────────────
  console.log();
  console.log(chalk.bold.green("  Done!"));
  console.log();
  if (!useCurrentDir) {
    console.log(`  ${chalk.dim("cd")} ${answers.name}`);
  }
  console.log(`  ${chalk.dim("docker compose up -d")}        ${chalk.dim("# start PostgreSQL")}`);
  console.log(`  ${chalk.dim("yarn dev")}                    ${chalk.dim("# start dev servers")}`);
  console.log();
  console.log(`  Frontend:  ${chalk.cyan(`https://${answers.localDomain}`)}`);
  console.log(`  Strapi:    ${chalk.cyan(`https://${answers.localApiDomain}/admin`)}`);
  console.log();
}

// ─── Config Generators ────────────────────────────

function generateUploadConfig(provider) {
  switch (provider.value) {
    case "aws-s3":
      return `  upload: {
    config: {
      provider: "aws-s3",
      providerOptions: {
        s3Options: {
          credentials: {
            accessKeyId: env("AWS_ACCESS_KEY_ID"),
            secretAccessKey: env("AWS_ACCESS_SECRET"),
          },
          region: env("AWS_REGION"),
          params: { Bucket: env("AWS_BUCKET") },
        },
      },
      actionOptions: { upload: {}, delete: {} },
    },
  },\n`;
    case "imagekit":
      return `  upload: {
    config: {
      provider: "strapi-provider-upload-imagekit",
      providerOptions: {
        publicKey: env("IMAGEKIT_PUBLIC_KEY"),
        privateKey: env("IMAGEKIT_PRIVATE_KEY"),
        urlEndpoint: env("IMAGEKIT_URL_ENDPOINT"),
        folder: env("IMAGEKIT_FOLDER", "/strapi"),
      },
      actionOptions: { upload: {}, delete: {} },
    },
  },\n`;
    default:
      return "";
  }
}

function generateEmailConfig(provider) {
  switch (provider.value) {
    case "brevo":
      return `  email: {
    config: {
      provider: "@opkod-france/strapi-provider-email-brevo",
      providerOptions: {
        apiKey: env("BREVO_API_KEY"),
      },
      settings: {
        defaultFrom: env("EMAIL_DEFAULT_FROM", "noreply@example.com"),
        defaultReplyTo: env("EMAIL_DEFAULT_FROM", "noreply@example.com"),
      },
    },
  },\n`;
    case "nodemailer":
      return `  email: {
    config: {
      provider: "nodemailer",
      providerOptions: {
        host: env("SMTP_HOST"),
        port: env.int("SMTP_PORT", 587),
        auth: {
          user: env("SMTP_USER"),
          pass: env("SMTP_PASS"),
        },
      },
      settings: {
        defaultFrom: env("EMAIL_DEFAULT_FROM", "noreply@example.com"),
        defaultReplyTo: env("EMAIL_DEFAULT_FROM", "noreply@example.com"),
      },
    },
  },\n`;
    case "sendgrid":
      return `  email: {
    config: {
      provider: "sendgrid",
      providerOptions: {
        apiKey: env("SENDGRID_API_KEY"),
      },
      settings: {
        defaultFrom: env("EMAIL_DEFAULT_FROM", "noreply@example.com"),
        defaultReplyTo: env("EMAIL_DEFAULT_FROM", "noreply@example.com"),
      },
    },
  },\n`;
    case "mailgun":
      return `  email: {
    config: {
      provider: "mailgun",
      providerOptions: {
        apiKey: env("MAILGUN_API_KEY"),
        domain: env("MAILGUN_DOMAIN"),
      },
      settings: {
        defaultFrom: env("EMAIL_DEFAULT_FROM", "noreply@example.com"),
        defaultReplyTo: env("EMAIL_DEFAULT_FROM", "noreply@example.com"),
      },
    },
  },\n`;
    default:
      return "";
  }
}
