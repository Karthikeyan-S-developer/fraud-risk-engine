import React, { useState, useEffect } from 'react';
import { ClipboardList, RefreshCw, UserCheck, ArrowUpRight } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function AuditLog({ onSelectFlag }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/audit-logs?limit=50`);
      if (res.ok) {
        setLogs(await res.json());
      }
    } catch (err) {
      console.error("Error fetching audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-lg flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-sky-400" />
            Compliance & Reviewer Audit Trail
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Immutable chronological record of human-in-the-loop decisions persisted in Neon PostgreSQL
          </p>
        </div>

        <button
          onClick={fetchLogs}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition border border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Audit Trail
        </button>
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Action ID</th>
                <th className="py-2.5 px-3">Flag Ref</th>
                <th className="py-2.5 px-3">Reviewer</th>
                <th className="py-2.5 px-3">Decision</th>
                <th className="py-2.5 px-3">Audit Comment</th>
                <th className="py-2.5 px-3">Timestamp (UTC)</th>
                <th className="py-2.5 px-3 text-right">View Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 font-mono">
              {logs.length > 0 ? (
                logs.map((log) => (
                  <tr key={log.action_id} className="hover:bg-slate-800/40 transition">
                    <td className="py-2.5 px-3 text-slate-400">
                      #{log.action_id}
                    </td>
                    <td className="py-2.5 px-3 text-sky-300 font-semibold">
                      Flag #{log.flag_id}
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-200">
                      <div className="flex items-center gap-1.5">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        {log.reviewer}
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                        log.decision === 'CONFIRMED_FRAUD' 
                          ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          : log.decision === 'CLEARED'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                      }`}>
                        {log.decision}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-slate-300 max-w-xs truncate">
                      {log.comment || "No comment provided"}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                      {new Date(log.acted_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-sans">
                      <button
                        onClick={() => onSelectFlag(log.flag_id)}
                        className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-400 text-xs font-semibold inline-flex items-center gap-1 transition border border-slate-700"
                      >
                        Inspect <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 font-sans text-xs">
                    {loading ? "Loading audit logs..." : "No reviewer actions recorded yet."}
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
