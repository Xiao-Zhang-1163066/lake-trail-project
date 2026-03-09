import { Link } from "react-router-dom";

/**
 * DashboardCard Component
 * A reusable card component for displaying statistics on the dashboard
 *
 * @param {string} to - The route path to navigate to when clicked
 * @param {string} title - The card title
 * @param {number|string} value - The main statistic value to display
 * @param {string} description - The description text below the value
 * @param {string} iconBgColor - Tailwind color class for icon background (e.g., "bg-emerald-100")
 * @param {string} iconColor - Tailwind color class for icon (e.g., "text-emerald-600")
 * @param {React.ReactNode} icon - The SVG icon element
 */
export default function DashboardCard({
  to,
  title,
  value,
  description,
  iconBgColor,
  iconColor,
  icon,
}) {
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-xl hover:-translate-y-1"
    >
      <div className="relative">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <div className="mt-1 text-5xl font-bold text-gray-900">{value}</div>
            <p className="mt-0.5 text-sm text-gray-500">{description}</p>
          </div>
          <div
            className={`flex h-14 w-14 items-center justify-center rounded-2xl ${iconBgColor} ${iconColor}`}
          >
            {icon}
          </div>
        </div>
      </div>
    </Link>
  );
}
