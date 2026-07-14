import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const HIER_KEY   = 'finpilot_hierarchies';
const ACTIVE_KEY = 'finpilot_hierarchy_active';

const NW = 156;  // node width
const NH = 44;   // node height
const HG = 36;   // horizontal gap between subtrees
const VG = 68;   // vertical gap between levels

function uid() {
  return Math.random().toString(36).slice(2, 11);
}

function loadHierarchies() {
  try {
    const s = JSON.parse(localStorage.getItem(HIER_KEY));
    if (s && s.length) return s;
  } catch {}
  return [{ id: 'h0', name: 'My Hierarchy', nodes: [] }];
}

function wouldCycle(nodes, childId, newParentId) {
  if (!newParentId) return false;
  const map = Object.fromEntries(nodes.map(n => [n.id, n]));
  let cur = newParentId;
  while (cur) {
    if (cur === childId) return true;
    cur = map[cur]?.parentId;
  }
  return false;
}

function computeLayout(nodes) {
  if (!nodes.length) return { positions: {}, svgW: 0, svgH: 0 };

  const validIds = new Set(nodes.map(n => n.id));
  const childrenOf = {};
  nodes.forEach(n => (childrenOf[n.id] = []));
  nodes.forEach(n => {
    if (n.parentId && validIds.has(n.parentId))
      childrenOf[n.parentId].push(n.id);
  });
  const roots = nodes.filter(n => !n.parentId || !validIds.has(n.parentId));

  const sw = {};
  const calcSW = (id) => {
    const ch = childrenOf[id] || [];
    sw[id] = ch.length ? ch.reduce((s, c) => s + calcSW(c), 0) : NW + HG;
    return sw[id];
  };
  roots.forEach(r => calcSW(r.id));

  const pos = {};
  const place = (id, x, depth) => {
    pos[id] = { x, y: depth * (NH + VG) + 50 };
    const ch = childrenOf[id] || [];
    let cx = x - sw[id] / 2;
    ch.forEach(cid => { place(cid, cx + sw[cid] / 2, depth + 1); cx += sw[cid]; });
  };

  let rx = 0;
  roots.forEach(r => { place(r.id, rx + sw[r.id] / 2, 0); rx += sw[r.id]; });

  // Normalize: left edge → NW/2 + 24
  const xs = Object.values(pos).map(p => p.x);
  const ys = Object.values(pos).map(p => p.y);
  const dx = NW / 2 + 24 - Math.min(...xs);
  Object.keys(pos).forEach(id => (pos[id].x += dx));

  const fxs = Object.values(pos).map(p => p.x);
  const svgW = Math.max(...fxs) + NW / 2 + 24;
  const svgH = Math.max(...ys) + NH + 44;

  return { positions: pos, svgW, svgH };
}

function trunc(s, max = 17) {
  return s.length > max ? s.slice(0, max) + '…' : s;
}

const ACCENT = '#3b82f6';
const AMBER  = '#f59e0b';

