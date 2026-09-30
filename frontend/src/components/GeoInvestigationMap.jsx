import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Plane, ArrowRight, Compass, Clock, MapPin, 
  Gauge
} from 'lucide-react';

export default function GeoInvestigationMap({ evidence, transaction, neighborhood, mobilityProfile }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [activeLayer, setActiveLayer] = useState("hybrid"); // "flight", "graph", "hybrid"
  const [tileStyle, setTileStyle] = useState("osm_standard"); // "osm_standard" or "esri_dark"

  const prevCoords = evidence?.prev_coords || null;
  const currCoords = evidence?.curr_coords || (transaction?.latitude && transaction?.longitude ? [transaction.latitude, transaction.longitude] : null);
  const homeCoords = mobilityProfile?.home_coords && mobilityProfile.home_coords[0] ? mobilityProfile.home_coords : null;

  const prevCity = evidence?.prev_city || "Origin";
  const currCity = evidence?.curr_city || transaction?.city || "Destination";
  const homeCity = mobilityProfile?.home_city || "Registered Home";
  const distanceKm = evidence?.distance_km ?? 0;
  const elapsedMin = evidence?.elapsed_min ?? 0;
  const impliedSpeed = evidence?.implied_speed_kmh ?? 0;
  const threshold = evidence?.threshold_kmh || 900;
  const isTeleport = impliedSpeed > threshold;

  const formatTime = (ts) => {
    if (!ts) return "N/A";
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return String(ts);
    }
  };

  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    const defaultCenter = currCoords || homeCoords || prevCoords || [20, 0];
    const map = L.map(mapContainerRef.current, {
      center: defaultCenter,
      zoom: 4,
      zoomControl: true,
      attributionControl: false
    });

    // Pure 100% Free Public Leaflet Tile Servers (Zero API key required)
    if (tileStyle === "esri_dark") {
      // Esri World Dark Gray Canvas (Free public tile server)
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ'
      }).addTo(map);
    } else {
      // Official Standard OpenStreetMap (OSM) Tiles (Free public tile server)
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);
    }

    const createMarkerIcon = (color, label, symbol, subtext = "") => {
      return L.divIcon({
        className: 'custom-geo-marker',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%); z-index: 1000;">
            <div style="background: ${color}; color: white; padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; box-shadow: 0 4px 12px rgba(0,0,0,0.6); white-space: nowrap; border: 1.5px solid rgba(255,255,255,0.7); display: flex; align-items: center; gap: 4px;">
              <span>${symbol}</span> <span>${label}</span>
            </div>
            ${subtext ? `<div style="background: rgba(15,23,42,0.95); color: #e2e8f0; font-size: 9px; font-family: monospace; font-weight: 600; padding: 1px 5px; border-radius: 3px; margin-top: 2px; border: 1px solid rgba(255,255,255,0.2); box-shadow: 0 2px 6px rgba(0,0,0,0.4);">${subtext}</div>` : ''}
            <div style="width: 8px; height: 8px; background: ${color}; transform: rotate(45deg); margin-top: -4px; border-bottom: 1.5px solid white; border-right: 1.5px solid white;"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });
    };

    const markers = [];

    // 1. User Home Node
    if ((activeLayer === "graph" || activeLayer === "hybrid") && homeCoords) {
      const homeMarker = L.marker(homeCoords, {
        icon: createMarkerIcon('#6366f1', `${homeCity}`, '👤', 'Registered Home')
      }).addTo(map);
      homeMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 11px;">
          <b style="color: #6366f1;">Buyer Entity (User Baseline)</b><br/>
          Home City: <b>${homeCity}</b><br/>
          Avg Amount: $${mobilityProfile?.avg_amount ?? 100}
        </div>
      `);
      markers.push(homeMarker);
    }

    // 2. Previous Location Node
    if ((activeLayer === "flight" || activeLayer === "hybrid") && prevCoords) {
      const prevMarker = L.marker(prevCoords, {
        icon: createMarkerIcon('#0284c7', `${prevCity} (t-1)`, '📍', formatTime(evidence?.prev_time))
      }).addTo(map);
      prevMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 11px;">
          <b style="color: #0284c7;">Previous Transaction (t-1)</b><br/>
          City: <b>${prevCity}</b><br/>
          Time: ${formatTime(evidence?.prev_time)}
        </div>
      `);
      markers.push(prevMarker);
    }

    // 3. Current Flagged Transaction Node
    if (currCoords) {
      const currMarker = L.marker(currCoords, {
        icon: createMarkerIcon('#e11d48', `${currCity} (t0)`, '🚨', `$${transaction?.amount?.toLocaleString()}`)
      }).addTo(map);
      currMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 11px;">
          <b style="color: #e11d48;">Current Flagged Transaction (t0)</b><br/>
          City: <b>${currCity}</b><br/>
          Amount: <b>$${transaction?.amount?.toLocaleString()}</b><br/>
          Time: ${formatTime(transaction?.timestamp || evidence?.curr_time)}
        </div>
      `);
      markers.push(currMarker);
    }

    // 4. Geodesic Flight Route Arc
    if ((activeLayer === "flight" || activeLayer === "hybrid") && prevCoords && currCoords && (prevCoords[0] !== currCoords[0] || prevCoords[1] !== currCoords[1])) {
      const lat1 = prevCoords[0], lon1 = prevCoords[1];
      const lat2 = currCoords[0], lon2 = currCoords[1];
      const arcPoints = [];
      const numSteps = 40;
      for (let i = 0; i <= numSteps; i++) {
        const f = i / numSteps;
        const curLat = lat1 + (lat2 - lat1) * f;
        const curLon = lon1 + (lon2 - lon1) * f;
        const arcElev = Math.sin(f * Math.PI) * (distanceKm > 2000 ? 5.5 : 1.5);
        arcPoints.push([curLat + arcElev, curLon]);
      }

      const flightPath = L.polyline(arcPoints, {
        color: '#e11d48',
        weight: 3.5,
        dashArray: '6, 6',
        opacity: 0.95
      }).addTo(map);
      flightPath.bindTooltip(`Trajectory: ${distanceKm.toLocaleString()} km @ ${impliedSpeed.toLocaleString()} km/h`, { sticky: true });
      markers.push(flightPath);
    }

    // 5. Graph Relation Line (User Home -> Txn)
    if ((activeLayer === "graph" || activeLayer === "hybrid") && homeCoords && currCoords && (homeCoords[0] !== currCoords[0] || homeCoords[1] !== currCoords[1])) {
      const graphRelationEdge = L.polyline([homeCoords, currCoords], {
        color: '#6366f1',
        weight: 2.5,
        dashArray: '4, 4',
        opacity: 0.75
      }).addTo(map);
      graphRelationEdge.bindTooltip("Graph Relation: User -> Txn", { sticky: true });
      markers.push(graphRelationEdge);
    }

    if (markers.length > 0) {
      const group = new L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.35));
    }

    mapInstanceRef.current = map;

    // Trigger map container layout recalculation
    const timer = setTimeout(() => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.invalidateSize();
      }
    }, 100);

    return () => {
      clearTimeout(timer);
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [evidence, transaction, neighborhood, mobilityProfile, activeLayer, tileStyle]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col shadow-lg">
      {/* Header Bar */}
      <div className="p-3.5 bg-slate-850 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-sky-500/10 text-sky-400">
            <Compass className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm">
              Geo-Spatial Velocity Cockpit
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                OpenStreetMap Free Engine
              </span>
            </h3>
            <p className="text-xs text-slate-400">
              Haversine spatio-temporal velocity & geodesic flight projection
            </p>
          </div>
        </div>

        {/* Controls: Tile Style + Layer Selector */}
        <div className="flex items-center gap-2">
          {/* Tile Source Selector */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setTileStyle("osm_standard")}
              className={`px-2 py-0.5 rounded transition ${tileStyle === 'osm_standard' ? 'bg-slate-800 text-sky-400 border border-slate-700' : 'text-slate-400 hover:text-white'}`}
              title="Official OpenStreetMap Standard Tiles"
            >
              OSM Standard
            </button>
            <button
              onClick={() => setTileStyle("esri_dark")}
              className={`px-2 py-0.5 rounded transition ${tileStyle === 'esri_dark' ? 'bg-slate-800 text-sky-400 border border-slate-700' : 'text-slate-400 hover:text-white'}`}
              title="Esri World Dark Canvas"
            >
              Esri Dark
            </button>
          </div>

          {/* Layer Mode Switcher */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800 text-xs font-semibold">
            <button
              onClick={() => setActiveLayer("hybrid")}
              className={`px-2 py-0.5 rounded transition ${activeLayer === 'hybrid' ? 'bg-sky-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Hybrid
            </button>
            <button
              onClick={() => setActiveLayer("flight")}
              className={`px-2 py-0.5 rounded transition ${activeLayer === 'flight' ? 'bg-rose-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Flight Arc
            </button>
            <button
              onClick={() => setActiveLayer("graph")}
              className={`px-2 py-0.5 rounded transition ${activeLayer === 'graph' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Graph Link
            </button>
          </div>
        </div>
      </div>

      {/* Teleport Summary HUD (If impossible travel detected) */}
      {isTeleport && (
        <div className="bg-slate-950 border-b border-slate-800 p-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
              <div className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-sky-400" /> Origin → Destination
              </div>
              <div className="mt-1 flex items-center gap-1.5 font-mono text-xs font-bold text-white">
                <span className="text-sky-400 truncate">{prevCity}</span>
                <ArrowRight className="w-3 h-3 text-rose-400 flex-shrink-0" />
                <span className="text-rose-400 truncate">{currCity}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5 flex justify-between">
                <span>{formatTime(evidence?.prev_time)}</span>
                <span>{formatTime(evidence?.curr_time)}</span>
              </div>
            </div>

            <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
              <div className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                <Plane className="w-3 h-3 text-amber-400" /> Geodesic Distance
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-amber-300">
                {distanceKm.toLocaleString()} km
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Great-Circle Separation
              </div>
            </div>

            <div className="bg-slate-900 p-2.5 rounded border border-slate-800">
              <div className="text-[10px] font-semibold uppercase text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3 text-indigo-400" /> Elapsed Time (Δt)
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-indigo-300">
                {elapsedMin} min
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Transaction Delta Window
              </div>
            </div>

            <div className="bg-slate-900 p-2.5 rounded border border-rose-900/60">
              <div className="text-[10px] font-semibold uppercase text-rose-400 flex items-center gap-1">
                <Gauge className="w-3 h-3 text-rose-400" /> Velocity
              </div>
              <div className="mt-1 font-mono text-sm font-bold text-rose-400">
                {impliedSpeed.toLocaleString()} km/h
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Flight Threshold: <b className="text-white">{threshold} km/h</b>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaflet Map Canvas */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-80 sm:h-96 relative z-10" 
      />

      {/* Map Footer Legend */}
      <div className="px-3 py-2 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-400 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500"></span> User Home
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-600"></span> Flagged Txn (t0)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-500"></span> Previous Txn (t-1)
          </span>
        </div>
        <div className="font-mono text-slate-500 text-[10px]">
          Free Engine: {tileStyle === 'esri_dark' ? 'Esri World Dark Canvas' : 'Official OpenStreetMap (OSM)'} • WGS84 Geodesic
        </div>
      </div>
    </div>
  );
}
