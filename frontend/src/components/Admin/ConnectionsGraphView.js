import React, { useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, MarkerType } from 'reactflow';
import 'reactflow/dist/style.css';
import { CONNECTION_NODES, CONNECTION_EDGES, CONNECTION_COLS } from './moduleConnections';

const TYPE_COLOR = {
  channel: '#5c96e0',
  brain: '#625db2',
  action: '#d59b41',
  entity: '#6ac79c',
  downstream: '#f68ab2',
};

const TYPE_LABEL = {
  channel: 'Channel',
  brain: 'Shared Brain',
  action: 'Action',
  entity: 'Entity (DB)',
  downstream: 'Downstream',
};

export default function ConnectionsGraphView() {
  const nodes = useMemo(() => CONNECTION_NODES.map(n => {
    const color = TYPE_COLOR[n.type] || '#94a3b8';
    return {
      id: n.id,
      data: { label: n.label },
      position: { x: CONNECTION_COLS[n.col], y: n.row * 90 },
      style: {
        background: `${color}18`,
        border: `1.5px solid ${color}88`,
        borderRadius: 10,
        padding: '8px 12px',
        fontSize: 11.5,
        fontWeight: 600,
        color: '#1e293b',
        whiteSpace: 'pre-line',
        textAlign: 'center',
        width: 170,
      },
    };
  }), []);

  const edges = useMemo(() => CONNECTION_EDGES.map((e, i) => {
    const sourceNode = CONNECTION_NODES.find(n => n.id === e.source);
    const color = TYPE_COLOR[sourceNode?.type] || '#94a3b8';
    return {
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      label: e.label,
      labelStyle: { fontSize: 9.5, fill: 'var(--text-3)', fontWeight: 600 },
      labelBgStyle: { fill: 'var(--surface)', fillOpacity: 0.9 },
      style: { stroke: color, strokeWidth: 1.5 },
      markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      animated: sourceNode?.type === 'brain',
    };
  }), []);

  return (
    <div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 12, fontSize: 11.5 }}>
        {Object.entries(TYPE_LABEL).map(([key, label]) => (
          <span key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text-3)' }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: TYPE_COLOR[key], display: 'inline-block' }} />
            {label}
          </span>
        ))}
      </div>
      <p style={{ margin: '0 0 14px', fontSize: 12.5, color: 'var(--text-3)', maxWidth: 720 }}>
        Reads left → right: a channel triggers an action, an action writes to one or more
        database entities, and those entities feed downstream views. Add a future connection in{' '}
        <code style={{ background: 'var(--surface-2)', padding: '1px 5px', borderRadius: 4 }}>
          frontend/src/components/Admin/moduleConnections.js
        </code> — one node (pick a column 0–4 and a row) and one edge.
      </p>
      <div style={{
        height: '65vh', border: '1px solid var(--border-2)', borderRadius: 14,
        overflow: 'hidden', background: '#fff',
      }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.3}
          maxZoom={1.5}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
        >
          <Background gap={16} size={1} color="#e2e8f0" />
          <Controls showInteractive={false} />
          <MiniMap
            nodeColor={(n) => {
              const found = CONNECTION_NODES.find(cn => cn.id === n.id);
              return TYPE_COLOR[found?.type] || '#94a3b8';
            }}
            maskColor="rgba(0,0,0,0.06)"
          />
        </ReactFlow>
      </div>
    </div>
  );
}
