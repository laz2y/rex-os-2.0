import "./Terminal.css";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CornerDownLeft,
  Lock,
  Play,
  RefreshCw,
  Square,
  Terminal as TerminalIcon,
  Trash2,
  X,
} from "lucide-react";

import {
  closeTerminalSession,
  createTerminalSession,
  getTerminalInfo,
  interruptTerminalSession,
  readTerminalOutput,
  sendTerminalInput,
} from "../api/terminal";
import { error as toastError, success } from "../services/toastService";

const POLL_MS = 600;

export default function TerminalPage() {
  const [info, setInfo] = useState(null);
  const [session, setSession] = useState(null);
  const [starting, setStarting] = useState(false);
  const [output, setOutput] = useState("");
  const [input, setInput] = useState("");
  const [exited, setExited] = useState(false);
  const [exitCode, setExitCode] = useState(null);
  const [infoError, setInfoError] = useState(null);
  const outputRef = useRef(null);
  const inputRef = useRef(null);

  // Load session info once on mount.
  useEffect(() => {
    let active = true;
    getTerminalInfo()
      .then((data) => {
        if (active) setInfo(data);
      })
      .catch((err) => {
        console.error("[REX OS] terminal info failed:", err);
        if (active) setInfoError(err);
      });
    return () => {
      active = false;
    };
  }, []);

  // Create a fresh session when the page mounts (authenticated route).
  useEffect(() => {
    let active = true;
    setStarting(true);
    createTerminalSession()
      .then((data) => {
        if (active) {
          setSession(data);
          setExited(false);
          setExitCode(null);
          setOutput("");
        }
      })
      .catch((err) => {
        console.error("[REX OS] terminal session create failed:", err);
        if (active) toastError("Could not start a terminal session");
      })
      .finally(() => {
        if (active) setStarting(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Drain output while the session is alive.
  useEffect(() => {
    if (!session) return undefined;
    let active = true;

    const tick = async () => {
      if (!active) return;
      try {
        const result = await readTerminalOutput(session.id);
        if (!active) return;
        if (result.output) setOutput((current) => current + result.output);
        if (result.exited && !exited) {
          setExited(true);
          setExitCode(result.exitCode);
        }
      } catch (err) {
        console.error("[REX OS] terminal read failed:", err);
        if (active) setExited(true);
      }
    };

    tick();
    const timer = setInterval(tick, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [session, exited]);

  // Keep the terminal scrolled to the bottom.
  useEffect(() => {
    const el = outputRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [output]);

  // Keep focus in the input box.
  useEffect(() => {
    if (session && !exited && inputRef.current) inputRef.current.focus();
  }, [session, exited]);

  async function handleSend(event) {
    event.preventDefault();
    if (!session || exited || !input.trim()) return;
    const command = input;
    setInput("");
    try {
      await sendTerminalInput(session.id, command + "\n");
    } catch (err) {
      console.error("[REX OS] terminal send failed:", err);
      toastError("Failed to send input");
    }
  }

  async function handleInterrupt() {
    if (!session) return;
    try {
      await interruptTerminalSession(session.id);
    } catch (err) {
      console.error("[REX OS] terminal interrupt failed:", err);
      toastError("Interrupt failed");
    }
  }

  async function handleClose() {
    if (!session) return;
    try {
      await closeTerminalSession(session.id);
      success("Session closed");
    } catch (err) {
      console.error("[REX OS] terminal close failed:", err);
      toastError("Failed to close session");
    }
    setSession(null);
    setOutput("");
    setExited(false);
    setExitCode(null);
  }

  async function handleNewSession() {
    if (session) await handleClose();
    setStarting(true);
    try {
      const data = await createTerminalSession();
      setSession(data);
      setExited(false);
      setExitCode(null);
      setOutput("");
    } catch (err) {
      console.error("[REX OS] terminal session create failed:", err);
      toastError("Could not start a terminal session");
    } finally {
      setStarting(false);
    }
  }

  return (
    <div className="page">
      <div className="page-head fade-up">
        <h1>Terminal</h1>
        <p>Secure administrative shell</p>

        {info && (
          <div className="term-head-actions">
            <span className="term-shell-chip">
              {info.shell} · {info.activeSessions}/{info.maxSessions} active
            </span>
          </div>
        )}
      </div>

      <div className="term-notice fade-up d-1">
        <Lock size={16} />
        <div>
          <strong>Authenticated session only</strong>
          <span>
            Commands run as the same user/container the REX OS backend runs as — not a host root
            shell. Sessions are capped, idle-expire, and terminate cleanly.
          </span>
        </div>
      </div>

      {info && !info.ptySupported && (
        <div className="term-warn fade-up d-1">
          <AlertTriangle size={16} />
          <div>
            <strong>Reduced interactivity</strong>
            <span>
              PTY support is not available on this host. Full-screen apps (top, editors) may not
              render correctly — prefer plain commands.
            </span>
          </div>
        </div>
      )}

      {infoError && (
        <div className="offline-strip fade-up d-1">
          <span>Terminal information unavailable — the backend may be restarting.</span>
          <button type="button" onClick={() => window.location.reload()}>
            <RefreshCw size={13} />
            Reload
          </button>
        </div>
      )}

      <div className="term-window fade-up d-2">
        <div className="term-window-head">
          <div className="term-dots">
            <i /> <i /> <i />
          </div>
          <span className="term-title">
            <TerminalIcon size={14} />
            {session ? `REX OS shell · ${session.shell}` : "terminal"}
            {exited && <em>exited</em>}
          </span>

          <div className="term-window-actions">
            {session && !exited && (
              <button type="button" onClick={handleInterrupt} title="Send Ctrl+C (interrupt)" aria-label="Interrupt (Ctrl+C)">
                <X size={15} />
              </button>
            )}
            {session && (
              <button type="button" onClick={handleClose} title="Close session" aria-label="Close session">
                <Trash2 size={15} />
              </button>
            )}
            <button type="button" onClick={handleNewSession} title="New session" aria-label="New session" disabled={starting}>
              <RefreshCw size={15} className={starting ? "spin" : ""} />
            </button>
          </div>
        </div>

        <div className="term-body" ref={outputRef}>
          {starting && (
            <p className="term-boot">
              <span className="term-cursor blink" />
              starting shell…
            </p>
          )}

          {!starting && !session && (
            <p className="term-empty">Session closed — start a new one.</p>
          )}

          {output && <pre className="term-output">{output}</pre>}

          {exited && (
            <p className="term-exit">
              Process exited with code {exitCode ?? "unknown"}
              {session && (
                <button type="button" className="term-new" onClick={handleNewSession}>
                  <Play size={13} />
                  New session
                </button>
              )}
            </p>
          )}
        </div>

        <form className="term-input-row" onSubmit={handleSend}>
          <span className="term-prompt">rexos$</span>
          <input
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={session && !exited ? "type a command and press Enter" : "start a session first"}
            disabled={!session || exited}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck="false"
            aria-label="Terminal input"
          />
          <button
            type="submit"
            disabled={!session || exited || !input.trim()}
            title="Run"
            aria-label="Run command"
          >
            <CornerDownLeft size={15} />
          </button>
        </form>
      </div>

      <div className="term-foot fade-up d-3">
        <Square size={13} />
        <span>
          Privilege level: <strong>{info ? info.privilege : "loading…"}</strong>
        </span>
        {info && (
          <span className="term-foot-muted">
            · idle expiry {Math.round(info.idleMs / 60000)} min · resize not supported
          </span>
        )}
      </div>
    </div>
  );
}
