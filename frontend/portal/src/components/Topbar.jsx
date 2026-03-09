import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

// Helper function to get asset URL with correct base path
const getAssetUrl = (path) => {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${path.startsWith("/") ? path.slice(1) : path}`;
};

export default function Topbar({ onToggle }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const role = user?.role || "volunteer";
  const name = (user?.name || "").trim();
  const email = (user?.email || "").trim();
  const displayName =
    name || email || (role === "admin" ? "Admin" : "Volunteer");
  const initials = (displayName || "??")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = () => {
    logout();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-30 shadow-sm bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl hover:bg-gray-100 lg:hidden"
            onClick={onToggle}
            aria-label="Toggle sidebar"
          >
            ☰
          </button>
          <div className="flex items-center gap-2">
            <img
              src={getAssetUrl("/assets/icons/logo_te_waihora.svg")}
              alt="Te Waihora Trail Logo"
              className="h-8 w-auto"
            />
            <span className="font-semibold">
              Te Waihora Trail · {role === "admin" ? "Admin" : "Volunteer"}{" "}
              Portal
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-xs text-gray-700">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
              {initials}
            </span>
            <div className="flex flex-col leading-tight">
              <span className="text-[10px] uppercase tracking-wide text-gray-500">
                {role === "admin" ? "Admin" : "Volunteer"}
              </span>
              <span className="font-medium text-gray-900 truncate max-w-[10rem] text-sm">
                {displayName}
              </span>
              {role !== "admin" && email ? (
                <span className="text-[11px] text-gray-500 truncate max-w-[10rem]">
                  {email}
                </span>
              ) : null}
            </div>
            <Link
              to="/profile"
              className="hidden text-xs font-medium text-emerald-600 hover:text-emerald-700 lg:inline"
            >
              Profile
          </Link>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-xl px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100"
        >
          Log out
        </button>
      </div>
      </div>
    </header>
  );
}
