#!/usr/bin/env node

import { program } from "commander";
import chalk from "chalk";
import { collectAnswers } from "./prompts.mjs";
import { scaffold } from "./scaffold.mjs";

program
  .name("create-nss")
  .description("Scaffold a Next.js 15 + Strapi v5 + PostgreSQL project")
  .argument("[project-name]", "Project name (kebab-case)")
  .option("--skip-install", "Skip dependency installation")
  .option("--force", "Overwrite existing project directory")
  .action(async (projectName, options) => {
    console.log();
    console.log(chalk.bold("  create-nss"));
    console.log(chalk.dim("  Next.js 15 · Strapi v5 · PostgreSQL · Turborepo"));
    console.log();

    try {
      const answers = await collectAnswers(projectName);
      await scaffold(answers, options);
    } catch (err) {
      if (err.name === "ExitPromptError") {
        console.log(chalk.dim("\n  Cancelled.\n"));
        process.exit(0);
      }
      console.error(chalk.red(`\n  Error: ${err.message}\n`));
      process.exit(1);
    }
  });

program.parse();
