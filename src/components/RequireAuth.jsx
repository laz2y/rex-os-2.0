import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";

/**
 * Protects the application shell. While the session cookie is being resolved
 * a minimal splash is shown; logged-out users are sent to /login and returned
 * to their intended destination after signing in.
 */
export default function RequireAuth({ children }) {
  const { user, checking } = useAuth();
  const location = useLocation();

  if (checking) {
    return (
      <div className="auth-splash">
        <div className="auth-splash-logo">⚓</div>
        <div className="skeleton sk-title-w" />
      </div>
    );
  }

  if (!user) {
    const returnTo = encodeURIComponent(
      location.pathname + location.search,
    );
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  return children;
}
