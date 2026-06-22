import type { Request, Response, NextFunction } from "express";
interface AppError extends Error { statusCode?: number; code?: string; isOperational?: boolean; }
export function errorHandler(err: AppError, _req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err.statusCode || 500;
  if (!err.isOperational) console.error(`[ERROR] ${err.message}`, err.stack);
  res.status(statusCode).json({ error: err.isOperational ? err.message : "Internal server error", code: err.code || "INTERNAL_ERROR" });
}
export function createError(statusCode: number, message: string, code?: string): AppError {
  const err = new Error(message) as AppError; err.statusCode = statusCode; err.code = code; err.isOperational = true; return err;
}