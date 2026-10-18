import { useCallback, useEffect, useState } from "react";

// Picks the stream server for the player and switches to the next one on its own
// when the current one is down or never finishes loading. No buttons needed.
// Note: a browser can't see inside a third-party iframe, so this catches servers that
// are unreachable or never load. It can't tell if a server loads but shows its own error.

const TIMEOUT_MS = 12000;

const readStart = (ids, storageKey) => {
  try {
    const i = ids.indexOf(localStorage.getItem(storageKey));
    return i >= 0 ? i : 0;
  } catch {
    return 0;
  }
};

export function useAutoServer({ ids, storageKey, resetKey, getSrc }) {
  const n = ids.length;
  const fresh = useCallback(
    () => ({ key: resetKey, start: readStart(ids, storageKey), tries: 0, loaded: false }),
    [resetKey, ids, storageKey]
  );
  const [st, setSt] = useState(fresh);
  const cur = st.key === resetKey ? st : fresh();

  const failedAll = cur.tries >= n;
  const index = (cur.start + Math.min(cur.tries, n - 1)) % n;
  const src = getSrc(index);

  // new movie / episode -> reset
  useEffect(() => {
    setSt((s) => (s.key === resetKey ? s : fresh()));
  }, [resetKey, fresh]);

  const next = useCallback(() => {
    setSt((s) => {
      const base = s.key === resetKey ? s : fresh();
      if (base.loaded) return base;
      return { ...base, tries: base.tries + 1 };
    });
  }, [resetKey, fresh]);

  // never finished loading -> next server
  useEffect(() => {
    if (cur.loaded || failedAll) return undefined;
    const t = setTimeout(next, TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [cur.loaded, failedAll, cur.tries, resetKey, next]);

  // server host unreachable (DNS / network down) -> next server right away
  useEffect(() => {
    if (cur.loaded || failedAll || !src) return undefined;
    let alive = true;
    let origin = "";
    try { origin = new URL(src).origin; } catch { return undefined; }
    fetch(origin, { mode: "no-cors", cache: "no-store" }).catch(() => { if (alive) next(); });
    return () => { alive = false; };
  }, [src, cur.loaded, failedAll, next]);

  const onLoad = useCallback(() => {
    setSt((s) => {
      const base = s.key === resetKey ? s : fresh();
      return { ...base, loaded: true };
    });
    try { localStorage.setItem(storageKey, ids[index]); } catch { /* ignore */ }
  }, [resetKey, fresh, storageKey, ids, index]);

  const retry = useCallback(() => {
    setSt({ key: resetKey, start: 0, tries: 0, loaded: false });
  }, [resetKey]);

  return { index, onLoad, failedAll, retry };
}
