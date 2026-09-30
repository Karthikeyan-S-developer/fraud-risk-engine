import React, { useState } from 'react';
import { CheckCircle2, XCircle, AlertOctagon, Send, UserCheck, ShieldCheck } from 'lucide-react';
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
        text: `Successfully updated flag status to ${decision}`
      });
      setComment("");
      if (onActionSubmitted) {
        onActionSubmitted(updatedFlag);
      }
    } catch (err) {
      console.error("Action error:", err);
      setToastMessage({
        type: 'error',
        text: `Failed to record review action: ${err.message}`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm sm:text-base">
              Human-in-the-Loop Review Cockpit
            </h3>
            <p className="text-xs text-slate-400">
              Submit binding compliance decision with audit logging
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400">Current Status:</span>
          <span className={`px-2.5 py-1 rounded-full font-bold uppercase tracking-wider text-[11px] ${
            currentStatus === 'CONFIRMED_FRAUD' 
              ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              : currentStatus === 'CLEARED'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : currentStatus === 'ESCALATED'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              : 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
          }`}>
            {currentStatus || "PENDING"}
          </span>
        </div>
      </div>

      {toastMessage && (
        <div className={`mb-4 p-3 rounded-lg text-xs font-semibold flex items-center gap-2 ${
          toastMessage.type === 'success' 
            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
            : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
        }`}>
          <ShieldCheck className="w-4 h-4 flex-shrink-0" />
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Reviewer Inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Reviewer Name / ID
          </label>
          <input
            type="text"
            value={reviewer}
            onChange={(e) => setReviewer(e.target.value)}
            placeholder="e.g. Lead Investigator"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
            Audit Trail Comment & Evidence Summary
          </label>
          <input
            type="text"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Enter reason for decision (e.g., Confirmed card theft with customer; Impossible travel confirmed)"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        {/* Confirm Fraud */}
        <button
          disabled={isSubmitting}
          onClick={() => handleDecision("CONFIRMED_FRAUD")}
          className="flex-1 min-w-[150px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white font-semibold text-xs transition shadow-lg shadow-rose-950/40 disabled:opacity-50"
        >
          <XCircle className="w-4 h-4" />
          Confirm Fraud
        </button>

        {/* Clear Flag */}
        <button
          disabled={isSubmitting}
          onClick={() => handleDecision("CLEARED")}
          className="flex-1 min-w-[150px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-semibold text-xs transition shadow-lg shadow-emerald-950/40 disabled:opacity-50"
        >
          <CheckCircle2 className="w-4 h-4" />
          Clear Flag
        </button>

        {/* Escalate Flag */}
        <button
          disabled={isSubmitting}
          onClick={() => handleDecision("ESCALATED")}
          className="flex-1 min-w-[150px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-semibold text-xs transition shadow-lg shadow-amber-950/40 disabled:opacity-50"
        >
          <AlertOctagon className="w-4 h-4" />
          Escalate Flag
        </button>
      </div>
    </div>
  );
}
