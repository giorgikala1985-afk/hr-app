import React from 'react';
import './TableSkeleton.css';

function darken(hex, amt = 0.28) {
  const c = hex.replace('#', '');
  const full = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return hex;
  const r = Math.round(((num >> 16) & 255) * (1 - amt));
  const g = Math.round(((num >> 8) & 255) * (1 - amt));
  const b = Math.round((num & 255) * (1 - amt));
  return `rgb(${r},${g},${b})`;
}

const DEFAULT_COLS = [
  { width: '10%' }, { width: '12%' }, { width: '20%' }, { width: '14%' },
  { width: '10%', align: 'right' }, { width: '8%' }, { width: '9%' },
];

// Shared shimmering-row loading state for any data table/list/matrix.
// icon: small ReactNode (≈12x12) shown inside a colored circular badge.
// color: module accent color — the badge and circle use this + an auto-darkened shade.
// label: text next to the icon (defaults to a generic "Loading…").
// rows: number of skeleton rows to render.
// cols: array of { width: '12%' } or { size: 18 } (square, e.g. for icon/status columns) and optional { align: 'right' }.
export default function TableSkeleton({ icon, color = '#479c73', label, rows = 8, cols = DEFAULT_COLS }) {
  return (
    <div className="ts-skeleton">
      <div className="ts-skeleton-header">
        <span className="ts-skeleton-icon" style={{ background: `linear-gradient(135deg, ${color}, ${darken(color)})` }}>
          {icon}
        </span>
        <span className="ts-skeleton-label">{label}</span>
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="ts-skeleton-row">
          {cols.map((col, i) => {
            // Deterministic per-row jitter so bars don't look like a mechanically
            // repeated grid — real data rows never line up that perfectly.
            const jitter = col.width ? 1 + (((row * 7 + i * 13) % 5) - 2) * 0.035 : 1;
            const width = col.size ?? (col.width ? `calc(${col.width} * ${jitter.toFixed(3)})` : undefined);
            return (
              <div
                key={i}
                className="ts-skeleton-bar"
                style={{
                  width,
                  height: col.size,
                  borderRadius: col.size ? 5 : undefined,
                  marginLeft: col.align === 'right' ? 'auto' : undefined,
                  animationDelay: `${row * 0.06 + i * 0.03}s`,
                }}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}
