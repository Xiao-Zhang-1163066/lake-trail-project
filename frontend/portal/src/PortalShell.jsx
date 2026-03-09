import React from "react";

/**
 * Te Waihora Trail — Admin Portal Shell
 * Responsive layout with sidebar, topbar, and content slots.
 * TailwindCSS utility classes only (no external UI deps).
 *
 * Drop-in usage:
 *   - Place this file at: frontend/portal/src/PortalShell.jsx
 *   - Import and render <PortalShell /> from your router or main entry.
 *   - Replace the placeholders with real routes/pages later.
 */

function NavItem({ icon, label, active = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className={
        "flex items-center gap-3 w-full rounded-xl px-3 py-2 text-left transition " +
        (active
          ? "bg-gray-900/90 text-white shadow"
          : "text-gray-700 hover:bg-gray-100")
      }
      aria-current={active ? "page" : undefined}
    >
      <span
        aria-hidden
        className="inline-flex w-5 h-5 items-center justify-center"
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function StatCard({ title, value, hint }) {
  return (
    <div className="rounded-2xl border border-gray-200 p-4 shadow-sm bg-white">
      <div className="text-sm text-gray-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-gray-400">{hint}</div>}
    </div>
  );
}

function PlaceholderTable() {
  return (
    <div className="overflow-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-gray-600">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Updated</th>
            <th className="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 6 }).map((_, i) => (
            <tr key={i} className="border-t">
              <td className="px-4 py-3">Item {i + 1}</td>
              <td className="px-4 py-3">Trail Segment</td>
              <td className="px-4 py-3">
                <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs text-green-700 ring-1 ring-inset ring-green-200">
                  Active
                </span>
              </td>
              <td className="px-4 py-3">2025-09-26</td>
              <td className="px-4 py-3 text-right">
                <button className="rounded-lg px-2 py-1 text-sm text-gray-700 hover:bg-gray-100">
                  Edit
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PlaceholderForm() {
  return (
    <form className="space-y-3">
      <div>
        <label className="block text-sm text-gray-600 mb-1">Title</label>
        <input
          className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="Trail section title"
        />
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Category</label>
        <select className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900">
          <option>POI</option>
          <option>Amenity</option>
          <option>Alert</option>
        </select>
      </div>
      <div>
        <label className="block text-sm text-gray-600 mb-1">Description</label>
        <textarea
          rows={4}
          className="w-full rounded-xl border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-gray-900"
          placeholder="Notes, instructions, safety info…"
        />
      </div>
      <div className="flex items-center justify-between">
        <div className="text-xs text-gray-500">Autosaves coming soon</div>
        <div className="space-x-2">
          <button
            type="button"
            className="rounded-xl px-3 py-2 text-sm hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black"
          >
            Save
          </button>
        </div>
      </div>
    </form>
  );
}

export default function PortalShell() {
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [active, setActive] = React.useState("Dashboard");

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Topbar */}
      <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-gray-100 lg:hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle sidebar"
            >
              ☰
            </button>
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-xl bg-gray-900 text-white grid place-items-center text-sm font-bold">
                TW
              </div>
              <span className="font-semibold">
                Te Waihora Trail · Admin Portal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              className="hidden sm:block w-56 rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
              placeholder="Search…"
            />
            <button className="rounded-xl px-3 py-2 text-sm hover:bg-gray-100">
              Help
            </button>
            <button
              className="rounded-full h-9 w-9 bg-gray-200 hover:bg-gray-300"
              aria-label="Profile"
            />
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6 py-6">
        {/* Sidebar */}
        <aside
          className={
            "lg:sticky lg:top-16 lg:self-start lg:h-[calc(100vh-5rem)] lg:overflow-y-auto " +
            (sidebarOpen ? "block" : "hidden lg:block")
          }
        >
          <nav className="space-y-2">
            {[
              "Dashboard",
              "Trails",
              "POIs",
              "Volunteers",
              "Project Updates",
              "Settings",
            ].map((item) => (
              <NavItem
                key={item}
                label={item}
                icon="•"
                active={active === item}
                onClick={() => setActive(item)}
              />
            ))}
          </nav>

          <div className="mt-6 rounded-2xl border border-gray-200 p-4 bg-white">
            <div className="text-sm font-medium">Quick tips</div>
            <ul className="mt-2 list-disc pl-5 text-sm text-gray-600 space-y-1">
              <li>Use the left nav to switch modules.</li>
              <li>Click Save to persist changes.</li>
              <li>Keyboard: “/” to focus search.</li>
            </ul>
          </div>
        </aside>

        {/* Main content */}
        <main className="space-y-6">
          {/* Breadcrumbs */}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Admin</span>
            <span>›</span>
            <span className="text-gray-900 font-medium">{active}</span>
          </div>

          {/* Page header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">
                {active}
              </h1>
              <p className="text-sm text-gray-500">
                Manage {active.toLowerCase()} for the public site.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
                Export
              </button>
              <button className="rounded-xl bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-black">
                New
              </button>
            </div>
          </div>

          {/* Dashboard widgets */}
          {active === "Dashboard" && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Total POIs" value="128" hint="+4 this week" />
                <StatCard title="Volunteers" value="36" hint="2 pending" />
                <StatCard title="Open Alerts" value="3" hint="1 critical" />
                <StatCard title="Edits" value="57" hint="Last 30 days" />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <PlaceholderTable />
                </div>
                <div className="lg:col-span-1 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                  <div className="text-sm font-medium">Recent activity</div>
                  <ol className="mt-3 space-y-3 text-sm text-gray-600">
                    <li>✅ Published POI “Lakeside Shelter”</li>
                    <li>🗺️ Updated trail geometry (South Loop)</li>
                    <li>👤 New volunteer registered</li>
                  </ol>
                </div>
              </div>
            </>
          )}

          {/* Trails / POIs module examples */}
          {(active === "Trails" || active === "POIs") && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-4">
                <PlaceholderTable />
              </div>
              <div className="lg:col-span-1 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                <div className="text-sm font-medium mb-3">
                  Edit {active.slice(0, -1)}
                </div>
                <PlaceholderForm />
              </div>
            </div>
          )}

          {/* Volunteers / Content / Settings stubs */}
          {(active === "Volunteers" ||
            active === "Project Updates" ||
            active === "Settings") && (
            <div className="rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-500 bg-white">
              <div className="text-lg font-medium mb-1">{active} module</div>
              <p className="text-sm">
                Wire this up to your API (Azure Functions) when ready. Replace
                this box with real views.
              </p>
            </div>
          )}

          <footer className="pt-4 text-center text-xs text-gray-400">
            © {new Date().getFullYear()} Te Waihora Trail · Admin
          </footer>
        </main>
      </div>
    </div>
  );
}

