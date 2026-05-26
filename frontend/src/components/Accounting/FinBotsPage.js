import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  BarChart, Bar, LineChart, Line,
  PieChart, Pie, Cell,
  Treemap,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const DATA_SOURCE_DEFS = [
  { key: 'employees',  labelKey: 'fb.ds.employees', descKey: 'fb.ds.employees.desc', color: '#3b82f6' },
  { key: 'salaries',   labelKey: 'fb.ds.salaries',  descKey: 'fb.ds.salaries.desc',  color: '#10b981' },
  { key: 'bonuses',    labelKey: 'fb.ds.bonuses',   descKey: 'fb.ds.bonuses.desc',   color: '#f59e0b' },
  { key: 'insurance',  labelKey: 'fb.ds.insurance', descKey: 'fb.ds.insurance.desc', color: '#8b5cf6' },
  { key: 'fitpass',    labelKey: 'fb.ds.fitpass',   descKey: 'fb.ds.fitpass.desc',   color: '#ec4899' },
  { key: 'accounting', labelKey: 'fb.ds.accounting',descKey: 'fb.ds.accounting.desc',color: '#06b6d4' },
  { key: 'sales',      labelKey: 'fb.ds.sales',     descKey: 'fb.ds.sales.desc',     color: '#14b8a6' },
  { key: 'stock',      labelKey: 'fb.ds.stock',     descKey: 'fb.ds.stock.desc',     color: '#d946ef' },
  { key: 'holidays',   labelKey: 'fb.ds.holidays',  descKey: 'fb.ds.holidays.desc',  color: '#f97316' },
  { key: 'coagents',    labelKey: 'fb.ds.clients',   descKey: 'fb.ds.clients.desc',   color: '#6366f1' },
];

const STORAGE_KEY_PREFIX = 'finpilot_finbots_';

function getStorageKey(userId) {
  return STORAGE_KEY_PREFIX + (userId || 'guest');
}

function mapBot(b) {
  return {
    ...b,
    dataSources: b.data_sources || [],
    systemPrompt: b.system_prompt || '',
    createdAt: b.created_at,
    updatedAt: b.updated_at,
  };
}

function loadChatHistory(botId) {
  try { return JSON.parse(localStorage.getItem(`finpilot_chat_${botId}`) || '[]'); } catch { return []; }
}
function saveChatHistory(botId, messages) {
  localStorage.setItem(`finpilot_chat_${botId}`, JSON.stringify(messages));
}
function clearChatHistory(botId) {
  localStorage.removeItem(`finpilot_chat_${botId}`);
}

// ── Available icons ──────────────────────────────────────────────────────────
const BOT_ICONS = [
  { key: 'bot', label: 'Robot', svg: (c, s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 2v3"/><circle cx="12" cy="5" r="1"/><path d="M8 11V9a4 4 0 0 1 8 0v2"/><circle cx="9" cy="15" r="1"/><circle cx="15" cy="15" r="1"/><path d="M9 19h6"/>
    </svg>
  )},
  { key: 'brain', label: 'Brain', svg: (c, s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 2a2.5 2.5 0 0 1 5 0v1a2.5 2.5 0 0 1 2.5 2.5v.5a2.5 2.5 0 0 1 2.5 2.5A2.5 2.5 0 0 1 17 11v1a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 12v-1a2.5 2.5 0 0 1-2.5-2.5A2.5 2.5 0 0 1 7 6v-.5A2.5 2.5 0 0 1 9.5 3V2z"/><path d="M12 16v6M8 22h8"/>
    </svg>
  )},
  { key: 'chart', label: 'Chart', svg: (c, s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6"  y1="20" x2="6"  y2="14"/><line x1="2"  y1="20" x2="22" y2="20"/>
    </svg>
  )},
  { key: 'dollar', label: 'Money', svg: (c, s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
    </svg>
  )},
  { key: 'people', label: 'People', svg: (c, s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )},
  { key: 'shield', label: 'Shield', svg: (c, s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )},
  { key: 'star', label: 'Star', svg: (c, s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  )},
  { key: 'lightning', label: 'Lightning', svg: (c, s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
    </svg>
  )},
  { key: 'search', label: 'Search', svg: (c, s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  )},
  { key: 'document', label: 'Document', svg: (c, s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><path d="M8 13h8"/><path d="M8 17h8"/><path d="M10 9H8"/>
    </svg>
  )},
  { key: 'calculator', label: 'Calculator', svg: (c, s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10"/><line x1="12" y1="10" x2="12" y2="10"/><line x1="16" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="14"/><line x1="12" y1="14" x2="12" y2="14"/><line x1="16" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="12" y2="18"/><line x1="16" y1="18" x2="16" y2="18"/>
    </svg>
  )},
  { key: 'globe', label: 'Globe', svg: (c, s) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  )},
];

