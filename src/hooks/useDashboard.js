import { useCallback, useEffect, useState } from "react";

import { getSystem, getDocker } from "../api";

export default function useDashboard() {
  const [system, setSystem] = useState(null);
  const [docker, setDocker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const load = useCallback(async () => {
    try {
      const [systemData, dockerData] = await Promise.all([
        getSystem(),
        getDocker(),
      ]);

      setSystem(systemData);
      setDocker(dockerData);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      // Keep showing the last good snapshot; surface the failure so the UI
      // can render a non-destructive error state with a retry action.
      console.error("[REX OS] dashboard poll failed:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();

    const interval = setInterval(load, 10000);

    return () => clearInterval(interval);
  }, [load]);

  return {
    loading,
    system,
    docker,
    error,
    lastUpdated,
    retry: load,
    online: !error && !!system && !!docker,
  };
}
