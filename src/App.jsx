import { lazy, Suspense, useState } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";

import "./App.css";

import { ThemeProvider } from "./hooks/useTheme";
import { AuthProvider } from "./hooks/useAuth";
import RequireAuth from "./components/RequireAuth";
import Sidebar from "./components/Sidebar";
import Header from "./components/dashboard/Header/Header";
import BottomNav from "./components/BottomNav";

import Login from "./pages/Login";
import Home from "./pages/Home";

// Pages beyond the shell are lazy-loaded so the initial bundle stays small
// and each route's JS/CSS is fetched only when first visited.
const DirectLink = lazy(() => import("./pages/DirectLink"));
const Downloads = lazy(() => import("./pages/Downloads"));
const Pipeline = lazy(() => import("./pages/Pipeline"));
const Media = lazy(() => import("./pages/Media"));
const Cloud = lazy(() => import("./pages/Cloud"));
const Photos = lazy(() => import("./pages/Photos"));
const Docker = lazy(() => import("./pages/Docker"));
const System = lazy(() => import("./pages/System"));
const Diagnostics = lazy(() => import("./pages/Diagnostics"));
const Activity = lazy(() => import("./pages/Activity"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Settings = lazy(() => import("./pages/Settings"));
const Storage = lazy(() => import("./pages/Storage"));
const Updates = lazy(() => import("./pages/Updates"));
const Backups = lazy(() => import("./pages/Backups"));
const Recovery = lazy(() => import("./pages/Recovery"));

/** Lightweight fallback while a lazy page chunk loads. */
function PageFallback() {
  return (
    <div className="page" aria-busy="true">
      <div className="skeleton sk-title" />
      <div className="skeleton sk-sub" />
      <div className="skeleton sk-line" />
      <div className="skeleton sk-line" />
    </div>
  );
}

/** Scrolls to the top and replays the page transition on route change. */
function PageTransition() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  return (
    <div key={location.pathname} className="page-enter">
      <Suspense fallback={<PageFallback />}>
        <Routes location={location}>
          <Route path="/" element={<Home />} />
          <Route path="/direct-link" element={<DirectLink />} />
          <Route path="/downloads" element={<Downloads />} />
          <Route path="/pipeline" element={<Pipeline />} />
          <Route path="/media" element={<Media />} />
          <Route path="/cloud" element={<Cloud />} />
          <Route path="/photos" element={<Photos />} />
          <Route path="/docker" element={<Docker />} />
          <Route path="/system" element={<System />} />
          <Route path="/storage" element={<Storage />} />
          <Route path="/diagnostics" element={<Diagnostics />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/updates" element={<Updates />} />
          <Route path="/backups" element={<Backups />} />
          <Route path="/recovery" element={<Recovery />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </div>
  );
}

/** The authenticated application shell (sidebar + header + pages). */
function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="app">
      <Sidebar open={menuOpen} onClose={() => setMenuOpen(false)} />

      <main className="content">
        <Header onMenu={() => setMenuOpen(true)} />

        <PageTransition />
      </main>

      <BottomNav />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          {/* Selectable anime artwork layer (see themes/themeManager.js) */}
          <div className="theme-bg" aria-hidden="true" />

          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/*"
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
