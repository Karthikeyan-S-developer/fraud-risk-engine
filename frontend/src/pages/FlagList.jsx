import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Search, RefreshCw, ArrowRight, CheckCircle2, 
  XCircle, AlertOctagon, HelpCircle, Zap, ShieldCheck
} from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function FlagList({ onSelectFlag }) {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [minScore, setMinScore] = useState(1);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [actionNotice, setActionNotice] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchFlags = async () => {
    setLoading(true);
    try {
      let url = `${API_BASE_URL}/flags?min_score=${minScore}&limit=100`;
      if (statusFilter !== "ALL") url += `&status=${statusFilter}`;
      if (riskFilter !== "ALL") url += `&risk_level=${riskFilter}`;

      const res = await fetch(url);
      if (res.ok) {
        setFlags(await res.json());
      }
    } catch (err) {
      console.error("Error fetching flags:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFlags();
  }, [statusFilter, riskFilter, minScore]);

  const handleQuickDecision = async (flagId, decision) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/flags/${flagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reviewer: "Quick Triage Lead",
          decision: decision,
          comment: `Quick review action applied: ${decision}`
        })
      });
      if (res.ok) {
        setActionNotice({
          type: 'success',
          text: `Flag #${flagId} updated to ${decision}`
        });
        fetchFlags();
      }
    } catch (err) {
      console.error("Quick decision error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBatchReview = async (decision) => {
    if (selectedIds.size === 0) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/flags/batch-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flag_ids: Array.from(selectedIds),
          decision: decision,
          reviewer: "Batch Compliance Officer",
          comment: `Batch resolved ${selectedIds.size} transactions as ${decision}`
        })
      });
      if (res.ok) {
        const data = await res.json();
        setActionNotice({
          type: 'success',
          text: `Batch updated ${data.updated_count} transactions to ${decision}`
        });
        setSelectedIds(new Set());
        fetchFlags();
      }
    } catch (err) {
      console.error("Batch review error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleAutoTriageAll = async () => {
    if (!window.confirm("Auto-triage all PENDING flags? Scores ≥70 will be CONFIRMED_FRAUD, and scores <70 will be CLEARED.")) {
      return;
    }
    setIsProcessing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/flags/auto-triage`, {
        method: 'POST'
      });
      if (res.ok) {
        const data = await res.json();
        setActionNotice({
          type: 'success',
          text: `Auto-Triaged ${data.total_triaged} transactions! (${data.confirmed_fraud} Fraud, ${data.cleared} Cleared)`
        });
        fetchFlags();
      }
    } catch (err) {
      console.error("Auto-triage error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredFlags.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredFlags.map(f => f.flag_id)));
    }
  };

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredFlags = flags.filter(f => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      f.txn_id?.toLowerCase().includes(q) ||
      f.transaction?.user_id?.toLowerCase().includes(q) ||
      f.transaction?.city?.toLowerCase().includes(q) ||
      f.transaction?.merchant?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-5">
      {/* Informational Queue Header */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex items-start gap-3 text-xs">
        <HelpCircle className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1 text-slate-300 space-y-1">
          <div className="font-semibold text-slate-200">
            Compliance Investigation Queue
          </div>
          <p className="text-slate-400">
            Transactions with policy risk scores (Score ≥ 30) enter as <span className="font-mono text-sky-400 font-semibold">PENDING</span> for reviewer confirmation. Use quick buttons to resolve items or click <span className="text-white font-semibold">Inspect</span> for full spatio-temporal and graph telemetry.
          </p>
        </div>
      </div>

      {/* Header & Controls */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-400" />
              Flagged Transactions Queue
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Deterministic rule violations and suspicious entity linkages requiring reviewer action
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              disabled={isProcessing}
              onClick={handleAutoTriageAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              Auto-Triage Pending
            </button>

            <button
              onClick={fetchFlags}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {actionNotice && (
          <div className={`p-2.5 rounded text-xs font-medium flex items-center gap-2 ${
            actionNotice.type === 'success' 
              ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
              : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
          }`}>
            <ShieldCheck className="w-4 h-4" />
            <span>{actionNotice.text}</span>
          </div>
        )}

        {/* Filter Toolbar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Txn ID, User, City..."
              className="w-full bg-slate-950 border border-slate-800 rounded pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">Pending Review</option>
              <option value="CONFIRMED_FRAUD">Confirmed Fraud</option>
              <option value="CLEARED">Cleared</option>
              <option value="ESCALATED">Escalated</option>
            </select>
          </div>

          {/* Risk Level Filter */}
          <div>
            <select
              value={riskFilter}
              onChange={(e) => setRiskFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">All Risk Levels</option>
              <option value="HIGH">HIGH (70 - 100)</option>
              <option value="MEDIUM">MEDIUM (30 - 69)</option>
              <option value="LOW">LOW (1 - 29)</option>
            </select>
          </div>

          {/* Min Score Filter */}
          <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs">
            <span className="text-slate-400 whitespace-nowrap">Min Score:</span>
            <input
              type="range"
              min="0"
              max="90"
              step="10"
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full accent-rose-500 cursor-pointer"
            />
            <span className="font-mono text-white font-bold w-6 text-right">{minScore}</span>
          </div>
        </div>

        {/* Batch Actions Bar (when checkboxes selected) */}
        {selectedIds.size > 0 && (
          <div className="bg-slate-950 border border-slate-700 p-2.5 rounded flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <span className="bg-sky-500/20 text-sky-400 px-2 py-0.5 rounded font-mono font-bold">
                {selectedIds.size}
              </span>
              transactions selected
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={isProcessing}
                onClick={() => handleBatchReview("CONFIRMED_FRAUD")}
                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-semibold transition flex items-center gap-1"
              >
                <XCircle className="w-3.5 h-3.5" />
                Confirm Fraud
              </button>
              <button
                disabled={isProcessing}
                onClick={() => handleBatchReview("CLEARED")}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-semibold transition flex items-center gap-1"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Clear Flags
              </button>
              <button
                disabled={isProcessing}
                onClick={() => handleBatchReview("ESCALATED")}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold transition flex items-center gap-1"
              >
                <AlertOctagon className="w-3.5 h-3.5" />
                Escalate
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Flagged Transactions Data Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={filteredFlags.length > 0 && selectedIds.size === filteredFlags.length}
                    onChange={toggleSelectAll}
                    className="accent-sky-500 cursor-pointer rounded"
                  />
                </th>
                <th className="py-2.5 px-3">Transaction ID</th>
                <th className="py-2.5 px-3">User / City</th>
                <th className="py-2.5 px-3">Amount</th>
                <th className="py-2.5 px-3">Score</th>
                <th className="py-2.5 px-3">ML Anomaly</th>
                <th className="py-2.5 px-3">Rules Fired</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {filteredFlags.length > 0 ? (
                filteredFlags.map((flag) => {
                  const txn = flag.transaction;
                  const isPending = flag.status === 'PENDING';
                  const isChecked = selectedIds.has(flag.flag_id);

                  return (
                    <tr key={flag.flag_id} className={`hover:bg-slate-800/40 transition ${isChecked ? 'bg-sky-950/20' : ''}`}>
                      <td className="py-2.5 px-3">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelectOne(flag.flag_id)}
                          className="accent-sky-500 cursor-pointer rounded"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-sky-300 font-semibold">
                        {flag.txn_id}
                      </td>
                      <td className="py-2.5 px-3 font-sans text-slate-300">
                        <div>{txn?.user_id || "User"}</div>
                        <div className="text-[10px] text-slate-500">{txn?.city || "Unknown City"}</div>
                      </td>
                      <td className="py-2.5 px-3 text-white font-semibold">
                        ${txn?.amount?.toLocaleString() ?? "—"}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`font-bold ${
                          flag.total_score >= 70 ? 'text-rose-400' : flag.total_score >= 30 ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {flag.total_score}/100
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="text-emerald-400 font-semibold">
                          {(flag.ml_anomaly_score * 100).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                          {flag.reasons?.length || 0} Rules
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-sans">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                          flag.status === 'CONFIRMED_FRAUD' 
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                            : flag.status === 'CLEARED'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            : flag.status === 'ESCALATED'
                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                        }`}>
                          {flag.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right font-sans">
                        <div className="flex items-center justify-end gap-1.5">
                          {isPending && (
                            <button
                              disabled={isProcessing}
                              onClick={() => handleQuickDecision(flag.flag_id, "CLEARED")}
                              className="px-2 py-0.5 rounded bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium transition"
                              title="Clear Flag"
                            >
                              ✓ Clear
                            </button>
                          )}

                          {isPending && (
                            <button
                              disabled={isProcessing}
                              onClick={() => handleQuickDecision(flag.flag_id, "CONFIRMED_FRAUD")}
                              className="px-2 py-0.5 rounded bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 border border-rose-500/30 text-[11px] font-medium transition"
                              title="Confirm Fraud"
                            >
                              ✕ Fraud
                            </button>
                          )}

                          <button
                            onClick={() => onSelectFlag(flag.flag_id)}
                            className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-semibold text-xs transition inline-flex items-center gap-1"
                          >
                            Inspect <ArrowRight className="w-3 h-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-sans text-xs">
                    {loading ? "Loading transactions..." : "No flagged transactions match current search criteria."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
