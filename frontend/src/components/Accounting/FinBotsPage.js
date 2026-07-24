import React, { useState, useEffect, useRef } from 'react';
import api from '../../services/api';
import { useLanguage } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { isFloating, setFloating } from './floatingStore';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import {
  BarChart, Bar, LineChart, Line,
  AreaChart, Area,
  ComposedChart,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter, ZAxis,
  RadialBarChart, RadialBar,
  FunnelChart, Funnel, LabelList,
  Treemap,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

const CHART_TYPES = [
  { key: 'bar',        label: 'Bar',        icon: (c) => <svg width="28" height="20" viewBox="0 0 28 20"><rect x="2" y="10" width="5" height="9" fill={c} rx="1"/><rect x="9" y="4" width="5" height="15" fill={c} rx="1"/><rect x="16" y="7" width="5" height="12" fill={c} rx="1"/><rect x="23" y="1" width="5" height="18" fill={c} rx="1"/></svg> },
  { key: 'line',       label: 'Line',       icon: (c) => <svg width="28" height="20" viewBox="0 0 28 20"><polyline points="2,17 8,10 14,13 20,4 26,7" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { key: 'area',       label: 'Area',       icon: (c) => <svg width="28" height="20" viewBox="0 0 28 20"><path d="M2,17 L8,10 L14,13 L20,4 L26,7 L26,18 L2,18 Z" fill={c} fillOpacity="0.4" stroke={c} strokeWidth="1.5"/></svg> },
  { key: 'composed',   label: 'Composed',   icon: (c) => <svg width="28" height="20" viewBox="0 0 28 20"><rect x="3" y="12" width="4" height="7" fill={c} fillOpacity="0.5" rx="1"/><rect x="9" y="8" width="4" height="11" fill={c} fillOpacity="0.5" rx="1"/><rect x="15" y="10" width="4" height="9" fill={c} fillOpacity="0.5" rx="1"/><rect x="21" y="5" width="4" height="14" fill={c} fillOpacity="0.5" rx="1"/><polyline points="5,9 11,5 17,7 23,2" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> },
  { key: 'pie',        label: 'Pie',        icon: (c) => <svg width="28" height="20" viewBox="0 0 28 20"><circle cx="14" cy="10" r="8" fill="none" stroke={c} strokeWidth="1"/><path d="M14,10 L14,2 A8,8 0 0,1 21.7,14 Z" fill={c} fillOpacity="0.8"/><path d="M14,10 L21.7,14 A8,8 0 0,1 6.3,14 Z" fill={c} fillOpacity="0.5"/><path d="M14,10 L6.3,14 A8,8 0 0,1 14,2 Z" fill={c} fillOpacity="0.3"/></svg> },
  { key: 'treemap',    label: 'Treemap',    icon: (c) => <svg width="28" height="20" viewBox="0 0 28 20"><rect x="1" y="1" width="14" height="12" fill={c} fillOpacity="0.7" rx="1"/><rect x="17" y="1" width="10" height="7" fill={c} fillOpacity="0.5" rx="1"/><rect x="17" y="10" width="10" height="9" fill={c} fillOpacity="0.35" rx="1"/><rect x="1" y="15" width="14" height="4" fill={c} fillOpacity="0.4" rx="1"/></svg> },
  { key: 'radar',      label: 'Radar',      icon: (c) => <svg width="28" height="20" viewBox="0 0 28 20"><polygon points="14,2 25,10 21,18 7,18 3,10" fill={c} fillOpacity="0.2" stroke={c} strokeWidth="1.2"/><polygon points="14,6 20.5,10 18,15 10,15 7.5,10" fill={c} fillOpacity="0.35" stroke={c} strokeWidth="1"/><line x1="14" y1="2" x2="14" y2="18" stroke={c} strokeWidth="0.5" strokeDasharray="2"/><line x1="3" y1="10" x2="25" y2="10" stroke={c} strokeWidth="0.5" strokeDasharray="2"/><line x1="7" y1="18" x2="21" y2="2" stroke={c} strokeWidth="0.5" strokeDasharray="2"/><line x1="21" y1="18" x2="7" y2="2" stroke={c} strokeWidth="0.5" strokeDasharray="2"/></svg> },
  { key: 'scatter',    label: 'Scatter',    icon: (c) => <svg width="28" height="20" viewBox="0 0 28 20"><circle cx="5" cy="15" r="2" fill={c}/><circle cx="9" cy="8" r="2" fill={c}/><circle cx="14" cy="12" r="2" fill={c}/><circle cx="18" cy="4" r="2" fill={c}/><circle cx="22" cy="9" r="2" fill={c}/><circle cx="25" cy="6" r="2" fill={c}/><circle cx="11" cy="15" r="2" fill={c} fillOpacity="0.5"/></svg> },
  { key: 'radial-bar', label: 'Radial',     icon: (c) => <svg width="28" height="20" viewBox="0 0 28 20"><path d="M14,10 m-8,0 a8,8 0 0,1 7,-7" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeOpacity="0.35"/><path d="M14,10 m-6,0 a6,6 0 0,1 6,-6" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeOpacity="0.55"/><path d="M14,10 m-4,0 a4,4 0 0,1 4,-3.5" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round"/></svg> },
  { key: 'funnel',     label: 'Funnel',     icon: (c) => <svg width="28" height="20" viewBox="0 0 28 20"><polygon points="4,2 24,2 20,8 8,8" fill={c} fillOpacity="0.7"/><polygon points="8,9 20,9 17,14 11,14" fill={c} fillOpacity="0.5"/><polygon points="11,15 17,15 15,19 13,19" fill={c} fillOpacity="0.35"/></svg> },
  { key: 'matrix',     label: 'Matrix',     icon: (c) => <svg width="28" height="20" viewBox="0 0 28 20"><rect x="1" y="1" width="26" height="18" rx="2" fill="none" stroke={c} strokeWidth="1.2"/><line x1="1" y1="7" x2="27" y2="7" stroke={c} strokeWidth="1.2"/><line x1="8" y1="1" x2="8" y2="19" stroke={c} strokeWidth="1"/><line x1="15" y1="1" x2="15" y2="19" stroke={c} strokeWidth="1"/><line x1="22" y1="1" x2="22" y2="19" stroke={c} strokeWidth="1"/><rect x="2" y="2" width="5" height="4" rx="1" fill={c} fillOpacity="0.6"/><rect x="9" y="2" width="5" height="4" rx="1" fill={c} fillOpacity="0.4"/><rect x="16" y="2" width="5" height="4" rx="1" fill={c} fillOpacity="0.25"/></svg> },
];

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
const DL_TABLES_KEY = 'dl_custom_tables';

function getStorageKey(userId) {
  return STORAGE_KEY_PREFIX + (userId || 'guest');
}

function readDLTables() {
  try { return JSON.parse(localStorage.getItem(DL_TABLES_KEY)) || []; } catch { return []; }
}

export function mapBot(b) {
  const pref = (b.data_sources || []).find(s => s.startsWith('__pref_chart:'));
  return {
    ...b,
    dataSources: b.data_sources || [],
    systemPrompt: b.system_prompt || '',
    preferredChart: pref ? pref.replace('__pref_chart:', '') : 'bar',
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
export function BotAvatar({ color, icon = 'bot', size = 36 }) {
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
  const [sources, setSources] = useState((bot?.dataSources || []).filter(s => !s.startsWith('__pref_chart:')));
  const [systemPrompt, setSystemPrompt] = useState(bot?.systemPrompt || '');
  const [color, setColor] = useState(bot?.color || '#ec4899');
  const [icon, setIcon] = useState(bot?.icon || 'bot');
  const [floating, setFloatingState] = useState(() => isFloating(bot?.id));
  const [dlTables] = useState(() => readDLTables());
  const [preferredChart, setPreferredChart] = useState(bot?.preferredChart || 'bar');

  const toggleSource = (key) => {
    setSources(prev => prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const finalSources = preferredChart !== 'bar'
      ? [...sources.filter(s => !s.startsWith('__pref_chart:')), `__pref_chart:${preferredChart}`]
      : sources.filter(s => !s.startsWith('__pref_chart:'));
    onSave({
      id: bot?.id || `temp_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      dataSources: finalSources,
      systemPrompt: systemPrompt.trim(),
      color,
      icon,
      floating,
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

            {/* Floating chat widget toggle */}
            <div
              className="fb-field"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: 12,
                padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 12,
                background: floating ? color + '10' : 'var(--surface-2)',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{t('fb.floating')}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, lineHeight: 1.4 }}>{t('fb.floatingHint')}</div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={floating}
                onClick={() => setFloatingState(v => !v)}
                style={{
                  position: 'relative', width: 44, height: 24, flexShrink: 0,
                  borderRadius: 999, border: 'none', cursor: 'pointer', padding: 0,
                  background: floating ? color : 'var(--border-2)',
                  transition: 'background 0.18s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: floating ? 22 : 2,
                  width: 20, height: 20, borderRadius: '50%', background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)', transition: 'left 0.18s',
                }} />
              </button>
            </div>
          </div>

          {/* Chart type picker */}
          <div className="fb-field" style={{ gridColumn: '1 / -1' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', marginBottom: 8, display: 'block' }}>Default Chart Type</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
              {CHART_TYPES.map(ct => {
                const active = preferredChart === ct.key;
                return (
                  <button key={ct.key} type="button" onClick={() => setPreferredChart(ct.key)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 4px', borderRadius: 10, border: `1.5px solid ${active ? color : 'var(--border-2)'}`, background: active ? color + '18' : 'var(--surface-2)', cursor: 'pointer', transition: 'all 0.15s' }}>
                    {ct.icon(active ? color : 'var(--text-4)')}
                    <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, color: active ? color : 'var(--text-3)', letterSpacing: '0.02em' }}>{ct.label}</span>
                  </button>
                );
              })}
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

            {/* Data Lake Tables */}
            <div style={{ height: 1, background: 'var(--border)', margin: '14px 0 10px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <line x1="3" y1="9" x2="21" y2="9"/>
                <line x1="3" y1="15" x2="21" y2="15"/>
                <line x1="9" y1="9" x2="9" y2="21"/>
                <line x1="15" y1="9" x2="15" y2="21"/>
              </svg>
              Data Lake Tables
            </div>
            {dlTables.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-4)', padding: '6px 2px', lineHeight: 1.5 }}>
                No tables yet. Go to <strong>Data Lake → Tables</strong> to create one.
              </div>
            ) : (
              dlTables.map(table => {
                const key = `dl_table:${table.id}`;
                const selected = sources.includes(key);
                return (
                  <label key={table.id} className={`fb-source-item${selected ? ' selected' : ''}`} style={selected ? { borderColor: '#6366f1', background: '#6366f118' } : {}}>
                    <input type="checkbox" checked={selected} onChange={() => toggleSource(key)} style={{ display: 'none' }} />
                    <div className="fb-source-dot" style={{ background: '#6366f1' }} />
                    <div>
                      <div className="fb-source-name">{table.name}</div>
                      <div className="fb-source-desc">{table.columns.length} col · {table.rows.length} rows</div>
                    </div>
                    {selected && (
                      <svg style={{ marginLeft: 'auto', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"/>
                      </svg>
                    )}
                  </label>
                );
              })
            )}
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

// ── Matrix table ─────────────────────────────────────────────────────────────
function MatrixTable({ chartData }) {
  const { labels = [], datasets = [], totals = true } = chartData;
  const [sortColIdx, setSortColIdx] = useState(null);
  const [sortDir, setSortDir] = useState(-1);

  const sortedRows = sortColIdx === null
    ? datasets
    : [...datasets].sort((a, b) => {
        const av = Number(a.data[sortColIdx]) || 0;
        const bv = Number(b.data[sortColIdx]) || 0;
        return (av - bv) * sortDir;
      });

  const rowTotals = sortedRows.map(ds => ds.data.reduce((s, v) => s + (Number(v) || 0), 0));
  const colTotals = labels.map((_, ci) => sortedRows.reduce((s, ds) => s + (Number(ds.data[ci]) || 0), 0));
  const grandTotal = rowTotals.reduce((s, v) => s + v, 0);

  const allVals = sortedRows.flatMap(ds => ds.data.map(Number)).filter(v => !isNaN(v));
  const minVal = allVals.length ? Math.min(...allVals) : 0;
  const maxVal = allVals.length ? Math.max(...allVals) : 0;

  const heatBg = (val) => {
    if (maxVal === minVal) return 'transparent';
    const pct = (Number(val) - minVal) / (maxVal - minVal);
    return `rgba(59,130,246,${(pct * 0.52).toFixed(2)})`;
  };

  const fmt = (v) => {
    const n = Number(v);
    if (isNaN(n)) return v ?? '—';
    return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
  };

  const handleColClick = (ci) => {
    if (sortColIdx === ci) setSortDir(d => -d);
    else { setSortColIdx(ci); setSortDir(-1); }
  };

  const thBase = {
    padding: '7px 12px', fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
    borderBottom: '2px solid var(--border-2)', background: 'var(--surface-2)',
    whiteSpace: 'nowrap', position: 'sticky', top: 0, zIndex: 1,
    cursor: 'pointer', userSelect: 'none',
  };
  const tdBase = {
    padding: '6px 12px', fontSize: 12, textAlign: 'right',
    borderBottom: '1px solid var(--border)', color: 'var(--text-1)', whiteSpace: 'nowrap',
  };

  return (
    <div style={{ overflowX: 'auto', maxHeight: 380, overflowY: 'auto', borderRadius: 10, border: '1px solid var(--border-2)' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 320, tableLayout: 'auto' }}>
        <thead>
          <tr>
            <th style={{ ...thBase, textAlign: 'left', left: 0, zIndex: 2, cursor: 'default', borderRight: '1.5px solid var(--border-2)' }}></th>
            {labels.map((l, ci) => (
              <th key={ci} style={{ ...thBase, textAlign: 'right' }} onClick={() => handleColClick(ci)}>
                {l}
                {sortColIdx === ci && <span style={{ marginLeft: 4, opacity: 0.6 }}>{sortDir === -1 ? '↓' : '↑'}</span>}
              </th>
            ))}
            {totals !== false && <th style={{ ...thBase, textAlign: 'right', borderLeft: '1.5px solid var(--border-2)', color: 'var(--text-2)' }}>Total</th>}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((ds, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 1 ? 'var(--surface-0, var(--bg))' : 'transparent' }}>
              <td style={{ ...tdBase, textAlign: 'left', fontWeight: 600, color: 'var(--text-2)', position: 'sticky', left: 0, background: ri % 2 === 1 ? 'var(--surface-0, var(--bg))' : 'var(--surface-1)', zIndex: 1, borderRight: '1.5px solid var(--border-2)' }}>
                {ds.label}
              </td>
              {ds.data.map((val, ci) => (
                <td key={ci} style={{ ...tdBase, background: heatBg(val) }}>{fmt(val)}</td>
              ))}
              {totals !== false && (
                <td style={{ ...tdBase, fontWeight: 700, borderLeft: '1.5px solid var(--border-2)' }}>{fmt(rowTotals[ri])}</td>
              )}
            </tr>
          ))}
        </tbody>
        {totals !== false && (
          <tfoot>
            <tr>
              <td style={{ ...tdBase, textAlign: 'left', fontWeight: 800, color: 'var(--text-1)', position: 'sticky', left: 0, background: 'var(--surface-2)', zIndex: 1, borderRight: '1.5px solid var(--border-2)', borderTop: '2px solid var(--border-2)' }}>
                Total
              </td>
              {colTotals.map((v, ci) => (
                <td key={ci} style={{ ...tdBase, fontWeight: 700, background: 'var(--surface-2)', borderTop: '2px solid var(--border-2)' }}>{fmt(v)}</td>
              ))}
              <td style={{ ...tdBase, fontWeight: 800, borderLeft: '1.5px solid var(--border-2)', background: 'var(--surface-2)', borderTop: '2px solid var(--border-2)' }}>{fmt(grandTotal)}</td>
            </tr>
          </tfoot>
        )}
      </table>
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
  } else if (type === 'area') {
    chart = (
      <AreaChart data={xyData} margin={margin}>
        <Gradients />
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-2)" opacity={0.6} />
        <XAxis dataKey="name" {...ax} angle={-35} textAnchor="end" interval={0} height={60} />
        <YAxis {...ax} width={40} axisLine={false} tickLine={false} />
        <Tooltip {...tip} />
        {datasets.length > 1 && <Legend verticalAlign="top" align="right" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />}
        {datasets.map((ds, i) => (
          <Area
            key={ds.label} type="monotone" dataKey={ds.label}
            stroke={CHART_COLORS[i % CHART_COLORS.length].start}
            fill={`url(#grad-${i % CHART_COLORS.length})`}
            strokeWidth={2.5} fillOpacity={0.25}
            dot={{ r: 3, strokeWidth: 2, fill: 'var(--surface)' }}
            animationDuration={1400}
          />
        ))}
      </AreaChart>
    );
  } else if (type === 'composed') {
    chart = (
      <ComposedChart data={xyData} margin={margin}>
        <Gradients />
        <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--border-2)" opacity={0.6} />
        <XAxis dataKey="name" {...ax} angle={-35} textAnchor="end" interval={0} height={60} />
        <YAxis {...ax} width={40} axisLine={false} tickLine={false} />
        <Tooltip {...tip} />
        {datasets.length > 1 && <Legend verticalAlign="top" align="right" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />}
        {datasets.map((ds, i) =>
          i === datasets.length - 1 && datasets.length > 1 ? (
            <Line key={ds.label} type="monotone" dataKey={ds.label}
              stroke={CHART_COLORS[i % CHART_COLORS.length].start} strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: 'var(--surface)' }} animationDuration={1400} />
          ) : (
            <Bar key={ds.label} dataKey={ds.label}
              fill={`url(#grad-${i % CHART_COLORS.length})`}
              radius={[5, 5, 0, 0]} animationDuration={1200}
              barSize={Math.min(36, 280 / xyData.length)} />
          )
        )}
      </ComposedChart>
    );
  } else if (type === 'radar') {
    const radarData = labels.map((name, i) => {
      const obj = { name };
      datasets.forEach(ds => { obj[ds.label] = ds.data[i] || 0; });
      return obj;
    });
    chart = (
      <RadarChart data={radarData} margin={{ top: 10, right: 30, left: 30, bottom: 10 }}>
        <PolarGrid stroke="var(--border-2)" />
        <PolarAngleAxis dataKey="name" {...ax} />
        <PolarRadiusAxis {...ax} axisLine={false} tickLine={false} />
        {datasets.length > 1 && <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 11 }} />}
        {datasets.map((ds, i) => (
          <Radar key={ds.label} name={ds.label} dataKey={ds.label}
            stroke={CHART_COLORS[i % CHART_COLORS.length].start}
            fill={CHART_COLORS[i % CHART_COLORS.length].start}
            fillOpacity={0.25} strokeWidth={2} animationDuration={1200} />
        ))}
        <Tooltip {...tip} />
      </RadarChart>
    );
  } else if (type === 'scatter') {
    const scatterData = labels.map((name, i) => ({ x: i + 1, y: datasets[0]?.data[i] || 0, name }));
    chart = (
      <ScatterChart margin={margin}>
        <CartesianGrid strokeDasharray="4 4" stroke="var(--border-2)" opacity={0.6} />
        <XAxis type="number" dataKey="x" name="index" {...ax} axisLine={false} tickLine={false} />
        <YAxis type="number" dataKey="y" name="value" {...ax} width={40} axisLine={false} tickLine={false} />
        <ZAxis range={[40, 40]} />
        <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ payload }) => {
          if (!payload?.length) return null;
          const d = payload[0]?.payload;
          return (
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
              <div style={{ fontWeight: 600 }}>{labels[d?.x - 1] || d?.x}</div>
              <div style={{ color: CHART_COLORS[0].start }}>{Number(d?.y).toLocaleString()}</div>
            </div>
          );
        }} />
        {datasets.map((ds, i) => (
          <Scatter key={ds.label} name={ds.label}
            data={labels.map((name, j) => ({ x: j + 1, y: ds.data[j] || 0, name }))}
            fill={CHART_COLORS[i % CHART_COLORS.length].start} fillOpacity={0.85} />
        ))}
      </ScatterChart>
    );
  } else if (type === 'radial-bar') {
    const rData = singleData.map((d, i) => ({ ...d, fill: CHART_COLORS[i % CHART_COLORS.length].start }));
    chart = (
      <RadialBarChart innerRadius="20%" outerRadius="90%" data={rData} startAngle={180} endAngle={0}
        margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
        <RadialBar dataKey="value" label={{ position: 'insideStart', fill: '#fff', fontSize: 10, fontWeight: 600 }} animationDuration={1400} />
        <Legend iconSize={10} layout="horizontal" verticalAlign="bottom" wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
        <Tooltip {...tip} formatter={(v) => v.toLocaleString()} />
      </RadialBarChart>
    );
  } else if (type === 'funnel') {
    const funnelData = singleData.map((d, i) => ({
      ...d, fill: CHART_COLORS[i % CHART_COLORS.length].start,
    }));
    chart = (
      <FunnelChart margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
        <Tooltip {...tip} formatter={(v) => v.toLocaleString()} />
        <Funnel dataKey="value" data={funnelData} isAnimationActive animationDuration={1200}>
          <LabelList position="center" fill="#fff" fontSize={11} fontWeight={600} formatter={(v, entry) => entry?.name ? `${entry.name}: ${Number(v).toLocaleString()}` : v} />
        </Funnel>
      </FunnelChart>
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
      {type === 'matrix' ? (
        <MatrixTable chartData={chartData} />
      ) : (
        <ResponsiveContainer width="100%" height={['treemap', 'radar', 'radial-bar', 'funnel'].includes(type) ? 360 : 320}>
          {chart}
        </ResponsiveContainer>
      )}
    </div>
  );
}

