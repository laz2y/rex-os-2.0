import "./FooterStatus.css";
import { useEffect, useState } from "react";
import { Boxes, Cpu, Film, ShieldCheck } from "lucide-react";

import { getJellyfinServer } from "../../../services/jellyfinService";
import { config } from "../../../data/config";

export default function FooterStatus({ system, docker, online }) {
  const [jellyfinState, setJellyfinState] = useState({
    ok: null,
    label: "Checking…",
  });

  useEffect(() => {
    let active = true;

    getJellyfinServer()
      .then(() => {
        if (active) setJellyfinState({ ok: true, label: "Connected" });
      })
      .catch(() => {
        if (active) setJellyfinState({ ok: false, label: "Offline" });
      });

    return () => {
      active = false;
    };
  }, []);

  const items = [
    {
      icon: Boxes,
      title: "Docker",
      ok: online && !!docker,
      value: docker
        ? `${docker.running} running`
        : online
        ? "Checking…"
        : "Offline",
    },
    {
      icon: Film,
      title: "Jellyfin",
      ok: jellyfinState.ok,
      value: jellyfinState.label,
    },
    {
      icon: ShieldCheck,
      title: "API",
      ok: online,
      value: online ? "Healthy" : "Unreachable",
    },
    {
      icon: Cpu,
      title: "REX OS",
      ok: true,
      value: `v${config.version}`,
    },
  ];

  return (
    <section className="footer-status fade-up">
      {items.map((item) => {
        const Icon = item.icon;

        return (
          <div key={item.title} className="footer-item">
            <div
              className={`footer-icon ${item.ok ? "" : "off"}`}
            >
              <Icon size={20} />
            </div>

            <div>
              <h4>{item.title}</h4>
              <span
                className={item.ok === false ? "foot-offline" : ""}
              >
                {item.value}
              </span>
            </div>

            <span
              className={`pulse-dot foot-dot ${
                item.ok ? "ok" : item.ok === false ? "bad" : "wait"
              }`}
            />
          </div>
        );
      })}
    </section>
  );
}
