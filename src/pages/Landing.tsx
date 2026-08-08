import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Smartphone, Zap } from "lucide-react";
import { Link } from "react-router";

import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { REX_BUILD } from "@/lib/rexos";

export default function Landing() {
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 rex-grid rex-grid-fade" />

      <header className="flex h-16 shrink-0 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-2.5">
          <img
            src={logo}
            alt="REX OS logo"
            width={30}
            height={30}
            className="rounded-md"
          />
          <span className="text-sm font-bold tracking-tight">REX OS</span>
        </div>
        <Link
          to="/auth?returnTo=%2Fdashboard"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign in
        </Link>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="w-full max-w-xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium tracking-wide text-primary">
            <Zap className="size-3.5" />
            {REX_BUILD}
          </span>
          <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">
            REX OS
          </h1>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Your media, containers, and hardware — one clean console.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-2 sm:flex-row">
            <Button size="lg" asChild className="w-full gap-2 sm:w-auto">
              <Link to="/auth?returnTo=%2Fdashboard">
                Launch Console
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground/80">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="size-3.5 text-primary" />
              Secure email-code access
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Smartphone className="size-3.5 text-primary" />
              Install as an app
            </span>
          </div>
        </motion.div>
      </main>

      <footer className="flex h-12 shrink-0 items-center justify-center gap-3 border-t border-border/60 text-xs text-muted-foreground/70">
        <span>{REX_BUILD}</span>
        <span aria-hidden="true">·</span>
        <span>self-hosted by you</span>
      </footer>
    </div>
  );
}
