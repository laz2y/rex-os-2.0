import { useEffect, useState } from "react";
import { getSystem, getDocker } from "../api";

export default function useDashboard() {
  const [system, setSystem] = useState(null);
  const [docker, setDocker] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    try {
      const [systemData, dockerData] = await Promise.all([
        getSystem(),
        getDocker(),
      ]);

      setSystem(systemData);
      setDocker(dockerData);
      setLoading(false);
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    loadDashboard();

    const interval = setInterval(loadDashboard, 10000);

    return () => clearInterval(interval);
  }, []);

  return {
    loading,
    system,
    docker,
  };
}