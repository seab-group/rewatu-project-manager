/**
 * Saving a file.
 *
 * Served normally, an anchor with `download` is all this needs. Inside a host
 * that mediates downloads (the claude.ai artifact viewer), that anchor is inert
 * and would fail silently — so where the host offers a save capability, the
 * file goes through it and the viewer gets a real confirmation.
 */

interface DownloadsNamespace {
  save(request: { filename: string; data: Blob | string }): Promise<{ status: string }>;
}

interface ClaudeHost {
  use?(name: string): Promise<unknown>;
}

/** Resolved once. `null` means this page saves the ordinary way. */
let downloadsPromise: Promise<DownloadsNamespace | null> | null = null;

function getDownloads(): Promise<DownloadsNamespace | null> {
  if (downloadsPromise) return downloadsPromise;
  const host = (window as unknown as { claude?: ClaudeHost }).claude;
  downloadsPromise = host?.use
    ? Promise.resolve(host.use('downloads'))
        .then((ns) => (ns as DownloadsNamespace | null) ?? null)
        .catch(() => null)
    : Promise.resolve(null);
  return downloadsPromise;
}

export type SaveOutcome =
  | { ok: true; via: 'host' | 'browser' }
  | { ok: false; reason: string };

export async function saveFile(fileName: string, blob: Blob): Promise<SaveOutcome> {
  const downloads = await getDownloads();

  if (downloads) {
    try {
      await downloads.save({ filename: fileName, data: blob });
      return { ok: true, via: 'host' };
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (code === 'declined') return { ok: false, reason: 'The download was declined.' };
      if (code === 'rate_limited') return { ok: false, reason: 'A download prompt is already open. Try again in a moment.' };
      return { ok: false, reason: 'This viewer could not save the file. Open the app directly to export.' };
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Give the browser a moment to start the download before revoking.
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
  return { ok: true, via: 'browser' };
}
