import { useEffect, useState } from "react";

export default function useHeroBanner(items) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!items.length) return;

    const timer = setInterval(() => {
      setCurrent((index) => (index + 1) % items.length);
    }, 10000);

    return () => clearInterval(timer);
  }, [items]);

  return items[current] || null;
}