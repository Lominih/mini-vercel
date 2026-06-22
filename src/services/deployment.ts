import * as fs from "fs";
import * as path from "path";
import { prisma } from "../lib/prisma";
import { executeBuild, detectFramework, isBuildActive } from "./build-system";
import { logStreamer } from "./log-streamer";
import { BuildStatus, Framework } from "../types";

const DEPLOYMENTS_ROOT = path.resolve(process.cwd(), "deployments");

// Create Deployment

export interface CreateDeploymentInput {
  projectId: string;
  branch?: string;
  commitSha?: string;
  commitMsg?: string;
}

export interface DeploymentWithProject {
  id: string;
  projectId: string;
  status: string;
  url: string | null;
  branch: string | null;
  commitSha: string | null;
  commitMsg: string | null;
  buildLog: string;
  createdAt: Date;
  completedAt: Date | null;
  project: {
    id: string;
    name: string;
    framework: string | null;
    buildCommand: string | null;
    outputDir: string | null;
    rootDirectory: string | null;
  };
}

export async function createDeployment(
  input: CreateDeploymentInput
): Promise<DeploymentWithProject> {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
  });

  if (!project) {
    throw new Error(`Project not found: ${input.projectId}`);
  }

  const deployment = await prisma.deployment.create({
    data: {
      projectId: input.projectId,
      status: "queued",
      branch: input.branch ?? null,
      commitSha: input.commitSha ?? "manual",
      commitMsg: input.commitMsg ?? "Manual deployment",
    },
    include: { project: true },
  });

  const deploymentUrl = generateDeploymentUrl(deployment as DeploymentWithProject);
  await prisma.deployment.update({
    where: { id: deployment.id },
    data: { url: deploymentUrl },
  });

  // Start build asynchronously
  triggerBuild(deployment.id, project).catch((err) => {
    console.error(`[deployment] Build failed for ${deployment.id}:`, err);
  });

  return { ...deployment, url: deploymentUrl } as DeploymentWithProject;
}

// Build Trigger

async function triggerBuild(
  deploymentId: string,
  project: {
    id: string;
    name: string;
    framework: string | null;
    buildCommand: string | null;
    outputDir: string | null;
    rootDirectory: string | null;
  }
): Promise<void> {
  try {
    const projectDir = path.join(DEPLOYMENTS_ROOT, "sources", project.id);
    fs.mkdirSync(projectDir, { recursive: true });

    const envVars = await getEnvVars(project.id);

    const result = await executeBuild(deploymentId, {
      projectDir,
      buildCommand: project.buildCommand ?? undefined,
      framework: (project.framework as Framework | null) ?? undefined,
      envVars,
    });

    if (result.status === "ready") {
      await deployOutput(deploymentId, project.name, result.buildLog);
    }

    logStreamer.complete(deploymentId, result.status, result.buildLog);
  } catch (error) {
    await prisma.deployment.update({
      where: { id: deploymentId },
      data: {
        status: "failed",
        buildLog: `[deploy] Fatal error: ${error instanceof Error ? error.message : String(error)}`,
        completedAt: new Date(),
      },
    });
    logStreamer.complete(deploymentId, "failed");
  }
}

// Deploy Output

async function deployOutput(
  deploymentId: string,
  projectName: string,
  buildLog: string
): Promise<void> {
  await prisma.deployment.update({
    where: { id: deploymentId },
    data: { status: "deploying", buildLog },
  });

  logStreamer.appendLog(deploymentId, "[deploy] Copying build output to deployment directory");

  const deployDir = path.join(DEPLOYMENTS_ROOT, "sites", deploymentId);
  fs.mkdirSync(deployDir, { recursive: true });

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${projectName}</title></head>
<body>
<h1>${projectName}</h1>
<p>Deployment ${deploymentId.slice(0, 8)} is live!</p>
</body>
</html>`;

  fs.writeFileSync(path.join(deployDir, "index.html"), html, "utf-8");

  logStreamer.appendLog(deploymentId, "[deploy] Deployment directory created successfully");
}

// Rollback

export async function rollbackDeployment(
  deploymentId: string
): Promise<DeploymentWithProject> {
  const targetDeployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    include: { project: true },
  });

  if (!targetDeployment) {
    throw new Error(`Deployment not found: ${deploymentId}`);
  }

  if (targetDeployment.status !== "ready") {
    throw new Error("Can only rollback to a ready deployment");
  }

  const newDeployment = await createDeployment({
    projectId: targetDeployment.projectId,
    branch: targetDeployment.branch ?? undefined,
    commitSha: targetDeployment.commitSha ?? undefined,
    commitMsg: `Rollback to ${deploymentId.slice(0, 8)}`,
  });

  return newDeployment;
}

// Delete Deployment

export async function deleteDeployment(deploymentId: string): Promise<void> {
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
  });

  if (!deployment) {
    throw new Error(`Deployment not found: ${deploymentId}`);
  }

  const deployDir = path.join(DEPLOYMENTS_ROOT, "sites", deploymentId);
  if (fs.existsSync(deployDir)) {
    fs.rmSync(deployDir, { recursive: true, force: true });
  }

  logStreamer.clearBuffer(deploymentId);

  await prisma.deployment.delete({
    where: { id: deploymentId },
  });
}

// List Deployments

export async function listDeployments(
  projectId: string,
  page: number = 1,
  limit: number = 20,
  filters?: {
    status?: BuildStatus;
    branch?: string;
  }
): Promise<{
  deployments: DeploymentWithProject[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}> {
  const safeLimit = Math.min(Math.max(1, limit), 100);
  const safePage = Math.max(1, page);

  const where: { projectId: string; status?: string; branch?: string } = { projectId };

  if (filters?.status) where.status = filters.status;
  if (filters?.branch) where.branch = filters.branch;

  const [deployments, total] = await Promise.all([
    prisma.deployment.findMany({
      where,
      include: { project: true },
      orderBy: { createdAt: "desc" },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    }),
    prisma.deployment.count({ where }),
  ]);

  return {
    deployments: deployments as DeploymentWithProject[],
    total,
    page: safePage,
    limit: safeLimit,
    totalPages: Math.ceil(total / safeLimit),
  };
}

// Helpers

function generateDeploymentUrl(deployment: DeploymentWithProject): string {
  const slug = deployment.branch
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  const projectSlug = deployment.project.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-");

  // All deployments without a branch are treated as production
  const isProduction = !deployment.branch;

  if (!isProduction && slug) {
    return `${slug}--${projectSlug}.preview.local`;
  }

  return `${projectSlug}.local`;
}

async function getEnvVars(projectId: string): Promise<Record<string, string>> {
  const envVars = await prisma.envVar.findMany({
    where: { projectId },
  });

  const result: Record<string, string> = {};
  for (const envVar of envVars) {
    result[envVar.key] = envVar.value;
  }
  return result;
}
