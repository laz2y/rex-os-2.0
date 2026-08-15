import { useEffect, useState } from "react";

/**
 * Live clock. `seconds` controls how often the hook re-renders its consumer:
 * the header clock needs per-second time; the dashboard greeting/date only
 * changes by hour/day, so Home subscribes with { seconds: false } (30s tick)
 * to avoid re-rendering the whole dashboard tree every second.
 */
export default function useLiveClock({ seconds = true } = {}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), seconds ? 1000 : 30000);
    return () => clearInterval(id);
  }, [seconds]);

  return {
    time: now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    date: now.toLocaleDateString(undefined, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    hour: now.getHours(),
  };
}
