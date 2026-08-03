import React from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ── 5 validated categorical themes ──────────────────────────────────────────
// Each passes the dataviz skill's six checks (lightness band, chroma floor,
// CVD separation, normal-vision floor, contrast) on the light chart surface;
// WARN-band slots (CVD 6-8, sub-3:1 contrast) are shipped with a legend and
// direct value labels as the required secondary encoding.
const THEMES = [
  {
    key: 'signal',
    name: 'Signal',
    blurb: 'The vibrant, high-contrast default — bold and unambiguous.',
    colors: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  },
  {
    key: 'slate',
    name: 'Slate',
    blurb: 'Muted, desaturated — a calmer, corporate register.',
    colors: ['#447abf', '#d87753', '#50a981', '#dfa753', '#d987a4', '#347e30', '#4a4392', '#cf5f5a'],
  },
  {
    key: 'deep',
    name: 'Deep',
    blurb: 'Dark, saturated jewel tones — dramatic and dense.',
    colors: ['#004eb5', '#c53100', '#009b62', '#c27800', '#c24c7d', '#006a00', '#4c36b3', '#bd0013'],
  },
  {
    key: 'pastel',
    name: 'Pastel',
    blurb: 'Light and airy — soft fills for a gentler surface.',
    colors: ['#5c96e0', '#f9916b', '#6ac79c', '#d59b41', '#f68ab2', '#4d9a48', '#625db2', '#f17972'],
  },
  {
    key: 'mono',
    name: 'Mono + Accent',
    blurb: 'Editorial: neutral grays, one accent hue carries the story.',
    colors: ['#479c73', '#52514e', '#898781', '#b8b6ae', '#d4d2c9', '#0b0b0b', '#6b6a64', '#a3a19a'],
    accentFirst: true,
  },
];

// ── Shared sample data (identical across themes, so only color changes) ────
const BAR_DATA = [
  { name: 'Jan', value: 42 }, { name: 'Feb', value: 58 }, { name: 'Mar', value: 51 },
  { name: 'Apr', value: 67 }, { name: 'May', value: 74 }, { name: 'Jun', value: 61 },
];
const LINE_DATA = [
  { name: 'W1', a: 24, b: 18 }, { name: 'W2', a: 31, b: 22 }, { name: 'W3', a: 28, b: 27 },
  { name: 'W4', a: 40, b: 25 }, { name: 'W5', a: 37, b: 33 }, { name: 'W6', a: 45, b: 30 },
];
const AREA_DATA = [
  { name: 'Q1', value: 120 }, { name: 'Q2', value: 145 }, { name: 'Q3', value: 132 },
  { name: 'Q4', value: 168 },
];
const PIE_DATA = [
  { name: 'გიორგი', value: 48 }, { name: 'თეონა', value: 52 },
];
const RADAR_DATA = [
  { metric: 'Speed', value: 80 }, { metric: 'Accuracy', value: 65 },
  { metric: 'Coverage', value: 90 }, { metric: 'Cost', value: 55 }, { metric: 'Uptime', value: 72 },
];

const GRID_STROKE = 'var(--border-3, #e1e0d9)';
const AXIS_STROKE = 'var(--text-4, #898781)';
const TICK = { fill: 'var(--text-3, #52514e)', fontSize: 11 };

function ChartCard({ title, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 12, padding: '14px 16px 6px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>{title}</div>
      <ResponsiveContainer width="100%" height={180}>
        {children}
      </ResponsiveContainer>
    </div>
  );
}

function ThemeSection({ theme }) {
  const c = theme.colors;
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{theme.name}</h3>
        <div style={{ display: 'flex', gap: 3 }}>
          {c.slice(0, 5).map((hex, i) => (
            <span key={i} style={{ width: 14, height: 14, borderRadius: 4, background: hex, border: '1px solid rgba(0,0,0,0.08)' }} />
          ))}
        </div>
        {theme.key === 'pastel' && (
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#4d9a48', background: 'rgba(77,154,72,0.12)', border: '1px solid rgba(77,154,72,0.3)', borderRadius: 20, padding: '2px 9px' }}>
            Active
          </span>
        )}
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--text-3)' }}>{theme.blurb}</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {/* Bar */}
        <ChartCard title="Bar — monthly volume">
          <BarChart data={BAR_DATA} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="name" stroke={AXIS_STROKE} tick={TICK} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
            <YAxis stroke={AXIS_STROKE} tick={TICK} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border-2)' }} />
            <Bar dataKey="value" fill={c[0]} radius={[4, 4, 0, 0]} maxBarSize={24} />
          </BarChart>
        </ChartCard>

        {/* Line */}
        <ChartCard title="Line — two series trend">
          <LineChart data={LINE_DATA} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="name" stroke={AXIS_STROKE} tick={TICK} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
            <YAxis stroke={AXIS_STROKE} tick={TICK} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border-2)' }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="a" name="Team A" stroke={c[0]} strokeWidth={2} dot={{ r: 4, fill: c[0], stroke: 'var(--surface)', strokeWidth: 2 }} />
            <Line type="monotone" dataKey="b" name="Team B" stroke={c[1]} strokeWidth={2} dot={{ r: 4, fill: c[1], stroke: 'var(--surface)', strokeWidth: 2 }} />
          </LineChart>
        </ChartCard>

        {/* Area */}
        <ChartCard title="Area — quarterly total">
          <AreaChart data={AREA_DATA} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id={`area-${theme.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={c[0]} stopOpacity={0.28} />
                <stop offset="100%" stopColor={c[0]} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={GRID_STROKE} vertical={false} />
            <XAxis dataKey="name" stroke={AXIS_STROKE} tick={TICK} axisLine={{ stroke: GRID_STROKE }} tickLine={false} />
            <YAxis stroke={AXIS_STROKE} tick={TICK} axisLine={false} tickLine={false} width={30} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border-2)' }} />
            <Area type="monotone" dataKey="value" stroke={c[0]} strokeWidth={2} fill={`url(#area-${theme.key})`} />
          </AreaChart>
        </ChartCard>

        {/* Pie */}
        <ChartCard title="Pie — split">
          <PieChart>
            <Pie
              data={PIE_DATA}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={62}
              label={({ percent }) => `${Math.round(percent * 100)}%`}
              labelLine={false}
            >
              {PIE_DATA.map((_, i) => <Cell key={i} fill={c[i % c.length]} />)}
            </Pie>
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--border-2)' }} />
          </PieChart>
        </ChartCard>

        {/* Radar */}
        <ChartCard title="Radar — five metrics">
          <RadarChart data={RADAR_DATA} margin={{ top: 4, right: 12, left: 12, bottom: 0 }}>
            <PolarGrid stroke={GRID_STROKE} />
            <PolarAngleAxis dataKey="metric" tick={{ ...TICK, fontSize: 10 }} />
            <PolarRadiusAxis tick={false} axisLine={false} />
            <Radar dataKey="value" stroke={c[0]} strokeWidth={2} fill={c[0]} fillOpacity={0.18} />
          </RadarChart>
        </ChartCard>
      </div>
    </div>
  );
}

function ChartDesignsGallery() {
  return (
    <div>
      <p style={{ margin: '0 0 24px', fontSize: 13, color: 'var(--text-3)', maxWidth: 720 }}>
        Five color themes, the same five chart types under each, using placeholder data so only the
        design changes. Each palette passes the lightness, chroma, colorblind-separation and contrast
        checks — pick the one that fits Datum, and it becomes the app-wide default.
      </p>
      {THEMES.map(theme => <ThemeSection key={theme.key} theme={theme} />)}
    </div>
  );
}

export default ChartDesignsGallery;
