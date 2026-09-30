import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertOctagon, UserCheck, ShieldCheck } from 'lucide-react';
import { API_BASE_URL } from '../config';

export default function ActionPanel({ flagId, currentStatus, onActionSubmitted }) {
  const [reviewer, setReviewer] = useState("Lead Investigator");
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const handleDecision = async (decision) => {
    if (!reviewer.trim()) {
      alert("Please specify a reviewer identifier.");
      return;
    }

    setIsSubmitting(true);
    setToastMessage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/flags/${flagId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reviewer: reviewer.trim(),
          decision: decision,
          comment: comment.trim() || `Transaction marked as ${decision} after reviewer cockpit inspection.`
        })
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const updatedFlag = await res.json();
      setToastMessage({
        type: 'success',
        text: `Updated flag status to ${decision}`
      });
      setComment("");
      if (onActionSubmitted) {
        onActionSubmitted(updatedFlag);
      }
    } catch (err) {
      console.error("Action error:", err);
      setToastMessage({
        type: 'error',
        text: `Failed to record action: ${err.message}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 mb-3">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded bg-rose-500/10 text-rose-400">
            <UserCheck className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">
              Reviewer Decision Panel
            </h3>
            <p className="text-xs text-slate-400">
              Submit binding compliance review decision (persisted with audit log)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Current Status:</span>
          <span className={`px-2 py-0.5 rounded font-semibold uppercase tracking-wider text-[10px] ${
            currentStatus === 'CONFIRMED_FRAUD' 
              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
              : currentStatus === 'CLEARED'
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : currentStatus === 'ESCALATED'
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
              : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
          }`}>
            {currentStatus || "PENDING"}
          </span>
        </div>
      </div>

      {toastMessage && (
        <div className={`mb-3 p-2.5 rounded text-xs font-medium flex items-center gap-2 ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
        }`}>
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Reviewer Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Reviewer Name / ID
          </label>
          <input
            type="text"
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            placeholder="e.g. Lead Investigator"
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">
            Audit Trail Comment & Evidence Summary
          </label>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Enter reason for decision (e.g., Confirmed card theft with customer; Impossible travel confirmed)"
            className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {/* Confirm Fraud */}
        <button
          disabled={isSubmitting}
          onClick={() => handleDecision("CONFIRMED_FRAUD")}
          className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs transition border border-rose-500/30 disabled:opacity-50"
        >
          <XCircle className="w-3.5 h-3.5" />
          Confirm Fraud
        </button>

        {/* Clear Flag */}
        <button
          disabled={isSubmitting}
          onClick={() => handleDecision("CLEARED")}
          className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition border border-emerald-500/30 disabled:opacity-50"
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Clear Flag
        </button>

        {/* Escalate Flag */}
        <button
          disabled={isSubmitting}
          onClick={() => handleDecision("ESCALATED")}
          className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 px-3 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition border border-amber-500/30 disabled:opacity-50"
        >
          <AlertOctagon className="w-3.5 h-3.5" />
          Escalate Flag
        </button>
      </div>
    </div>
  );
}
