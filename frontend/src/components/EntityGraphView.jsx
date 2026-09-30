import React, { useState, useEffect, useRef } from 'react';
import { Share2, ZoomIn, ZoomOut, RotateCcw, ShieldAlert, Smartphone, CreditCard, MapPin, User, ArrowUpRight } from 'lucide-react';

const ENTITY_CONFIG = {
  user: { color: '#6366f1', label: 'Buyer Account', icon: User, radius: 18 },
  txn: { color: '#f43f5e', label: 'Transaction', icon: ShieldAlert, radius: 22 },
  device: { color: '#f59e0b', label: 'Device ID', icon: Smartphone, radius: 16 },
  pmt: { color: '#06b6d4', label: 'Payment Token', icon: CreditCard, radius: 16 },
  addr: { color: '#a855f7', label: 'Shipping Address', icon: MapPin, radius: 16 },
  default: { color: '#64748b', label: 'Entity', icon: Share2, radius: 14 }
};

export default function EntityGraphView({ neighborhood, activeTxnId }) {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const [selectedNode, setSelectedNode] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // In-memory simulation nodes and links
  const simulationRef = useRef({
    nodes: [],
    links: [],
    animId: null
  });

  const rawNodes = neighborhood?.nodes || [];
  const rawLinks = neighborhood?.links || [];

  // Initialize and run simple 2D force layout
  useEffect(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth || 600;
    const height = 400;

    // Build node map
    const nodeMap = new Map();
    rawNodes.forEach((n, idx) => {
      // Position nodes in a loose ring around center
      const angle = (idx / Math.max(rawNodes.length, 1)) * 2 * Math.PI;
      const dist = n.type === 'txn' ? 40 : 130 + (idx % 3) * 30;
      nodeMap.set(n.id, {
        ...n,
        x: width / 2 + Math.cos(angle) * dist + (Math.random() - 0.5) * 20,
        y: height / 2 + Math.sin(angle) * dist + (Math.random() - 0.5) * 20,
        vx: 0,
        vy: 0
      });
    });

    const nodes = Array.from(nodeMap.values());
    const links = rawLinks.map(l => ({
      sourceNode: nodeMap.get(l.source) || { x: width / 2, y: height / 2 },
      targetNode: nodeMap.get(l.target) || { x: width / 2, y: height / 2 },
      relationship: l.relationship
    }));

    simulationRef.current.nodes = nodes;
    simulationRef.current.links = links;

    // Gentle spring simulation loop
    let tick = 0;
    const step = () => {
      if (tick < 120) {
        // Repulsion
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[j].x - nodes[i].x;
            const dy = nodes[j].y - nodes[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            if (dist < 180) {
              const force = (180 - dist) / dist * 0.05;
              nodes[i].x -= dx * force;
              nodes[i].y -= dy * force;
              nodes[j].x += dx * force;
              nodes[j].y += dy * force;
            }
          }
        }

        // Link attraction
        links.forEach(l => {
          const dx = l.targetNode.x - l.sourceNode.x;
          const dy = l.targetNode.y - l.sourceNode.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const targetDist = 90;
          const force = (dist - targetDist) / dist * 0.04;
          l.sourceNode.x += dx * force;
          l.sourceNode.y += dy * force;
          l.targetNode.x -= dx * force;
          l.targetNode.y -= dy * force;
        });

        // Center gravity
        nodes.forEach(n => {
          n.x += (width / 2 - n.x) * 0.01;
          n.y += (height / 2 - n.y) * 0.01;
        });

        tick++;
      }

      drawCanvas();
      simulationRef.current.animId = requestAnimationFrame(step);
    };

    simulationRef.current.animId = requestAnimationFrame(step);

    return () => {
      if (simulationRef.current.animId) {
        cancelAnimationFrame(simulationRef.current.animId);
      }
    };
  }, [neighborhood]);

  // Canvas drawing routine
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);
    ctx.save();

    // Pan & Zoom
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    const { nodes, links } = simulationRef.current;

    // Draw Links
    links.forEach(link => {
      ctx.beginPath();
      ctx.moveTo(link.sourceNode.x, link.sourceNode.y);
      ctx.lineTo(link.targetNode.x, link.targetNode.y);
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Relationship label at edge center
      const mx = (link.sourceNode.x + link.targetNode.x) / 2;
      const my = (link.sourceNode.y + link.targetNode.y) / 2;
      ctx.font = '9px monospace';
      ctx.fillStyle = '#64748b';
      ctx.textAlign = 'center';
      ctx.fillText(link.relationship || '', mx, my - 3);
    });

    // Draw Nodes
    nodes.forEach(node => {
      const cfg = ENTITY_CONFIG[node.type] || ENTITY_CONFIG.default;
      const isTargetTxn = node.id === `txn:${activeTxnId}` || node.id === activeTxnId;
      const isSelected = selectedNode?.id === node.id;
      const radius = isTargetTxn ? cfg.radius + 6 : cfg.radius;

      // Glow effect for flagged/selected
      if (isTargetTxn || node.risk === 'high_risk' || isSelected) {
        ctx.beginPath();
        ctx.arc(node.x, node.y, radius + 8, 0, 2 * Math.PI);
        ctx.fillStyle = isTargetTxn || node.risk === 'high_risk' 
          ? 'rgba(244, 63, 94, 0.3)' 
          : 'rgba(99, 102, 241, 0.3)';
        ctx.fill();
      }

      // Outer ring
      ctx.beginPath();
      ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = cfg.color;
      ctx.fill();
      ctx.lineWidth = isSelected ? 3 : 1.5;
      ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.7)';
      ctx.stroke();

      // Node text label
      ctx.font = isTargetTxn ? 'bold 11px sans-serif' : '10px sans-serif';
      ctx.fillStyle = '#f8fafc';
      ctx.textAlign = 'center';
      ctx.fillText(node.label || node.id, node.x, node.y + radius + 14);

      // Node type badge
      ctx.font = '8px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(node.type.toUpperCase(), node.x, node.y + radius + 24);
    });

    ctx.restore();
  };

  // Mouse interaction for click-to-select and pan
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
      drawCanvas();
    }
  };

  const handleMouseUp = (e) => {
    setIsDragging(false);
    // Check if clicked a node
    if (!containerRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left - offset.x) / zoom;
    const mouseY = (e.clientY - rect.top - offset.y) / zoom;

    const clicked = simulationRef.current.nodes.find(n => {
      const cfg = ENTITY_CONFIG[n.type] || ENTITY_CONFIG.default;
      const dist = Math.hypot(n.x - mouseX, n.y - mouseY);
      return dist <= cfg.radius + 6;
    });

    setSelectedNode(clicked || null);
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      {/* Header */}
      <div className="p-4 bg-slate-850 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Share2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm sm:text-base">
              Transaction Graph & Entity Connections
            </h3>
            <p className="text-xs text-slate-400">
              Heterogeneous multi-entity network (NetworkX in-memory egocentric subgraph)
            </p>
          </div>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1.5 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800">
          <button 
            onClick={() => setZoom(z => Math.min(2.5, z + 0.2))}
            className="p-1 text-slate-400 hover:text-white rounded transition"
            title="Zoom In"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button 
            onClick={() => setZoom(z => Math.max(0.4, z - 0.2))}
            className="p-1 text-slate-400 hover:text-white rounded transition"
            title="Zoom Out"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button 
            onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
            className="p-1 text-slate-400 hover:text-white rounded transition"
            title="Reset Pan/Zoom"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Interactive Entity Canvas */}
      <div 
        ref={containerRef} 
        className="w-full h-80 sm:h-96 relative bg-slate-950/80 cursor-grab active:cursor-grabbing overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          className="w-full h-full"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />

        {/* Selected Node Inspector Flyout */}
        {selectedNode && (
          <div className="absolute top-3 right-3 bg-slate-900/95 border border-slate-700/80 rounded-lg p-3 max-w-xs shadow-2xl backdrop-blur-md text-xs z-20">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
              <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: ENTITY_CONFIG[selectedNode.type]?.color }} />
                {selectedNode.type} Entity
              </span>
              <button 
                onClick={() => setSelectedNode(null)} 
                className="text-slate-400 hover:text-white font-mono px-1"
              >
                ✕
              </button>
            </div>
            <div className="space-y-1 text-slate-300">
              <div><span className="text-slate-500">ID:</span> <code className="text-sky-300">{selectedNode.id}</code></div>
              <div><span className="text-slate-500">Label:</span> {selectedNode.label}</div>
              <div><span className="text-slate-500">Risk Status:</span> <span className={selectedNode.risk === 'high_risk' ? 'text-rose-400 font-bold' : 'text-emerald-400'}>{selectedNode.risk}</span></div>
            </div>
          </div>
        )}
      </div>

      {/* Legend & Stats Footer */}
      <div className="p-3 bg-slate-850 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-4">
          {Object.entries(ENTITY_CONFIG).filter(([k]) => k !== 'default').map(([key, item]) => {
            const count = rawNodes.filter(n => n.type === key).length;
            return (
              <div key={key} className="flex items-center gap-1.5 text-slate-300">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.label}</span>
                <span className="bg-slate-800 text-slate-400 px-1.5 py-0.2 rounded-full font-mono text-[10px]">
                  {count}
                </span>
              </div>
            );
          })}
        </div>
        <div className="text-slate-500 font-mono text-[11px]">
          Total Entities: {rawNodes.length} • Relations: {rawLinks.length}
        </div>
      </div>
    </div>
  );
}