/* ----------------------------------------------
 * Recommended src/ structure (for beginners)
 * ----------------------------------------------
 *
 * src/
 * ├─ main.jsx           // App entry (bootstraps React)
 * ├─ index.css          // Tailwind entry
 * ├─ App.jsx            // Router + high-level layout wrapper
 * ├─ layouts/
 * │   └─ PortalLayout.jsx   // Split the shell into a reusable layout
 * ├─ components/
 * │   ├─ Sidebar.jsx
 * │   ├─ Topbar.jsx
 * │   ├─ StatCard.jsx
 * │   ├─ PlaceholderTable.jsx
 * │   └─ PlaceholderForm.jsx
 * └─ pages/
 *     ├─ Dashboard.jsx
 *     ├─ Trails.jsx
 *     ├─ POIs.jsx
 *     ├─ Volunteers.jsx
 *     ├─ Content.jsx
 *     └─ Settings.jsx
 *
 * You can start with the single-file PortalShell.jsx. When you feel ready,
 * create these files and move the corresponding parts out of PortalShell.jsx.
 * Below are minimal skeletons you can copy-paste.
 */

// ======================= src/App.jsx =======================

// Usage: in main.jsx import { App } from './App' and render <App />

// =================== src/layouts/PortalLayout.jsx ===================

// =================== src/components/Topbar.jsx ===================

// =================== src/components/Sidebar.jsx ===================
// (kept minimal; we built links directly inside PortalLayout with NavLink)

// =================== src/components/StatCard.jsx ===================
