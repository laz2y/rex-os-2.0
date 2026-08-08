import { Home, MonitorCog } from "lucide-react";
import { Link } from "react-router";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <div className="pointer-events-none absolute inset-0 -z-10 rex-grid rex-grid-fade" />

      <p className="rex-glow-soft font-mono text-7xl font-bold tracking-tight text-primary">
        404
      </p>
      <h1 className="mt-5 text-xl font-semibold tracking-tight">
        Signal lost
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
        The page you're looking for isn't in this filesystem.
      </p>
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Button asChild className="gap-2">
          <Link to="/dashboard">
            <MonitorCog className="size-4" />
            Open console
          </Link>
        </Button>
        <Button asChild variant="outline" className="gap-2">
          <Link to="/">
            <Home className="size-4" />
            Home
          </Link>
        </Button>
      </div>
    </div>
  );
}
