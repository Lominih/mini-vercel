import { Router, Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/prisma"
import { GitHubRepo, GitLabProject, CommitStatus } from "../types";
import { requireAuth, AuthenticatedRequest } from "../middleware/auth";
import * as github from "../services/github";
import * as gitlab from "../services/gitlab";

const router = Router();

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "mini-vercel-webhook-secret";
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL || "http://localhost:3000";

router.post("/connect", requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { provider, repoId, projectId, repoName } = req.body;

    if (!provider || !repoId || !projectId) {
      res.status(400).json({ error: "provider, repoId, and projectId are required" });
      return;
    }

    if (provider !== "github" && provider !== "gitlab") {
      res.status(400).json({ error: "provider must be 'github' or 'gitlab'" });
      return;
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    const githubRepoId = provider === "github" ? String(repoId) : null;
    const githubRepoName = repoName || null;

    const webhookUrl = `${WEBHOOK_BASE_URL}/api/git/webhook`;

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        githubRepoId,
        githubRepoName: githubRepoName || `${provider}/${repoId}`,
      },
    });

    // Create a deployment for the connection
    await prisma.deployment.create({
      data: {
        projectId,
        status: "queued",
        branch: "main",
        commitSha: uuidv4().slice(0, 7),
        commitMsg: `Connected ${provider} repository`,
      },
    });

    res.json({
      project: updatedProject,
      webhookUrl,
      webhookSecret: WEBHOOK_SECRET,
      message: `Repository connected via ${provider}`,
    });
  } catch (err) {
    console.error("Connect error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/webhook", async (req: Request, res: Response) => {
  try {
    const eventType = req.headers["x-github-event"] || req.headers["x-gitlab-event"] || "unknown";

    // Verify webhook secret
    const signature = req.headers["x-hub-signature-256"] || req.headers["x-gitlab-token"];
    if (!signature || signature !== WEBHOOK_SECRET) {
      res.status(401).json({ error: "Invalid or missing webhook signature" });
      return;
    }

    let payload;
    if (eventType === "push" || req.body?.ref) {
      // GitHub push event
      if (req.body?.head_commit) {
        payload = github.parseWebhookPayload(req.body);
      }
      // GitLab push event
      else if (req.body?.after) {
        payload = gitlab.parseWebhookPayload(req.body);
      }
    }

    if (!payload) {
      res.status(200).json({ message: "Event ignored" });
      return;
    }

    // Find the project by repo ID
    const repoIdStr = String(payload.repository.id);
    const project = await prisma.project.findFirst({
      where: { githubRepoId: repoIdStr },
    });

    if (!project) {
      console.log(`No project found for repo ${payload.repository.full_name}`);
      res.status(200).json({ message: "No matching project" });
      return;
    }

    // Determine branch from ref
    const branch = payload.ref.replace("refs/heads/", "");

    // Create a new deployment
    const deployment = await prisma.deployment.create({
      data: {
        projectId: project.id,
        status: "queued",
        branch,
        commitSha: payload.commitSha,
        commitMsg: payload.commitMessage,
      },
    });

    console.log(
      `Deployment ${deployment.id} created for ${project.name} (${branch}@${payload.commitSha.slice(0, 7)})`
    );

    res.status(201).json({
      deploymentId: deployment.id,
      status: "queued",
      message: "Deployment queued",
    });
  } catch (err) {
    console.error("Webhook error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/repos", requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { provider, accessToken } = req.query;

    if (!provider || !accessToken) {
      res.status(400).json({ error: "provider and accessToken query params are required" });
      return;
    }

    const token = accessToken as string;

    if (provider === "github") {
      const repos = await github.listRepositories(token);
      res.json({ repos, provider: "github" });
    } else if (provider === "gitlab") {
      const projects = await gitlab.listProjects(token);
      res.json({ repos: projects, provider: "gitlab" });
    } else {
      res.status(400).json({ error: "provider must be 'github' or 'gitlab'" });
    }
  } catch (err) {
    console.error("List repos error:", err);
    res.status(500).json({ error: "Failed to list repositories" });
  }
});

router.delete("/disconnect", requireAuth, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { projectId } = req.body;

    if (!projectId) {
      res.status(400).json({ error: "projectId is required" });
      return;
    }

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }

    if (!project.githubRepoId) {
      res.status(400).json({ error: "Project is not connected to a repository" });
      return;
    }

    await prisma.project.update({
      where: { id: projectId },
      data: {
        githubRepoId: null,
        githubRepoName: null,
      },
    });

    res.json({ message: "Repository disconnected" });
  } catch (err) {
    console.error("Disconnect error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;

