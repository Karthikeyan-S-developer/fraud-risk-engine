import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, ShieldCheck, Activity, Users, AlertTriangle, 
  Play, Square, Sparkles, ArrowRight, Bell, Zap, DollarSign, 
  Compass, Share2, RefreshCw, Radio
} from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function Dashboard({ onNavigateToFlag }) {
  const [stats, setStats] = useState(null);
  const [simStatus, setSimStatus] = useState(null);
  const [recentFlags, setRecentFlags] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [isInjecting, setIsInjecting] = useState(false);
  const [injectMessage, setInjectMessage] = useState(null);

  const fetchData = async () => {
    try {
      const [resStats, resSim, resFlags, resAlerts] = await Promise.all([
        fetch(`${API_BASE_URL}/stats`),
        fetch(`${API_BASE_URL}/simulate/status`),
        fetch(`${API_BASE_URL}/flags?limit=6&min_score=30`),
        fetch(`${API_BASE_URL}/notifications`)
      ]);

      if (resStats.ok) setStats(await resStats.json());
      if (resSim.ok) setSimStatus(await resSim.json());
      if (resFlags.ok) setRecentFlags(await resFlags.json());
      if (resAlerts.ok) {
        const notifData = await resAlerts.json();
        setAlerts(notifData.alerts || []);
      }
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleSimulator = async () => {
    const isRunning = simStatus?.is_running;
    const endpoint = isRunning ? `${API_BASE_URL}/simulate/stop` : `${API_BASE_URL}/simulate/start`;
    try {
      await fetch(endpoint, { method: 'POST' });
      fetchData();
    } catch (err) {
      console.error("Simulator toggle error:", err);
    }
  };

  const handleInjectScenario = async (scenario) => {
    setIsInjecting(true);
    setInjectMessage(null);
    try {
      const res = await fetch(`${API_BASE_URL}/simulate/inject?scenario=${scenario}`, {
        method: 'POST'
      });
      const data = await res.json();
      setInjectMessage({
        type: 'success',
        text: `Injected '${scenario.toUpperCase()}' scenario (${data.transactions_generated} txns generated)`
      });
      fetchData();
    } catch (err) {
      setInjectMessage({
        type: 'error',
        text: `Injection failed: ${err.message}`
      });
    } finally {
      setIsInjecting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Banner & Status */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span className="text-xs font-mono font-semibold uppercase tracking-wider text-emerald-400">
              Deterministic Defense Engine Active
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Fraud Operations & Risk Cockpit
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time multi-layered defense: Auto-Discovery Rule Engine, In-Memory Heterogeneous Graph, Haversine Spatio-Temporal Velocity & Isolated SHAP signals.
          </p>
        </div>

        {/* Live Simulator Controls */}
        <div className="flex items-center gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
          <div className="text-right">
            <div className="text-[11px] font-mono uppercase text-slate-400">TRAFFIC SIMULATOR</div>
            <div className="text-xs font-bold text-slate-200">
              {simStatus?.is_running ? (
                <span className="text-emerald-400 flex items-center justify-end gap-1">
                  <Radio className="w-3.5 h-3.5 animate-pulse" /> LIVE STREAMING
                </span>
              ) : (
                <span className="text-slate-500">PAUSED</span>
              )}
            </div>
          </div>
          <button
            onClick={handleToggleSimulator}
            className={`p-2.5 rounded-lg font-semibold text-xs transition flex items-center gap-2 ${
              simStatus?.is_running
                ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30 border border-rose-500/40'
                : 'bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/40'
            }`}
          >
            {simStatus?.is_running ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {simStatus?.is_running ? 'Stop Stream' : 'Start Stream'}
          </button>
        </div>
      </div>

      {/* KPI Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Transactions */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Total Transactions</span>
            <Activity className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-white">
            {stats?.total_transactions ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Persisted in Neon PostgreSQL
          </div>
        </div>

        {/* Flagged Transactions */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Flagged (Score ≥ 30)</span>
            <ShieldAlert className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-amber-400">
            {stats?.flagged_transactions ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Pending human review: <b className="text-white">{stats?.pending_flags ?? 0}</b>
          </div>
        </div>

        {/* Confirmed Fraud */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>Confirmed Fraud</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-rose-400">
            {stats?.confirmed_fraud ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Cleared by reviewers: <b className="text-emerald-400">{stats?.cleared_flags ?? 0}</b>
          </div>
        </div>

        {/* High Risk Alerts / SNS */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl shadow-lg">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase tracking-wider mb-2">
            <span>High-Risk Alerts (≥ 70)</span>
            <Bell className="w-4 h-4 text-purple-400" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-purple-400">
            {stats?.risk_distribution?.HIGH ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            AWS SNS Topic published: <b className="text-white">{alerts.length}</b>
          </div>
        </div>
      </div>

      {/* Scenario Injector Command Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">
                Deterministic Fraud Scenario Injector
              </h2>
              <p className="text-xs text-slate-400">
                Trigger precision fraud vectors to validate rule execution, map visualization, graph traversal, and SNS dispatch.
              </p>
            </div>
          </div>

          {injectMessage && (
            <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
              injectMessage.type === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-300'
            }`}>
              {injectMessage.text}
            </div>
          )}
        </div>

        {/* 5 Scenario Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* 1. Impossible Geo Travel */}
          <button
            disabled={isInjecting}
            onClick={() => handleInjectScenario("teleport")}
            className="p-3 rounded-xl bg-slate-950/80 hover:bg-sky-950/30 border border-slate-800 hover:border-sky-500/50 text-left transition group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 group-hover:scale-110 transition">
                <Compass className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono text-sky-400 font-bold">+25 pts</span>
            </div>
            <div className="text-xs font-bold text-slate-200 group-hover:text-white">
              Impossible Travel
            </div>
            <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
              Chennai → London in 31m (Speed &gt; 12,000 km/h)
            </div>
          </button>

          {/* 2. Velocity Burst */}
          <button
            disabled={isInjecting}
            onClick={() => handleInjectScenario("velocity")}
            className="p-3 rounded-xl bg-slate-950/80 hover:bg-amber-950/30 border border-slate-800 hover:border-amber-500/50 text-left transition group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 group-hover:scale-110 transition">
                <Zap className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono text-amber-400 font-bold">+25 pts</span>
            </div>
            <div className="text-xs font-bold text-slate-200 group-hover:text-white">
              Velocity Burst
            </div>
            <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
              6 transactions in 2 minutes for single customer
            </div>
          </button>

          {/* 3. Amount Spike */}
          <button
            disabled={isInjecting}
            onClick={() => handleInjectScenario("amount")}
            className="p-3 rounded-xl bg-slate-950/80 hover:bg-rose-950/30 border border-slate-800 hover:border-rose-500/50 text-left transition group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 group-hover:scale-110 transition">
                <DollarSign className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono text-rose-400 font-bold">+30 pts</span>
            </div>
            <div className="text-xs font-bold text-slate-200 group-hover:text-white">
              Unusual Amount
            </div>
            <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
              $15,850.00 spike (113x user baseline average)
            </div>
          </button>

          {/* 4. Entity Syndicate Ring */}
          <button
            disabled={isInjecting}
            onClick={() => handleInjectScenario("ring")}
            className="p-3 rounded-xl bg-slate-950/80 hover:bg-purple-950/30 border border-slate-800 hover:border-purple-500/50 text-left transition group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 group-hover:scale-110 transition">
                <Share2 className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono text-purple-400 font-bold">+20 pts</span>
            </div>
            <div className="text-xs font-bold text-slate-200 group-hover:text-white">
              Shared Entity Ring
            </div>
            <div className="text-[11px] text-slate-400 mt-1 line-clamp-2">
              Device and shipping address shared by 3+ accounts
            </div>
          </button>

          {/* 5. Critical Combo Attack */}
          <button
            disabled={isInjecting}
            onClick={() => handleInjectScenario("combo")}
            className="p-3 rounded-xl bg-rose-950/30 hover:bg-rose-900/40 border border-rose-800/60 hover:border-rose-500 text-left transition group"
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="p-1.5 rounded-lg bg-rose-500/20 text-rose-400 group-hover:scale-110 transition">
                <AlertTriangle className="w-4 h-4" />
              </span>
              <span className="text-[10px] font-mono text-rose-300 font-extrabold">🚨 95+ pts</span>
            </div>
            <div className="text-xs font-bold text-white">
              Critical Multi-Attack
            </div>
            <div className="text-[11px] text-rose-200/80 mt-1 line-clamp-2">
              Teleport + $18k Amount + Shared Device ring
            </div>
          </button>
        </div>
      </div>

      {/* Main Bottom Section: Recent High-Risk Flags & Live SNS Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Flagged Transactions (2 Cols) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              High-Risk Investigation Queue
            </h3>
            <button
              onClick={() => onNavigateToFlag("list")}
              className="text-xs text-sky-400 hover:text-sky-300 font-semibold flex items-center gap-1"
            >
              View All Flags <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-mono text-[11px]">
                <tr>
                  <th className="py-3 px-4">Txn ID</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Risk Level</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 font-mono">
                {recentFlags.length > 0 ? (
                  recentFlags.map((flag) => (
                    <tr key={flag.flag_id} className="hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 text-sky-300 font-bold">
                        {flag.txn_id?.slice(0, 14)}...
                      </td>
                      <td className="py-3 px-4 text-slate-200">
                        ${flag.transaction?.amount?.toLocaleString() ?? "—"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`font-bold ${
                          flag.total_score >= 70 ? 'text-rose-400' : 'text-amber-400'
                        }`}>
                          {flag.total_score}/100
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          flag.risk_level === 'HIGH' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {flag.risk_level}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-slate-300 font-sans text-[11px]">
                          {flag.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-sans">
                        <button
                          onClick={() => onNavigateToFlag(flag.flag_id)}
                          className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition"
                        >
                          Inspect Cockpit
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-sans">
                      No flagged transactions yet. Click any Scenario button above to inject fraud traffic!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* AWS SNS Real-Time Alert Broadcasts (1 Col) */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl flex flex-col">
          <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
            <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
              <Bell className="w-4 h-4 text-purple-400" />
              AWS SNS Alert Feed
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono">
              score ≥ 70
            </span>
          </div>

          <div className="p-4 flex-1 overflow-y-auto max-h-96 space-y-3">
            {alerts.length > 0 ? (
              alerts.map((al, idx) => (
                <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-purple-400 font-bold">
                      {al.txn_id?.slice(0, 12)}
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(al.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="text-slate-300 font-semibold line-clamp-1">
                    {al.subject}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-900">
                    <span>Status: <b className="text-emerald-400">{al.status}</b></span>
                    <span className="font-mono text-rose-400 font-bold">Score: {al.total_score}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-slate-500 text-xs italic">
                No high-risk SNS notifications sent yet.<br/>
                Injecting a scenario will trigger SNS alerting.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
