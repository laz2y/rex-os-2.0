import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "../hooks/useAuth";
import BootScreen from "./BootScreen";

/**
 * Protects the application shell. While the session cookie is being resolved
 * the branded REX OS boot animation is shown; logged-out users are then sent
 * to /login and returned to their intended destination after signing in.
 */
export default function RequireAuth({ children }) {
  const { user, checking } = useAuth();
  const location = useLocation();

  if (checking) {
    return <BootScreen minMs={1300} />;
  }

  if (!user) {
    const returnTo = encodeURIComponent(
      location.pathname + location.search,
    );
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }

  return children;
}
