import { spawn, ChildProcess } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { prisma } from "../lib/prisma";
import {
  Framework,
  FrameworkConfig,
  FRAMEWORKS,
  BuildStatus,
  BuildResult,
} from "../types";
import { logStreamer } from "./log-streamer";
import { buildCache } from "./build-cache";

const BUILD_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const BUILD_DIR = path.resolve(process.cwd(), "builds");

// Active build processes

const activeBuilds = new Map<string, ChildProcess>();

// Framework Detection

export async function detectFramework(projectDir: string): Promise<FrameworkConfig> {
  const pkgJsonPath = path.join(projectDir, "package.json");
  let pkgJson: Record<string, any> = {};

  if (fs.existsSync(pkgJsonPath)) {
    try {
      pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf-8"));
    } catch {
      // Malformed package.json - fall through
    }
  }

  // Check dependency-based hints first
  const allDeps = {
    ...pkgJson.dependencies,
    ...pkgJson.devDependencies,
  };

  if (allDeps["next"]) return getFrameworkConfig("nextjs");
  if (allDeps["nuxt"]) return getFrameworkConfig("nuxt");
  if (allDeps["remix"] || allDeps["@remix-run/react"]) return getFrameworkConfig("remix");
  if (allDeps["gatsby"]) return getFrameworkConfig("gatsby");
  if (allDeps["astro"]) return getFrameworkConfig("astro");
  if (allDeps["@sveltejs/kit"]) return getFrameworkConfig("sveltekit");
  if (allDeps["react-scripts"]) return getFrameworkConfig("create-react-app");
  if (allDeps["@vue/cli-service"]) return getFrameworkConfig("vue-cli");
  if (allDeps["vite"]) return getFrameworkConfig("vite");

  // Fallback: check for config files on disk
  for (const fw of FRAMEWORKS) {
    for (const configFile of fw.configFile) {
      if (fs.existsSync(path.join(projectDir, configFile))) {
        return fw;
      }
    }
  }

  // Default: Node.js with npm build
  return {
    name: "node",
    displayName: "Node.js",
    configFile: ["package.json"],
    buildCommand: "npm run build",
    outputDir: "dist",
  };
}

function getFrameworkConfig(name: Framework): FrameworkConfig {
  return FRAMEWORKS.find((f) => f.name === name) ?? FRAMEWORKS[FRAMEWORKS.length - 1];
}

// Build Execution

export interface BuildOptions {
  projectDir: string;
  buildCommand?: string;
  framework?: Framework;
  envVars?: Record<string, string>;
}

