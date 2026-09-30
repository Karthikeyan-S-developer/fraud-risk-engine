import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { 
  Plane, AlertTriangle, ArrowRight, Compass, Clock, MapPin, 
  Gauge, Share2, Layers, User, Smartphone, CreditCard, ShieldAlert 
} from 'lucide-react';

export default function GeoInvestigationMap({ evidence, transaction, neighborhood, mobilityProfile }) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [activeLayer, setActiveLayer] = useState("hybrid"); // "flight", "graph", "hybrid"

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
      zoom: 3,
      zoomControl: true,
      attributionControl: false
    });

    // Dark sleek CartoDB basemap tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    // Custom Leaflet Marker Generator
    const createMarkerIcon = (color, label, symbol, subtext = "") => {
      return L.divIcon({
        className: 'custom-geo-marker',
        html: `
          <div style="position: relative; display: flex; flex-direction: column; align-items: center; transform: translate(-50%, -100%);">
            <div style="background: ${color}; color: white; padding: 3px 8px; border-radius: 9999px; font-size: 10px; font-weight: 700; box-shadow: 0 4px 14px rgba(0,0,0,0.6); white-space: nowrap; border: 1.5px solid rgba(255,255,255,0.6); display: flex; align-items: center; gap: 4px;">
              <span>${symbol}</span> <span>${label}</span>
            </div>
            ${subtext ? `<div style="background: rgba(15,23,42,0.85); color: #cbd5e1; font-size: 8px; font-family: monospace; padding: 1px 4px; border-radius: 4px; margin-top: 1px; border: 1px solid rgba(255,255,255,0.1);">${subtext}</div>` : ''}
            <div style="width: 10px; height: 10px; background: ${color}; transform: rotate(45deg); margin-top: -5px; border-bottom: 2px solid white; border-right: 2px solid white;"></div>
            <div style="width: 8px; height: 8px; border-radius: 50%; background: ${color}; box-shadow: 0 0 12px ${color}; margin-top: 3px;"></div>
          </div>
        `,
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      });
    };

    const markers = [];

    // 1. User Home Node (Graph Entity Relation)
    if ((activeLayer === "graph" || activeLayer === "hybrid") && homeCoords) {
      const homeMarker = L.marker(homeCoords, {
        icon: createMarkerIcon('#6366f1', `${homeCity}`, '👤', 'User Baseline')
      }).addTo(map);
      homeMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px;">
          <b style="color: #6366f1;">Buyer Entity (User)</b><br/>
          Home City: <b>${homeCity}</b><br/>
          Avg Amount: $${mobilityProfile?.avg_amount ?? 100}<br/>
          Mobility Entropy: ${mobilityProfile?.mobility_entropy ?? 0.0}
        </div>
      `);
      markers.push(homeMarker);
    }

    // 2. Previous Location Node (Teleport Origin)
    if ((activeLayer === "flight" || activeLayer === "hybrid") && prevCoords) {
      const prevMarker = L.marker(prevCoords, {
        icon: createMarkerIcon('#38bdf8', `${prevCity} (t-1)`, '📍', formatTime(evidence?.prev_time))
      }).addTo(map);
      prevMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px;">
          <b style="color: #38bdf8;">Previous Transaction (t-1)</b><br/>
          City: <b>${prevCity}</b><br/>
          Time: ${formatTime(evidence?.prev_time)}<br/>
          Coords: ${prevCoords[0].toFixed(3)}, ${prevCoords[1].toFixed(3)}
        </div>
      `);
      markers.push(prevMarker);
    }

    // 3. Current Flagged Transaction Node
    if (currCoords) {
      const currMarker = L.marker(currCoords, {
        icon: createMarkerIcon('#f43f5e', `${currCity} (t0)`, '🚨', `$${transaction?.amount?.toLocaleString()}`)
      }).addTo(map);
      currMarker.bindPopup(`
        <div style="font-family: inherit; font-size: 12px;">
          <b style="color: #f43f5e;">Current Transaction (t0)</b><br/>
          City: <b>${currCity}</b><br/>
          Amount: <b>$${transaction?.amount?.toLocaleString()}</b><br/>
          Device: <code>${transaction?.device_id || "N/A"}</code><br/>
          Token: <code>${transaction?.payment_token || "N/A"}</code><br/>
          Time: ${formatTime(transaction?.timestamp || evidence?.curr_time)}
        </div>
      `);
      markers.push(currMarker);
    }

    // 4. Draw Geodesic Flight Route Arc (if teleport detected & enabled)
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
        color: '#f43f5e',
        weight: 3.5,
        dashArray: '8, 8',
        opacity: 0.9
      }).addTo(map);
      flightPath.bindTooltip(`Flight Trajectory: ${distanceKm.toLocaleString()} km @ ${impliedSpeed.toLocaleString()} km/h`, { sticky: true });
      markers.push(flightPath);
    }

    // 5. Draw Graph-Based Relation Lines on Map (User Home -> Transaction)
    if ((activeLayer === "graph" || activeLayer === "hybrid") && homeCoords && currCoords && (homeCoords[0] !== currCoords[0] || homeCoords[1] !== currCoords[1])) {
      const graphRelationEdge = L.polyline([homeCoords, currCoords], {
        color: '#6366f1',
        weight: 2.5,
        dashArray: '4, 6',
        opacity: 0.75
      }).addTo(map);
      graphRelationEdge.bindTooltip("Relationship: [User] --(PERFORMED)--> [Transaction]", { sticky: true });
      markers.push(graphRelationEdge);
    }

    // 6. Draw Neighboring Transactions from Graph Neighborhood
    if ((activeLayer === "graph" || activeLayer === "hybrid") && neighborhood?.nodes) {
      // Find other transaction nodes with city/coords in neighborhood
      neighborhood.nodes.filter(n => n.type === 'txn' && n.id !== transaction?.txn_id).forEach(otherTxn => {
        // If other txn has city coordinates, plot them
        const props = otherTxn.properties || {};
        if (props.city) {
          // Find standard city coords
          const knownCoords = {
            "Chennai": [13.0827, 80.2707],
            "London": [51.5074, -0.1278],
            "New York": [40.7128, -74.0060],
            "San Francisco": [37.7749, -122.4194],
            "Frankfurt": [50.1109, 8.6821],
            "Tokyo": [35.6762, 139.6503],
            "Springfield": [39.7817, -89.6501]
          }[props.city];

          if (knownCoords && (knownCoords[0] !== currCoords?.[0] || knownCoords[1] !== currCoords?.[1])) {
            const relMarker = L.marker(knownCoords, {
              icon: createMarkerIcon(otherTxn.risk === 'high_risk' ? '#f43f5e' : '#a855f7', props.city, '🕸️', `TXN ${otherTxn.id?.slice(0, 8)}`)
            }).addTo(map);
            relMarker.bindPopup(`<b>Linked Syndicate Txn: ${otherTxn.id}</b><br/>City: ${props.city}<br/>Amount: $${props.amount || 0}`);
            markers.push(relMarker);

            // Link edge
            if (currCoords) {
              const syndicateEdge = L.polyline([currCoords, knownCoords], {
                color: '#a855f7',
                weight: 2,
                dashArray: '3, 6',
                opacity: 0.65
              }).addTo(map);
              syndicateEdge.bindTooltip(`Graph Relation: Shared Device/Card Link to ${otherTxn.id?.slice(0, 8)}`, { sticky: true });
              markers.push(syndicateEdge);
            }
          }
        }
      });
    }

    if (markers.length > 0) {
      const group = new L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.35));
    }

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, [evidence, transaction, neighborhood, mobilityProfile, activeLayer]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col">
      {/* Header Bar with Layer Control */}
      <div className="p-4 bg-slate-850 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 flex items-center gap-2 text-sm sm:text-base">
              Geo-Spatial Graph & Velocity Investigation View
            </h3>
            <p className="text-xs text-slate-400">
              Interactive Leaflet template projecting graph entity relationships and geodesic travel vectors
            </p>
          </div>
        </div>

        {/* Layer Mode Switcher */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-semibold">
          <button
            onClick={() => setActiveLayer("hybrid")}
            className={`px-2.5 py-1 rounded transition ${activeLayer === 'hybrid' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Hybrid (All)
          </button>
          <button
            onClick={() => setActiveLayer("flight")}
            className={`px-2.5 py-1 rounded transition ${activeLayer === 'flight' ? 'bg-rose-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Flight Path
          </button>
          <button
            onClick={() => setActiveLayer("graph")}
            className={`px-2.5 py-1 rounded transition ${activeLayer === 'graph' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
          >
            Graph Relations
          </button>
        </div>
      </div>

      {/* Teleport Summary Cockpit HUD (if velocity anomaly triggered) */}
      {isTeleport && (
        <div className="bg-gradient-to-r from-rose-950/40 via-slate-900 to-rose-950/30 border-b border-rose-900/40 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-sky-400" /> Origin → Destination
              </div>
              <div className="mt-1 flex items-center gap-2 font-mono text-sm font-bold text-white">
                <span className="text-sky-400 truncate max-w-[85px]">{prevCity}</span>
                <ArrowRight className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                <span className="text-rose-400 truncate max-w-[85px]">{currCity}</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-1 flex justify-between">
                <span>{formatTime(evidence?.prev_time)}</span>
                <span>{formatTime(evidence?.curr_time)}</span>
              </div>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Plane className="w-3.5 h-3.5 text-amber-400" /> Geodesic Distance
              </div>
              <div className="mt-1 font-mono text-base font-bold text-amber-300">
                {distanceKm.toLocaleString()} km
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Great-circle spherical separation
              </div>
            </div>

            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-indigo-400" /> Time Elapsed (Δt)
              </div>
              <div className="mt-1 font-mono text-base font-bold text-indigo-300">
                {elapsedMin} min
              </div>
              <div className="text-[10px] text-slate-400 mt-1">
                Window between transactions
              </div>
            </div>

            <div className="bg-rose-950/40 p-3 rounded-lg border border-rose-800/60">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-300 flex items-center gap-1">
                <Gauge className="w-3.5 h-3.5 text-rose-400" /> Implied Velocity
              </div>
              <div className="mt-1 font-mono text-base font-extrabold text-rose-400">
                {impliedSpeed.toLocaleString()} km/h
              </div>
              <div className="text-[10px] text-rose-200/80 mt-1">
                Aviation Threshold: <b className="text-white">{threshold} km/h</b>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaflet JS Map Template Container */}
      <div 
        ref={mapContainerRef} 
        className="w-full h-80 sm:h-96 relative z-10" 
      />

      {/* Spatial Graph Relations Legend */}
      <div className="px-4 py-2.5 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500"></span> User Home
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-rose-500"></span> Flagged Txn
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-sky-400"></span> Previous Txn
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2.5 h-2.5 rounded-full bg-purple-500"></span> Linked Syndicate
          </span>
        </div>
        <div className="font-mono text-slate-500 text-[10px]">
          Leaflet Engine: CartoDB Dark Matter • WGS84 Geodesic Projection
        </div>
      </div>
    </div>
  );
}
