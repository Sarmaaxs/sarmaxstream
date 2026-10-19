import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Loader2, Check, X, RotateCw, AlertTriangle, Music } from 'lucide-react';
import { useDownloads, dismissDownload, retryDownload } from '@/lib/downloadManager';
import { formatBytes } from '@/lib/offlineDownloads';

function statusText(job) {
  if (job.status === 'resolving') return 'Finding the best source…';
  if (job.status === 'saving') return 'Saving…';
  if (job.status === 'done' || job.status === 'error') return job.message;
  const known = job.total > 0;
  const pct = known ? Math.min(100, Math.round((job.loaded / job.total) * 100)) : 0;
  const size = known
    ? `${pct}% · ${formatBytes(job.loaded)} of ${formatBytes(job.total)}`
    : job.loaded > 0
      ? `${formatBytes(job.loaded)} downloaded`
      : 'Starting…';
  return `${size}${job.message ? ` · ${job.message}` : ''}`;
}

export function JobRow({ job }) {
  const active = job.status === 'resolving' || job.status === 'downloading' || job.status === 'saving';
  const known = job.total > 0 && job.status === 'downloading';
  const pct = job.status === 'saving' || job.status === 'done' ? 100 : known ? Math.min(100, (job.loaded / job.total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-black/85 backdrop-blur border border-white/10 p-2.5 shadow-lg">
      <div className="w-11 h-11 rounded-lg overflow-hidden shrink-0 bg-white/10 flex items-center justify-center">
        {job.thumbnail ? (
          <img src={job.thumbnail} alt="" className="w-full h-full object-cover" />
        ) : (
          <Music size={18} className="text-white/50" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-white truncate">{job.title}</div>
        <div className={`text-[11px] truncate ${job.status === 'error' ? 'text-red-300' : 'text-white/60'}`}>
          {statusText(job)}
        </div>
        {job.status === 'error' && job.error && (
          <div className="text-[10px] text-white/35 truncate" title={job.error}>{job.error}</div>
        )}
        {job.status !== 'error' && (
          <div className="mt-1.5 h-1.5 rounded-full bg-white/15 overflow-hidden">
            {known || job.status === 'saving' || job.status === 'done' ? (
              <div
                className={`h-full rounded-full ${job.status === 'done' ? 'bg-green-400' : 'bg-primary'}`}
                style={{ width: `${pct}%`, transition: 'width 150ms linear' }}
              />
            ) : (
              <div className="h-full w-full rounded-full bg-primary/70 animate-pulse" />
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {active && <Loader2 size={18} className="animate-spin text-white/70" />}
        {job.status === 'done' && <Check size={18} className="text-green-400" />}
        {job.status === 'error' && (
          <>
            <button
              onClick={() => retryDownload(job.key)}
              className="p-2 rounded-full text-white/80 hover:text-white bg-white/10"
              aria-label="Retry"
              title="Retry"
            >
              <RotateCw size={15} />
            </button>
            <button
              onClick={() => dismissDownload(job.key)}
              className="p-2 rounded-full text-white/50 hover:text-white"
              aria-label="Dismiss"
              title="Dismiss"
            >
              <X size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/** Full list for the Downloads page. */
export function ActiveDownloads() {
  const jobs = useDownloads();
  if (!jobs.length) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-white/50">
        {jobs.some((j) => j.status === 'error') && <AlertTriangle size={13} className="text-red-300" />}
        In progress
      </div>
      {jobs.map((j) => (
        <JobRow key={j.key} job={j} />
      ))}
    </div>
  );
}

/** Floating card: appears briefly when a download starts / finishes / fails, then hides itself.
 *  Live progress stays available on the Downloads page. */
export default function DownloadProgress() {
  const jobs = useDownloads();
  const { pathname } = useLocation();
  const [, force] = useState(0);
  const now = Date.now();
  const visible = jobs.filter((j) => (j.toastUntil || 0) > now);

  useEffect(() => {
    const next = jobs.map((j) => j.toastUntil || 0).filter((t) => t > Date.now());
    if (!next.length) return undefined;
    const id = setTimeout(() => force((x) => x + 1), Math.min(...next) - Date.now() + 30);
    return () => clearTimeout(id);
  }, [jobs]);

  if (!visible.length || pathname.endsWith('/downloads')) return null;
  return (
    <div className="fixed z-[80] left-2 right-2 md:left-auto md:right-4 md:w-96 top-[calc(env(safe-area-inset-top,0px)+0.5rem)] space-y-2 pointer-events-none">
      {visible.slice(-2).map((j) => (
        <div key={j.key} className="pointer-events-auto">
          <Link to="/music/downloads" className="block">
            <JobRow job={j} />
          </Link>
        </div>
      ))}
    </div>
  );
}