export async function executeBuild(
  deploymentId: string,
  options: BuildOptions
): Promise<BuildResult> {
  const startTime = Date.now();
  const fullLogs: string[] = [];

  if (!options.projectDir) {
    return {
      deploymentId,
      status: "failed",
      buildLog: "[build] Error: projectDir is required",
      duration: 0,
      error: "projectDir is required",
    };
  }

  const buildDir = path.join(BUILD_DIR, deploymentId);
  fs.mkdirSync(buildDir, { recursive: true });

  try {
    // Detect or use provided framework
    const frameworkConfig = options.framework
      ? getFrameworkConfig(options.framework)
      : await detectFramework(options.projectDir);

    if (!frameworkConfig) {
      return {
        deploymentId,
        status: "failed",
        buildLog: "[build] Error: could not determine framework configuration",
        duration: 0,
        error: "Could not determine framework configuration",
      };
    }

    // Resolve build command
    const buildCommand = options.buildCommand || frameworkConfig.buildCommand;

    if (!buildCommand) {
      return {
        deploymentId,
        status: "failed",
        buildLog: "[build] Error: no build command available",
        duration: 0,
        error: "No build command available",
      };
    }

    const fwDisplayName = frameworkConfig.displayName ?? frameworkConfig.name ?? "unknown";

    logStreamer.appendLog(deploymentId, `[build] Detected framework: ${fwDisplayName}`);
    logStreamer.appendLog(deploymentId, `[build] Running: ${buildCommand}`);

    // Update deployment status to building
    await updateDeploymentStatus(deploymentId, "building", `[build] Starting build with ${fwDisplayName}\n`);

    // Check build cache
    const cachedResult = await buildCache.checkCache(
      options.projectDir,
      frameworkConfig.name
    );

    if (cachedResult) {
      logStreamer.appendLog(deploymentId, `[cache] Cache hit - restoring from ${cachedResult.commitSha.slice(0, 8)}`);
      fullLogs.push(`[cache] Cache hit - restoring from ${cachedResult.commitSha.slice(0, 8)}`);

      // Copy cached output to build directory
      fs.cpSync(cachedResult.outputDir, buildDir, { recursive: true });

      const duration = Date.now() - startTime;
      await updateDeploymentStatus(deploymentId, "ready", fullLogs.join("\n"), duration);

      return {
        deploymentId,
        status: "ready",
        buildLog: fullLogs.join("\n"),
        duration,
      };
    }

    const exitCode = await runCommand(buildCommand, options.projectDir, deploymentId, fullLogs, options.envVars);
    const duration = Date.now() - startTime;

    const outputDir = determineOutputDir(options.projectDir, frameworkConfig);
    const outputExists = fs.existsSync(outputDir);

    if (exitCode === 0 && outputExists) {
      // Cache the build output
      await buildCache.storeCache(options.projectDir, frameworkConfig.name, outputDir);

      await updateDeploymentStatus(deploymentId, "ready", fullLogs.join("\n"), duration);

      return {
        deploymentId,
        status: "ready",
        buildLog: fullLogs.join("\n"),
        duration,
      };
    } else {
      const reason = exitCode !== 0
        ? `Build process exited with code ${exitCode}`
        : `Build output directory not found: ${outputDir}`;
      fullLogs.push(`[build] ${reason}`);

      await updateDeploymentStatus(deploymentId, "failed", fullLogs.join("\n"), duration);

      return {
        deploymentId,
        status: "failed",
        buildLog: fullLogs.join("\n"),
        duration,
        error: reason,
      };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    fullLogs.push(`[build] Fatal error: ${errorMsg}`);

    await updateDeploymentStatus(deploymentId, "failed", fullLogs.join("\n"), duration);

    return {
      deploymentId,
      status: "failed",
      buildLog: fullLogs.join("\n"),
      duration,
      error: errorMsg,
    };
  }
}

// Command Runner

function runCommand(
  command: string,
  cwd: string,
  deploymentId: string,
  logs: string[],
  envVars?: Record<string, string>
): Promise<number> {
  return new Promise((resolve) => {
    const shell = process.platform === "win32" ? "cmd" : "sh";
    const shellArgs = process.platform === "win32" ? ["/c", command] : ["-c", command];

    const child = spawn(shell, shellArgs, {
      cwd,
      env: {
        ...process.env,
        ...envVars,
        NODE_ENV: "production",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    activeBuilds.set(deploymentId, child);

    // Set timeout
    const timeout = setTimeout(() => {
      child.kill("SIGTERM");
      const timeoutMsg = `[build] Build timed out after ${BUILD_TIMEOUT_MS / 1000}s`;
      logStreamer.appendLog(deploymentId, timeoutMsg);
      logs.push(timeoutMsg);
      resolve(1); // Non-zero exit = failure
    }, BUILD_TIMEOUT_MS);

    // Stream stdout
    child.stdout?.on("data", (data: Buffer) => {
      const lines = data.toString("utf-8").split("\n").filter(Boolean);
      for (const line of lines) {
        const msg = `[stdout] ${line}`;
        logStreamer.appendLog(deploymentId, msg);
        logs.push(msg);
      }
    });

    // Stream stderr
    child.stderr?.on("data", (data: Buffer) => {
      const lines = data.toString("utf-8").split("\n").filter(Boolean);
      for (const line of lines) {
        const msg = `[stderr] ${line}`;
        logStreamer.appendLog(deploymentId, msg);
        logs.push(msg);
      }
    });

    // Handle process close
    child.on("close", (code) => {
      clearTimeout(timeout);
      activeBuilds.delete(deploymentId);
      resolve(code ?? 1);
    });

    // Handle process error
    child.on("error", (err) => {
      clearTimeout(timeout);
      activeBuilds.delete(deploymentId);
      const errMsg = `[build] Process error: ${err.message}`;
      logStreamer.appendLog(deploymentId, errMsg);
      logs.push(errMsg);
      resolve(1);
    });
  });
}

function determineOutputDir(projectDir: string, framework: FrameworkConfig): string {
  const possibleOutputs = [framework.outputDir, "dist", "build", "out", ".next", ".output"];

  for (const dir of possibleOutputs) {
    if (!dir) continue;
    const fullPath = path.join(projectDir, dir);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return path.join(projectDir, framework.outputDir ?? "dist");
}

async function updateDeploymentStatus(
  deploymentId: string,
  status: BuildStatus,
  buildLog: string,
  duration?: number
): Promise<void> {
  const updateData: { status: BuildStatus; buildLog: string; completedAt?: Date } = { status, buildLog };

  if (status === "ready" || status === "failed" || status === "cancelled") {
    updateData.completedAt = new Date();
  }

  await prisma.deployment.update({
    where: { id: deploymentId },
    data: updateData,
  });
}

async function getCommitSha(deploymentId: string): Promise<string> {
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    select: { commitSha: true },
  });
  return deployment?.commitSha ?? "unknown";
}

// Cancel Build

export async function cancelBuild(deploymentId: string): Promise<boolean> {
  const child = activeBuilds.get(deploymentId);
  if (!child || !child.pid) return false;

  try {
    // Send SIGTERM for graceful shutdown
    child.kill("SIGTERM");

    // Force kill after 5 seconds if still alive
    setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // Process may have already exited
      }
    }, 5000);

    await updateDeploymentStatus(deploymentId, "cancelled", "[build] Build cancelled by user");
    logStreamer.appendLog(deploymentId, "[build] Build cancelled by user");
    logStreamer.closeAll(deploymentId);

    activeBuilds.delete(deploymentId);
    return true;
  } catch {
    return false;
  }
}

// Get Active Build Status

export function isBuildActive(deploymentId: string): boolean {
  return activeBuilds.has(deploymentId);
}

export function getActiveBuildIds(): string[] {
  return Array.from(activeBuilds.keys());
}
