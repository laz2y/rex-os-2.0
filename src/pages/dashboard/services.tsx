import { motion } from "framer-motion";
import { ExternalLink, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WidgetCard } from "@/components/dashboard/widget-shell";
import { SERVICES } from "@/lib/rexos";
import { cn } from "@/lib/utils";

export default function ServicesPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Services
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your self-hosted stack, one launcher away. REX OS is a read-only
          overview — manage each app in its own interface.
        </p>
      </div>

      <motion.div
        initial="hidden"
        animate="show"
        variants={{ hidden: {}, show: { transition: { staggerChildren: 0.04 } } }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3"
      >
        {SERVICES.map((service) => (
          <motion.div
            key={service.id}
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: { opacity: 1, y: 0 },
            }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            <WidgetCard
              className="h-full"
              contentClassName="flex h-full flex-col"
            >
              <div className="flex items-start gap-3">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background"
                  style={{ color: service.color }}
                >
                  <service.icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold tracking-tight">
                      {service.name}
                    </h2>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                        service.status === "online"
                          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-300"
                          : "border-rose-400/25 bg-rose-400/10 text-rose-300",
                      )}
                    >
                      <span
                        className={cn(
                          "size-1.5 rounded-full",
                          service.status === "online"
                            ? "bg-emerald-400"
                            : "bg-rose-400",
                        )}
                      />
                      {service.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {service.description}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3.5">
                <div className="flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className="border-border/70 font-mono text-[10px] text-muted-foreground"
                  >
                    v{service.version}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="border-border/70 font-mono text-[10px] text-muted-foreground"
                  >
                    :{service.port}
                  </Badge>
                </div>
                <Button asChild size="sm" variant="outline" className="gap-1.5">
                  <a
                    href={service.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open
                    <ExternalLink className="size-3.5" />
                  </a>
                </Button>
              </div>
            </WidgetCard>
          </motion.div>
        ))}
      </motion.div>

      <p className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 px-3.5 py-3 text-xs leading-relaxed text-muted-foreground">
        <Info className="mt-0.5 size-3.5 shrink-0" />
        Service endpoints are defined in{" "}
        <code className="rounded bg-background px-1 font-mono text-[11px] text-primary">
          src/lib/rexos.ts
        </code>{" "}
        — update them to match your LAN addresses and the launcher, media
        dialog, and container overview all follow.
      </p>
    </div>
  );
}
