import React, { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { MODULE_MAP } from './moduleMap';

function countNodes(node) {
  return 1 + (node.children || []).reduce((sum, c) => sum + countNodes(c), 0);
}

function TreeNode({ node, depth, color }) {
  const hasChildren = node.children && node.children.length > 0;
  const [expanded, setExpanded] = useState(depth < 2);
  const nodeColor = node.color || color;
  const planned = node.status === 'planned';

  return (
    <li>
      <div
        className={`mm-node${hasChildren ? ' mm-node--clickable' : ''}`}
        onClick={() => hasChildren && setExpanded(v => !v)}
        style={{ borderColor: `${nodeColor}55`, background: planned ? 'transparent' : `${nodeColor}0f` }}
      >
        {node.icon && (
          <span className="mm-node-icon" style={{ color: nodeColor }}>
            <HugeiconsIcon icon={node.icon} size={14} strokeWidth={1.8} />
          </span>
        )}
        <span className="mm-node-label" style={{ color: planned ? 'var(--text-4)' : 'var(--text)', fontStyle: planned ? 'italic' : 'normal' }}>
          {node.label}
        </span>
        {planned && <span className="mm-badge">Planned</span>}
        {hasChildren && (
          <span className="mm-toggle">{expanded ? '−' : '+'}</span>
        )}
      </div>
      {hasChildren && expanded && (
        <ul>
          {node.children.map(child => (
            <TreeNode key={child.id} node={child} depth={depth + 1} color={nodeColor} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default function ModuleMapView() {
  const [zoom, setZoom] = useState(1);
  const total = countNodes(MODULE_MAP) - 1; // exclude the synthetic root

  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 16, flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-3)', maxWidth: 620 }}>
          Every section, tab, and sub-tab in Finpilot — click a node to expand or collapse it.
          {' '}<strong>{total}</strong> nodes mapped. To add a future module, add an entry to{' '}
          <code style={{ background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 4 }}>
            frontend/src/components/Admin/moduleMap.js
          </code> — set <code style={{ background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 4 }}>status: 'planned'</code> to
          show it dashed-out before it's built (see "Devices" under Documents).
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <button onClick={() => setZoom(z => Math.max(0.6, +(z - 0.1).toFixed(1)))} style={zoomBtnStyle}>−</button>
          <span style={{ fontSize: 12, color: 'var(--text-3)', width: 40, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(1.6, +(z + 0.1).toFixed(1)))} style={zoomBtnStyle}>+</button>
          <button onClick={() => setZoom(1)} style={{ ...zoomBtnStyle, width: 'auto', padding: '0 10px' }}>Reset</button>
        </div>
      </div>

      <div style={{
        border: '1px solid var(--border-2)', borderRadius: 14, background: 'var(--surface)',
        overflow: 'auto', padding: 24, maxHeight: '70vh',
      }}>
        <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: 'fit-content' }}>
          <ul className="mm-tree mm-tree--root">
            <TreeNode node={MODULE_MAP} depth={0} color={MODULE_MAP.color} />
          </ul>
        </div>
      </div>

      <style>{`
        .mm-tree, .mm-tree ul {
          list-style: none;
          margin: 0;
          padding-left: 0;
        }
        .mm-tree ul {
          padding-left: 28px;
          position: relative;
        }
        .mm-tree li {
          position: relative;
          padding: 4px 0;
        }
        .mm-tree ul > li {
          padding-left: 20px;
        }
        .mm-tree ul > li::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          border-left: 1.5px solid var(--border-2);
        }
        .mm-tree ul > li:last-child::before {
          bottom: auto;
          height: 17px;
        }
        .mm-tree ul > li::after {
          content: '';
          position: absolute;
          top: 17px;
          left: 0;
          width: 18px;
          border-top: 1.5px solid var(--border-2);
        }
        .mm-node {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border-radius: 8px;
          border: 1.5px solid;
          font-size: 12.5px;
          font-weight: 600;
          white-space: nowrap;
        }
        .mm-node--clickable { cursor: pointer; }
        .mm-node--clickable:hover { filter: brightness(0.97); }
        [data-theme="dark"] .mm-node--clickable:hover { filter: brightness(1.15); }
        .mm-node-icon { display: flex; align-items: center; }
        .mm-toggle {
          color: var(--text-4);
          font-size: 13px;
          font-weight: 700;
          margin-left: 2px;
          width: 12px;
          text-align: center;
        }
        .mm-badge {
          font-size: 9.5px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.4px;
          color: var(--text-4);
          border: 1px dashed var(--border-2);
          border-radius: 4px;
          padding: 1px 5px;
        }
      `}</style>
    </div>
  );
}

const zoomBtnStyle = {
  width: 26, height: 26, borderRadius: 6, border: '1px solid var(--border-2)',
  background: 'var(--surface)', color: 'var(--text-2)', fontSize: 14, fontWeight: 700,
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};
