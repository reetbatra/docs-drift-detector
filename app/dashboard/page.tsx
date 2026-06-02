import Link from "next/link";
import { listReports } from "@/lib/storage";
import { scoreTone } from "@/lib/drift";
import type { ReportSummary } from "@/lib/storage";

export const dynamic = "force-dynamic";

const TONE: Record<
  string,
  { score: string; pill: string }
> = {
  green:  { score: "text-emerald-400", pill: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" },
  amber:  { score: "text-amber-400",   pill: "bg-amber-500/10  text-amber-300  border-amber-500/20"  },
  orange: { score: "text-orange-400",  pill: "bg-orange-500/10 text-orange-300 border-orange-500/20" },
  red:    { score: "text-red-400",     pill: "bg-red-500/10    text-red-300    border-red-500/20"    },
};

const LANG: Record<string, { dot: string; text: string; border: string; bg: string }> = {
  typescript: { dot: "bg-blue-400",    text: "text-blue-300",    border: "border-blue-500/20",    bg: "bg-blue-500/10"    },
  javascript: { dot: "bg-yellow-400",  text: "text-yellow-300",  border: "border-yellow-500/20",  bg: "bg-yellow-500/10"  },
  python:     { dot: "bg-emerald-400", text: "text-emerald-300", border: "border-emerald-500/20", bg: "bg-emerald-500/10" },
};

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function LanguageBadge({ language }: { language: string }) {
  const s = LANG[language.toLowerCase()] ?? {
    dot: "bg-zinc-400", text: "text-zinc-300", border: "border-zinc-500/20", bg: "bg-zinc-500/10",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${s.border} ${s.bg} ${s.text}`}>
      <span className={`size-1.5 rounded-full ${s.dot}`} />
      {language}
    </span>
  );
}

function ReportCard({ r }: { r: ReportSummary }) {
  const tone = TONE[scoreTone(r.driftScore)];
  return (
    <Link
      href={`/report/${r.id}`}
      className="flex flex-col rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 transition-colors hover:border-zinc-700 hover:bg-zinc-900/60"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className={`text-2xl font-bold tabular-nums ${tone.score}`}>
            {r.driftScore}
          </span>
          <span className="text-sm text-zinc-500">/10</span>
          <div className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tone.pill}`}>
            {r.scoreLabel}
          </div>
        </div>
        {r.language && <LanguageBadge language={r.language} />}
      </div>

      <div className="mt-3 min-w-0">
        <div className="truncate font-semibold text-zinc-100">{r.repoFullName}</div>
        <div className="mt-0.5 truncate text-xs text-zinc-500">vs {r.docsUrl}</div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="text-red-300">{r.highCount} high</span>
        <span className="text-amber-300">{r.mediumCount} med</span>
        <span className="text-zinc-500">{r.lowCount} low</span>
        {r.coverageScore > 0 && (
          <span className="ml-auto text-zinc-500">
            {r.coverageScore}% coverage
          </span>
        )}
      </div>

      <div className="mt-auto pt-4 text-xs text-zinc-600">
        {formatDate(r.uploadedAt)}
      </div>
    </Link>
  );
}

export default async function DashboardPage() {
  const reports = await listReports();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">
            {reports.length === 0
              ? "No reports yet"
              : `${reports.length} report${reports.length === 1 ? "" : "s"} analyzed`}
          </p>
        </div>
        <Link
          href="/"
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-emerald-500 hover:text-emerald-300"
        >
          + New analysis
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-12 text-center">
          <p className="text-zinc-400">No reports yet.</p>
          <Link
            href="/"
            className="mt-3 inline-block text-sm text-emerald-400 hover:underline"
          >
            Analyze a repo →
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {reports.map((r) => (
            <ReportCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </div>
  );
}
