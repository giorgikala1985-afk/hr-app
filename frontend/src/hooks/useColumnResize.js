import { useState, useRef, useCallback } from 'react';

/**
 * Provides drag-to-resize column widths for any table.
 * Usage:
 *   const { colWidths, onResizeMouseDown } = useColumnResize([120, 200, ...]);
 *
 *   <table style={{ tableLayout: 'fixed', width: colWidths.reduce((a,b)=>a+b,0) }}>
 *     <colgroup>{colWidths.map((w,i) => <col key={i} style={{ width: w }} />)}</colgroup>
 *     <thead><tr>
 *       {HEADERS.map((label, i) => (
 *         <th key={i} style={{ position:'relative', width: colWidths[i], overflow:'hidden', whiteSpace:'nowrap' }}>
 *           {label}
 *           <div onMouseDown={e => onResizeMouseDown(e, i)} style={HANDLE_STYLE}
 *             onMouseEnter={e => e.currentTarget.style.background='#cbd5e1'}
 *             onMouseLeave={e => e.currentTarget.style.background='transparent'} />
 *         </th>
 *       ))}
 *     </tr></thead>
 *   </table>
 */
export function useColumnResize(defaultWidths) {
  const [colWidths, setColWidths] = useState(defaultWidths);
  const resizing = useRef(null);

  const onResizeMouseDown = useCallback((e, index) => {
    e.preventDefault();
    resizing.current = { index, startX: e.clientX, startWidth: colWidths[index] };

    const onMouseMove = (ev) => {
      if (!resizing.current) return;
      const delta = ev.clientX - resizing.current.startX;
      const newWidth = Math.max(50, resizing.current.startWidth + delta);
      setColWidths(prev => {
        const next = [...prev];
        next[resizing.current.index] = newWidth;
        return next;
      });
    };

    const onMouseUp = () => {
      resizing.current = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [colWidths]);

  return { colWidths, onResizeMouseDown };
}

// Inline style for the drag handle element inside <th>
export const RESIZE_HANDLE_STYLE = {
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: 5,
  cursor: 'col-resize',
  userSelect: 'none',
  background: 'transparent',
};
