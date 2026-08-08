import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import "./styles/theme.css";
import "./styles/animations.css";
import "./App.css";

import App from "./App";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <>
      <App />

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
  </StrictMode>
);