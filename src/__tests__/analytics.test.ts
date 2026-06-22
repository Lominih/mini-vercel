import { describe, it, expect } from "vitest";

function generateDailyDates(start: Date, end: Date): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  while (current <= end) {
    dates.push(current.toISOString().split("T")[0]);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, idx)];
}

function aggregateStats(dailyData: Array<{ date: string; value: number }>) {
  const total = dailyData.reduce((sum, d) => sum + d.value, 0);
  const avg = dailyData.length > 0 ? Math.round(total / dailyData.length) : 0;
  const max = dailyData.length > 0 ? Math.max(...dailyData.map((d) => d.value)) : 0;
  const min = dailyData.length > 0 ? Math.min(...dailyData.map((d) => d.value)) : 0;
  return { total, avg, max, min };
}

describe("Date Range Generation", () => {
  it("should generate correct number of days for a range", () => {
    const start = new Date("2024-01-01");
    const end = new Date("2024-01-10");
    const dates = generateDailyDates(start, end);
    expect(dates).toHaveLength(10);
  });

  it("should handle single-day range", () => {
    const start = new Date("2024-06-15");
    const end = new Date("2024-06-15");
    const dates = generateDailyDates(start, end);
    expect(dates).toHaveLength(1);
    expect(dates[0]).toBe("2024-06-15");
  });

  it("should generate ISO-formatted date strings", () => {
    const dates = generateDailyDates(new Date("2024-03-01"), new Date("2024-03-03"));
    for (const d of dates) {
      expect(d).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("should return empty array when start > end", () => {
    const dates = generateDailyDates(new Date("2024-06-10"), new Date("2024-06-05"));
    expect(dates).toHaveLength(0);
  });
});

describe("Percentile Calculation", () => {
  it("should compute p50 (median) correctly", () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
  });

  it("should compute p95 correctly", () => {
    const data = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(data, 0.95)).toBe(95);
  });

  it("should compute p99 correctly", () => {
    const data = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(data, 0.99)).toBe(99);
  });

  it("should return 0 for empty array", () => {
    expect(percentile([], 0.95)).toBe(0);
  });

  it("should return the value for single-element array", () => {
    expect(percentile([42], 0.5)).toBe(42);
  });

  it("should handle unsorted input", () => {
    expect(percentile([5, 1, 3, 2, 4], 0.5)).toBe(3);
  });
});

describe("Traffic Stats Aggregation", () => {
  it("should sum daily page views", () => {
    const data = [
      { date: "2024-01-01", pv: 100 },
      { date: "2024-01-02", pv: 200 },
      { date: "2024-01-03", pv: 150 },
    ];
    const result = aggregateStats(data.map((d) => ({ date: d.date, value: d.pv })));
    expect(result.total).toBe(450);
  });

  it("should calculate average page views", () => {
    const data = [
      { date: "2024-01-01", pv: 100 },
      { date: "2024-01-02", pv: 200 },
      { date: "2024-01-03", pv: 300 },
    ];
    const result = aggregateStats(data.map((d) => ({ date: d.date, value: d.pv })));
    expect(result.avg).toBe(200);
  });

  it("should handle zero data points", () => {
    const result = aggregateStats([]);
    expect(result.total).toBe(0);
    expect(result.avg).toBe(0);
    expect(result.max).toBe(0);
    expect(result.min).toBe(0);
  });
});

describe("Error Rate Calculation", () => {
  it("should calculate error rate as percentage", () => {
    const errors = 50;
    const requests = 1000;
    const rate = Math.round((errors / requests) * 10000) / 100;
    expect(rate).toBe(5);
  });

  it("should handle zero requests", () => {
    const rate = Math.round((0 / 0) * 10000) / 100;
    expect(isNaN(rate)).toBe(true);
  });

  it("should handle 100% error rate", () => {
    const errors = 100;
    const requests = 100;
    const rate = Math.round((errors / requests) * 10000) / 100;
    expect(rate).toBe(100);
  });

  it("should compute per-status breakdown", () => {
    const statuses = [400, 404, 404, 500, 404];
    const breakdown = statuses.reduce<Record<number, number>>((acc, s) => {
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    expect(breakdown[404]).toBe(3);
    expect(breakdown[400]).toBe(1);
    expect(breakdown[500]).toBe(1);
  });
});

describe("Performance Metrics Aggregation", () => {
  it("should calculate average TTFB", () => {
    const ttfbValues = [100, 200, 300, 400];
    const avg = Math.round(ttfbValues.reduce((s, v) => s + v, 0) / ttfbValues.length);
    expect(avg).toBe(250);
  });

  it("should filter out zero values from averages", () => {
    const values = [100, 0, 200, 0];
    const valid = values.filter((v) => v > 0);
    const avg = Math.round(valid.reduce((s, v) => s + v, 0) / valid.length);
    expect(avg).toBe(150);
  });

  it("should compute p95 for performance metrics", () => {
    const ttfbValues = Array.from({ length: 50 }, (_, i) => (i + 1) * 10);
    const p95 = percentile(ttfbValues, 0.95);
    expect(p95).toBe(480);
  });

  it("should handle empty metric arrays", () => {
    const p95 = percentile([], 0.95);
    expect(p95).toBe(0);
  });
});

describe("Random Data Generation", () => {
  it("randomBetween should return values within range", () => {
    for (let i = 0; i < 100; i++) {
      const val = randomBetween(10, 50);
      expect(val).toBeGreaterThanOrEqual(10);
      expect(val).toBeLessThanOrEqual(50);
    }
  });

  it("randomBetween min === max should return that value", () => {
    expect(randomBetween(5, 5)).toBe(5);
  });

  it("generated data should match expected date count", () => {
    const dates = generateDailyDates(new Date("2024-01-01"), new Date("2024-01-07"));
    const simulated = dates.map((date) => ({
      date,
      pv: randomBetween(50, 500),
    }));
    expect(simulated).toHaveLength(7);
    for (const s of simulated) {
      expect(s.pv).toBeGreaterThanOrEqual(50);
      expect(s.pv).toBeLessThanOrEqual(500);
    }
  });
});
