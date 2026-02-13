import { input, select, checkbox, confirm } from "@inquirer/prompts";
import chalk from "chalk";
import validate from "validate-npm-package-name";
import { uploadProviders, emailProviders, strapiPlugins } from "./catalog.mjs";

function section(title) {
  console.log();
  console.log(chalk.bold(`  ${title}`));
  console.log(chalk.dim("  " + "─".repeat(40)));
}

export async function collectAnswers(initialName) {
  const answers = {};

  // ─── 1. Project ──────────────────────────────
  section("1. Project");

  answers.name = initialName || await input({
    message: "Project name (kebab-case)",
    validate: (v) => {
      const { validForNewPackages, errors } = validate(v);
      return validForNewPackages || errors?.[0] || "Invalid package name";
    },
  });

  answers.description = await input({
    message: "Description",
    default: "A full-stack web application",
  });

  // ─── 2. Domains ──────────────────────────────
  section("2. Domains");

  answers.localDomain = await input({
    message: "Frontend domain (local dev)",
    default: `${answers.name}.dev`,
  });

  answers.localApiDomain = await input({
    message: "API domain (local dev)",
    default: `api.${answers.name}.dev`,
  });

  answers.webDomain = await input({
    message: "Frontend domain (production)",
    default: `${answers.name}.com`,
  });

  answers.apiDomain = await input({
    message: "API domain (production)",
    default: `api.${answers.name}.com`,
  });

  // ─── 3. Database ─────────────────────────────
  section("3. Database");

  answers.dbName = await input({
    message: "Database name",
    default: answers.name.replace(/-/g, "_") + "_db",
  });

  answers.dbUser = await input({
    message: "Database user",
    default: "strapi",
  });

  answers.dbPort = await input({
    message: "Database port",
    default: "5432",
  });

  // ─── 4. Upload Provider ──────────────────────
  section("4. Upload Provider");

  answers.uploadProvider = await select({
    message: "Where should Strapi store uploaded files?",
    choices: uploadProviders.map((p) => ({ name: p.name, value: p.value })),
  });

  const selectedUpload = uploadProviders.find(
    (p) => p.value === answers.uploadProvider
  );
  if (selectedUpload?.envKeys.length) {
    answers.uploadEnv = {};
    const configNow = await confirm({
      message: `Configure ${selectedUpload.name} credentials now?`,
      default: false,
    });
    if (configNow) {
      for (const env of selectedUpload.envKeys) {
        answers.uploadEnv[env.key] = await input({
          message: env.prompt,
          default: env.default || "",
        });
      }
    }
  }

  // ─── 5. Email Provider ───────────────────────
  section("5. Email Provider");

  answers.emailProvider = await select({
    message: "Which email provider should Strapi use?",
    choices: emailProviders.map((p) => ({ name: p.name, value: p.value })),
  });

  const selectedEmail = emailProviders.find(
    (p) => p.value === answers.emailProvider
  );
  if (selectedEmail?.envKeys.length) {
    answers.emailEnv = {};
    const configNow = await confirm({
      message: `Configure ${selectedEmail.name} credentials now?`,
      default: false,
    });
    if (configNow) {
      for (const env of selectedEmail.envKeys) {
        answers.emailEnv[env.key] = await input({
          message: env.prompt,
          default: env.default || "",
        });
      }
    }
  }

  // ─── 6. Strapi Plugins ───────────────────────
  section("6. Strapi Plugins");

  answers.plugins = await checkbox({
    message: "Select additional Strapi plugins",
    choices: strapiPlugins.map((p) => ({ name: p.name, value: p.value })),
  });

  // ─── Summary ─────────────────────────────────
  console.log();
  console.log(chalk.bold("  Summary"));
  console.log(chalk.dim("  " + "─".repeat(40)));
  console.log(`  Project:     ${chalk.green(answers.name)}`);
  console.log(`  Local:       https://${answers.localDomain} / https://${answers.localApiDomain}`);
  console.log(`  Production:  https://${answers.webDomain} / https://${answers.apiDomain}`);
  console.log(`  Database:    ${answers.dbName} @ localhost:${answers.dbPort}`);
  console.log(`  Upload:      ${selectedUpload.name}`);
  console.log(`  Email:       ${selectedEmail.name}`);
  if (answers.plugins.length) {
    const pluginNames = answers.plugins
      .map((v) => strapiPlugins.find((p) => p.value === v).name)
      .join(", ");
    console.log(`  Plugins:     ${pluginNames}`);
  }
  console.log();

  const proceed = await confirm({ message: "Proceed?", default: true });
  if (!proceed) throw new Error("ExitPromptError");

  return answers;
}
