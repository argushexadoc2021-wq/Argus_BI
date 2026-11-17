import React from 'react';
import { Routes, Route, Navigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  UserPlus,
  FileSpreadsheet,
  Settings,
  Camera,
  ExternalLink,
  ShieldCheck,
  Building2,
} from 'lucide-react';
import { KioskTerminalPage } from './pages/KioskTerminalPage';
import { AttendanceDashboard } from './pages/AttendanceDashboard';
import { FaceEnrollmentPage } from './pages/FaceEnrollmentPage';
import { AttendanceReportsPage } from './pages/AttendanceReportsPage';
import { AttendanceSettingsPage } from './pages/AttendanceSettingsPage';
import { useAuth } from '@/contexts/AuthContext';

export function AttendanceApp() {
  const location = useLocation();
  const { company, attendanceEnabled, isSuperAdmin } = useAuth();

  // Fullscreen Kiosk Mode (no top bar chrome)
  if (location.pathname === '/attendance/kiosk' || location.pathname === '/kiosk') {
    return <KioskTerminalPage />;
  }

  // If attendance is disabled for this company and not super admin
  if (!attendanceEnabled && !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 border border-orange-200 flex items-center justify-center mx-auto mb-4 font-bold">
            <Camera className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">AI Attendance is Disabled</h2>
          <p className="mt-2 text-xs text-slate-600">
            Biometric Facial Recognition Attendance is not enabled for {company?.name || 'your company'}. Please contact your administrator.
          </p>
          <div className="mt-5">
            <button
              onClick={() => window.location.assign('/dashboard')}
              className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
            >
              Return to BI Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navLinks = [
    { path: '/attendance/dashboard', label: 'Live Roster & KPIs', icon: LayoutDashboard },
    { path: '/attendance/enroll', label: 'Face Enrollment', icon: UserPlus },
    { path: '/attendance/reports', label: 'Reports & Payroll', icon: FileSpreadsheet },
    { path: '/attendance/settings', label: 'Shift & Policies', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col">
      {/* Attendance Subsystem Sub-Header Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center font-bold text-white shadow-md shadow-orange-500/20">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm text-slate-900">AI Biometric Attendance</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-50 text-orange-700 border border-orange-200">
                  v2.0
                </span>
              </div>
              <div className="text-[11px] text-slate-500 font-medium">
                {company?.name || 'Argus Technologies'} &bull; Workplace Timekeeping
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
            {navLinks.map((tab) => {
              const Icon = tab.icon;
              const isActive = location.pathname === tab.path;
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}

            <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

            <a
              href="/attendance/kiosk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-sm shadow-orange-500/20 transition-all shrink-0"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>Launch Kiosk</span>
              <ExternalLink className="w-3 h-3 opacity-75" />
            </a>
          </div>
        </div>
      </header>

      {/* Routed Content View */}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Navigate to="/attendance/dashboard" replace />} />
          <Route path="/dashboard" element={<AttendanceDashboard />} />
          <Route path="/enroll" element={<FaceEnrollmentPage />} />
          <Route path="/reports" element={<AttendanceReportsPage />} />
          <Route path="/settings" element={<AttendanceSettingsPage />} />
          <Route path="*" element={<Navigate to="/attendance/dashboard" replace />} />
        </Routes>
      </main>
    </div>
  );
}
