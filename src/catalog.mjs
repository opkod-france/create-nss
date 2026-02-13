// ─── Upload Providers ───────────────────────────
export const uploadProviders = [
  {
    name: "ImageKit",
    value: "imagekit",
    pkg: "strapi-provider-upload-imagekit",
    envKeys: [
      { key: "IMAGEKIT_PUBLIC_KEY", prompt: "ImageKit public key" },
      { key: "IMAGEKIT_PRIVATE_KEY", prompt: "ImageKit private key" },
      { key: "IMAGEKIT_URL_ENDPOINT", prompt: "ImageKit URL endpoint" },
    ],
  },
  {
    name: "AWS S3",
    value: "aws-s3",
    pkg: "@strapi/provider-upload-aws-s3",
    envKeys: [
      { key: "AWS_ACCESS_KEY_ID", prompt: "AWS access key ID" },
      { key: "AWS_ACCESS_SECRET", prompt: "AWS secret access key" },
      { key: "AWS_REGION", prompt: "AWS region", default: "eu-west-3" },
      { key: "AWS_BUCKET", prompt: "S3 bucket name" },
    ],
  },
  {
    name: "Local (filesystem)",
    value: "local",
    pkg: null,
    envKeys: [],
  },
];

// ─── Email Providers ────────────────────────────
export const emailProviders = [
  {
    name: "Sendmail (default)",
    value: "sendmail",
    pkg: null,
    envKeys: [],
  },
  {
    name: "Brevo — Opkod France",
    value: "brevo",
    pkg: "@opkod-france/strapi-provider-email-brevo",
    envKeys: [
      { key: "BREVO_API_KEY", prompt: "Brevo API key" },
      { key: "EMAIL_DEFAULT_FROM", prompt: "Default sender email", default: "noreply@example.com" },
    ],
  },
  {
    name: "Nodemailer (SMTP)",
    value: "nodemailer",
    pkg: "@strapi/provider-email-nodemailer",
    envKeys: [
      { key: "SMTP_HOST", prompt: "SMTP host" },
      { key: "SMTP_PORT", prompt: "SMTP port", default: "587" },
      { key: "SMTP_USER", prompt: "SMTP username" },
      { key: "SMTP_PASS", prompt: "SMTP password" },
    ],
  },
  {
    name: "SendGrid",
    value: "sendgrid",
    pkg: "@strapi/provider-email-sendgrid",
    envKeys: [
      { key: "SENDGRID_API_KEY", prompt: "SendGrid API key" },
    ],
  },
  {
    name: "Mailgun",
    value: "mailgun",
    pkg: "@strapi/provider-email-mailgun",
    envKeys: [
      { key: "MAILGUN_API_KEY", prompt: "Mailgun API key" },
      { key: "MAILGUN_DOMAIN", prompt: "Mailgun domain" },
    ],
  },
];

// ─── Strapi Plugins ─────────────────────────────
export const strapiPlugins = [
  {
    name: "GraphQL",
    value: "graphql",
    pkg: "@strapi/plugin-graphql",
  },
  {
    name: "Internationalization (i18n)",
    value: "i18n",
    pkg: "@strapi/plugin-i18n",
  },
  {
    name: "SEO",
    value: "seo",
    pkg: "@strapi/plugin-seo",
  },
];
