import React from "react";
import { Link } from "react-router-dom";

export default function StatCard({ title, value, hint, to }) {
  const content = (
    <>
      <div className="text-base font-semibold text-gray-900">{title}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight text-gray-900">
        {value}
      </div>
      {hint && <div className="mt-1 text-xs text-gray-500">{hint}</div>}
    </>
  );

  const className =
    "rounded-2xl border border-gray-200 p-4 shadow-sm bg-white transition hover:border-emerald-200 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500";

  if (to) {
    return (
      <Link to={to} className={`${className} block`} aria-label={title}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}
