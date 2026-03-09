import React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import PortalLayout from "./layouts/PortalLayout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import EditMap from "./pages/EditMap.jsx";
import Volunteers from "./pages/Volunteers.jsx";
import Content from "./pages/Content.jsx";
import Gallery from "./pages/Gallery.jsx";
import VolunteerActivities from "./pages/VolunteerActivities.jsx";
import Profile from "./pages/Profile.jsx";
import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import ContactSubmissions from "./pages/ContactSubmissions.jsx";
import NewsletterSubscribers from "./pages/NewsletterSubscribers.jsx";
import { useAuth } from "./contexts/AuthContext.jsx";

function RequireAuth({ children }) {
  const location = useLocation();
  const { initializing, isAuthenticated } = useAuth();

  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <span className="text-sm text-gray-500">Loading…</span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

function AdminRoute({ children }) {
  const { user } = useAuth();
  if ((user?.role || "volunteer") !== "admin") {
    return <Navigate to="/activities" replace />;
  }
  return children;
}

function LandingRedirect() {
  const { user } = useAuth();
  const role = user?.role || "volunteer";
  return (
    <Navigate to={role === "admin" ? "/dashboard" : "/activities"} replace />
  );
}

// This is the main App component where the application's routing logic is defined.
export function App() {
  return (
    // BrowserRouter is the router implementation for web browsers.
    // `basename` sets the base URL for all locations. If your app is served from a sub-directory on a server, you'll want to set this to the sub-directory.
    <BrowserRouter basename="/portal">
      {/* The <Routes> component is a container for a collection of <Route> elements. 
          It looks through its children <Route>s to find the best match for the current URL. */}
      <Routes>
        {/* This is a parent route. It renders the PortalLayout component.
            All nested child routes will be rendered inside the <Outlet /> component within PortalLayout. */}
        <Route
          element={
            <RequireAuth>
              <PortalLayout />
            </RequireAuth>
          }
        >
          {/* The `index` route specifies the default component to render for the parent route.
              Here, when the path is just `/` (matching the parent), it automatically navigates based on user role.
              The `replace` prop ensures this navigation doesn't add a new entry to the browser's history stack. */}
          <Route index element={<LandingRedirect />} />
          {/* Defines a route for the "/dashboard" path. When the URL matches, it renders the Dashboard component. */}
          <Route
            path="/dashboard"
            element={
              <AdminRoute>
                <Dashboard />
              </AdminRoute>
            }
          />
          <Route path="/activities" element={<VolunteerActivities />} />
          <Route path="/profile" element={<Profile />} />
          {/* Defines a route for the "/trails" path, rendering the Trails component. */}
          <Route
            path="/edit-map"
            element={
              <AdminRoute>
                <EditMap />
              </AdminRoute>
            }
          />
          {/* Defines a route for the "/volunteers" path, rendering the Volunteers component. */}
          <Route
            path="/volunteers"
            element={
              <AdminRoute>
                <Volunteers />
              </AdminRoute>
            }
          />
          <Route
            path="/gallery"
            element={
              <AdminRoute>
                <Gallery />
              </AdminRoute>
            }
          />
          {/* Defines a route for the "/content" path, rendering the Project Updates module. */}
          <Route
            path="/content"
            element={
              <AdminRoute>
                <Content />
              </AdminRoute>
            }
          />
          {/* Defines a route for the "/contact" path, rendering the ContactSubmissions component. */}
          <Route
            path="/contact"
            element={
              <AdminRoute>
                <ContactSubmissions />
              </AdminRoute>
            }
          />
          {/* Defines a route for the "/newsletter" path, rendering the NewsletterSubscribers component. */}
          <Route
            path="/newsletter"
            element={
              <AdminRoute>
                <NewsletterSubscribers />
              </AdminRoute>
            }
          />
        </Route>

        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<LandingRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}
