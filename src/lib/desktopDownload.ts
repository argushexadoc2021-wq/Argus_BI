// The web app's "Download Desktop App" button.
//
// It always downloads the NEWEST "Argus Business Intelligence" installer: the server reads the same latest.json the
// installed apps update from (GET /api/desktop/latest) and the download goes to that release's installer
// (GitHub release asset, e.g. Argus.Business.Intelligence_1.1.153_x64-setup.exe). Nothing has to be changed here
// for a new release, and old installers under old names ("CNCFORGE ERP", "Business Intelligence") are never handed out
// (their old links are redirected to /api/desktop/setup in vercel.json).

import { useEffect, useState } from 'react';

/** Shown until the newest version number has been read from the server. */
export const DESKTOP_APP_VERSION = 'latest';

export interface LatestDesktop { version: string; url: string; notes?: string }

let cached: Promise<LatestDesktop | null> | null = null;
export function latestDesktop(): Promise<LatestDesktop | null> {
  cached ??= fetch('/api/desktop/latest', { cache: 'no-store' })
    .then((r) => (r.ok && !/text\/html/i.test(r.headers.get('content-type') || '') ? r.json() : null))
    .then((j) => (j && j.url ? (j as LatestDesktop) : null))
    .catch(() => null);
  const p = cached;
  p.then((v) => { if (!v) cached = null; });   // a failed read is tried again next time
  return p;
}

/** The newest version number ("1.1.153"), or '' while it is being read. */
export function useLatestDesktopVersion(): string {
  const [v, setV] = useState('');
  useEffect(() => { let off = false; void latestDesktop().then((l) => { if (!off && l) setV(l.version); }); return () => { off = true; }; }, []);
  return v;
}

/**
 * Starts the download of the newest installer. Throws an Error with a user-facing message when it cannot be found
 * (the caller shows it with a retry).
 */
export async function downloadDesktopApp(): Promise<void> {
  const l = await latestDesktop();
  const href = l?.url || '/api/desktop/setup';
  if (!l) {
    // the server could not say which version is newest: try the redirect route once before giving up
    const res = await fetch('/api/desktop/latest', { cache: 'no-store' }).catch(() => null);
    if (!res || !res.ok) throw new Error('The latest version could not be found. Check your internet connection and try again.');
  }
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
