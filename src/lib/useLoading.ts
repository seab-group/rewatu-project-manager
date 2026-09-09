import { useEffect, useState } from 'react';

/**
 * True for the first moment of the session only. Skeletons are shaped like the
 * content that replaces them, so the first paint is not a spinner on a blank
 * page — but navigation inside the app stays instant.
 */
let firstLoadDone = false;

export function useInitialLoad(ms = 550): boolean {
  const [loading, setLoading] = useState(!firstLoadDone);
  useEffect(() => {
    if (firstLoadDone) return;
    const t = window.setTimeout(() => { firstLoadDone = true; setLoading(false); }, ms);
    return () => window.clearTimeout(t);
  }, [ms]);
  return loading;
}
