import React, { useState } from 'react';
import { ShieldAlert, Zap, DollarSign, Compass, Share2, ChevronDown, ChevronUp, Brain, Info, CheckCircle2 } from 'lucide-react';

const RULE_METADATA = {
  TransactionVelocityRule: {
    title: "Transaction Velocity",
    maxScore: 25,
    icon: Zap,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30"
  },
  UnusualTransactionAmountRule: {
    title: "Unusual Transaction Amount",
    maxScore: 30,
    icon: DollarSign,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/30"
  },
  ImpossibleGeographicalLocationRule: {
    title: "Impossible Geo Location",
    maxScore: 25,
    icon: Compass,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30"
  },
  SharedEntityGraphRiskRule: {
    title: "Shared Entity Graph Risk",
    maxScore: 20,
    icon: Share2,
    color: "text-purple-400",
    bg: "bg-purple-500/10",
    border: "border-purple-500/30"
  }
};

export default function RuleBreakdownCard({ flag, shapAttributions }) {
  const [expandedRule, setExpandedRule] = useState(null);

  const reasons = flag?.reasons || [];
  const totalScore = flag?.total_score || 0;
  const mlScore = flag?.ml_anomaly_score || 0.0;
  const riskLevel = flag?.risk_level || "LOW";

  const toggleExpand = (ruleName) => {
    setExpandedRule(prev => prev === ruleName ? null : ruleName);
  };

  // Known 4 core rules list
  const coreRuleKeys = [
    "TransactionVelocityRule",
    "UnusualTransactionAmountRule",
    "ImpossibleGeographicalLocationRule",
    "SharedEntityGraphRiskRule"
  ];

  return (
    <div className="space-y-6">
      {/* SECTION 1: DETERMINISTIC RULE ENGINE SCORE BREAKDOWN */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm sm:text-base">
                Rule Score Breakdown
              </h3>
              <p className="text-xs text-slate-400">
                Primary Foundation: Deterministic Strategy Pattern
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-xs text-slate-400 font-mono">AGGREGATE SCORE</div>
            <div className="text-xl font-extrabold font-mono text-white flex items-center gap-1 justify-end">
              <span className={totalScore >= 70 ? "text-rose-400" : totalScore >= 30 ? "text-amber-400" : "text-emerald-400"}>
                {totalScore}
              </span>
              <span className="text-slate-500 text-sm">/100</span>
            </div>
          </div>
        </div>

        {/* Rules List */}
        <div className="divide-y divide-slate-800/80 p-3 space-y-2">
          {coreRuleKeys.map((ruleKey) => {
            const meta = RULE_METADATA[ruleKey] || {
              title: ruleKey,
              maxScore: 25,
              icon: ShieldAlert,
              color: "text-slate-400",
              bg: "bg-slate-800",
              border: "border-slate-700"
            };
            const Icon = meta.icon;
            
            // Check if this rule triggered
            const fired = reasons.find(r => r.rule_name === ruleKey);
            const score = fired ? fired.score : 0;
            const isFired = score > 0;
            const isExpanded = expandedRule === ruleKey;

            return (
              <div 
                key={ruleKey} 
                className={`rounded-lg transition border ${isFired ? `${meta.border} bg-slate-900/90` : 'border-slate-800/40 bg-slate-950/40 opacity-70'}`}
              >
                <div 
                  onClick={() => isFired && toggleExpand(ruleKey)}
                  className={`p-3 flex items-center justify-between gap-3 ${isFired ? 'cursor-pointer hover:bg-slate-800/50' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${meta.bg} ${meta.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                        {meta.title}
                        {isFired ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-rose-500/20 text-rose-400 border border-rose-500/30">
                            Fired
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium text-slate-400 bg-slate-800">
                            Passed
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                        {fired ? fired.reason : "No anomalous pattern identified against policy threshold."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`font-mono font-bold text-sm ${isFired ? meta.color : 'text-slate-500'}`}>
                      {isFired ? `+${score}` : `0`} <span className="text-xs text-slate-600">/ {meta.maxScore}</span>
                    </span>
                    {isFired && (
                      <button className="text-slate-400 hover:text-white">
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Evidence Drawer */}
                {isFired && isExpanded && fired.evidence && (
                  <div className="px-4 pb-3 pt-1 border-t border-slate-800/80 bg-slate-950/60 rounded-b-lg">
                    <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Info className="w-3.5 h-3.5 text-sky-400" /> Evidence Audit Payload
                    </div>
                    <pre className="bg-slate-900 p-2.5 rounded-md text-[11px] font-mono text-slate-300 overflow-x-auto border border-slate-800">
                      {JSON.stringify(fired.evidence, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: ISOLATED ML RISK SIGNAL & SHAP LOCAL FEATURE ATTRIBUTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
        <div className="p-4 bg-slate-850 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Brain className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-100 text-sm sm:text-base flex items-center gap-2">
                SHAP Local Feature Attribution
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-normal">
                  Isolated ML Layer
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                XGBoost probability: <b className="font-mono text-emerald-400">{(mlScore * 100).toFixed(1)}%</b> (Explainable Shapley contributions)
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="text-xs text-slate-400 mb-2">
            Features pushing the transaction towards anomaly (positive values elevate fraud risk):
          </div>

          {shapAttributions && Object.keys(shapAttributions).length > 0 ? (
            <div className="space-y-2.5">
              {Object.entries(shapAttributions).map(([feat, val]) => {
                const isRiskElevating = val > 0;
                const absVal = Math.min(100, Math.abs(val) * 100);

                return (
                  <div key={feat} className="text-xs">
                    <div className="flex justify-between font-mono mb-1">
                      <span className="text-slate-300 font-medium capitalize">
                        {feat.replace(/_/g, ' ')}
                      </span>
                      <span className={isRiskElevating ? "text-rose-400 font-bold" : "text-emerald-400"}>
                        {isRiskElevating ? `+${val.toFixed(3)}` : val.toFixed(3)}
                      </span>
                    </div>

                    {/* Horizontal Divergence Bar */}
                    <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                      <div 
                        className={`h-full transition-all duration-500 rounded-full ${isRiskElevating ? 'bg-gradient-to-r from-rose-500 to-red-400' : 'bg-gradient-to-r from-emerald-500 to-teal-400'}`}
                        style={{ width: `${absVal}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-slate-500 italic p-3 text-center bg-slate-950 rounded">
              Standard local Shapley attributions computed within normal bounds.
            </div>
          )}

          <div className="mt-3 p-2.5 rounded bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
            <Info className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <span>
              <b>Mentor Architecture Note:</b> The ML layer acts as an auxiliary risk signal for cognitive reviewer oversight. It does not overwrite or mask the deterministic rule scoring foundation.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
