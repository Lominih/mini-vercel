import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import compression from "compression";
import { globalLimiter, apiLimiter, authLimiter } from "./middleware/rate-limit";

import authRoutes from "./routes/auth";
import gitRoutes from "./routes/git";
import domainRoutes from "./routes/domains";
import edgeFunctionRoutes from "./routes/edge-functions";
import envVarRoutes from "./routes/env-vars";

const app = express();

// Security & middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  credentials: true,
}));
app.use(compression());
app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use(globalLimiter);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Routes
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/git", apiLimiter, gitRoutes);
app.use("/api/domains", apiLimiter, domainRoutes);
app.use("/api/functions", apiLimiter, edgeFunctionRoutes);
app.use("/api/env", apiLimiter, envVarRoutes);

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

// Error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

export default app;
