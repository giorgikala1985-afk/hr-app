import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';

const HIER_KEY   = 'finpilot_hierarchies';
const ACTIVE_KEY = 'finpilot_hierarchy_active';

const NW = 160;        // node width
const NH = 52;         // node height
const CANVAS_W = 3200;
const CANVAS_H = 2000;

function uid() { return Math.random().toString(36).slice(2, 11); }

function loadHierarchies() {
  try {
    const s = JSON.parse(localStorage.getItem(HIER_KEY));
    if (s && s.length) return s;
  } catch {}
  return [{ id: 'h0', name: 'My Hierarchy', nodes: [], edges: [] }];
}

// Bezier path between two nodes (bottom-center → top-center)
function edgePath(src, tgt) {
  const sx = src.x + NW / 2, sy = src.y + NH;
  const tx = tgt.x + NW / 2, ty = tgt.y;
  const cy = Math.max(60, Math.abs(ty - sy) * 0.55);
  return `M ${sx} ${sy} C ${sx} ${sy + cy}, ${tx} ${ty - cy}, ${tx} ${ty}`;
}

// Bezier for rubber-band preview
function previewPath(src, mx, my) {
  const sx = src.x + NW / 2, sy = src.y + NH + 8;
  const cy = Math.max(40, Math.abs(my - sy) * 0.5);
  return `M ${sx} ${sy} C ${sx} ${sy + cy}, ${mx} ${my - cy}, ${mx} ${my}`;
}

const BLUE = '#3b82f6';
const RED  = '#ef4444';
const GREY = '#94a3b8';

