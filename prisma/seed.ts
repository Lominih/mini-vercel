import { PrismaClient } from "../src/generated/prisma";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // ─── Users ─────────────────────────────────────────────────
  const passwordHash = await bcrypt.hash("password123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@mini-vercel.dev" },
    update: {},
    create: {
      email: "admin@mini-vercel.dev",
      name: "Admin",
      password: passwordHash,
      avatar: null,
    },
  });

  const dev = await prisma.user.upsert({
    where: { email: "dev@mini-vercel.dev" },
    update: {},
    create: {
      email: "dev@mini-vercel.dev",
      name: "Developer",
      password: passwordHash,
      avatar: null,
    },
  });

  console.log(`  Users: admin (${admin.id}), dev (${dev.id})`);

  // ─── Teams ─────────────────────────────────────────────────
  const team = await prisma.team.create({
    data: {
      name: "Acme Corp",
      members: {
        create: [
          { userId: admin.id, role: "owner" },
          { userId: dev.id, role: "member" },
        ],
      },
    },
  });

  console.log(`  Team: ${team.name} (${team.id})`);

  // ─── Projects ──────────────────────────────────────────────
  const frontend = await prisma.project.create({
    data: {
      name: "acme-frontend",
      framework: "nextjs",
      buildCommand: "npx next build",
      outputDir: ".next",
      installCommand: "npm install",
      rootDirectory: ".",
      userId: admin.id,
      teamId: team.id,
    },
  });

  const dashboard = await prisma.project.create({
    data: {
      name: "acme-dashboard",
      framework: "vite",
      buildCommand: "npm run build",
      outputDir: "dist",
      userId: dev.id,
      teamId: team.id,
    },
  });

  const docs = await prisma.project.create({
    data: {
      name: "acme-docs",
      framework: "astro",
      buildCommand: "npx astro build",
      outputDir: "dist",
      userId: admin.id,
    },
  });

  console.log(`  Projects: ${frontend.name}, ${dashboard.name}, ${docs.name}`);

  // ─── Deployments ───────────────────────────────────────────
  const now = new Date();
  const statuses = ["ready", "ready", "ready", "failed", "building", "queued"];

  for (let i = 0; i < statuses.length; i++) {
    const daysAgo = statuses.length - i;
    const createdAt = new Date(now.getTime() - daysAgo * 86400000);
    const completedAt = statuses[i] !== "building" && statuses[i] !== "queued"
      ? new Date(createdAt.getTime() + 60000 * (2 + Math.random() * 5))
      : null;

    await prisma.deployment.create({
      data: {
        projectId: frontend.id,
        status: statuses[i],
        url: `${frontend.name}.local`,
        branch: i < 4 ? "main" : `feat/feature-${i}`,
        commitSha: Math.random().toString(16).slice(2, 10),
        commitMsg: i < 4 ? "chore: production deploy" : `feat: add feature ${i}`,
        buildLog: `[build] ${statuses[i] === "failed" ? "Build failed" : "Build completed"}`,
        createdAt,
        completedAt,
      },
    });
  }

  console.log(`  Deployments: ${statuses.length} created for ${frontend.name}`);

  // ─── Domains ───────────────────────────────────────────────
  const prodDomain = await prisma.domain.create({
    data: {
      projectId: frontend.id,
      name: "acme.com",
      verified: true,
      sslStatus: "active",
      sslExpiry: new Date(now.getTime() + 90 * 86400000),
    },
  });

  const stagingDomain = await prisma.domain.create({
    data: {
      projectId: dashboard.id,
      name: "staging.acme.com",
      verified: true,
      sslStatus: "active",
      sslExpiry: new Date(now.getTime() + 60 * 86400000),
    },
  });

  const pendingDomain = await prisma.domain.create({
    data: {
      projectId: docs.id,
      name: "docs.acme.com",
      verified: false,
      sslStatus: "none",
    },
  });

  console.log(`  Domains: ${prodDomain.name}, ${stagingDomain.name}, ${pendingDomain.name}`);

  // ─── Environment Variables ─────────────────────────────────
  const envVars = [
    { key: "NEXT_PUBLIC_API_URL", value: "https://api.acme.com" },
    { key: "DATABASE_URL", value: "postgresql://user:pass@db:5432/app" },
    { key: "NODE_ENV", value: "production" },
    { key: "REDIS_URL", value: "redis://localhost:6379" },
  ];

  for (const ev of envVars) {
    await prisma.envVar.create({
      data: {
        projectId: frontend.id,
        key: ev.key,
        value: ev.value,
        encrypted: false,
      },
    });
  }

  console.log(`  Env vars: ${envVars.length} created for ${frontend.name}`);

  // ─── Edge Functions ────────────────────────────────────────
  await prisma.edgeFunction.create({
    data: {
      projectId: frontend.id,
      name: "hello-world",
      path: "/api/hello",
      runtime: "nodejs",
      code: `
        __response.status = 200;
        __response.headers["content-type"] = "application/json";
        __response.body = JSON.stringify({
          message: "Hello from Mini Vercel Edge!",
          timestamp: new Date().toISOString(),
        });
      `,
    },
  });

  await prisma.edgeFunction.create({
    data: {
      projectId: frontend.id,
      name: "auth-guard",
      path: "/api/guard",
      runtime: "nodejs",
      code: `
        const token = __request.headers.authorization;
        if (!token) {
          __response.status = 401;
          __response.body = JSON.stringify({ error: "Unauthorized" });
        } else {
          __response.status = 200;
          __response.body = JSON.stringify({ message: "Access granted" });
        }
      `,
    },
  });

  console.log("  Edge functions: hello-world, auth-guard");

  // ─── Redirect Rules ───────────────────────────────────────
  await prisma.redirectRule.create({
    data: {
      projectId: frontend.id,
      source: "/old-blog/*",
      target: "/blog/$1",
      statusCode: 301,
      regex: true,
      preserveQuery: true,
    },
  });

  console.log("  Redirect rules: 1 created");

  console.log("\nSeed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