export default function HierarchyBuilder() {
  const { t } = useLanguage();

  const [hierarchies, setHierarchies] = useState(loadHierarchies);
  const [activeId, setActiveId] = useState(() => {
    try { return localStorage.getItem(ACTIVE_KEY) || 'h0'; } catch { return 'h0'; }
  });
  const [selectedId,  setSelectedId]  = useState(null);
  const [connectMode, setConnectMode] = useState(false);
  const [connectSrc,  setConnectSrc]  = useState(null);

  const hier  = useMemo(
    () => hierarchies.find(h => h.id === activeId) || hierarchies[0],
    [hierarchies, activeId],
  );
  const nodes = hier?.nodes || [];

  useEffect(() => {
    setSelectedId(null);
    setConnectMode(false);
    setConnectSrc(null);
  }, [activeId]);

  // ── persistence ──────────────────────────────────────────────
  const saveAll = useCallback((hs) => {
    localStorage.setItem(HIER_KEY, JSON.stringify(hs));
    setHierarchies(hs);
  }, []);

  const patchNodes = useCallback((newNodes) => {
    saveAll(hierarchies.map(h => h.id === activeId ? { ...h, nodes: newNodes } : h));
  }, [hierarchies, activeId, saveAll]);

  // ── node ops ─────────────────────────────────────────────────
  const addNode = () => {
    const n = { id: uid(), name: t('hier.newNode'), parentId: selectedId || null };
    patchNodes([...nodes, n]);
    setSelectedId(n.id);
  };

  const deleteNode = (id) => {
    patchNodes(
      nodes.filter(n => n.id !== id).map(n => n.parentId === id ? { ...n, parentId: null } : n),
    );
    if (selectedId === id) setSelectedId(null);
  };

  const renameNode = (id, name) => patchNodes(nodes.map(n => n.id === id ? { ...n, name } : n));

  const setParentOf = (childId, parentId) => {
    if (wouldCycle(nodes, childId, parentId)) return;
    patchNodes(nodes.map(n => n.id === childId ? { ...n, parentId: parentId || null } : n));
  };

  // ── hierarchy ops ─────────────────────────────────────────────
  const addHierarchy = () => {
    const h = { id: uid(), name: t('hier.newHierarchy'), nodes: [] };
    saveAll([...hierarchies, h]);
    setActiveId(h.id);
    localStorage.setItem(ACTIVE_KEY, h.id);
  };

  const deleteHierarchy = () => {
    if (hierarchies.length === 1) return;
    const next = hierarchies.filter(h => h.id !== activeId);
    saveAll(next);
    const nid = next[0].id;
    setActiveId(nid);
    localStorage.setItem(ACTIVE_KEY, nid);
  };

  const renameHierarchy = (name) =>
    saveAll(hierarchies.map(h => h.id === activeId ? { ...h, name } : h));

  const switchHierarchy = (id) => {
    setActiveId(id);
    localStorage.setItem(ACTIVE_KEY, id);
  };

  // ── connect mode ─────────────────────────────────────────────
  const handleCanvasClick = (nodeId) => {
    if (connectMode) {
      if (!connectSrc) {
        setConnectSrc(nodeId);
      } else if (connectSrc === nodeId) {
        setConnectSrc(null);
      } else {
        setParentOf(nodeId, connectSrc);
        setConnectSrc(null);
        setConnectMode(false);
      }
    } else {
      setSelectedId(nodeId === selectedId ? null : nodeId);
    }
  };

  const toggleConnect = () => {
    setConnectMode(v => !v);
    setConnectSrc(null);
  };

  // ── layout ───────────────────────────────────────────────────
  const { positions, svgW, svgH } = useMemo(() => computeLayout(nodes), [nodes]);

  const sourceNode = nodes.find(n => n.id === connectSrc);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 580 }}>

      {/* ── Top bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '14px 20px 12px',
        borderBottom: '1px solid var(--border-2)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <input
          value={hier?.name || ''}
          onChange={e => renameHierarchy(e.target.value)}
          style={{
            fontSize: 15, fontWeight: 700, color: 'var(--text)',
            border: 'none', background: 'transparent', outline: 'none',
            minWidth: 100, maxWidth: 200, padding: '2px 6px',
            borderBottom: '2px solid var(--border-2)',
          }}
          placeholder={t('hier.hierarchyName')}
        />

        {hierarchies.length > 1 && (
          <select
            value={activeId}
            onChange={e => switchHierarchy(e.target.value)}
            style={selectSty()}
          >
            {hierarchies.map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
        )}

        <button onClick={addHierarchy} style={btn('var(--surface)', 'var(--border-2)', 'var(--text-3)')}>
          + {t('hier.newHierarchy')}
        </button>

        {hierarchies.length > 1 && (
          <button onClick={deleteHierarchy} style={btn('var(--surface)', '#ef4444', '#ef4444')}>
            {t('hier.delete')}
          </button>
        )}

        <div style={{ flex: 1 }} />

        {/* Connect toggle */}
        <button
          onClick={toggleConnect}
          title={t('hier.connectHint')}
          style={btn(
            connectMode ? '#f59e0b22' : 'var(--surface)',
            connectMode ? AMBER : 'var(--border-2)',
            connectMode ? AMBER : 'var(--text-3)',
          )}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5"  r="3"/><circle cx="6"  cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          {connectMode ? t('hier.connecting') : t('hier.connect')}
        </button>

        {/* Add node */}
        <button onClick={addNode} style={btn(ACCENT, ACCENT, '#fff')}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          {t('hier.addNode')}
        </button>
      </div>

      {/* ── Main split ── */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

        {/* ── Left: node list ── */}
        <div style={{
          width: 272, flexShrink: 0, borderRight: '1px solid var(--border-2)',
          overflowY: 'auto', padding: '14px 10px',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-4)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
            {t('hier.nodes')} ({nodes.length})
          </div>

          {nodes.length === 0 && (
            <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-4)', fontSize: 13 }}>
              {t('hier.empty')}
            </div>
          )}

          {nodes.map(node => {
            const isSel = selectedId === node.id;
            return (
              <div
                key={node.id}
                onClick={() => !connectMode && setSelectedId(node.id === selectedId ? null : node.id)}
                style={{
                  border: `1.5px solid ${isSel ? ACCENT : 'var(--border-2)'}`,
                  borderRadius: 10, padding: '8px 10px',
                  background: isSel ? '#3b82f608' : 'var(--surface)',
                  cursor: 'pointer', transition: 'border-color 0.14s, background 0.14s',
                }}
              >
                {/* Name */}
                <input
                  value={node.name}
                  onChange={e => renameNode(node.id, e.target.value)}
                  onClick={e => e.stopPropagation()}
                  placeholder={t('hier.nodeName')}
                  style={{
                    width: '100%', border: 'none', background: 'transparent',
                    color: 'var(--text)', fontSize: 13, fontWeight: 600,
                    outline: 'none', padding: 0, marginBottom: 6,
                  }}
                />
                {/* Parent + delete row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <select
                    value={node.parentId || ''}
                    onChange={e => { e.stopPropagation(); setParentOf(node.id, e.target.value); }}
                    onClick={e => e.stopPropagation()}
                    style={selectSty(true)}
                  >
                    <option value="">{t('hier.root')}</option>
                    {nodes
                      .filter(n => n.id !== node.id && !wouldCycle(nodes, node.id, n.id))
                      .map(n => <option key={n.id} value={n.id}>{n.name || t('hier.unnamed')}</option>)}
                  </select>
                  <button
                    onClick={e => { e.stopPropagation(); deleteNode(node.id); }}
                    title={t('hier.deleteNode')}
                    style={{
                      border: 'none', background: 'none', color: '#ef444480',
                      cursor: 'pointer', fontSize: 16, padding: '2px 5px',
                      borderRadius: 4, lineHeight: 1, flexShrink: 0,
                    }}
                  >×</button>
                </div>
              </div>
            );
          })}

          <button
            onClick={addNode}
            style={{
              marginTop: 4, padding: '9px', borderRadius: 10,
              border: `1.5px dashed var(--border-2)`, background: 'transparent',
              color: 'var(--text-4)', fontSize: 13, cursor: 'pointer',
              fontWeight: 500, textAlign: 'center',
            }}
          >
            + {t('hier.addNode')}
          </button>
        </div>

        {/* ── Right: visual canvas ── */}
        <div style={{ flex: 1, overflow: 'auto', background: 'var(--surface-2)', position: 'relative' }}>
          {nodes.length === 0 ? (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 14, color: 'var(--text-4)',
            }}>
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.25 }}>
                <circle cx="12" cy="4"  r="2.5"/>
                <line x1="12" y1="6.5" x2="12" y2="10"/>
                <line x1="12"  y1="10" x2="6"  y2="13"/>
                <line x1="12"  y1="10" x2="18" y2="13"/>
                <circle cx="6"  cy="16" r="2.5"/>
                <circle cx="18" cy="16" r="2.5"/>
              </svg>
              <span style={{ fontSize: 14, fontWeight: 500 }}>{t('hier.emptyCanvas')}</span>
              <button onClick={addNode} style={{ ...btn(ACCENT, ACCENT, '#fff'), fontSize: 13 }}>
                + {t('hier.addNode')}
              </button>
            </div>
          ) : (
            <svg
              width={svgW}
              height={svgH}
              style={{ display: 'block', minWidth: '100%', minHeight: '100%' }}
            >
              {/* Grid dots */}
              <defs>
                <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
                  <circle cx="1" cy="1" r="1" fill="var(--border-2)" fillOpacity="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Edges */}
              {nodes.map(node => {
                if (!node.parentId || !positions[node.parentId] || !positions[node.id]) return null;
                const px = positions[node.parentId].x;
                const py = positions[node.parentId].y + NH;
                const cx = positions[node.id].x;
                const cy = positions[node.id].y;
                const my = (py + cy) / 2;
                return (
                  <path
                    key={`e${node.id}`}
                    d={`M ${px} ${py} C ${px} ${my}, ${cx} ${my}, ${cx} ${cy}`}
                    fill="none"
                    stroke="var(--border-2)"
                    strokeWidth={2}
                    strokeLinejoin="round"
                  />
                );
              })}

              {/* Nodes */}
              {nodes.map(node => {
                const p = positions[node.id];
                if (!p) return null;
                const nx = p.x - NW / 2;
                const ny = p.y;
                const isSel   = selectedId === node.id;
                const isSrc   = connectSrc === node.id;
                const stroke  = isSrc ? AMBER : isSel ? ACCENT : 'var(--border-2)';
                const fill    = isSrc ? '#f59e0b18' : isSel ? '#3b82f614' : 'var(--surface)';
                const sw      = isSrc || isSel ? 2.2 : 1.5;

                return (
                  <g
                    key={node.id}
                    onClick={() => handleCanvasClick(node.id)}
                    style={{ cursor: connectMode ? 'crosshair' : 'pointer' }}
                  >
                    {/* Shadow */}
                    <rect x={nx + 2} y={ny + 3} width={NW} height={NH} rx={10} fill="rgba(0,0,0,0.07)" />
                    {/* Box */}
                    <rect x={nx} y={ny} width={NW} height={NH} rx={10} fill={fill} stroke={stroke} strokeWidth={sw} />
                    {/* Name */}
                    <text
                      x={p.x} y={ny + NH / 2}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={13}
                      fontWeight={600}
                      fill="var(--text)"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      {trunc(node.name)}
                    </text>
                    {/* Connect-source indicator dot */}
                    {isSrc && (
                      <circle cx={p.x} cy={ny + NH + 8} r={4} fill={AMBER} />
                    )}
                  </g>
                );
              })}
            </svg>
          )}

          {/* Connect mode badge */}
          {connectMode && (
            <div style={{
              position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
              background: AMBER, color: '#fff', borderRadius: 20,
              padding: '6px 18px', fontSize: 12, fontWeight: 700,
              boxShadow: '0 2px 10px rgba(245,158,11,0.45)', pointerEvents: 'none',
              whiteSpace: 'nowrap',
            }}>
              {connectSrc
                ? `${t('hier.selectTarget')}: "${sourceNode?.name || ''}"`
                : t('hier.selectSource')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function btn(bg, border, color) {
  return {
    padding: '7px 13px', borderRadius: 8,
    border: `1.5px solid ${border}`,
    background: bg, color, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap', transition: 'opacity 0.15s',
    display: 'inline-flex', alignItems: 'center', gap: 5,
  };
}

function selectSty(compact = false) {
  return {
    flex: compact ? 1 : undefined,
    fontSize: compact ? 11 : 12,
    padding: compact ? '3px 6px' : '5px 10px',
    borderRadius: 7,
    border: '1px solid var(--border-2)',
    background: 'var(--surface-2)',
    color: 'var(--text-3)',
    outline: 'none',
    cursor: 'pointer',
  };
}
