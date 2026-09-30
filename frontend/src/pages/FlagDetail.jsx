import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, DollarSign, MapPin, 
  Smartphone, CreditCard, User, Globe, AlertTriangle
} from 'lucide-react';
import GeoInvestigationMap from '../components/GeoInvestigationMap';
import EntityGraphView from '../components/EntityGraphView';
import RuleBreakdownCard from '../components/RuleBreakdownCard';
import ActionPanel from '../components/ActionPanel';
import { API_BASE_URL } from '../config';

export default function FlagDetail({ flagId, onBack }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDetail = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/flags/${flagId}`);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json();
      setDetail(data);
    } catch (err) {
      console.error("Flag detail error:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (flagId) fetchDetail();
  }, [flagId]);

  if (loading) {
    return (
      <div className="py-16 text-center text-slate-400 font-mono text-xs">
        <div className="inline-block w-6 h-6 border-2 border-sky-400 border-t-transparent rounded-full animate-spin mb-3"></div>
        <p>Fetching full investigation telemetry for Flag #{flagId}...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-lg text-center">
        <AlertTriangle className="w-6 h-6 text-rose-400 mx-auto mb-2" />
        <p className="text-xs text-rose-300 font-semibold">Failed to load investigation cockpit: {error}</p>
        <button
          onClick={onBack}
          className="mt-4 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded text-xs font-semibold"
        >
          Return to Queue
        </button>
      </div>
    );
  }

  const { flag, shap_attributions, graph_neighborhood, mobility_profile } = detail;
  const txn = flag.transaction;
  const isHighRisk = flag.total_score >= 70;

  // Extract geo rule evidence if present
  const geoReason = flag.reasons?.find(r => r.rule_name === "ImpossibleGeographicalLocationRule");
  const geoEvidence = geoReason?.evidence;

  return (
    <div className="space-y-5">
      {/* Cockpit Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
            title="Return to Flags Table"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                INVESTIGATION COCKPIT
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                flag.status === 'CONFIRMED_FRAUD' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-sky-500/10 text-sky-300 border border-sky-500/20'
              }`}>
                {flag.status}
              </span>
            </div>
            <h1 className="text-lg font-bold font-mono text-white flex items-center gap-2 mt-0.5">
              {flag.txn_id}
            </h1>
          </div>
        </div>

        {/* Dual Scores HUD: Rule Score vs Isolated ML Anomaly */}
        <div className="flex items-center gap-4 bg-slate-950 px-3 py-2 rounded border border-slate-800">
          <div className="text-right">
            <div className="text-[10px] font-mono text-slate-400 uppercase">RULE SCORE</div>
            <div className="text-lg font-bold font-mono text-white flex items-center justify-end gap-0.5">
              <span className={isHighRisk ? "text-rose-400" : "text-amber-400"}>
                {flag.total_score}
              </span>
              <span className="text-slate-600 text-xs">/100</span>
            </div>
          </div>

          <div className="w-px h-6 bg-slate-800" />

          <div className="text-right">
            <div className="text-[10px] font-mono text-emerald-400 uppercase">ML ANOMALY (XGB)</div>
            <div className="text-lg font-bold font-mono text-emerald-400">
              {(flag.ml_anomaly_score * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Metadata Quick Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-3 rounded">
          <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
            <DollarSign className="w-3 h-3 text-emerald-400" /> Amount
          </div>
          <div className="font-mono text-xs font-bold text-white mt-1">
            ${txn?.amount?.toLocaleString()} <span className="text-[10px] text-slate-400">{txn?.currency}</span>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded">
          <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
            <User className="w-3 h-3 text-sky-400" /> User Baseline
          </div>
          <div className="font-mono text-xs font-semibold text-slate-200 mt-1 truncate">
            {txn?.user_id}
          </div>
          <div className="text-[10px] text-slate-500">Avg: ${mobility_profile?.avg_amount}</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded">
          <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
            <MapPin className="w-3 h-3 text-rose-400" /> Location
          </div>
          <div className="font-semibold text-xs text-slate-200 mt-1 truncate">
            {txn?.city || "Unknown"}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            {txn?.latitude?.toFixed(2)}, {txn?.longitude?.toFixed(2)}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded">
          <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
            <Smartphone className="w-3 h-3 text-amber-400" /> Device ID
          </div>
          <div className="font-mono text-xs font-semibold text-slate-200 mt-1 truncate">
            {txn?.device_id || "N/A"}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded">
          <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
            <CreditCard className="w-3 h-3 text-cyan-400" /> Payment Token
          </div>
          <div className="font-mono text-xs font-semibold text-slate-200 mt-1 truncate">
            {txn?.payment_token || "N/A"}
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3 rounded">
          <div className="text-[10px] font-mono text-slate-400 uppercase flex items-center gap-1">
            <Globe className="w-3 h-3 text-purple-400" /> Mobility Entropy
          </div>
          <div className="font-mono text-xs font-bold text-purple-300 mt-1">
            {mobility_profile?.mobility_entropy ?? 0.0}
          </div>
          <div className="text-[10px] text-slate-500">Shannon Index</div>
        </div>
      </div>

      {/* 3-SECTION COCKPIT LAYOUT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN: Rule Score Breakdown & SHAP Local Attribution (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          <RuleBreakdownCard 
            flag={flag} 
            shapAttributions={shap_attributions} 
          />
        </div>

        {/* RIGHT COLUMN: Geo-Temporal Investigation View + Entity Graph (7 Cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* 1. Geo-Temporal Investigation Map */}
          <GeoInvestigationMap 
            evidence={geoEvidence} 
            transaction={txn}
            neighborhood={graph_neighborhood}
            mobilityProfile={mobility_profile}
          />

          {/* 2. Heterogeneous Entity Graph Visualizer */}
          <EntityGraphView 
            neighborhood={graph_neighborhood} 
            activeTxnId={txn?.txn_id} 
          />
        </div>
      </div>

      {/* SECTION 3: HUMAN-IN-THE-LOOP ACTION PANEL */}
      <div>
        <ActionPanel 
          flagId={flag.flag_id} 
          currentStatus={flag.status} 
          onActionSubmitted={(updated) => {
            setDetail(prev => ({
              ...prev,
              flag: { ...prev.flag, status: updated.status }
            }));
          }} 
        />
      </div>
    </div>
  );
}
