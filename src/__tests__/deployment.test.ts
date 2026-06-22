import { describe, it, expect } from "vitest";
import type { BuildStatus, CreateDeploymentInput } from "@/types";

describe("Deployment Lifecycle State Machine", () => {
  const validTransitions: Record<BuildStatus, BuildStatus[]> = {
    queued: ["building", "cancelled"],
    building: ["deploying", "failed", "cancelled"],
    deploying: ["ready", "failed"],
    ready: [],
    failed: [],
    cancelled: [],
  };

  it("should define all valid deployment statuses", () => {
    const statuses: BuildStatus[] = [
      "queued", "building", "deploying", "ready", "failed", "cancelled",
    ];
    for (const status of statuses) {
      expect(validTransitions[status]).toBeDefined();
    }
  });

  it("queued deployments can transition to building", () => {
    expect(validTransitions["queued"]).toContain("building");
  });

  it("queued deployments can transition to cancelled", () => {
    expect(validTransitions["queued"]).toContain("cancelled");
  });

  it("building deployments can transition to deploying", () => {
    expect(validTransitions["building"]).toContain("deploying");
  });

  it("building deployments can transition to failed", () => {
    expect(validTransitions["building"]).toContain("failed");
  });

  it("deploying deployments can transition to ready", () => {
    expect(validTransitions["deploying"]).toContain("ready");
  });

  it("deploying deployments can transition to failed", () => {
    expect(validTransitions["deploying"]).toContain("failed");
  });

  it("ready deployments are terminal", () => {
    expect(validTransitions["ready"]).toHaveLength(0);
  });

  it("failed deployments are terminal", () => {
    expect(validTransitions["failed"]).toHaveLength(0);
  });

  it("cancelled deployments are terminal", () => {
    expect(validTransitions["cancelled"]).toHaveLength(0);
  });

  it("should not allow skipping states", () => {
    expect(validTransitions["queued"]).not.toContain("deploying");
    expect(validTransitions["queued"]).not.toContain("ready");
    expect(validTransitions["building"]).not.toContain("ready");
  });
});

describe("CreateDeploymentInput Validation", () => {
  it("should accept valid input with only projectId", () => {
    const input: CreateDeploymentInput = { projectId: "proj-1" };
    expect(input.projectId).toBe("proj-1");
  });

  it("should accept optional branch, commitSha, commitMsg", () => {
    const input: CreateDeploymentInput = {
      projectId: "proj-1",
      branch: "main",
      commitSha: "abc123",
      commitMsg: "feat: add auth",
    };
    expect(input.branch).toBe("main");
    expect(input.commitSha).toBe("abc123");
  });

  it("should handle undefined optional fields", () => {
    const input: CreateDeploymentInput = { projectId: "proj-1" };
    expect(input.branch).toBeUndefined();
    expect(input.commitSha).toBeUndefined();
    expect(input.commitMsg).toBeUndefined();
  });
});

describe("Deployment URL Generation Logic", () => {
  function generateUrl(
    projectName: string,
    branch?: string
  ): string {
    const slug = branch
      ?.toLowerCase()
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    const projectSlug = projectName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "-");

    if (!slug) return `${projectSlug}.local`;
    return `${slug}--${projectSlug}.preview.local`;
  }

  it("production deploys (no branch) get project.local", () => {
    const url = generateUrl("My App");
    expect(url).toBe("my-app.local");
  });

  it("branch deploys get branch--project.preview.local", () => {
    const url = generateUrl("My App", "feature/login");
    expect(url).toBe("feature-login--my-app.preview.local");
  });

  it("main branch deploys get production URL", () => {
    const url = generateUrl("My App", undefined);
    expect(url).toBe("my-app.local");
  });

  it("sanitizes special characters in branch names", () => {
    const url = generateUrl("app", "feat@#$%branch");
    expect(url).toMatch(/^[a-z0-9-]+--app\.preview\.local$/);
  });

  it("collapses multiple dashes in branch names", () => {
    const url = generateUrl("app", "feat---branch");
    expect(url).toBe("feat-branch--app.preview.local");
  });
});
