import DashboardLayout from "./dashboard/layout";

/**
 * Authenticated REX OS console. The shell (sidebar, topbar, mobile bottom
 * nav) lives in DashboardLayout; nested routes render the individual
 * console pages (overview, media, system, services).
 */
export default function Dashboard() {
  return <DashboardLayout />;
}
