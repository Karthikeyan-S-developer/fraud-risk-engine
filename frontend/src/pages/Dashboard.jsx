import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  ShieldAlert, Activity, AlertTriangle, 
  Play, Square, ArrowRight, Bell, Zap, DollarSign, 
  Compass, Share2, Radio, CheckCircle2, Wifi, WifiOff,
  TrendingUp, Clock, MapPin, User, RefreshCw
} from 'lucide-react';
import { API_BASE_URL } from '../config';

const RISK_COLORS = {
  HIGH: { text: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', badge: 'bg-rose-500/20 text-rose-300' },
  MEDIUM: { text: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', badge: 'bg-amber-500/20 text-amber-300' },
  LOW: { text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', badge: 'bg-emerald-500/20 text-emerald-300' },
};

const STATUS_BADGE = {
  PENDING: 'bg-sky-500/10 text-sky-300 border border-sky-500/20',
  CONFIRMED_FRAUD: 'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  CLEARED: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  ESCALATED: 'bg-orange-500/10 text-orange-400 border border-orange-500/20',
  NORMAL: 'bg-slate-700/40 text-slate-400 border border-slate-700/50',
};

export default function Dashboard({ onNavigateToFlag }) {
  const [stats, setStats] = useState(null);
  const [simStatus, setSimStatus] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [isInjecting, setIsInjecting] = useState(false);
  const [injectMessage, setInjectMessage] = useState(null);
  const [streamConnected, setStreamConnected] = useState(false);
  const [liveStream, setLiveStream] = useState([]); // Real-time SSE feed (max 40 rows)
  const [newRowId, setNewRowId] = useState(null);   // Used to flash new row
  const eventSourceRef = useRef(null);
  const liveStreamRef = useRef([]);

  // ─── Fetch KPI Stats ───────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const [resStats, resSim, resAlerts] = await Promise.all([
        fetch(`${API_BASE_URL}/stats`),
        fetch(`${API_BASE_URL}/simulate/status`),
        fetch(`${API_BASE_URL}/notifications`)
      ]);
      if (resStats.ok) setStats(await resStats.json());
      if (resSim.ok) setSimStatus(await resSim.json());
      if (resAlerts.ok) {
        const notifData = await resAlerts.json();
        setAlerts(notifData.alerts || []);
      }
    } catch (err) {
      console.error("Dashboard stats fetch error:", err);
    }
  }, []);

  // ─── Load initial recent transactions ─────────────────────────────────────
  const loadRecentStream = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/stream/recent?limit=20`);
      if (res.ok) {
        const data = await res.json();
        liveStreamRef.current = data;
        setLiveStream([...data]);
      }
    } catch (err) {
      console.error("Recent stream load error:", err);
    }
  }, []);

  // ─── Connect SSE live stream ───────────────────────────────────────────────
  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(`${API_BASE_URL}/stream/live`);
    eventSourceRef.current = es;

    es.onopen = () => setStreamConnected(true);
    es.onerror = () => {
      setStreamConnected(false);
      // Auto-reconnect after 5s
      setTimeout(() => {
        if (eventSourceRef.current?.readyState === EventSource.CLOSED) {
          connectSSE();
        }
      }, 5000);
    };

    es.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data);
        if (parsed.type === 'transaction') {
          const txn = parsed.data;
          setNewRowId(txn.txn_id);
          setTimeout(() => setNewRowId(null), 800);

          // Prepend to live stream (newest first), keep max 40
          const updated = [txn, ...liveStreamRef.current].slice(0, 40);
          liveStreamRef.current = updated;
          setLiveStream([...updated]);

          // Refresh KPI stats on each new transaction
          fetchStats();
        } else if (parsed.type === 'connected') {
          setStreamConnected(true);
        }
      } catch {
        // Ignore parse errors (heartbeats etc.)
      }
    };
  }, [fetchStats]);

  // ─── Disconnect SSE ───────────────────────────────────────────────────────
  const disconnectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setStreamConnected(false);
  }, []);

  // ─── Initial setup ────────────────────────────────────────────────────────
  useEffect(() => {
    fetchStats();
    loadRecentStream();
    connectSSE();

    // Poll stats every 8s as fallback
    const statsInterval = setInterval(fetchStats, 8000);

    return () => {
      clearInterval(statsInterval);
      disconnectSSE();
    };
  }, []);

  // ─── Simulator toggle ──────────────────────────────────────────────────────
  const handleToggleSimulator = async () => {
    const isRunning = simStatus?.is_running;
    const endpoint = isRunning ? `${API_BASE_URL}/simulate/stop` : `${API_BASE_URL}/simulate/start?interval=2.5`;
    try {
      await fetch(endpoint, { method: 'POST' });
      fetchStats();
    } catch (err) {
      console.error("Simulator toggle error:", err);
    }
  };

  // ─── Scenario injector ────────────────────────────────────────────────────
  const handleInjectScenario = async (scenario) => {
    setIsInjecting(true);
    setInjectMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/simulate/inject?scenario=${scenario}`, { method: 'POST' });
      const data = await res.json();
      setInjectMessage({
        type: 'success',
        text: `Injected '${scenario.toUpperCase()}' scenario • ${data.transactions_generated} txns scored`
      });
      fetchStats();
    } catch (err) {
      setInjectMessage({ type: 'error', text: `Injection failed: ${err.message}` });
    } finally {
      setIsInjecting(false);
      setTimeout(() => setInjectMessage(null), 5000);
    }
  };

  const formatTime = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const formatAmount = (amt) => amt != null ? `$${Number(amt).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—';

  return (
    <div className="space-y-5">

      {/* ─── HEADER COCKPIT BAR ─────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-white tracking-tight">
              Fraud Operations &amp; Risk Cockpit
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
              Engine Online
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Multi-layer: Auto-Discovery Rule Engine · NetworkX Graph · Haversine Velocity · XGBoost SHAP
          </p>
        </div>

        {/* Simulator Control */}
        <div className="flex items-center gap-3">
          {/* SSE Stream Status Indicator */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-xs font-semibold ${streamConnected ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-slate-800 border-slate-700 text-slate-500'}`}>
            {streamConnected ? (
              <>
                <span className="w-2 h-2 rounded-full bg-emerald-400 stream-live-dot" />
                <Wifi className="w-3.5 h-3.5" />
                <span className="font-mono">SSE LIVE</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5" />
                <span>Connecting…</span>
              </>
            )}
          </div>

          {/* Traffic Simulator Toggle */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded border border-slate-800">
            <div className="text-right">
              <div className="text-[10px] font-mono uppercase text-slate-400">SIMULATOR</div>
              <div className="text-xs font-semibold">
                {simStatus?.is_running ? (
                  <span className="text-emerald-400 flex items-center justify-end gap-1">
                    <Radio className="w-3 h-3" /> LIVE
                  </span>
                ) : (
                  <span className="text-slate-500">PAUSED</span>
                )}
              </div>
            </div>
            <button
              onClick={handleToggleSimulator}
              className={`px-3 py-1.5 rounded font-semibold text-xs transition flex items-center gap-1.5 ${
                simStatus?.is_running
                  ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30'
                  : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
              }`}
            >
              {simStatus?.is_running ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
              {simStatus?.is_running ? 'Stop' : 'Start'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── KPI CARDS ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Total Transactions</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">{stats?.total_transactions ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">Persisted · Neon DB</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Flagged (≥30)</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-amber-400">{stats?.flagged_transactions ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Pending: <b className="text-slate-300">{stats?.pending_flags ?? 0}</b>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>Confirmed Fraud</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-rose-400">{stats?.confirmed_fraud ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Cleared: <b className="text-emerald-400">{stats?.cleared_flags ?? 0}</b>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-1">
            <span>High-Risk Alerts</span>
            <Bell className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-400">{stats?.risk_distribution?.HIGH ?? 0}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            SNS Dispatched: <b className="text-slate-300">{alerts.length}</b>
          </div>
        </div>
      </div>

      {/* ─── SCENARIO INJECTOR ──────────────────────────────────────────────── */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm font-bold text-white">Fraud Scenario Test Suite</h2>
            <p className="text-xs text-slate-400">
              Inject synthetic attack vectors to validate rule engine, geo-temporal maps, graph traversal &amp; SNS alerts.
            </p>
          </div>
          {injectMessage && (
            <div className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 ${
              injectMessage.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
            }`}>
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{injectMessage.text}</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <button disabled={isInjecting} onClick={() => handleInjectScenario("teleport")}
            className="p-3 rounded bg-slate-950 border border-slate-800 hover:border-sky-500/50 text-left transition group">
            <div className="flex items-center justify-between mb-1">
              <Compass className="w-4 h-4 text-sky-400" />
              <span className="text-[10px] font-mono text-sky-400 font-bold">+25 pts</span>
            </div>
            <div className="text-xs font-semibold text-slate-200">Impossible Travel</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Chennai → London in 31m</div>
          </button>

          <button disabled={isInjecting} onClick={() => handleInjectScenario("velocity")}
            className="p-3 rounded bg-slate-950 border border-slate-800 hover:border-amber-500/50 text-left transition">
            <div className="flex items-center justify-between mb-1">
              <Zap className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-mono text-amber-400 font-bold">+25 pts</span>
            </div>
            <div className="text-xs font-semibold text-slate-200">Velocity Burst</div>
            <div className="text-[11px] text-slate-500 mt-0.5">6 txns in 2 min window</div>
          </button>

          <button disabled={isInjecting} onClick={() => handleInjectScenario("amount")}
            className="p-3 rounded bg-slate-950 border border-slate-800 hover:border-rose-500/50 text-left transition">
            <div className="flex items-center justify-between mb-1">
              <DollarSign className="w-4 h-4 text-rose-400" />
              <span className="text-[10px] font-mono text-rose-400 font-bold">+30 pts</span>
            </div>
            <div className="text-xs font-semibold text-slate-200">Unusual Amount</div>
            <div className="text-[11px] text-slate-500 mt-0.5">$15,850 spike (113× avg)</div>
          </button>

          <button disabled={isInjecting} onClick={() => handleInjectScenario("ring")}
            className="p-3 rounded bg-slate-950 border border-slate-800 hover:border-purple-500/50 text-left transition">
            <div className="flex items-center justify-between mb-1">
              <Share2 className="w-4 h-4 text-purple-400" />
              <span className="text-[10px] font-mono text-purple-400 font-bold">+20 pts</span>
            </div>
            <div className="text-xs font-semibold text-slate-200">Shared Entity Ring</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Device shared by 3+ accounts</div>
          </button>

          <button disabled={isInjecting} onClick={() => handleInjectScenario("combo")}
            className="p-3 rounded bg-slate-950 border border-rose-900/60 hover:border-rose-500 text-left transition">
            <div className="flex items-center justify-between mb-1">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span className="text-[10px] font-mono text-rose-400 font-bold">95+ pts</span>
            </div>
            <div className="text-xs font-semibold text-white">Multi-Vector Attack</div>
            <div className="text-[11px] text-rose-400/70 mt-0.5">Teleport + $18k + Shared Device</div>
          </button>
        </div>
      </div>

      {/* ─── MAIN BOTTOM SECTION: LIVE STREAM + SNS ALERTS ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

        {/* Live Transaction Stream (2 Cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-sky-400" />
              Live Transaction Feed
              {streamConnected && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 stream-live-dot" />
                  REAL-TIME SSE
                </span>
              )}
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { loadRecentStream(); fetchStats(); }}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Refresh"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onNavigateToFlag("list")}
                className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
              >
                Full Queue <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="overflow-auto flex-1" style={{ maxHeight: '440px' }}>
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-500 uppercase tracking-wider font-mono text-[10px] sticky top-0">
                <tr>
                  <th className="py-2 px-3"><Clock className="w-3 h-3 inline mr-1" />Time</th>
                  <th className="py-2 px-3"><User className="w-3 h-3 inline mr-1" />Txn ID</th>
                  <th className="py-2 px-3">Amount</th>
                  <th className="py-2 px-3"><MapPin className="w-3 h-3 inline mr-1" />City</th>
                  <th className="py-2 px-3">Score</th>
                  <th className="py-2 px-3">Risk</th>
                  <th className="py-2 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {liveStream.length > 0 ? (
                  liveStream.map((txn) => {
                    const risk = RISK_COLORS[txn.risk_level] || RISK_COLORS.LOW;
                    const isNew = txn.txn_id === newRowId;
                    return (
                      <tr
                        key={txn.txn_id}
                        className={`hover:bg-slate-800/30 transition ${isNew ? 'row-new bg-sky-950/30' : ''}`}
                      >
                        <td className="py-2 px-3 text-slate-400 text-[10px] whitespace-nowrap">
                          {formatTime(txn.timestamp)}
                        </td>
                        <td className="py-2 px-3 text-sky-400 font-semibold truncate max-w-[120px]">
                          <span title={txn.txn_id}>{txn.txn_id?.slice(0, 16)}…</span>
                        </td>
                        <td className="py-2 px-3 text-slate-200 whitespace-nowrap">
                          {formatAmount(txn.amount)}
                        </td>
                        <td className="py-2 px-3 text-slate-300 text-[11px]">
                          {txn.city || '—'}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`font-bold text-xs ${txn.total_score >= 70 ? 'text-rose-400' : txn.total_score >= 30 ? 'text-amber-400' : 'text-slate-400'}`}>
                            {txn.total_score}/100
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${risk.badge}`}>
                            {txn.risk_level || 'LOW'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-sans">
                          {txn.flag_id && (
                            <button
                              onClick={() => onNavigateToFlag(txn.flag_id)}
                              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 font-semibold text-[11px] transition border border-slate-700"
                            >
                              Cockpit
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-500 font-sans italic">
                      No transactions yet. Start the simulator or inject a scenario above.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* AWS SNS Alert Feed (1 Col) */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white text-sm flex items-center gap-2">
              <Bell className="w-4 h-4 text-purple-400" />
              AWS SNS Alerts
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 font-mono border border-purple-500/20">
              score ≥ 70
            </span>
          </div>

          <div className="p-3 flex-1 overflow-y-auto space-y-2" style={{ maxHeight: '440px' }}>
            {alerts.length > 0 ? (
              alerts.map((al, idx) => (
                <div key={idx} className="bg-slate-950 p-2.5 rounded border border-slate-800 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-purple-400 font-semibold truncate text-[11px]">
                      {al.txn_id?.slice(0, 14)}…
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono flex-shrink-0">
                      {new Date(al.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-slate-300 font-medium text-[11px] truncate">{al.subject}</div>
                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-900">
                    <span className={`px-1.5 py-0.5 rounded ${
                      al.status === 'AWS_SNS_DELIVERED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-sky-500/10 text-sky-400'
                    } font-mono`}>
                      {al.status?.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono text-rose-400 font-bold">Score: {al.total_score}</span>
                  </div>
                  {al.ses_status && al.ses_status !== 'NOT_CONFIGURED' && (
                    <div className="text-[9px] text-slate-500 font-mono">SES: {al.ses_status}</div>
                  )}
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-slate-500 text-xs italic">
                No high-risk alerts dispatched.<br />
                <span className="text-slate-600">Triggers on score ≥ 70 → SNS topic</span>
              </div>
            )}
          </div>

          {/* SNS Config Status */}
          <div className="px-3 py-2 bg-slate-950/50 border-t border-slate-800 text-[10px] text-slate-500">
            <div className="flex items-center justify-between">
              <span>Topic ARN: <span className="text-slate-400 font-mono">FraudHighRiskAlerts</span></span>
              <span className="text-emerald-500/70">Auto-fallback enabled</span>
            </div>
          </div>
        </div>

      </div>

      {/* ─── ACTIVE RULES INDICATOR ─────────────────────────────────────────── */}
      {stats?.active_rules && stats.active_rules.length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-3.5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Active Detection Rules
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 font-mono border border-sky-500/20">
              {stats.active_rules_count} loaded
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.active_rules.map((rule, i) => (
              <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                {rule.replace(/Rule$/, '')}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
