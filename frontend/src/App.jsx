import React, { useState } from 'react';
import { Shield, LayoutDashboard, ListFilter, ClipboardCheck, Server } from 'lucide-react';
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-sky-500/20 selection:text-sky-200">
      {/* Top Navigation Header */}
      <header className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          {/* Logo & Brand */}
          <div 
            onClick={() => { setActiveFlagId(null); setCurrentPage('dashboard'); }}
            className="flex items-center gap-2.5 cursor-pointer"
          >
            <div className="w-8 h-8 rounded bg-slate-800 border border-slate-700 flex items-center justify-center text-sky-400">
              <Shield className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-wide text-white">ACENTRA</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                AEGIS
              </span>
              <span className="hidden md:inline text-xs text-slate-400 border-l border-slate-800 pl-2 ml-1">
                Fraud Risk Engine
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1">
            <button
              onClick={() => { setActiveFlagId(null); setCurrentPage('dashboard'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition ${
                currentPage === 'dashboard'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => { setActiveFlagId(null); setCurrentPage('flags'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition ${
                currentPage === 'flags' || currentPage === 'detail'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" />
              <span>Flagged Queue</span>
            </button>

            <button
              onClick={() => { setActiveFlagId(null); setCurrentPage('audit'); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition ${
                currentPage === 'audit'
                  ? 'bg-slate-800 text-sky-400 border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
              }`}
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              <span>Audit Trail</span>
            </button>
          </nav>

          {/* DB Connection Indicator */}
          <div className="hidden lg:flex items-center gap-2 font-mono text-[11px] bg-slate-950 border border-slate-800 px-2.5 py-1 rounded">
            <Server className="w-3 h-3 text-emerald-400" />
            <span className="text-slate-400">PostgreSQL:</span>
            <span className="text-emerald-400 font-medium">Neon Active</span>
          </div>
        </div>
      </header>

      {/* Main Workspace Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
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

      {/* System Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-2">
          <span>Acentra Aegis Fraud Platform v1.2</span>
          <span className="font-mono text-slate-600">Deterministic Rules • Heterogeneous Graph • Haversine Mobility • SHAP ML</span>
        </div>
      </footer>
    </div>
  );
}
