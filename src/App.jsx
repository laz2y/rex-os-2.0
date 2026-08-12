import { useState } from "react";
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
import DirectLink from "./pages/DirectLink";
import Downloads from "./pages/Downloads";
import Media from "./pages/Media";
import Cloud from "./pages/Cloud";
import Photos from "./pages/Photos";
import Docker from "./pages/Docker";
import System from "./pages/System";
import Settings from "./pages/Settings";

/** Scrolls to the top and replays the page transition on route change. */
function PageTransition() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);

  return (
    <div key={location.pathname} className="page-enter">
      <Routes location={location}>
        <Route path="/" element={<Home />} />
        <Route path="/direct-link" element={<DirectLink />} />
        <Route path="/downloads" element={<Downloads />} />
        <Route path="/media" element={<Media />} />
        <Route path="/cloud" element={<Cloud />} />
        <Route path="/photos" element={<Photos />} />
        <Route path="/docker" element={<Docker />} />
        <Route path="/system" element={<System />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Home />} />
      </Routes>
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
