import { promises as fs } from "node:fs";
import path from "node:path";
import type { DriftReport } from "./types";

export interface ReportSummary {
  id: string;
  uploadedAt: Date;
  repoFullName: string;
  repoUrl: string;
  docsUrl: string;
  driftScore: number;
  scoreLabel: string;
  coverageScore: number;
  mismatchCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  language: string | null;
}

/**
 * Report persistence with a pluggable backend:
 *  - If BLOB_READ_WRITE_TOKEN is present (Vercel Blob), reports are stored as
 *    public JSON blobs under `reports/<id>.json` — durable and shareable.
 *  - Otherwise we fall back to the local filesystem under `.reports/`, so the
 *    app works end-to-end in local dev with zero external setup.
 */

const PREFIX = "reports";

function toSummary(id: string, uploadedAt: Date, report: DriftReport): ReportSummary {
  const counts = report.mismatches.reduce(
    (acc, m) => { acc[m.severity] = (acc[m.severity] ?? 0) + 1; return acc; },
    { high: 0, medium: 0, low: 0 } as Record<string, number>,
  );
  return {
    id,
    uploadedAt,
    repoFullName: report.repo.fullName,
    repoUrl: report.input.repoUrl,
    docsUrl: report.input.docsUrl,
    driftScore: report.driftScore,
    scoreLabel: report.scoreLabel,
    coverageScore: report.coverageScore ?? 0,
    mismatchCount: report.mismatches.length,
    highCount: counts.high ?? 0,
    mediumCount: counts.medium ?? 0,
    lowCount: counts.low ?? 0,
    language: report.repo.language,
  };
}

function hasBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

function localDir(): string {
  return path.join(process.cwd(), ".reports");
}

export async function saveReport(report: DriftReport): Promise<void> {
  const json = JSON.stringify(report);
  if (hasBlob()) {
    const { put } = await import("@vercel/blob");
    await put(`${PREFIX}/${report.id}.json`, json, {
      access: "public",
      addRandomSuffix: false,
      contentType: "application/json",
      allowOverwrite: true,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return;
  }

  const dir = localDir();
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, `${report.id}.json`), json, "utf8");
}

export async function getReport(id: string): Promise<DriftReport | null> {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;

  if (hasBlob()) {
    try {
      const { list } = await import("@vercel/blob");
      const { blobs } = await list({
        prefix: `${PREFIX}/${id}.json`,
        token: process.env.BLOB_READ_WRITE_TOKEN,
      });
      const match = blobs.find((b) => b.pathname === `${PREFIX}/${id}.json`);
      if (!match) return null;
      const res = await fetch(match.url, { cache: "no-store" });
      if (!res.ok) return null;
      return (await res.json()) as DriftReport;
    } catch {
      return null;
    }
  }

  try {
    const file = path.join(localDir(), `${id}.json`);
    const data = await fs.readFile(file, "utf8");
    return JSON.parse(data) as DriftReport;
  } catch {
    return null;
  }
}

export async function listReports(): Promise<ReportSummary[]> {
  if (hasBlob()) {
    const { list } = await import("@vercel/blob");
    const { blobs } = await list({
      prefix: `${PREFIX}/`,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    const summaries = await Promise.all(
      blobs.map(async (b) => {
        const id = b.pathname.replace(`${PREFIX}/`, "").replace(".json", "");
        try {
          const res = await fetch(b.url, { cache: "no-store" });
          if (!res.ok) return null;
          return toSummary(id, new Date(b.uploadedAt), (await res.json()) as DriftReport);
        } catch {
          return null;
        }
      }),
    );
    return (summaries.filter(Boolean) as ReportSummary[]).sort(
      (a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime(),
    );
  }

  try {
    const dir = localDir();
    const files = await fs.readdir(dir);
    const summaries = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (f) => {
          const filePath = path.join(dir, f);
          const [data, stat] = await Promise.all([
            fs.readFile(filePath, "utf8"),
            fs.stat(filePath),
          ]);
          return toSummary(f.replace(".json", ""), stat.mtime, JSON.parse(data) as DriftReport);
        }),
    );
    return summaries.sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  } catch {
    return [];
  }
}