function parseMessageParts(content) {
  const parts = [];
  const re = /\[(CHART|ORDER_ACTION)\]([\s\S]*?)\[\/\1\]/g;
  let last = 0, m;
  while ((m = re.exec(content)) !== null) {
    if (m.index > last) parts.push({ kind: 'text', text: content.slice(last, m.index) });
    if (m[1] === 'CHART') {
      try { parts.push({ kind: 'chart', data: JSON.parse(m[2]) }); }
      catch { parts.push({ kind: 'text', text: m[0] }); }
    } else {
      try { parts.push({ kind: 'order_action', data: JSON.parse(m[2]) }); }
      catch { parts.push({ kind: 'text', text: m[0] }); }
    }
    last = m.index + m[0].length;
  }
  if (last < content.length) parts.push({ kind: 'text', text: content.slice(last) });
  return parts;
}

const CONFIRMED_KEY = 'finbot_confirmed_orders';
function isConfirmed(action) {
  try { return (JSON.parse(localStorage.getItem(CONFIRMED_KEY)) || []).includes(JSON.stringify(action)); } catch { return false; }
}
function markConfirmed(action) {
  try {
    const existing = JSON.parse(localStorage.getItem(CONFIRMED_KEY)) || [];
    localStorage.setItem(CONFIRMED_KEY, JSON.stringify([...existing, JSON.stringify(action)]));
  } catch {}
}