// ── Bot avatar ───────────────────────────────────────────────────────────────
function BotAvatar({ color, icon = 'bot', size = 36 }) {
  const iconDef = BOT_ICONS.find(i => i.key === icon) || BOT_ICONS[0];
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28,
      background: `linear-gradient(135deg, ${color}22, ${color}44)`,
      border: `1.5px solid ${color}55`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}>
      {iconDef.svg(color, size * 0.5)}
    </div>
  );
}

// ── Create / Edit modal ──────────────────────────────────────────────────────
function BotModal({ bot, onSave, onClose }) {
  const { t } = useLanguage();
  const DATA_SOURCES = DATA_SOURCE_DEFS.map(ds => ({ ...ds, label: t(ds.labelKey), desc: t(ds.descKey) }));
  const [name, setName] = useState(bot?.name || '');
  const [description, setDescription] = useState(bot?.description || '');
  const [sources, setSources] = useState(bot?.dataSources || []);
  const [systemPrompt, setSystemPrompt] = useState(bot?.systemPrompt || '');
  const [color, setColor] = useState(bot?.color || '#ec4899');
  const [icon, setIcon] = useState(bot?.icon || 'bot');

  const toggleSource = (key) => {
    setSources(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: bot?.id || `temp_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      dataSources: sources,
      systemPrompt: systemPrompt.trim(),
      color,
      icon,
      createdAt: bot?.createdAt || new Date().toISOString(),
    });
  };

  const COLORS = ['#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#ef4444'];

  return (
    <div className="fb-modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="fb-modal">
        <div className="fb-modal-header">
          <h3>{bot ? t('fb.editTitle') : t('fb.createTitle')}</h3>
          <button className="fb-modal-close" onClick={onClose}>×</button>
        </div>

        <div className="fb-modal-body-cols">
          {/* Left column */}
          <div className="fb-modal-col-left">
            {/* Preview */}
            <div style={{ display: 'flex', justifyContent: 'center', paddingBottom: 4 }}>
              <BotAvatar color={color} icon={icon} size={56} />
            </div>

            {/* Color picker */}
            <div className="fb-field">
              <label>{t('fb.color')}</label>
              <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                {COLORS.map(c => (
                  <button key={c} onClick={() => setColor(c)} style={{
                    width: 26, height: 26, borderRadius: 7, background: c,
                    border: color === c ? `3px solid var(--text)` : '2px solid transparent',
                    cursor: 'pointer', transition: 'transform 0.1s', outline: 'none',
                  }} />
                ))}
              </div>
            </div>

            {/* Icon picker */}
            <div className="fb-field">
              <label>{t('fb.icon')}</label>
              <div className="fb-icon-grid">
                {BOT_ICONS.map(ic => (
                  <button
                    key={ic.key}
                    className={`fb-icon-pick${icon === ic.key ? ' active' : ''}`}
                    onClick={() => setIcon(ic.key)}
                    title={ic.label}
                    style={icon === ic.key ? { borderColor: color, background: color + '18' } : {}}
                  >
                    {ic.svg(icon === ic.key ? color : 'var(--text-3)', 18)}
                  </button>
                ))}
              </div>
            </div>

            {/* Name */}
            <div className="fb-field">
              <label>{t('fb.botName')} <span style={{ color: '#ef4444' }}>*</span></label>
              <input
                className="fb-input"
                placeholder={t('fb.botNamePlaceholder')}
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="fb-field">
              <label>{t('fb.description')}</label>
              <input
                className="fb-input"
                placeholder={t('fb.descriptionPlaceholder')}
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            {/* System prompt */}
            <div className="fb-field">
              <label>{t('fb.systemPrompt')} <span style={{ color: 'var(--text-4)', fontWeight: 400 }}>({t('fb.optional')})</span></label>
              <textarea
                className="fb-input fb-textarea"
                placeholder={t('fb.systemPromptPlaceholder')}
                value={systemPrompt}
                onChange={e => setSystemPrompt(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          {/* Right column — Data sources */}
          <div className="fb-modal-col-right">
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4 }}>{t('fb.dataSources')}</div>
            {DATA_SOURCES.map(ds => (
              <label key={ds.key} className={`fb-source-item${sources.includes(ds.key) ? ' selected' : ''}`} style={sources.includes(ds.key) ? { borderColor: ds.color, background: ds.color + '10' } : {}}>
                <input type="checkbox" checked={sources.includes(ds.key)} onChange={() => toggleSource(ds.key)} style={{ display: 'none' }} />
                <div className="fb-source-dot" style={{ background: ds.color }} />
                <div>
                  <div className="fb-source-name">{ds.label}</div>
                  <div className="fb-source-desc">{ds.desc}</div>
                </div>
                {sources.includes(ds.key) && (
                  <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={ds.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                )}
              </label>
            ))}
          </div>
        </div>

        <div className="fb-modal-footer">
          <button className="fb-btn fb-btn-ghost" onClick={onClose}>{t('fb.cancel')}</button>
          <button className="fb-btn fb-btn-primary" onClick={handleSave} disabled={!name.trim()}>
            {bot ? t('fb.saveChanges') : t('fb.createBot')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Chart rendering ──────────────────────────────────────────────────────────
const CHART_COLORS = [
  { start: '#6366f1', end: '#818cf8', glow: 'rgba(99,102,241,0.3)' }, // Indigo
  { start: '#10b981', end: '#34d399', glow: 'rgba(16,185,129,0.3)' }, // Emerald
  { start: '#8b5cf6', end: '#a78bfa', glow: 'rgba(139,92,246,0.3)' }, // Violet
  { start: '#f59e0b', end: '#fbbf24', glow: 'rgba(245,158,11,0.3)' },  // Amber
  { start: '#ec4899', end: '#f472b6', glow: 'rgba(236,72,153,0.3)' }, // Pink
  { start: '#06b6d4', end: '#22d3ee', glow: 'rgba(6,182,212,0.3)' },  // Cyan
  { start: '#f97316', end: '#fb923c', glow: 'rgba(249,115,22,0.3)' },  // Orange
  { start: '#ef4444', end: '#f87171', glow: 'rgba(239,68,68,0.3)' },   // Red
];

function ChartBlock({ chartData }) {
  const { type, title, labels = [], datasets = [] } = chartData;
  const containerRef = useRef(null);
  const [saving, setSaving] = useState(false);

  const handleSavePng = async () => {
    if (!containerRef.current || saving) return;
    setSaving(true);
    try {
      const canvas = await html2canvas(containerRef.current, { scale: 2, useCORS: true, backgroundColor: null });
      const link = document.createElement('a');
      link.download = `${title || 'chart'}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setSaving(false);
    }
  };

  const handleSavePdf = async () => {
    if (!containerRef.current || saving) return;
    setSaving(true);
    try {
      const canvas = await html2canvas(containerRef.current, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: canvas.width > canvas.height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${title || 'chart'}.pdf`);
    } finally {
      setSaving(false);
    }
  };

  const xyData = labels.map((label, i) => {
    const point = { name: label };
    datasets.forEach(ds => { point[ds.label] = ds.data[i]; });
    return point;
  });

  const singleData = labels.map((label, i) => ({
    name: label,
    value: datasets[0]?.data[i] ?? 0,
  }));

  const tip = {
    contentStyle: {
      background: 'rgba(15, 15, 25, 0.85)',
      backdropFilter: 'blur(10px)',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      borderRadius: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
      fontSize: 12,
      fontWeight: 600,
      padding: '8px 12px',
      color: '#ffffff',
    },
    itemStyle: { padding: '2px 0', color: '#ececf1' },
    cursor: { fill: 'rgba(255,255,255,0.05)' }
  };

  const ax = {
    tick: { fontSize: 10, fill: 'var(--text-4)', fontWeight: 500, fontFamily: 'var(--font-mono), monospace' },
    axisLine: { stroke: 'var(--border-2)', strokeWidth: 1 },
    tickLine: { stroke: 'var(--border-2)' },
  };

  const margin = { top: 10, right: 20, left: 0, bottom: 60 };

  const Gradients = () => (
    <defs>
      {CHART_COLORS.map((c, i) => (
        <React.Fragment key={i}>
          <linearGradient id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={c.start} stopOpacity={1} />
            <stop offset="100%" stopColor={c.end} stopOpacity={0.85} />
          </linearGradient>
          <filter id={`glow-${i}`}>
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </React.Fragment>
      ))}
    </defs>
  );

  let chart;
  if (type === 'pie') {
    chart = (
      <PieChart>
        <Gradients />
        <Pie
          data={singleData} dataKey="value" nameKey="name"
          cx="50%" cy="47%" outerRadius="75%"
          paddingAngle={4} stroke="none"
          animationBegin={0} animationDuration={1200} animationEasing="ease-out"
          label={({ name, percent }) => percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : ''}
          labelLine={false}
        >
          {singleData.map((_, i) => <Cell key={i} fill={`url(#grad-${i % CHART_COLORS.length})`} filter={`url(#glow-${i % CHART_COLORS.length})`} />)}
        </Pie>
        <Tooltip {...tip} formatter={(v) => v.toLocaleString()} />
        <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
      </PieChart>
    );
  } else if (type === 'treemap') {
    chart = (
      <Treemap
        data={singleData} dataKey="value" nameKey="name" aspectRatio={4 / 3}
        animationDuration={1000}
        content={(props) => {
          const { x, y, width, height, name, value, depth, index } = props;
          if (depth === 0 || !width || !height) return null;
          const fill = CHART_COLORS[index % CHART_COLORS.length].start;
          const fs = Math.max(9, Math.min(13, width / 8));
          return (
            <g>
              <rect x={x + 1} y={y + 1} width={width - 2} height={height - 2} fill={fill} fillOpacity={0.9} rx={8} />
              {width > 45 && height > 24 && (
                <text x={x + width / 2} y={y + height / 2 + (height > 40 ? -5 : 4)} textAnchor="middle" fill="#fff" fontSize={fs} fontWeight={600}>
                  {name}
                </text>
              )}
              {width > 45 && height > 42 && (
                <text x={x + width / 2} y={y + height / 2 + 11} textAnchor="middle" fill="#fff" fontSize={fs - 1} opacity={0.8}>
                  {Number(value).toLocaleString()}
                </text>
              )}
            </g>
          );
        }}
      />
    );
  } else if (type === 'line') {
    chart = (
      <LineChart data={xyData} margin={margin}>
        <Gradients />
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-2)" opacity={0.6} />
        <XAxis dataKey="name" {...ax} angle={-35} textAnchor="end" interval={0} height={60} />
        <YAxis {...ax} width={40} axisLine={false} tickLine={false} />
        <Tooltip {...tip} />
        {datasets.length > 1 && <Legend verticalAlign="top" align="right" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />}
        {datasets.map((ds, i) => (
          <Line
            key={ds.label} type="monotone" dataKey={ds.label}
            stroke={ds.color || CHART_COLORS[i % CHART_COLORS.length].start}
            strokeWidth={3} dot={{ r: 4, strokeWidth: 2, fill: 'var(--surface)' }}
            activeDot={{ r: 6, strokeWidth: 0 }}
            animationDuration={1500}
          />
        ))}
      </LineChart>
    );
  } else {
    chart = (
      <BarChart data={xyData} margin={margin}>
        <Gradients />
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-2)" opacity={0.6} />
        <XAxis dataKey="name" {...ax} angle={-35} textAnchor="end" interval={0} height={60} />
        <YAxis {...ax} width={40} axisLine={false} tickLine={false} />
        <Tooltip {...tip} />
        {datasets.length > 1 && <Legend verticalAlign="top" align="right" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />}
        {datasets.map((ds, i) => (
          <Bar
            key={ds.label} dataKey={ds.label}
            fill={`url(#grad-${i % CHART_COLORS.length})`}
            radius={[6, 6, 0, 0]}
            animationDuration={1200}
            barSize={Math.min(40, 300 / xyData.length)}
          />
        ))}
      </BarChart>
    );
  }

  return (
    <div ref={containerRef} style={{
      background: 'rgba(255, 255, 255, 0.03)',
      backdropFilter: 'blur(10px)',
      border: '1px solid var(--border)',
      borderRadius: 20,
      padding: '20px 12px 12px',
      margin: '16px 0',
      position: 'relative',
      boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
      animation: 'fadeUp 0.5s ease both',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 8, marginBottom: 10 }}>
        {title ? <div style={{ fontWeight: 800, fontSize: 14, letterSpacing: '-0.3px', color: 'var(--text)' }}>{title}</div> : <span />}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={handleSavePng}
            disabled={saving}
            title="Save as PNG"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-3)', cursor: saving ? 'wait' : 'pointer',
              fontSize: 11, fontWeight: 600, opacity: saving ? 0.6 : 1, transition: 'all 0.15s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            PNG
          </button>
          <button
            onClick={handleSavePdf}
            disabled={saving}
            title="Save as PDF"
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '4px 10px', borderRadius: 7, border: '1px solid var(--border)',
              background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-3)', cursor: saving ? 'wait' : 'pointer',
              fontSize: 11, fontWeight: 600, opacity: saving ? 0.6 : 1, transition: 'all 0.15s',
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
            </svg>
            PDF
          </button>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={type === 'treemap' ? 360 : 320}>
        {chart}
      </ResponsiveContainer>
    </div>
  );
}

