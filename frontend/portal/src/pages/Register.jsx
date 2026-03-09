// Import necessary React hooks and routing tools
import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

// Helper function to get asset URL with correct base path
const getAssetUrl = (path) => {
  const base = import.meta.env.BASE_URL || "/";
  return `${base}${path.startsWith("/") ? path.slice(1) : path}`;
};

/**
 * Register Component
 * Handles user registration for Te Waihora Trail management portal
 * Allows new users to create an account using email, password, and name
 */
export default function Register() {
  // Navigation hook - used to redirect users after successful registration
  const navigate = useNavigate();

  // Location hook - captures where the user came from (for post-login redirect)
  const location = useLocation();

  // Extract authentication methods and state from AuthContext
  const { register, status, isAuthenticated } = useAuth();

  const fallbackPath = "/activities";
  const from = location.state?.from?.pathname || null;

  // Form state - stores user input for registration fields
  const [form, setForm] = useState({
    name: "", // User display name (optional)
    email: "", // User email address (required)
    password: "", // User password (required, minimum 8 characters)
    confirmPassword: "", // Confirm password (required, must match password)
  });

  // Error state - stores validation or registration error messages
  const [error, setError] = useState("");

  /**
   * Side effect: Redirect authenticated users
   * If the user is already logged in, redirect them to the target page
   * This prevents authenticated users from accessing the registration page
   */
  useEffect(() => {
    if (isAuthenticated) {
      navigate(from || fallbackPath, { replace: true });
    }
  }, [from, isAuthenticated, navigate]);

  /**
   * Handle input field changes
   * Updates form state when user types in any input field
   * @param {Event} event - The input change event
   */
  const handleChange = (event) => {
    const { name, value } = event.target;
    // Only update the changed field while preserving other fields
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  /**
   * Handle form submission
   * Validates input and attempts to register the user
   * @param {Event} event - The form submission event
   */
  const handleSubmit = async (event) => {
    // Prevent default form submission (page reload)
    event.preventDefault();

    // Clear previous error messages
    setError("");

    // Validation: Check if email and password are provided
    if (!form.email.trim() || !form.password.trim()) {
      setError("Email and password are required.");
      return;
    }

    // Validation: Ensure password meets minimum length requirement
    if (form.password.trim().length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    // Validation: Ensure both passwords match
    if (form.password !== form.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      const created = await register({
        email: form.email.trim(),
        password: form.password,
        name: form.name.trim(),
      });

      const target =
        from || (created?.role === "admin" ? "/dashboard" : "/activities");
      navigate(target, { replace: true });
    } catch (err) {
      // Log error for debugging
      console.error(err);

      // Display user-friendly error message
      setError(
        err?.message || "Unable to create your account. Please try again."
      );
    }
  };

  // Render registration form UI
  return (
    // Full-screen container with gradient background
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-emerald-50 to-white px-4">
      {/* Registration card container */}
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        {/* Header section with logo and title */}
        <div className="mb-6 text-center">
          {/* Te Waihora Trail logo */}
          <img
            src={getAssetUrl("/assets/icons/logo_te_waihora.svg")}
            alt="Te Waihora Trail Logo"
            className="mx-auto mb-3 h-16 w-auto"
          />
          {/* Page title */}
          <h1 className="text-2xl font-semibold text-gray-900">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Sign up to access the Te Waihora Trail portal.
          </p>
        </div>

        {/* Registration form */}
        <form className="space-y-4" onSubmit={handleSubmit}>
          {/* Name input field (optional) */}
          <div>
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="name"
            >
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              placeholder="Kia ora"
            />
          </div>

          {/* Email input field (required) */}
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
              autoComplete="email" // Enable browser autocomplete
              value={form.email}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              placeholder="you@example.org"
              required // HTML5 validation
            />
          </div>

          {/* Password input field (required, min 8 characters) */}
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
              autoComplete="new-password" // Hint for password managers
              value={form.password}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              placeholder="At least 8 characters"
              required // HTML5 validation
            />
          </div>

          {/* Confirm Password input field (required, must match password) */}
          <div>
            <label
              className="block text-sm font-medium text-gray-700"
              htmlFor="confirmPassword"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password" // Hint for password managers
              value={form.confirmPassword}
              onChange={handleChange}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900/20"
              placeholder="Re-enter your password"
              required // HTML5 validation
            />
          </div>

          {/* Error message display (conditional rendering) */}
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {/* Submit button - disabled during registration process */}
          <button
            type="submit"
            className="w-full rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
            disabled={status === "pending"} // Disable while processing
          >
            {/* Dynamic button text based on registration status */}
            {status === "pending" ? "Creating account…" : "Create account"}
          </button>
        </form>

        {/* Login page link for users who already have an account */}
        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link
            className="font-medium text-emerald-600 hover:text-emerald-700"
            to="/login"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
