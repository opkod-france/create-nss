<p align="center">
  <img src="logo.png" alt="create-nss" width="280" />
</p>

<h1 align="center">create-nss</h1>

<p align="center">
  Scaffold a production-ready <strong>Next.js 15 + Strapi v5 + PostgreSQL</strong> project in seconds.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/create-nss"><img src="https://img.shields.io/npm/v/create-nss?color=4F46E5&label=npm" alt="npm version" /></a>
  <a href="https://github.com/opkod-france/create-nss/actions"><img src="https://img.shields.io/github/actions/workflow/status/opkod-france/create-nss/release.yml?label=CI" alt="CI" /></a>
  <a href="https://github.com/opkod-france/create-nss/blob/main/LICENSE"><img src="https://img.shields.io/github/license/opkod-france/create-nss" alt="License" /></a>
</p>

---

## Usage

```bash
npx create-nss my-project
```

The interactive wizard guides you through:

```
  create-nss
  Next.js 15 · Strapi v5 · PostgreSQL · Turborepo

  1. Project
  ────────────────────────────────────────
? Project name (kebab-case) › my-project
? Description › A full-stack web application

  2. Domains
  ────────────────────────────────────────
? Frontend domain (local dev) › my-project.dev
? API domain (local dev) › api.my-project.dev

  4. Upload Provider
  ────────────────────────────────────────
? Where should Strapi store uploaded files?
❯ ImageKit
  AWS S3
  Local (filesystem)

  5. Email Provider
  ────────────────────────────────────────
? Which email provider should Strapi use?
❯ Brevo — Opkod France
  Nodemailer (SMTP)
  SendGrid
  Mailgun
  Sendmail (default)

  6. Strapi Plugins
  ────────────────────────────────────────
? Select additional Strapi plugins
◻ GraphQL
◻ Internationalization (i18n)
◻ SEO
```

Then start building:

```bash
cd my-project
docker compose up -d     # PostgreSQL + Traefik (local SSL)
yarn dev                 # Next.js + Strapi in parallel
```

## What You Get

```
my-project/
├── apps/
│   ├── web/              # Next.js 15 (App Router, TypeScript, Tailwind)
│   └── api/              # Strapi v5 (TypeScript, PostgreSQL)
├── docker/
│   ├── Dockerfile.api    # Production Strapi image
│   ├── Dockerfile.web    # Production Next.js image
│   └── certs/            # Local SSL certificates (mkcert)
├── scripts/
│   ├── setup.sh          # Secrets generation + deps install
│   └── generate-certs.sh # Local SSL via mkcert or openssl
├── docker-compose.yml        # Dev: PostgreSQL + Traefik
├── docker-compose.prod.yml   # Prod: full stack + Let's Encrypt
├── turbo.json
└── .env                      # Auto-generated with secrets
```

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS v4 |
| CMS / API | Strapi v5, TypeScript |
| Database | PostgreSQL 16 |
| Monorepo | Yarn Workspaces + Turborepo |
| Reverse Proxy | Traefik v3 (local SSL + Let's Encrypt prod) |
| Deploy | Dokploy-ready Docker Compose |

## Available Providers

### Upload

| Provider | Package |
|----------|---------|
| **ImageKit** | `strapi-provider-upload-imagekit` |
| AWS S3 | `@strapi/provider-upload-aws-s3` |
| Local | Built-in |

### Email

| Provider | Package |
|----------|---------|
| **Brevo (Opkod)** | `@opkod-france/strapi-provider-email-brevo` |
| Nodemailer | `@strapi/provider-email-nodemailer` |
| SendGrid | `@strapi/provider-email-sendgrid` |
| Mailgun | `@strapi/provider-email-mailgun` |
| Sendmail | Built-in |

### Strapi Plugins

| Plugin | Package |
|--------|---------|
| GraphQL | `@strapi/plugin-graphql` |
| i18n | `@strapi/plugin-i18n` |
| SEO | `@strapi/plugin-seo` |

## CLI Options

```
Usage: create-nss [options] [project-name]

Arguments:
  project-name    Project name (kebab-case)

Options:
  --skip-install  Skip dependency installation
  --skip-certs    Skip SSL certificate generation
  -h, --help      Display help
```

## Local Development Domains

By default, projects get local `.dev` domains with Traefik + SSL:

| Service | URL |
|---------|-----|
| Frontend | `https://{project-name}.dev` |
| Strapi Admin | `https://api.{project-name}.dev/admin` |
| Strapi API | `https://api.{project-name}.dev/api` |
| Traefik Dashboard | `http://localhost:8080` |

Requires [mkcert](https://github.com/FiloSottile/mkcert) for trusted certificates (`brew install mkcert`).

## Contributing

Commits follow [Conventional Commits](https://www.conventionalcommits.org/). Releases are automated via [semantic-release](https://github.com/semantic-release/semantic-release).

```
feat: add Resend email provider    → minor release (1.x.0)
fix: correct S3 config template    → patch release (1.0.x)
feat!: change prompt flow          → major release (x.0.0)
```

## License

MIT — [Opkod France](https://opkod.com)
