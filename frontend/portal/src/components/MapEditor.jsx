import React, { useState, useEffect } from "react";
import POIManager from "./POIManager.jsx";
import TrailManager from "./TrailManager.jsx";

export default function MapEditor({ mode }) {
  if (mode === "pois") {
    return <POIManager />;
  }

  if (mode === "trails") {
    return <TrailManager />;
  }

  return null;
}
