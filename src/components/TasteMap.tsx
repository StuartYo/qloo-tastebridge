"use client";
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { HeatPoint } from "@/lib/types";

export interface MapMarker { lat: number; lon: number; label: string; sub?: string }

export default function TasteMap({ center, zoom = 13, markers, heat = [] }: { center: [number, number]; zoom?: number; markers: MapMarker[]; heat?: HeatPoint[] }) {
  const el = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!el.current) return;
    const map = L.map(el.current, { scrollWheelZoom: false }).setView(center, zoom);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "© OpenStreetMap contributors" }).addTo(map);
    for (const h of heat) L.circle([h.lat, h.lon], { radius: 420, stroke: false, fillColor: "#b42318", fillOpacity: Math.min(0.45, h.affinity * 0.5) }).addTo(map);
    markers.forEach((m, i) => {
      L.circleMarker([m.lat, m.lon], { radius: 8, color: "#fff", weight: 2, fillColor: "#1c1917", fillOpacity: 0.9 })
        .bindTooltip(`${i + 1}. ${m.label}`, { direction: "top" })
        .bindPopup(`<strong>${i + 1}. ${escapeHtml(m.label)}</strong>${m.sub ? `<br/>${escapeHtml(m.sub)}` : ""}`)
        .addTo(map);
    });
    if (markers.length > 1) map.fitBounds(L.latLngBounds(markers.map(m => [m.lat, m.lon])), { padding: [30, 30], maxZoom: 15 });
    return () => { map.remove(); };
  }, [center, zoom, markers, heat]);
  return <div ref={el} className="h-72 w-full overflow-hidden rounded-lg border border-stone-200 sm:h-96" />;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
