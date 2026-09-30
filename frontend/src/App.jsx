import React, { useState } from 'react';
import { Shield, ShieldAlert, LayoutDashboard, ListFilter, ClipboardCheck, Bell, Zap, Compass, DollarSign, Share2 } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import FlagList from './pages/FlagList';
import FlagDetail from './pages/FlagDetail';
import AuditLog from './pages/AuditLog';

export default function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeFlagId, setActiveFlagId] = useState(null);

  const handleSelectFlag = (flagId) => {
    setActiveFlagId(flagId);
    setCurrentPage('detail');
  };

  const handleBackToFlags = () => {
    setActiveFlagId(null);
    setCurrentPage('flags');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-rose-500/30 selection:text-rose-200">
      {/* Top Main Navigation Bar */}
      <header className="sticky top-0 z-50 glass-panel border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo & Brand */}
          <div 
            onClick={() => { setActiveFlagId(null); setCurrentPage('dashboard'); }}
            className="flex items-center gap-3 cursor-pointer group"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 via-sky-600 to-indigo-600 p-0.5 shadow-lg shadow-rose-950/50 group-hover:scale-105 transition">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <Shield className="w-5 h-5 text-sky-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-black text-lg tracking-wider text-white">ACENTRA</span>
                <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold">
                  AEGIS
                </span>
              </div>
              <p className="text-[10px] font-mono text-slate-400 -mt-0.5 tracking-tight">
                Graph & Rule-Engine Fraud Platform
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => { setActiveFlagId(null); setCurrentPage('dashboard'); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentPage === 'dashboard'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <LayoutDashboard className="w-4 h-4" />
              <span className="hidden sm:inline">Dashboard</span>
            </button>

            <button
              onClick={() => { setActiveFlagId(null); setCurrentPage('flags'); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentPage === 'flags' || currentPage === 'detail'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <ListFilter className="w-4 h-4" />
              <span className="hidden sm:inline">Flagged Queue</span>
            </button>

            <button
              onClick={() => { setActiveFlagId(null); setCurrentPage('audit'); }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition ${
                currentPage === 'audit'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <ClipboardCheck className="w-4 h-4" />
              <span className="hidden sm:inline">Audit Trail</span>
            </button>
          </nav>

          {/* Environment Status Badge */}
          <div className="hidden lg:flex items-center gap-2 font-mono text-[11px] bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-full">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-slate-400">PostgreSQL:</span>
            <span className="text-emerald-400 font-bold">Neon Serverless</span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentPage === 'dashboard' && (
          <Dashboard 
            onNavigateToFlag={(flagId) => {
              if (flagId === "list") {
                setCurrentPage('flags');
              } else {
                handleSelectFlag(flagId);
              }
            }} 
          />
        )}

        {currentPage === 'flags' && (
          <FlagList 
            onSelectFlag={handleSelectFlag} 
          />
        )}

        {currentPage === 'detail' && activeFlagId && (
          <FlagDetail 
            flagId={activeFlagId} 
            onBack={handleBackToFlags} 
          />
        )}

        {currentPage === 'audit' && (
          <AuditLog 
            onSelectFlag={handleSelectFlag} 
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>Acentra Aegis Fraud Detection Platform • Multi-Layered Defense Architecture</span>
          <span className="font-mono text-slate-600">Deterministic Rules • In-Memory NetworkX • Spatio-Temporal Haversine • Isolated SHAP</span>
        </div>
      </footer>
    </div>
  );
}
