import React, { useMemo, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap, MarkerType, useNodesState } from 'reactflow';
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
  const [selectedId, setSelectedId] = useState(null);

  const initialNodes = useMemo(() => CONNECTION_NODES.map(n => {
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
        cursor: 'grab',
      },
    };
  }), []);

  // Node positions live in React state (not a plain memo) so dragging can
  // actually update them — without this, React Flow's uncontrolled drag
  // preview snaps back on the next render since nothing owns the position.
  const [allNodes, , onNodesChange] = useNodesState(initialNodes);

  const allEdges = useMemo(() => CONNECTION_EDGES.map((e, i) => {
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

  // When a node is selected, keep only it plus its direct (1-hop) neighbors
  // and the edges connecting them — everything else is hidden.
  const connectedIds = useMemo(() => {
    if (!selectedId) return null;
    const ids = new Set([selectedId]);
    CONNECTION_EDGES.forEach(e => {
      if (e.source === selectedId) ids.add(e.target);
      if (e.target === selectedId) ids.add(e.source);
    });
    return ids;
  }, [selectedId]);

  const nodes = connectedIds ? allNodes.filter(n => connectedIds.has(n.id)) : allNodes;
  const edges = connectedIds
    ? allEdges.filter(e => e.source === selectedId || e.target === selectedId)
    : allEdges;

  const selectedLabel = selectedId ? CONNECTION_NODES.find(n => n.id === selectedId)?.label : null;

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
        overflow: 'hidden', background: '#fff', position: 'relative',
      }}>
        {selectedId && (
          <div style={{
            position: 'absolute', top: 12, left: 12, zIndex: 5,
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8,
            padding: '6px 10px', fontSize: 12, fontWeight: 600, color: '#1e293b',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}>
            Showing connections for: {selectedLabel}
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              style={{
                border: 'none', background: '#f1f5f9', borderRadius: 6,
                padding: '3px 8px', fontSize: 11.5, fontWeight: 600,
                color: '#475569', cursor: 'pointer',
              }}
            >
              Show all ✕
            </button>
          </div>
        )}
        <ReactFlow
          key={selectedId || 'all'}
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          minZoom={0.3}
          maxZoom={1.5}
          nodesDraggable={true}
          nodesConnectable={false}
          elementsSelectable={true}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => setSelectedId(prev => prev === node.id ? null : node.id)}
          onPaneClick={() => setSelectedId(null)}
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
