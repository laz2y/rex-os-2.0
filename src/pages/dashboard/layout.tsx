import { useMutation } from "convex/react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import {
  Activity,
  ChevronsLeft,
  ChevronsRight,
  Home,
  LogOut,
  Wifi,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router";

import { api } from "@/convex/_generated/api";
import logo from "@/assets/logo.svg";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import { useClock } from "@/hooks/use-clock";
import { NAV_ITEMS, REX_BUILD } from "@/lib/rexos";
import { cn } from "@/lib/utils";

const SIDEBAR_KEY = "rexos:sidebar-collapsed";

// Module-level guard: survives StrictMode remounts so the demo seed mutation
// is only ever fired once per page load.
let seedStarted = false;

function initials(name?: string, email?: string) {
  if (name) {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join("");
  }
  return (email?.[0] ?? "R").toUpperCase();
}

function SidebarLink({
  to,
  label,
  icon: Icon,
  end,
  collapsed,
}: {
  to: string;
  label: string;
  icon: typeof Activity;
  end?: boolean;
  collapsed: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <NavLink
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              "flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm font-medium transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                : "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
              collapsed && "justify-center px-0",
            )
          }
        >
          {({ isActive }) => (
            <>
              <Icon
                className={cn(
                  "size-[18px] shrink-0",
                  isActive && "text-sidebar-primary",
                )}
              />
              {!collapsed && <span className="truncate">{label}</span>}
            </>
          )}
        </NavLink>
      </TooltipTrigger>
      {collapsed && (
        <TooltipContent side="right">{label}</TooltipContent>
      )}
    </Tooltip>
  );
}

function Clock() {
  const { time, date } = useClock();
  return (
    <div
      className="hidden items-center gap-2 md:flex"
      role="status"
      aria-label={`Local time ${time}`}
    >
      <span className="font-mono text-xs tabular-nums tracking-tight text-muted-foreground">
        {time}
      </span>
      <span className="text-xs text-muted-foreground/60">{date}</span>
    </div>
  );
}

export default function DashboardLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  const seed = useMutation(api.seed.ensureSeedData);

  useEffect(() => {
    if (seedStarted) return;
    seedStarted = true;
    seed().catch((error) =>
      console.warn("[REX OS] demo data seed failed:", error),
    );
  }, [seed]);

  const [collapsed, setCollapsed] = useState(
    () =>
      typeof window !== "undefined" &&
      window.localStorage.getItem(SIDEBAR_KEY) === "1",
  );

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const pageTitle =
    location.pathname === "/dashboard/media"
      ? "Media"
      : location.pathname === "/dashboard/system"
        ? "System"
        : location.pathname === "/dashboard/services"
          ? "Services"
          : "Overview";

  const userMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-9 rounded-full"
          aria-label="Account menu"
        >
          <Avatar className="size-9">
            <AvatarFallback className="border border-border/70 bg-muted/60 text-xs font-semibold text-primary">
              {initials(user?.name, user?.email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <p className="truncate text-sm font-medium">
            {user?.name ?? "REX user"}
          </p>
          <p className="truncate text-xs font-normal text-muted-foreground">
            {user?.email ?? "anonymous session"}
          </p>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/")} className="cursor-pointer">
          <Home className="size-4" />
          Landing page
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleSignOut}
          className="cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-dvh bg-background text-foreground">
        {/* ---------- Sidebar (desktop/tablet) ---------- */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 lg:flex",
            collapsed ? "w-16" : "w-64",
          )}
        >
          <div
            className={cn(
              "flex h-14 shrink-0 items-center gap-2.5 border-b border-sidebar-border px-4",
              collapsed && "justify-center px-0",
            )}
          >
            <img
              src={logo}
              alt="REX OS logo"
              width={30}
              height={30}
              className="shrink-0 rounded-md"
            />
            {!collapsed && (
              <div className="min-w-0">
                <p className="text-sm font-bold leading-none tracking-tight">
                  REX OS
                </p>
                <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
                  {REX_BUILD}
                </p>
              </div>
            )}
          </div>

          <nav
            aria-label="Primary"
            className="flex-1 space-y-1 overflow-y-auto px-2.5 py-4"
          >
            {NAV_ITEMS.map((item) => (
              <SidebarLink
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                end={item.end}
                collapsed={collapsed}
              />
            ))}
          </nav>

          <div className="space-y-1 border-t border-sidebar-border p-2.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => setCollapsed((c) => !c)}
                  className={cn(
                    "flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm font-medium text-sidebar-foreground transition-colors",
                    "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                    "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    collapsed && "justify-center px-0",
                  )}
                >
                  {collapsed ? (
                    <ChevronsRight className="size-[18px] shrink-0" />
                  ) : (
                    <>
                      <ChevronsLeft className="size-[18px] shrink-0" />
                      <span>Collapse</span>
                    </>
                  )}
                </button>
              </TooltipTrigger>
              {collapsed && (
                <TooltipContent side="right">Expand sidebar</TooltipContent>
              )}
            </Tooltip>

            {!collapsed && (
              <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
                <Avatar className="size-8">
                  <AvatarFallback className="border border-border/70 bg-muted/60 text-xs font-semibold text-primary">
                    {initials(user?.name, user?.email)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {user?.name ?? "REX user"}
                  </p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {user?.email ?? "anonymous session"}
                  </p>
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* ---------- Main column ---------- */}
        <div
          className={cn(
            "flex min-h-dvh flex-col transition-[padding] duration-200",
            collapsed ? "lg:pl-16" : "lg:pl-64",
          )}
        >
          {/* Topbar */}
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-3 border-b border-border/70 bg-background/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-2.5 lg:hidden">
              <img
                src={logo}
                alt=""
                width={26}
                height={26}
                className="shrink-0 rounded-md"
              />
              <span className="truncate text-sm font-bold tracking-tight">
                REX OS
              </span>
            </div>
            <div className="hidden min-w-0 items-center gap-2 lg:flex">
              <h1 className="truncate text-sm font-semibold tracking-tight">
                {pageTitle}
              </h1>
              <span className="text-muted-foreground/40">/</span>
              <span className="truncate text-xs text-muted-foreground">
                rexos-node
              </span>
            </div>

            <div className="ml-auto flex items-center gap-2 sm:gap-3">
              <span className="hidden items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 sm:flex">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
                </span>
                All systems operational
              </span>
              <span className="hidden items-center gap-1.5 text-xs text-muted-foreground/70 md:flex">
                <Wifi className="size-3.5 text-muted-foreground/60" />
                <span className="font-mono text-[11px]">192.168.1.42</span>
              </span>
              <Clock />
              <div className="lg:hidden">{userMenu}</div>
            </div>
          </header>

          {/* Content */}
          <main className="flex-1 px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-7">
            <div className="mx-auto w-full max-w-[1560px]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={location.pathname}
                  initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
                  transition={{ duration: 0.24, ease: "easeOut" }}
                >
                  <Outlet />
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>

        {/* ---------- Mobile / tablet bottom nav ---------- */}
        <nav
          aria-label="Primary"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border/80 bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
        >
          <div className="mx-auto grid max-w-lg grid-cols-4">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                    "outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    isActive
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground",
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <motion.span
                        layoutId="bottom-nav-indicator"
                        className="absolute top-0 h-0.5 w-8 rounded-full bg-primary"
                        transition={{ duration: 0.25 }}
                      />
                    )}
                    <item.icon className="size-5" />
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </TooltipProvider>
  );
}
