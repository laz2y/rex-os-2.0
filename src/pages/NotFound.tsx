import { motion } from "framer-motion";
import { ArrowLeft, RadioTower } from "lucide-react";
import { Link } from "react-router";

import logo from "@/assets/logo.svg";
import { Button } from "@/components/ui/button";
import { REX_BUILD } from "@/lib/rexos";

export default function NotFound() {
  return (
    <div className="rex-grid flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 text-center">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative flex flex-col items-center"
      >
        <div className="absolute -top-32 left-1/2 -z-10 h-56 w-96 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

        <img
          src={logo}
          alt=""
          width={56}
          height={56}
          className="rounded-xl opacity-90"
        />

        <p className="mt-8 flex items-center gap-2 font-mono text-xs uppercase tracking-[0.25em] text-primary">
          <RadioTower className="size-4" />
          Signal lost
        </p>

        <h1 className="mt-3 font-mono text-7xl font-bold tracking-tight sm:text-8xl">
          <span className="text-muted-foreground/30">4</span>
          <span className="text-primary">0</span>
          <span className="text-muted-foreground/30">4</span>
        </h1>

        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
          The route you requested doesn&apos;t exist on this node. Check the
          address, or head back to the console.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="gap-2">
            <Link to="/dashboard">
              <ArrowLeft className="size-4" />
              Back to console
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Landing page</Link>
          </Button>
        </div>

        <p className="mt-10 font-mono text-[10px] tracking-wider text-muted-foreground/50">
          {REX_BUILD} · rexos-node
        </p>
      </motion.div>
    </div>
  );
}
