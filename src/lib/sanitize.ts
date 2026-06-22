import { z } from "zod";
export function sanitizeHtml(input: string): string {
  return input.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}
export function sanitizeInput(input: string): string {
  return input.trim().replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, 10_000);
}
export function validateAndSanitize<T>(schema: z.ZodType<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  if (!result.success) return { success: false, errors: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  return { success: true, data: result.data };
}