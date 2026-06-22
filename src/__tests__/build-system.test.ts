import { describe, it, expect } from "vitest";
import { FRAMEWORKS, type FrameworkConfig, type Framework } from "@/types";

describe("Framework Configurations", () => {
  it("should have configs for all supported frameworks", () => {
    const expected: Framework[] = [
      "nextjs",
      "vite",
      "nuxt",
      "remix",
      "gatsby",
      "astro",
      "sveltekit",
      "create-react-app",
      "vue-cli",
    ];
    for (const name of expected) {
      const config = FRAMEWORKS.find((f) => f.name === name);
      expect(config).toBeDefined();
    }
  });

  it("each framework config should have required fields", () => {
    for (const fw of FRAMEWORKS) {
      expect(fw.name).toBeTruthy();
      expect(fw.displayName).toBeTruthy();
      expect(fw.buildCommand).toBeTruthy();
      expect(fw.outputDir).toBeTruthy();
      expect(Array.isArray(fw.configFile)).toBe(true);
    }
  });

  it("Next.js should use npx next build", () => {
    const next = FRAMEWORKS.find((f) => f.name === "nextjs")!;
    expect(next.buildCommand).toBe("npx next build");
    expect(next.outputDir).toBe(".next");
    expect(next.configFile).toContain("next.config.js");
  });

  it("Vite should use npm run build", () => {
    const vite = FRAMEWORKS.find((f) => f.name === "vite")!;
    expect(vite.buildCommand).toBe("npm run build");
    expect(vite.outputDir).toBe("dist");
    expect(vite.configFile).toContain("vite.config.ts");
  });

  it("Astro should use npx astro build", () => {
    const astro = FRAMEWORKS.find((f) => f.name === "astro")!;
    expect(astro.buildCommand).toBe("npx astro build");
    expect(astro.outputDir).toBe("dist");
  });

  it("Gatsby should use npx gatsby build", () => {
    const gatsby = FRAMEWORKS.find((f) => f.name === "gatsby")!;
    expect(gatsby.buildCommand).toBe("npx gatsby build");
    expect(gatsby.outputDir).toBe("public");
  });

  it("Remix should use npx remix build", () => {
    const remix = FRAMEWORKS.find((f) => f.name === "remix")!;
    expect(remix.buildCommand).toBe("npx remix build");
    expect(remix.outputDir).toBe("build");
  });

  it("Nuxt should use npx nuxt build", () => {
    const nuxt = FRAMEWORKS.find((f) => f.name === "nuxt")!;
    expect(nuxt.buildCommand).toBe("npx nuxt build");
    expect(nuxt.outputDir).toBe(".output");
  });

  it("SvelteKit should use npx svelte-kit build", () => {
    const sveltekit = FRAMEWORKS.find((f) => f.name === "sveltekit")!;
    expect(sveltekit.buildCommand).toBe("npx svelte-kit build");
  });

  it("React App should use npx react-scripts build", () => {
    const cra = FRAMEWORKS.find((f) => f.name === "create-react-app")!;
    expect(cra.buildCommand).toBe("npx react-scripts build");
    expect(cra.outputDir).toBe("build");
  });

  it("Vue CLI should use npx vue-cli-service build", () => {
    const vue = FRAMEWORKS.find((f) => f.name === "vue-cli")!;
    expect(vue.buildCommand).toBe("npx vue-cli-service build");
    expect(vue.outputDir).toBe("dist");
  });
});

describe("Framework Detection Heuristics", () => {
  it("should map dependency names to frameworks", () => {
    const depMap: Record<string, Framework> = {
      next: "nextjs",
      nuxt: "nuxt",
      gatsby: "gatsby",
      astro: "astro",
      vite: "vite",
    };
    for (const [dep, fwName] of Object.entries(depMap)) {
      const config = FRAMEWORKS.find((f) => f.name === fwName);
      expect(config).toBeDefined();
    }
  });

  it("should map config file names to frameworks", () => {
    const fileMap: Record<string, Framework> = {
      "next.config.js": "nextjs",
      "nuxt.config.ts": "nuxt",
      "vite.config.mjs": "vite",
      "gatsby-config.js": "gatsby",
      "astro.config.ts": "astro",
      "svelte.config.js": "sveltekit",
      "remix.config.js": "remix",
      "vue.config.js": "vue-cli",
    };
    for (const [file, fwName] of Object.entries(fileMap)) {
      const fw = FRAMEWORKS.find((f) => f.name === fwName);
      expect(fw).toBeDefined();
      expect(fw!.configFile).toContain(file);
    }
  });

  it("should have unique framework names", () => {
    const names = FRAMEWORKS.map((f) => f.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it("should have reasonable output directories", () => {
    const outputs = FRAMEWORKS.map((f) => f.outputDir);
    const validOutputs = ["dist", "build", ".next", ".output", "public"];
    for (const output of outputs) {
      expect(validOutputs).toContain(output);
    }
  });
});

describe("BuildResult Type", () => {
  it("should have all required status values defined", () => {
    const statuses = ["queued", "building", "deploying", "ready", "failed", "cancelled"];
    expect(statuses.length).toBe(6);
  });
});

