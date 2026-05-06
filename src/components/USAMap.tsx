'use client';

import React from 'react';
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
  Annotation
} from 'react-simple-maps';
import { motion } from 'framer-motion';

const geoUrl = '/data/states-10m.json';

interface MapPoint {
  id: string;
  coordinates: [number, number]; // [longitude, latitude]
  label: string;
  signals: number;
  confidenceLevel: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface USAMapProps {
  points: MapPoint[];
  onPointClick: (point: MapPoint) => void;
  selectedPointId?: string;
}

export default function USAMap({ points, onPointClick, selectedPointId }: USAMapProps) {
  const getColor = (level: string) => {
    if (level === 'HIGH') return '#10b981'; // Emerald
    if (level === 'MEDIUM') return '#f59e0b'; // Amber/Yellow
    return '#64748b'; // Slate
  };

  const getGlow = (level: string) => {
    if (level === 'HIGH') return 'rgba(16, 185, 129, 0.4)';
    if (level === 'MEDIUM') return 'rgba(245, 158, 11, 0.4)';
    return 'rgba(100, 116, 139, 0.4)';
  };

  return (
    <div className="relative w-full bg-slate-950/50 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
      <ComposableMap 
        projection="geoAlbersUsa"
        className="w-full h-auto"
      >
        <Geographies geography={geoUrl}>
          {({ geographies }) =>
            geographies.map((geo) => (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill="#0f172a"
                stroke="#1e293b"
                strokeWidth={0.5}
                style={{
                  default: { outline: "none" },
                  hover: { fill: "#1e293b", outline: "none" },
                  pressed: { outline: "none" },
                }}
              />
            ))
          }
        </Geographies>

        {points.map((point) => (
          <Marker key={point.id} coordinates={point.coordinates}>
            <g 
              onClick={() => onPointClick(point)}
              className="cursor-pointer"
            >
              {/* Marker Core */}
              <motion.circle
                r={selectedPointId === point.id ? 6 : 4}
                fill={selectedPointId === point.id ? getColor(point.confidenceLevel) : "#020617"}
                stroke={getColor(point.confidenceLevel)}
                strokeWidth={2}
                whileHover={{ r: 8 }}
                transition={{ type: "spring", stiffness: 300 }}
              />

              {/* Signal Count Badge */}
              {point.signals > 1 && (
                <text
                  textAnchor="middle"
                  y={-10}
                  className="fill-emerald-400 text-[8px] font-bold pointer-events-none"
                >
                  {point.signals}
                </text>
              )}
            </g>
          </Marker>
        ))}

        {/* Labels for Selected Hub */}
        {points.map((point) => (
          selectedPointId === point.id && (
            <Annotation
              key={`label-${point.id}`}
              subject={point.coordinates}
              dx={-30}
              dy={-30}
              connectorProps={{
                stroke: "#10b981",
                strokeWidth: 1,
                strokeLinecap: "round"
              }}
            >
              <text x="-8" textAnchor="end" alignmentBaseline="middle" fill="#f8fafc" className="text-[10px] font-bold uppercase tracking-widest">
                {point.label}
              </text>
            </Annotation>
          )
        ))}
      </ComposableMap>

      {/* Map Legend */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-2 p-4 bg-slate-950/80 backdrop-blur-md rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Verified Hub (High)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Speculative Signal (Med)</span>
        </div>
      </div>
    </div>
  );
}
