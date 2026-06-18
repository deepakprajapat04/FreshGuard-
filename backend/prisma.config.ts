// freshguard-backend/prisma.config.ts
// Prisma does NOT auto-load .env when a prisma.config.ts exists,
// so we load it explicitly with dotenv (https://pris.ly/prisma-config-env-vars).
import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
