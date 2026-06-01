"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-red-500/30 bg-red-500/[0.06] p-8 text-center">
      <h1 className="text-xl font-semibold text-zinc-100">Something broke</h1>
      <p className="mt-2 text-sm text-zinc-400">
        An unexpected error occurred while rendering this page.
        {error.digest ? ` (ref ${error.digest})` : ""}
      </p>
      <div className="mt-5 flex items-center justify-center gap-2">
        <button
          type="button"
          onClick={reset}
          className="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-emerald-950 hover:bg-emerald-400"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-lg border border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-800"
        >
          Go home
        </Link>
      </div>
    </div>
  );
}