export default function HierarchyBuilder() {
  const { t } = useLanguage();

  // ── data state ────────────────────────────────────────────────
  const [hierarchies, setHierarchies] = useState(loadHierarchies);
  const [activeId, setActiveId] = useState(() => {
    try { return localStorage.getItem(ACTIVE_KEY) || 'h0'; } catch { return 'h0'; }
  });

  // ── interaction state ─────────────────────────────────────────
  const [dragging,      setDragging]      = useState(null); // { nodeId, offX, offY }
  const [connecting,    setConnecting]    = useState(null); // { fromId, mouseX, mouseY }
  const [selectedNode,  setSelectedNode]  = useState(null);
  const [selectedEdge,  setSelectedEdge]  = useState(null);
  const [editingId,     setEditingId]     = useState(null);
  const [editingName,   setEditingName]   = useState('');
  const [hoverPort,     setHoverPort]     = useState(null);
  const [hoverTarget,   setHoverTarget]   = useState(null); // nodeId highlighted as drop target

  // ── refs (avoid stale closures in global event handlers) ───────
  const canvasRef      = useRef(null);
  const draggingRef    = useRef(null);
  const connectingRef  = useRef(null);
  const activeIdRef    = useRef(activeId);
  const didDragRef     = useRef(false);
  const hoverTargetRef = useRef(null);

  useEffect(() => { draggingRef.current    = dragging;    }, [dragging]);
  useEffect(() => { connectingRef.current  = connecting;  }, [connecting]);
  useEffect(() => { activeIdRef.current    = activeId;    }, [activeId]);
  useEffect(() => { hoverTargetRef.current = hoverTarget; }, [hoverTarget]);

  // ── derived ───────────────────────────────────────────────────
  const hier  = useMemo(() => hierarchies.find(h => h.id === activeId) || hierarchies[0], [hierarchies, activeId]);
  const nodes = hier?.nodes || [];
  const edges = hier?.edges || [];
  const nodeMap = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);

  // ── persistence helpers ───────────────────────────────────────
  const saveAll = useCallback((hs) => {
    localStorage.setItem(HIER_KEY, JSON.stringify(hs));
    setHierarchies(hs);
  }, []);

  const patchActive = useCallback((patch) => {
    setHierarchies(prev => {
      const next = prev.map(h => h.id === activeIdRef.current ? { ...h, ...patch } : h);
      localStorage.setItem(HIER_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // ── mouse helpers ─────────────────────────────────────────────
  const canvasMouse = useCallback((e) => {
    const el = canvasRef.current;
    if (!el) return { x: 0, y: 0 };
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left + el.scrollLeft, y: e.clientY - r.top + el.scrollTop };
  }, []);

  // ── global mouse events (set up once) ─────────────────────────
  useEffect(() => {
    const onMove = (e) => {
      const drag = draggingRef.current;
      const conn = connectingRef.current;

      if (drag) {
        didDragRef.current = true;
        const { x, y } = canvasMouse(e);
        setHierarchies(prev => {
          const next = prev.map(h => h.id === activeIdRef.current ? {
            ...h,
            nodes: h.nodes.map(n => n.id === drag.nodeId
              ? { ...n, x: Math.max(0, x - drag.offX), y: Math.max(0, y - drag.offY) }
              : n),
          } : h);
          localStorage.setItem(HIER_KEY, JSON.stringify(next));
          return next;
        });
      }

      if (conn) {
        const { x, y } = canvasMouse(e);
        setConnecting(prev => prev ? { ...prev, mouseX: x, mouseY: y } : null);

        // Detect target node under cursor
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const nodeEl = el?.closest('[data-nodeid]');
        const toId = nodeEl?.dataset.nodeid || null;
        const newTarget = (toId && toId !== conn.fromId) ? toId : null;
        if (newTarget !== hoverTargetRef.current) setHoverTarget(newTarget);
      }
    };

    const onUp = (e) => {
      const drag = draggingRef.current;
      const conn = connectingRef.current;

      if (drag) {
        setDragging(null);
      }

      if (conn) {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const nodeEl = el?.closest('[data-nodeid]');
        const toId = nodeEl?.dataset.nodeid;
        if (toId && toId !== conn.fromId) {
          // Create edge
          setHierarchies(prev => {
            const h = prev.find(h => h.id === activeIdRef.current);
            if (!h) return prev;
            if (h.edges.some(e => e.from === conn.fromId && e.to === toId)) return prev;
            const newEdge = { id: uid(), from: conn.fromId, to: toId };
            const next = prev.map(hh => hh.id === activeIdRef.current
              ? { ...hh, edges: [...hh.edges, newEdge] }
              : hh);
            localStorage.setItem(HIER_KEY, JSON.stringify(next));
            return next;
          });
        }
        setConnecting(null);
        setHoverTarget(null);
      }
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [canvasMouse]); // canvasMouse is stable

  // ── node ops ─────────────────────────────────────────────────
  const addNode = () => {
    const wrap = canvasRef.current;
    const cx = wrap ? wrap.scrollLeft + wrap.clientWidth / 2 - NW / 2 : 300;
    const cy = wrap ? wrap.scrollTop  + wrap.clientHeight / 2 - NH / 2 : 200;
    const n = { id: uid(), name: t('hier.newNode'), x: Math.round(cx), y: Math.round(cy) };
    patchActive({ nodes: [...nodes, n] });
    setSelectedNode(n.id);
    setSelectedEdge(null);
    setTimeout(() => { setEditingId(n.id); setEditingName(n.name); }, 60);
  };

  const deleteNode = (id) => {
    patchActive({
      nodes: nodes.filter(n => n.id !== id),
      edges: edges.filter(e => e.from !== id && e.to !== id),
    });
    if (selectedNode === id) setSelectedNode(null);
    if (editingId === id) setEditingId(null);
  };

  const deleteEdge = (id) => {
    patchActive({ edges: edges.filter(e => e.id !== id) });
    if (selectedEdge === id) setSelectedEdge(null);
  };

  const commitEdit = () => {
    if (!editingId) return;
    patchActive({ nodes: nodes.map(n => n.id === editingId ? { ...n, name: editingName.trim() || n.name } : n) });
    setEditingId(null);
  };

  // ── hierarchy ops ─────────────────────────────────────────────
  const addHierarchy = () => {
    const h = { id: uid(), name: t('hier.newHierarchy'), nodes: [], edges: [] };
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

  const renameHierarchy = (name) => saveAll(hierarchies.map(h => h.id === activeId ? { ...h, name } : h));

  const switchHierarchy = (id) => {
    setActiveId(id);
    localStorage.setItem(ACTIVE_KEY, id);
    setSelectedNode(null); setSelectedEdge(null);
    setConnecting(null); setDragging(null); setEditingId(null);
  };

  const connSrcNode = connecting ? nodeMap[connecting.fromId] : null;

  // ── keyboard delete ───────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement.tagName === 'INPUT') return;
        if (selectedNode) deleteNode(selectedNode);
        if (selectedEdge) deleteEdge(selectedEdge);
      }
      if (e.key === 'Escape') {
        setConnecting(null); setHoverTarget(null);
        setEditingId(null); setSelectedNode(null); setSelectedEdge(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // ── hint text ─────────────────────────────────────────────────
  const hint = connecting ? t('hier.hintConnecting')
    : selectedNode   ? t('hier.hintSelected')
    : selectedEdge   ? t('hier.hintEdge')
    : t('hier.hint');

  // ── render ────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 600 }}>

      {/* ── Toolbar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px',
        borderBottom: '1px solid var(--border-2)', flexShrink: 0,
        background: 'var(--surface)', flexWrap: 'wrap',
      }}>
        {/* Hierarchy name */}
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

        {/* Chart tabs */}
        {hierarchies.length > 1 && (
          <div style={{ display: 'flex', gap: 3, background: 'var(--surface-2)', borderRadius: 8, padding: 3 }}>
            {hierarchies.map(h => (
              <button
                key={h.id}
                onClick={() => switchHierarchy(h.id)}
                style={{
                  padding: '4px 12px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
                  background: h.id === activeId ? 'var(--surface)' : 'transparent',
                  color: h.id === activeId ? 'var(--text)' : 'var(--text-3)',
                  cursor: 'pointer',
                  boxShadow: h.id === activeId ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                  transition: 'all 0.13s',
                }}
              >{h.name}</button>
            ))}
          </div>
        )}

        <button onClick={addHierarchy} style={toolBtn()}>+ {t('hier.newHierarchy')}</button>

        {hierarchies.length > 1 && (
          <button onClick={deleteHierarchy} style={toolBtn('#ef444410', '#ef444440', RED)}>
            {t('hier.delete')}
          </button>
        )}

        <div style={{ flex: 1 }} />

        {/* Context actions */}
        {selectedNode && (
          <>
            <button
              onClick={() => { const n = nodeMap[selectedNode]; setEditingId(selectedNode); setEditingName(n?.name || ''); }}
              style={toolBtn()}
            >✏ {t('hier.rename')}</button>
            <button onClick={() => deleteNode(selectedNode)} style={toolBtn('#ef444410', '#ef444440', RED)}>
              ✕ {t('hier.deleteNode')}
            </button>
          </>
        )}
        {selectedEdge && (
          <button onClick={() => deleteEdge(selectedEdge)} style={toolBtn('#ef444410', '#ef444440', RED)}>
            ✕ {t('hier.deleteEdge')}
          </button>
        )}

        <button onClick={addNode} style={toolBtn(BLUE, BLUE, '#fff')}>
          + {t('hier.addNode')}
        </button>
      </div>

      {/* ── Canvas ── */}
      <div
        ref={canvasRef}
        onMouseDown={e => {
          // Click on canvas background = deselect
          if (e.target === canvasRef.current || e.target.classList.contains('canvas-inner')) {
            if (!didDragRef.current) {
              setSelectedNode(null);
              setSelectedEdge(null);
              if (editingId) commitEdit();
            }
            didDragRef.current = false;
          }
        }}
        style={{ flex: 1, overflow: 'auto', position: 'relative', background: 'var(--surface-2)' }}
      >
        <div
          className="canvas-inner"
          style={{ position: 'relative', width: CANVAS_W, height: CANVAS_H }}
        >
          {/* SVG layer: dots + edges + preview */}
          <svg
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'visible' }}
            onMouseDown={e => { if (e.target.tagName === 'svg') { setSelectedNode(null); setSelectedEdge(null); } }}
          >
            <defs>
              <pattern id="hb-dots" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="var(--border-2)" fillOpacity="0.7" />
              </pattern>
              {/* Arrow markers */}
              {[['arr', GREY], ['arr-sel', RED], ['arr-conn', BLUE]].map(([id, fill]) => (
                <marker key={id} id={id} markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
                  <path d="M0,0 L0,6 L8,3 z" fill={fill} />
                </marker>
              ))}
            </defs>

            {/* Dot grid */}
            <rect width="100%" height="100%" fill="url(#hb-dots)" />

            {/* Edges */}
            {edges.map(edge => {
              const src = nodeMap[edge.from], tgt = nodeMap[edge.to];
              if (!src || !tgt) return null;
              const d = edgePath(src, tgt);
              const isSel = selectedEdge === edge.id;
              return (
                <g key={edge.id}>
                  {/* Wide invisible hit zone */}
                  <path d={d} fill="none" stroke="transparent" strokeWidth={18}
                    style={{ cursor: 'pointer', pointerEvents: 'all' }}
                    onMouseDown={e => { e.stopPropagation(); setSelectedEdge(edge.id); setSelectedNode(null); if (editingId) commitEdit(); }}
                  />
                  {/* Visible line */}
                  <path d={d} fill="none"
                    stroke={isSel ? RED : GREY} strokeWidth={isSel ? 2.5 : 2}
                    markerEnd={isSel ? 'url(#arr-sel)' : 'url(#arr)'}
                    strokeLinejoin="round"
                    pointerEvents="none"
                  />
                </g>
              );
            })}

            {/* Preview rubber-band */}
            {connecting && connSrcNode && (
              <path
                d={previewPath(connSrcNode, connecting.mouseX, connecting.mouseY)}
                fill="none" stroke={BLUE} strokeWidth={2}
                strokeDasharray="7 4" markerEnd="url(#arr-conn)"
                pointerEvents="none"
              />
            )}
          </svg>

          {/* Node divs */}
          {nodes.map(node => {
            const isSel    = selectedNode === node.id;
            const isSrc    = connecting?.fromId === node.id;
            const isTarget = hoverTarget === node.id;
            const isDrag   = dragging?.nodeId === node.id;

            const borderColor = isTarget ? BLUE : isSrc ? '#f59e0b' : isSel ? BLUE : 'var(--border-2)';
            const shadow = (isSel || isTarget)
              ? `0 0 0 3px ${BLUE}30, 0 4px 20px rgba(0,0,0,0.12)`
              : '0 2px 8px rgba(0,0,0,0.08)';

            return (
              <div
                key={node.id}
                data-nodeid={node.id}
                style={{
                  position: 'absolute',
                  left: node.x, top: node.y,
                  width: NW, height: NH,
                  borderRadius: 12,
                  background: isTarget ? '#3b82f60e' : 'var(--surface)',
                  border: `2px solid ${borderColor}`,
                  boxShadow: shadow,
                  cursor: isDrag ? 'grabbing' : 'grab',
                  userSelect: 'none',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: isSel || isDrag ? 10 : 1,
                  transition: isDrag ? 'none' : 'border-color 0.12s, box-shadow 0.12s',
                }}
                onMouseDown={e => {
                  if (e.target.closest('.hb-port')) return;
                  e.stopPropagation();
                  didDragRef.current = false;
                  const { x, y } = canvasMouse(e);
                  setDragging({ nodeId: node.id, offX: x - node.x, offY: y - node.y });
                  setSelectedNode(node.id);
                  setSelectedEdge(null);
                  if (editingId && editingId !== node.id) commitEdit();
                }}
                onDoubleClick={e => {
                  e.stopPropagation();
                  setEditingId(node.id);
                  setEditingName(node.name);
                }}
              >
                {/* Name / edit input */}
                {editingId === node.id ? (
                  <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onBlur={commitEdit}
                    onKeyDown={e => {
                      if (e.key === 'Enter')  commitEdit();
                      if (e.key === 'Escape') setEditingId(null);
                      e.stopPropagation();
                    }}
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                    style={{
                      width: '90%', border: 'none', background: 'transparent',
                      color: 'var(--text)', fontSize: 13, fontWeight: 600,
                      outline: 'none', textAlign: 'center',
                    }}
                  />
                ) : (
                  <span style={{
                    fontSize: 13, fontWeight: 600, color: 'var(--text)',
                    padding: '0 12px', textAlign: 'center',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    width: '100%',
                  }}>
                    {node.name}
                  </span>
                )}

                {/* Connect port — bottom center */}
                <div
                  className="hb-port"
                  onMouseDown={e => {
                    e.stopPropagation();
                    e.preventDefault();
                    const { x, y } = canvasMouse(e);
                    setConnecting({ fromId: node.id, mouseX: x, mouseY: y });
                    setHoverPort(null);
                  }}
                  onMouseEnter={() => setHoverPort(node.id)}
                  onMouseLeave={() => setHoverPort(null)}
                  style={{
                    position: 'absolute',
                    bottom: hoverPort === node.id ? -11 : -8,
                    left: '50%', transform: 'translateX(-50%)',
                    width:  hoverPort === node.id ? 20 : 14,
                    height: hoverPort === node.id ? 20 : 14,
                    borderRadius: '50%',
                    background: hoverPort === node.id ? BLUE : 'var(--surface)',
                    border: `2.5px solid ${hoverPort === node.id ? BLUE : GREY}`,
                    cursor: 'crosshair',
                    transition: 'all 0.12s',
                    zIndex: 30,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: hoverPort === node.id ? `0 0 0 3px ${BLUE}25` : 'none',
                  }}
                >
                  {hoverPort === node.id && (
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="5" y1="1" x2="5" y2="9"/><line x1="1" y1="5" x2="9" y2="5"/>
                    </svg>
                  )}
                </div>
              </div>
            );
          })}

          {/* Empty state overlay */}
          {nodes.length === 0 && (
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 16, pointerEvents: 'none',
            }}>
              <svg width="72" height="72" viewBox="0 0 80 80" fill="none" stroke="var(--border-2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="28" y="4" width="24" height="18" rx="5"/>
                <line x1="40" y1="22" x2="40" y2="34"/>
                <line x1="40" y1="34" x2="14" y2="44"/>
                <line x1="40" y1="34" x2="66" y2="44"/>
                <rect x="2" y="44" width="24" height="18" rx="5"/>
                <rect x="54" y="44" width="24" height="18" rx="5"/>
              </svg>
              <span style={{ fontSize: 14, color: 'var(--text-4)', fontWeight: 500 }}>{t('hier.emptyCanvas')}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Hint bar ── */}
      <div style={{
        padding: '5px 20px', borderTop: '1px solid var(--border-2)',
        background: 'var(--surface)', fontSize: 11, color: 'var(--text-4)', flexShrink: 0,
      }}>
        {hint}
      </div>
    </div>
  );
}

function toolBtn(bg = 'var(--surface)', border = 'var(--border-2)', color = 'var(--text-3)') {
  return {
    padding: '6px 12px', borderRadius: 8, border: `1.5px solid ${border}`,
    background: bg, color, fontSize: 12, fontWeight: 600,
    cursor: 'pointer', whiteSpace: 'nowrap',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  };
}