function OrderActionCard({ action, botColor }) {
  const [status, setStatus] = useState(() => isConfirmed(action) ? 'done' : 'pending');
  const [errorMsg, setErrorMsg] = useState('');

  function localAdd(key, row) {
    const existing = (() => { try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; } })();
    localStorage.setItem(key, JSON.stringify([{ id: Date.now(), createdAt: new Date().toISOString(), ...row }, ...existing]));
  }

  const execute = async () => {
    setStatus('executing');
    try {
      const { type, employeeId, employeeName } = action;
      if (type === 'promotion') {
        localAdd('hr_promotion_orders', {
          employeeId,
          empName: employeeName,
          newPosition: action.newPosition,
          oldSalary: action.oldSalary,
          newSalary: action.newSalary,
          effectiveDate: action.effectiveDate,
          notes: action.notes || '',
        });
      } else if (type === 'firing') {
        localAdd('hr_firing_orders', {
          employeeId,
          empName: employeeName,
          terminationDate: action.endDate,
          reason: action.reason,
          notes: action.notes || '',
        });
        await api.patch(`/employees/${employeeId}/end-date`, { end_date: action.endDate });
      } else if (type === 'advance') {
        const startDate = new Date(action.startMonth + '-01');
        for (let i = 0; i < action.numMonths; i++) {
          const d = new Date(startDate.getFullYear(), startDate.getMonth() + i + 1, 0);
          const dateStr = d.toISOString().slice(0, 10);
          const monthlyAmount = action.totalAmount / action.numMonths;
          await api.post(`/employees/${employeeId}/units`, {
            type: 'Advance',
            amount: monthlyAmount,
            date: dateStr,
            currency: action.currency || 'GEL',
            include_in_salary: true,
          });
        }
      } else if (type === 'adjusting') {
        await api.post(`/employees/${employeeId}/units`, {
          type: action.unitType,
          amount: action.amount,
          date: new Date().toISOString().slice(0, 10),
          currency: action.currency || 'GEL',
          include_in_salary: true,
        });
      }
      markConfirmed(action);
      setStatus('done');
    } catch (err) {
      setErrorMsg(err.response?.data?.error || err.message || 'Failed');
      setStatus('error');
    }
  };

  const typeLabel = {
    promotion: 'Promotion Order',
    firing: 'Termination Order',
    advance: 'Advance Payment Order',
    adjusting: 'Salary Adjustment',
  }[action.type] || 'HR Order';

  const details = [];
  if (action.employeeName) details.push(['Employee', action.employeeName]);
  if (action.newPosition) details.push(['New Position', action.newPosition]);
  if (action.oldSalary != null && action.newSalary != null)
    details.push(['Salary Change', `${action.oldSalary} → ${action.newSalary}`]);
  if (action.effectiveDate) details.push(['Effective Date', action.effectiveDate]);
  if (action.endDate) details.push(['End Date', action.endDate]);
  if (action.reason) details.push(['Reason', action.reason]);
  if (action.totalAmount != null) details.push(['Total Amount', `${action.totalAmount} ${action.currency || 'GEL'}`]);
  if (action.numMonths) details.push(['Months', action.numMonths]);
  if (action.startMonth) details.push(['Start Month', action.startMonth]);
  if (action.unitType) details.push(['Type', action.unitType]);
  if (action.amount != null) details.push(['Amount', `${action.amount} ${action.currency || 'GEL'}`]);

  const color = botColor || '#3b82f6';

  return (
    <div style={{
      margin: '12px 0',
      borderRadius: 14,
      border: `1.5px solid ${color}44`,
      background: `linear-gradient(135deg, ${color}08, ${color}14)`,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px',
        background: `${color}18`,
        borderBottom: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
          <path d="M8 13h8"/><path d="M8 17h8"/>
        </svg>
        <span style={{ fontSize: 12, fontWeight: 700, color, letterSpacing: '-0.2px' }}>{typeLabel}</span>
      </div>
      <div style={{ padding: '10px 14px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <tbody>
            {details.map(([k, v]) => (
              <tr key={k}>
                <td style={{ color: 'var(--text-3)', paddingBottom: 4, paddingRight: 12, whiteSpace: 'nowrap', verticalAlign: 'top' }}>{k}</td>
                <td style={{ color: 'var(--text)', fontWeight: 600, paddingBottom: 4 }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {status === 'pending' && (
          <button
            onClick={execute}
            style={{
              marginTop: 10, padding: '6px 16px', borderRadius: 8,
              background: color, color: '#fff', border: 'none',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            Confirm & Create Order
          </button>
        )}
        {status === 'executing' && (
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-3)' }}>Creating order...</div>
        )}
        {status === 'done' && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#10b981', fontWeight: 600 }}>
            ✓ Order created successfully
          </div>
        )}
        {status === 'error' && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#ef4444' }}>
            Error: {errorMsg}
          </div>
        )}
      </div>
    </div>
  );
}

function MessageContent({ content, botColor }) {
  const parts = parseMessageParts(content);
  return (
    <>
      {parts.map((p, i) =>
        p.kind === 'chart'
          ? <ChartBlock key={i} chartData={p.data} />
          : p.kind === 'order_action'
          ? <OrderActionCard key={i} action={p.data} botColor={botColor} />
          : <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{p.text}</span>
      )}
    </>
  );
}

// ── Chat view ────────────────────────────────────────────────────────────────
export function BotChat({ bot, showHeader = true }) {
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
      const allDlTables = readDLTables();
      const dlTablesData = (bot.dataSources || [])
        .filter(s => s.startsWith('dl_table:'))
        .map(key => allDlTables.find(t => t.id === key.replace('dl_table:', '')))
        .filter(Boolean);

      const res = await api.post('/finbots/chat', {
        botName: bot.name,
        dataSources: (bot.dataSources || []).filter(s => !s.startsWith('dl_table:') && !s.startsWith('__pref_chart:')),
        systemPrompt: bot.systemPrompt || '',
        preferredChartType: bot.preferredChart || 'bar',
        messages: newMessages.filter(m => m.role === 'user' || m.role === 'assistant'),
        dlTablesData,
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
  const connectedDlTables = (() => {
    const all = readDLTables();
    return (bot.dataSources || [])
      .filter(s => s.startsWith('dl_table:'))
      .map(key => all.find(t => t.id === key.replace('dl_table:', '')))
      .filter(Boolean);
  })();
  const sourceLabels = [
    ...connectedSources.map(s => t(s.labelKey)),
    ...connectedDlTables.map(tbl => tbl.name),
  ];
  const hasSources = sourceLabels.length > 0;

  return (
    <div className="fb-chat">
      {/* Chat header */}
      {showHeader && (
      <div className="fb-chat-header">
        <BotAvatar color={bot.color} icon={bot.icon} size={38} />
        <div>
          <div className="fb-chat-bot-name">{bot.name}</div>
          <div className="fb-chat-bot-meta">
            {!hasSources
              ? 'No data sources connected'
              : sourceLabels.join(', ')}
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
      )}

      {/* Messages */}
      <div className="fb-messages">
        {messages.length === 0 && (
          <div className="fb-empty-chat">
            <BotAvatar color={bot.color} icon={bot.icon} size={56} />
            <div className="fb-empty-chat-name">{bot.name}</div>
            <div className="fb-empty-chat-hint">
              {!hasSources
                ? 'No data sources connected. Edit this bot to connect data.'
                : `Connected to: ${sourceLabels.join(', ')}`}
            </div>
            {hasSources && (
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
              <div className="fb-msg-text"><MessageContent content={msg.content} botColor={bot.color} /></div>
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

      // Persist the floating-widget preference against the saved (real) id.
      setFloating(savedBot.id, !!bot.floating);

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
                  {(() => {
                    if (!bot.dataSources?.length) return t('fb.noDataConnected');
                    const dlTables = readDLTables();
                    const labels = bot.dataSources.map(s => {
                      const def = DATA_SOURCE_DEFS.find(d => d.key === s);
                      if (def?.labelKey) return t(def.labelKey);
                      if (s.startsWith('dl_table:')) {
                        const tbl = dlTables.find(x => x.id === s.replace('dl_table:', ''));
                        return tbl ? tbl.name : null;
                      }
                      return s;
                    }).filter(Boolean);
                    return labels.length ? labels.join(', ') : t('fb.noDataConnected');
                  })()}
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