function parseMessageParts(content) {
  const parts = [];
  const re = /\[CHART\]([\s\S]*?)\[\/CHART\]/g;
  let last = 0, m;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', text: content.slice(last, m.index) });
    try { parts.push({ kind: 'chart', data: JSON.parse(m[1]) }); }
    catch { parts.push({ kind: 'text', text: m[0] }); }
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push({ kind: 'text', text: content.slice(last) });
  return parts;
}

function MessageContent({ content }) {
  const parts = parseMessageParts(content);
  return (
    <>
      {parts.map((p, i) =>
        p.kind === 'chart'
          ? <ChartBlock key={i} chartData={p.data} />
          : <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{p.text}</span>
      )}
    </>
  );
}

// ── Chat view ────────────────────────────────────────────────────────────────
function BotChat({ bot }) {
  const { t } = useLanguage();
  const [messages, setMessages] = useState(() => loadChatHistory(bot.id));
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setMessages(loadChatHistory(bot.id));
    setInput('');
  }, [bot.id]);

  useEffect(() => {
    saveChatHistory(bot.id, messages);
  }, [bot.id, messages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (e) => {
    e?.preventDefault();
    const q = input.trim();
    if (!q || loading) return;

    const newMessages = [...messages, { role: 'user', content: q }];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await api.post('/finbots/chat', {
        botName: bot.name,
        dataSources: bot.dataSources || [],
        systemPrompt: bot.systemPrompt || '',
        messages: newMessages.filter(m => m.role === 'user' || m.role === 'assistant'),
      });
      setMessages(m => [...m, { role: 'assistant', content: res.data.answer }]);
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to get answer.';
      setMessages(m => [...m, { role: 'error', content: msg }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const connectedSources = DATA_SOURCE_DEFS.filter(s => bot.dataSources?.includes(s.key));

  return (
    <div className="fb-chat">
      {/* Chat header */}
      <div className="fb-chat-header">
        <BotAvatar color={bot.color} icon={bot.icon} size={38} />
        <div>
          <div className="fb-chat-bot-name">{bot.name}</div>
          <div className="fb-chat-bot-meta">
            {connectedSources.length === 0
              ? 'No data sources connected'
              : connectedSources.map(s => t(s.labelKey)).join(', ')}
          </div>
        </div>
        <button className="fb-clear-btn" onClick={() => { clearChatHistory(bot.id); setMessages([]); }} title="Clear conversation">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
          Clear
        </button>
      </div>

      {/* Messages */}
      <div className="fb-messages">
        {messages.length === 0 && (
          <div className="fb-empty-chat">
            <BotAvatar color={bot.color} icon={bot.icon} size={56} />
            <div className="fb-empty-chat-name">{bot.name}</div>
            <div className="fb-empty-chat-hint">
              {connectedSources.length === 0
                ? 'No data sources connected. Edit this bot to connect data.'
                : `Connected to: ${connectedSources.map(s => t(s.labelKey)).join(', ')}`}
            </div>
            {connectedSources.length > 0 && (
              <div className="fb-suggestions">
                {bot.dataSources?.includes('salaries') && (
                  <button className="fb-suggestion" onClick={() => setInput('When did the last salary change happen?')}>
                    When did the last salary change happen?
                  </button>
                )}
                {bot.dataSources?.includes('employees') && (
                  <button className="fb-suggestion" onClick={() => setInput('Who has the highest salary?')}>
                    Who has the highest salary?
                  </button>
                )}
                {bot.dataSources?.includes('bonuses') && (
                  <button className="fb-suggestion" onClick={() => setInput('What bonuses were paid this year?')}>
                    What bonuses were paid this year?
                  </button>
                )}
                {bot.dataSources?.includes('insurance') && (
                  <button className="fb-suggestion" onClick={() => setInput('List all insured employees.')}>
                    List all insured employees.
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`fb-msg fb-msg-${msg.role}`}>
            {msg.role !== 'user' && (
              <div className="fb-msg-avatar">
                {msg.role === 'assistant'
                  ? <BotAvatar color={bot.color} icon={bot.icon} size={28} />
                  : <div className="fb-msg-error-icon">!</div>
                }
              </div>
            )}
            <div className="fb-msg-bubble">
              <div className="fb-msg-sender">
                {msg.role === 'user' ? 'You' : msg.role === 'error' ? 'Error' : bot.name}
              </div>
              <div className="fb-msg-text"><MessageContent content={msg.content} /></div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="fb-msg fb-msg-assistant">
            <div className="fb-msg-avatar"><BotAvatar color={bot.color} icon={bot.icon} size={28} /></div>
            <div className="fb-msg-bubble">
              <div className="fb-msg-sender">{bot.name}</div>
              <div className="fb-typing">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <form className="fb-input-bar" onSubmit={send}>
        <input
          ref={inputRef}
          className="fb-chat-input"
          placeholder={`Ask ${bot.name} anything...`}
          value={input}
          onChange={e => setInput(e.target.value)}
          disabled={loading}
        />
        <button type="submit" className="fb-send-btn" disabled={!input.trim() || loading} style={{ background: bot.color }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </form>
    </div>
  );
}

// ── Main FinBots page ────────────────────────────────────────────────────────
function FinBotsPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const userId = user?.id;
  const [bots, setBots] = useState([]);
  
  useEffect(() => {
    if (userId) {
      api.get('/finbots')
        .then(res => setBots((res.data.bots || []).map(mapBot)))
        .catch(err => console.error('Failed to load bots:', err));
    }
  }, [userId]);
  const [selectedId, setSelectedId] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingBot, setEditingBot] = useState(null);

  const selectedBot = bots.find(b => b.id === selectedId) || null;

  const handleSave = async (bot) => {
    try {
      const res = await api.post('/finbots', bot);
      const savedBot = mapBot(res.data.bot);
      
      setBots(prev => {
        const idx = prev.findIndex(b => b.id === savedBot.id);
        if (idx >= 0) return prev.map(b => b.id === savedBot.id ? savedBot : b);
        return [savedBot, ...prev];
      });
      
      setSelectedId(savedBot.id);
      setShowModal(false);
      setEditingBot(null);
    } catch (err) {
      alert('Failed to save bot: ' + (err.response?.data?.error || err.message));
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this bot?')) return;
    try {
      await api.delete(`/finbots/${id}`);
      setBots(prev => prev.filter(b => b.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      alert('Failed to delete bot: ' + (err.response?.data?.error || err.message));
    }
  };

  const openCreate = () => { setEditingBot(null); setShowModal(true); };
  const openEdit = (bot, e) => { e.stopPropagation(); setEditingBot(bot); setShowModal(true); };

  return (
    <div className="fb-layout">
      {/* Left panel — bot list */}
      <aside className="fb-sidebar">
        <div className="fb-sidebar-header">
          <span className="fb-sidebar-title">FinBots</span>
          <button className="fb-new-btn" onClick={openCreate} title="Create new bot">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Bot
          </button>
        </div>

        <div className="fb-bot-list">
          {bots.length === 0 && (
            <div className="fb-no-bots">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="10" rx="2"/>
                <path d="M12 2v3"/><circle cx="12" cy="5" r="1"/>
                <path d="M8 11V9a4 4 0 0 1 8 0v2"/>
              </svg>
              <p>No bots yet.<br/>Create your first FinBot.</p>
            </div>
          )}
          {bots.map(bot => (
            <div
              key={bot.id}
              className={`fb-bot-item${selectedId === bot.id ? ' active' : ''}`}
              onClick={() => setSelectedId(bot.id)}
            >
              <BotAvatar color={bot.color} icon={bot.icon} size={34} />
              <div className="fb-bot-item-info">
                <div className="fb-bot-item-name">{bot.name}</div>
                <div className="fb-bot-item-sources">
                  {bot.dataSources?.length
                    ? bot.dataSources.map(s => DATA_SOURCE_DEFS.find(d => d.key === s)?.labelKey ? t(DATA_SOURCE_DEFS.find(d => d.key === s).labelKey) : s).join(', ')
                    : t('fb.noDataConnected')}
                </div>
              </div>
              <div className="fb-bot-item-actions">
                <button className="fb-icon-btn" onClick={e => openEdit(bot, e)} title="Edit">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button className="fb-icon-btn fb-icon-btn-delete" onClick={e => { e.stopPropagation(); handleDelete(bot.id); }} title="Delete">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                    <path d="M10 11v6"/><path d="M14 11v6"/>
                    <path d="M9 6V4h6v2"/>
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Right panel — chat or placeholder */}
      <main className="fb-main">
        {selectedBot ? (
          <BotChat key={selectedBot.id} bot={selectedBot} />
        ) : (
          <div className="fb-no-selection">
            <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--text-4)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="10" rx="2"/>
              <path d="M12 2v3"/><circle cx="12" cy="5" r="1"/>
              <path d="M8 11V9a4 4 0 0 1 8 0v2"/>
              <circle cx="9" cy="15" r="1" fill="var(--text-4)"/>
              <circle cx="15" cy="15" r="1" fill="var(--text-4)"/>
              <path d="M9 19h6"/>
            </svg>
            <h3>{t('fb.selectTitle')}</h3>
            <p>{t('fb.selectHint')}</p>
            <button className="fb-btn fb-btn-primary" onClick={openCreate}>
              {t('fb.createFinBot')}
            </button>
          </div>
        )}
      </main>

      {/* Modal */}
      {showModal && (
        <BotModal
          bot={editingBot}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingBot(null); }}
        />
      )}

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(15px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fb-bounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default FinBotsPage;
