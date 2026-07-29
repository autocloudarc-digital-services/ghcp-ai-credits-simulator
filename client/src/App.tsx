import { NavLink, Route, Routes } from 'react-router-dom';
import {
  LayoutDashboard,
  SlidersHorizontal,
  Search,
  ListChecks,
  FileText,
  Sparkles,
} from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Simulator from './pages/Simulator';
import Assessment from './pages/Assessment';
import Recommendations from './pages/Recommendations';
import Report from './pages/Report';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/simulator', label: 'Simulator', icon: SlidersHorizontal },
  { to: '/assessment', label: 'Assessment', icon: Search },
  { to: '/recommendations', label: 'Recommendations', icon: ListChecks },
  { to: '/report', label: 'Report', icon: FileText },
];

export default function App() {
  return (
    <div className="flex min-h-screen bg-slate-900 text-slate-100">
      <aside className="w-64 shrink-0 bg-slate-950/60 border-r border-slate-800 flex flex-col">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-800">
          <Sparkles className="w-6 h-6 text-teal-400" />
          <div>
            <div className="text-sm font-semibold leading-tight">GHCP AI Credits</div>
            <div className="text-xs text-slate-400 leading-tight">Simulator</div>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-500/15 text-teal-400 border border-teal-400/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800 border border-transparent'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-slate-800 text-xs text-slate-500">
          Governance for GitHub Copilot AI Credits under Usage-Based Billing.
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto p-6 lg:p-8">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/simulator" element={<Simulator />} />
          <Route path="/assessment" element={<Assessment />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/report" element={<Report />} />
        </Routes>
      </main>
    </div>
  );
}
