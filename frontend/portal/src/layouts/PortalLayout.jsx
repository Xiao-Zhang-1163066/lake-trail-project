// Import necessary libraries and components from React and react-router-dom.
// Outlet is a placeholder for child routes, NavLink is for navigation.
import React from "react";
import { Outlet, NavLink } from "react-router-dom";
import Topbar from "../components/Topbar.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

// This is the main layout component for the admin portal.
// It defines the overall structure with a top bar, a sidebar, and a main content area.
export default function PortalLayout() {
  // State to manage the visibility of the sidebar on mobile devices.
  // `open` is a boolean, `setOpen` is the function to update it.
  const [open, setOpen] = React.useState(false);

  const { user } = useAuth();
  const role = user?.role || "volunteer";

  // Build navigation items based on the signed-in user's role.
  const items = React.useMemo(() => {
    if (role === "admin") {
      return [
        { to: "/dashboard", label: "Dashboard" },
        { to: "/edit-map", label: "Map Editor" },
        { to: "/volunteers", label: "Volunteers" },
        { to: "/contact", label: "Contact Submissions" },
        { to: "/newsletter", label: "Newsletter" },
        { to: "/gallery", label: "Gallery" },
        { to: "/content", label: "Project Updates" },
        { to: "/profile", label: "Account" },
      ];
    }
    return [
      { to: "/activities", label: "Activities" },
      { to: "/profile", label: "My profile" },
    ];
  }, [role]);

  return (
    // Root container for the entire portal layout.
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Topbar component. The `onToggle` prop is a function that flips the `open` state. */}
      <Topbar onToggle={() => setOpen(!open)} />
      {/* Main content grid. It's divided into two columns on large screens: one for the sidebar and one for the main content. */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 py-6">
        {/* Sidebar section. */}
        <aside
          className={
            // Conditionally apply 'block' or 'hidden' based on the `open` state for mobile.
            // On large screens ('lg:'), it's always 'block', sticky, and positioned correctly.
            (open ? "block " : "hidden ") +
            "lg:block lg:sticky lg:top-16 lg:self-start lg:h-[calc(100vh-5rem)] lg:overflow-y-auto"
          }
        >
          {/* Navigation menu within the sidebar. */}
          <nav className="space-y-2">
            {/* Map over the `items` array to create a NavLink for each item. */}
            {items.map((i) => (
              <NavLink
                key={i.to} // Unique key for each link.
                to={i.to} // The destination URL.
                // Dynamically set the className based on whether the link is active.
                className={
                  ({ isActive }) =>
                    "flex items-center gap-3 w-full rounded-xl px-3 py-2 text-left transition " +
                    (isActive
                      ? "bg-gray-900/90 text-white shadow" // Style for the active link.
                      : "text-gray-700 hover:bg-gray-100") // Style for inactive links.
                }
              >
                <span
                  aria-hidden
                  className="inline-flex w-5 h-5 items-center justify-center"
                >
                  •
                </span>
                <span className="truncate">{i.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>
        {/* Main content area. */}
        <main className="space-y-6">
          {/* The Outlet component renders the matched child route's component. */}
          {/* For example, if the URL is '/dashboard', the Dashboard component will be rendered here. */}
          <Outlet />
          {/* Footer for the portal. */}
          <footer className="pt-4 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} Te Waihora Trail ·{" "}
            {role === "admin" ? "Admin" : "Volunteer"} Portal
          </footer>
        </main>
      </div>
    </div>
  );
}
