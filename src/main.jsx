import "@vly-ai/integrations";
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import "./index.css";
import "./styles/theme.css";
import "./styles/animations.css";

import App from "./App";
import { VlyToolbar } from "../vly-toolbar-readonly.tsx";
import { startPushMonitor } from "./services/pushService";

function useServiceWorker() {
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;

    let refreshed = false;

    // A new service worker activates as soon as it is installed (skipWaiting)
    // — reload once so the user lands on the freshly deployed build.
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshed) return;
      refreshed = true;
      window.location.reload();
    });

    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
}

function usePushNotifications() {
  useEffect(() => {
    // Graceful fallback: browser Notifications for new REX OS events while
    // the app is open. Only polls when the user enabled it in Settings.
    startPushMonitor();
  }, []);
}

function Root() {
  useServiceWorker();
  usePushNotifications();

  return (
    <>
      <App />

      <VlyToolbar />

      <ToastContainer
        position="bottom-right"
        autoClose={2500}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
        draggable
        theme="dark"
      />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
