import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

// Helper function to get asset URL with correct base path
const getAssetUrl = (path) => {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${path.startsWith("/") ? path.slice(1) : path}`;
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, status, isAuthenticated } = useAuth();
  const fallbackPath = "/activities";
  const from = location.state?.from?.pathname || null;
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from || fallbackPath, { replace: true });
    }
  }, [fallbackPath, from, isAuthenticated, navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    if (!form.email.trim() || !form.password.trim()) {
      setError("Email and password are required.");
      return;
    }
    try {
      const loggedIn = await login({
        email: form.email.trim(),
        password: form.password,
      });
      const target =
        from || (loggedIn?.role === "admin" ? "/dashboard" : "/activities");
      navigate(target, { replace: true });
    } catch (err) {
      console.error(err);
      setError(err?.message || "Unable to sign in. Please try again.");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-white px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <img
            src={getAssetUrl("/assets/icons/logo_te_waihora.svg")}
            alt="Te Waihora Trail Logo"
            className="mx-auto mb-3 h-16 w-auto"
          />
          <h1 className="text-2xl font-semibold text-gray-900">Portal login</h1>
          <p className="mt-1 text-sm text-gray-500">
            Welcome back! Sign in to manage your Te Waihora Trail activity.
          </p>
        </div>
        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="email"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              placeholder="you@example.org"
              required
            />
          </div>
          <div>
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="password"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              placeholder="Enter your password"
              required
            />
          </div>
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:bg-gray-400"
            disabled={status === "pending"}
          >
            {status === "pending" ? "Signing in…" : "Sign in"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-500">
          Need an account?{" "}
          <Link
            className="font-medium text-emerald-600 hover:text-emerald-700"
            to="/register"
          >
            Register here
          </Link>
        </p>
      </div>
    </div>
  );
}
