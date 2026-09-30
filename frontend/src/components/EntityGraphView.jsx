import React, { useState, useMemo } from 'react';
import { 
  Share2, ZoomIn, ZoomOut, RotateCcw, ShieldAlert, 
  Smartphone, CreditCard, MapPin, User, Search, Filter, 
  X, CheckCircle, Info, Link as LinkIcon
} from 'lucide-react';

const ENTITY_CONFIG = {
  user: { color: '#818cf8', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30', label: 'Buyer Account', icon: User, radius: 24 },
  txn: { color: '#f43f5e', bg: 'bg-rose-500/10', border: 'border-rose-500/30', label: 'Transaction', icon: ShieldAlert, radius: 28 },
  device: { color: '#fbbf24', bg: 'bg-amber-500/10', border: 'border-amber-500/30', label: 'Device ID', icon: Smartphone, radius: 22 },
  pmt: { color: '#22d3ee', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30', label: 'Payment Token', icon: CreditCard, radius: 22 },
  addr: { color: '#c084fc', bg: 'bg-purple-500/10', border: 'border-purple-500/30', label: 'Shipping Address', icon: MapPin, radius: 22 },
  default: { color: '#94a3b8', bg: 'bg-slate-500/10', border: 'border-slate-500/30', label: 'Entity', icon: Share2, radius: 20 }
};

export default function EntityGraphView({ neighborhood, activeTxnId }) {
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [activeFilter, setActiveFilter] = useState("ALL");
  const [zoom, setZoom] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");

  const rawNodes = neighborhood?.nodes || [];
  const rawLinks = neighborhood?.links || [];

  // Compute STABLE, DETERMINISTIC Egocentric Radial Layout (No chaotic movement)
  const layout = useMemo(() => {
    const width = 800;
    const height = 400;
    const centerX = width / 2;
    const centerY = height / 2;

    const nodeMap = new Map();

    // 1. Identify center target transaction node
    const targetNodeId = rawNodes.find(n => n.id === `txn:${activeTxnId}` || n.id === activeTxnId)?.id || rawNodes[0]?.id;

    // Separate center node from outer nodes
    const outerNodes = rawNodes.filter(n => n.id !== targetNodeId);

    // Place center node directly in middle
    if (targetNodeId) {
      const centerRaw = rawNodes.find(n => n.id === targetNodeId);
      nodeMap.set(targetNodeId, {
        ...centerRaw,
        x: centerX,
        y: centerY,
        isCenter: true
      });
    }

    // Place outer nodes in concentric radial rings by type
    const ring1Types = ['user', 'device'];
    const ring2Types = ['pmt', 'addr', 'txn'];

    const ring1Nodes = outerNodes.filter(n => ring1Types.includes(n.type));
    const ring2Nodes = outerNodes.filter(n => !ring1Types.includes(n.type));

    // Position Ring 1 (Inner Ring - radius 120px)
    ring1Nodes.forEach((n, idx) => {
      const angle = (idx / Math.max(ring1Nodes.length, 1)) * 2 * Math.PI - Math.PI / 2;
      const radius = 130;
      nodeMap.set(n.id, {
        ...n,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      });
    });

    // Position Ring 2 (Outer Ring - radius 210px)
    ring2Nodes.forEach((n, idx) => {
      const angle = (idx / Math.max(ring2Nodes.length, 1)) * 2 * Math.PI - Math.PI / 4;
      const radius = 220;
      nodeMap.set(n.id, {
        ...n,
        x: centerX + Math.cos(angle) * radius,
        y: centerY + Math.sin(angle) * radius
      });
    });

    const nodesList = Array.from(nodeMap.values());

    const linksList = rawLinks.map(l => ({
      source: l.source,
      target: l.target,
      sourceNode: nodeMap.get(l.source) || { x: centerX, y: centerY },
      targetNode: nodeMap.get(l.target) || { x: centerX, y: centerY },
      relationship: l.relationship
    }));

    return { nodes: nodesList, links: linksList, nodeMap };
  }, [neighborhood, activeTxnId]);

  // Handle Search Filtering & Matching
  const searchMatchingIds = useMemo(() => {
    if (!searchQuery.trim()) return new Set();
    const q = searchQuery.toLowerCase();
    return new Set(
      layout.nodes
        .filter(n => n.id.toLowerCase().includes(q) || n.label?.toLowerCase().includes(q) || n.type?.toLowerCase().includes(q))
        .map(n => n.id)
    );
  }, [searchQuery, layout.nodes]);

  // Selected node details
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return layout.nodeMap.get(selectedNodeId) || null;
  }, [selectedNodeId, layout.nodeMap]);

  // Connected neighbors for selected node
  const connectedEdges = useMemo(() => {
    if (!selectedNodeId) return [];
    return layout.links.filter(l => l.source === selectedNodeId || l.target === selectedNodeId);
  }, [selectedNodeId, layout.links]);

  // Controls Handlers
  const handleZoomIn = () => setZoom(z => Math.min(2.0, z + 0.2));
  const handleZoomOut = () => setZoom(z => Math.max(0.5, z - 0.2));
  const handleReset = () => {
    setZoom(1);
    setSelectedNodeId(null);
    setSearchQuery("");
    setActiveFilter("ALL");
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col shadow-lg">
      {/* Header Bar */}
      <div className="p-3.5 bg-slate-850 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-indigo-500/10 text-indigo-400">
            <Share2 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm">
              Heterogeneous Entity Graph
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono">
                Stable Egocentric View
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Interactive multi-entity network: Click any node to inspect details
            </p>
          </div>
        </div>

        {/* Controls: Search Bar + Working Zoom Buttons */}
        <div className="flex items-center gap-2">
          {/* Working Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search entity..."
              className="bg-slate-950 border border-slate-800 rounded pl-7 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-36"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery("")} 
                className="absolute right-2 top-2 text-slate-500 hover:text-white text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Working Zoom Buttons */}
          <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
            <button 
              onClick={handleZoomIn}
              className="p-1 text-slate-400 hover:text-white transition flex items-center gap-1 text-xs"
              title="Zoom In (+)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>

            <span className="text-[10px] font-mono text-slate-400 font-bold px-1">
              {Math.round(zoom * 100)}%
            </span>

            <button 
              onClick={handleZoomOut}
              className="p-1 text-slate-400 hover:text-white transition flex items-center gap-1 text-xs"
              title="Zoom Out (-)"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <div className="w-px h-3 bg-slate-800 my-auto" />

            <button 
              onClick={handleReset}
              className="p-1 text-slate-400 hover:text-white transition"
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Graph Canvas Area */}
      <div className="relative w-full h-80 sm:h-96 bg-slate-950 overflow-hidden flex items-center justify-center">
        {/* SVG Render Engine for Crisp Stable Visuals & Working Node Clicks */}
        <div 
          className="w-full h-full transition-transform duration-300 ease-out flex items-center justify-center"
          style={{ transform: `scale(${zoom})`, transformOrigin: 'center center' }}
        >
          <svg 
            viewBox="0 0 800 400" 
            className="w-full h-full max-w-full max-h-full overflow-visible"
          >
            {/* 1. Render Links */}
            <g className="links">
              {layout.links.map((link, idx) => {
                const isSourceVisible = activeFilter === "ALL" || layout.nodeMap.get(link.source)?.type === activeFilter;
                const isTargetVisible = activeFilter === "ALL" || layout.nodeMap.get(link.target)?.type === activeFilter;
                if (!isSourceVisible && !isTargetVisible) return null;

                const isConnectedToSelected = selectedNodeId && (link.source === selectedNodeId || link.target === selectedNodeId);
                const isDimmed = selectedNodeId && !isConnectedToSelected;

                const midX = (link.sourceNode.x + link.targetNode.x) / 2;
                const midY = (link.sourceNode.y + link.targetNode.y) / 2;

                return (
                  <g key={`link-${idx}`} className="transition-opacity duration-300" style={{ opacity: isDimmed ? 0.15 : 1 }}>
                    <line
                      x1={link.sourceNode.x}
                      y1={link.sourceNode.y}
                      x2={link.targetNode.x}
                      y2={link.targetNode.y}
                      stroke={isConnectedToSelected ? '#38bdf8' : '#334155'}
                      strokeWidth={isConnectedToSelected ? 2.5 : 1.5}
                      strokeDasharray={link.relationship === 'SHARED_DEVICE' ? '4,4' : 'none'}
                    />
                    <text
                      x={midX}
                      y={midY - 4}
                      fill={isConnectedToSelected ? '#38bdf8' : '#64748b'}
                      fontSize="9"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {link.relationship}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* 2. Render Nodes */}
            <g className="nodes">
              {layout.nodes.map((node) => {
                const isVisible = activeFilter === "ALL" || node.type === activeFilter;
                if (!isVisible) return null;

                const cfg = ENTITY_CONFIG[node.type] || ENTITY_CONFIG.default;
                const Icon = cfg.icon;
                const isSelected = selectedNodeId === node.id;
                const isSearchMatch = searchMatchingIds.has(node.id);
                const isTargetTxn = node.id === `txn:${activeTxnId}` || node.id === activeTxnId;
                const isHighRisk = node.risk === 'high_risk' || isTargetTxn;

                const radius = isTargetTxn ? cfg.radius + 4 : cfg.radius;

                return (
                  <g
                    key={node.id}
                    onClick={() => setSelectedNodeId(node.id)}
                    className="cursor-pointer group transition-all duration-200"
                    style={{ opacity: selectedNodeId && !isSelected && !layout.links.some(l => (l.source === selectedNodeId && l.target === node.id) || (l.target === selectedNodeId && l.source === node.id)) ? 0.25 : 1 }}
                  >
                    {/* Pulsing Risk / Search Selection Ring */}
                    {(isHighRisk || isSelected || isSearchMatch) && (
                      <circle
                        cx={node.x}
                        cy={node.y}
                        r={radius + 6}
                        fill={isHighRisk ? 'rgba(244, 63, 94, 0.25)' : isSearchMatch ? 'rgba(56, 189, 248, 0.3)' : 'rgba(129, 140, 248, 0.3)'}
                        stroke={isHighRisk ? '#f43f5e' : '#38bdf8'}
                        strokeWidth="1.5"
                        className="animate-pulse"
                      />
                    )}

                    {/* Main Node Circle */}
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={radius}
                      fill={cfg.color}
                      stroke={isSelected ? '#ffffff' : '#0f172a'}
                      strokeWidth={isSelected ? 3 : 1.5}
                      className="group-hover:scale-110 transition-transform origin-center"
                    />

                    {/* Node Icon */}
                    <g transform={`translate(${node.x - 7}, ${node.y - 7})`}>
                      <Icon className="w-3.5 h-3.5 text-white" />
                    </g>

                    {/* Node Label */}
                    <text
                      x={node.x}
                      y={node.y + radius + 13}
                      fill={isSelected ? '#ffffff' : '#e2e8f0'}
                      fontSize={isTargetTxn ? "11" : "10"}
                      fontWeight={isTargetTxn || isSelected ? "bold" : "normal"}
                      fontFamily="sans-serif"
                      textAnchor="middle"
                    >
                      {node.label || node.id}
                    </text>

                    {/* Node Subtype */}
                    <text
                      x={node.x}
                      y={node.y + radius + 23}
                      fill="#64748b"
                      fontSize="8"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {node.type.toUpperCase()}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Working Click Node Inspector Modal/Drawer */}
        {selectedNode && (
          <div className="absolute top-3 right-3 bg-slate-900/95 border border-slate-700 rounded-lg p-3.5 max-w-xs shadow-2xl backdrop-blur-md text-xs z-30 animate-fade-in w-72">
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-2">
              <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5 text-[11px]">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: ENTITY_CONFIG[selectedNode.type]?.color }} />
                {ENTITY_CONFIG[selectedNode.type]?.label || selectedNode.type} Details
              </span>
              <button 
                onClick={() => setSelectedNodeId(null)} 
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-2 text-slate-300 text-[11px]">
              <div>
                <span className="text-slate-500 font-mono">Entity ID:</span>
                <div className="text-sky-300 font-mono font-bold truncate mt-0.5">{selectedNode.id}</div>
              </div>

              <div className="flex justify-between items-center py-1 border-t border-b border-slate-800/80">
                <span className="text-slate-400">Risk Profile:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedNode.risk === 'high_risk' || selectedNode.id.includes(activeTxnId) 
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                }`}>
                  {selectedNode.risk === 'high_risk' || selectedNode.id.includes(activeTxnId) ? 'HIGH RISK' : 'NORMAL'}
                </span>
              </div>

              <div>
                <span className="text-slate-500">Connected Neighbors ({connectedEdges.length}):</span>
                <div className="mt-1 max-h-24 overflow-y-auto space-y-1 pr-1">
                  {connectedEdges.map((edge, i) => {
                    const otherId = edge.source === selectedNode.id ? edge.target : edge.source;
                    return (
                      <div 
                        key={i} 
                        onClick={() => setSelectedNodeId(otherId)}
                        className="flex items-center justify-between p-1 rounded bg-slate-950 hover:bg-slate-800 cursor-pointer text-[10px] font-mono border border-slate-800"
                      >
                        <span className="text-slate-300 truncate max-w-[130px]">{otherId}</span>
                        <span className="text-sky-400 text-[9px]">{edge.relationship}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {selectedNode.properties && Object.keys(selectedNode.properties).length > 0 && (
                <div className="pt-2 border-t border-slate-800">
                  <span className="text-[10px] uppercase font-mono text-slate-400">Metadata Payload:</span>
                  <pre className="bg-slate-950 p-2 rounded text-[10px] font-mono text-slate-300 overflow-x-auto border border-slate-800 mt-1 max-h-28">
                    {JSON.stringify(selectedNode.properties, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Working Type Filter Bar */}
      <div className="p-2.5 bg-slate-850 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-slate-400 flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5 text-slate-500" /> Filter:
          </span>

          <button
            onClick={() => setActiveFilter("ALL")}
            className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition ${activeFilter === 'ALL' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}
          >
            All Entities ({rawNodes.length})
          </button>

          {Object.entries(ENTITY_CONFIG).filter(([k]) => k !== 'default').map(([key, item]) => {
            const count = rawNodes.filter(n => n.type === key).length;
            if (count === 0) return null;

            return (
              <button
                key={key}
                onClick={() => setActiveFilter(prev => prev === key ? "ALL" : key)}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-semibold transition ${activeFilter === key ? 'bg-slate-800 text-white border border-slate-600' : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'}`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                <span>{item.label}</span>
                <span className="bg-slate-950 text-slate-400 px-1 py-0.2 rounded font-mono text-[9px]">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="text-slate-500 font-mono text-[10px]">
          Click Node for Details • Interactive SVG Engine
        </div>
      </div>
    </div>
  );
}
