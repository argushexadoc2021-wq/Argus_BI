/**
 * Client API for Argus AI Face Recognition Attendance Subsystem
 * Connects with /api/attendance/* endpoints on Express backend & Supabase
 */
import { supabase } from '@/lib/supabase';

function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem('cncforge_gtoken') || null;
  } catch {
    return null;
  }
}

async function getAuthHeader(): Promise<Record<string, string>> {
  let token = getStoredToken();
  if (!token) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token || null;
    } catch {
      // ignore
    }
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJSON<T>(url: string, options: RequestInit = {}): Promise<T> {
  const authHeader = await getAuthHeader();
  const headers = {
    'Content-Type': 'application/json',
    ...authHeader,
    ...(options.headers || {}),
  };

  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || data.detail || `Request failed with status ${res.status}`);
  }
  return data as T;
}

export interface AttendanceSettings {
  id?: string;
  company_id: string;
  work_start_time: string;
  work_end_time: string;
  late_grace_minutes: number;
  half_day_hours: number;
  full_day_hours: number;
  geofence_enabled: boolean;
  geofence_latitude: number | null;
  geofence_longitude: number | null;
  geofence_radius_meters: number;
  liveness_strict: boolean;
  similarity_threshold: number;
}

export interface AttendanceEmployee {
  id: string;
  company_id: string;
  employee_code: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  department: string;
  designation: string;
  employment_type: string;
  shift_type: string;
  shift_start: string;
  shift_end: string;
  hourly_rate: number;
  is_enrolled?: boolean;
  embeddings_count?: number;
  is_active: boolean;
  avatar_url?: string;
}

export interface AttendanceRosterItem {
  employee_id: string;
  employee_code: string;
  name: string;
  department: string;
  designation: string;
  shift: string;
  status: 'PRESENT' | 'LATE' | 'HALF_DAY' | 'ABSENT' | 'OVERTIME' | 'ON_LEAVE';
  shift_status: string;
  is_currently_in: boolean;
  check_in_time: string | null;
  check_out_time: string | null;
  total_hours: number;
  confidence_score: number | null;
  punches?: any[];
}

export interface AttendanceRosterResponse {
  ok: boolean;
  date: string;
  metrics: {
    total_staff: number;
    present: number;
    late: number;
    half_day: number;
    absent: number;
    currently_clocked_in: number;
  };
  roster: AttendanceRosterItem[];
}

export interface KioskPunchResult {
  ok: boolean;
  action: 'CHECK_IN' | 'CHECK_OUT';
  time: string;
  date: string;
  total_hours: number;
  status: string;
  shift_status: string;
  confidence: number;
  employee: {
    id: string;
    employee_code: string;
    first_name: string;
    last_name: string;
    department: string;
    designation: string;
  };
  message: string;
}

export const attendanceApi = {
  getStatus: () => fetchJSON<{ ok: boolean; attendance_enabled: boolean; company_id: string }>('/api/attendance/status'),

  getSettings: (companyId?: string) =>
    fetchJSON<{ ok: boolean; settings: AttendanceSettings }>(
      `/api/attendance/settings${companyId ? `?company_id=${companyId}` : ''}`
    ),

  saveSettings: (settings: Partial<AttendanceSettings>) =>
    fetchJSON<{ ok: boolean; settings: AttendanceSettings }>('/api/attendance/settings', {
      method: 'POST',
      body: JSON.stringify(settings),
    }),

  getEmployees: (companyId?: string) =>
    fetchJSON<{ ok: boolean; employees: AttendanceEmployee[] }>(
      `/api/attendance/employees${companyId ? `?company_id=${companyId}` : ''}`
    ),

  saveEmployee: (employee: Partial<AttendanceEmployee>) =>
    fetchJSON<{ ok: boolean; employee: AttendanceEmployee }>('/api/attendance/employees', {
      method: 'POST',
      body: JSON.stringify(employee),
    }),

  deleteEmployee: (id: string) =>
    fetchJSON<{ ok: boolean; deleted: string }>(`/api/attendance/employees/${id}`, {
      method: 'DELETE',
    }),

  enrollFace: (payload: {
    employee_id: string;
    vectors: number[][] | number[];
    biometric_consent: boolean;
    avatar_preview?: string;
  }) =>
    fetchJSON<{ ok: boolean; message: string; employee: any }>('/api/attendance/enroll', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  punchKiosk: (payload: {
    company_id: string;
    vector: number[];
    punch_type?: 'AUTO' | 'CHECK_IN' | 'CHECK_OUT';
    kiosk_id?: string;
    latitude?: number;
    longitude?: number;
  }) =>
    fetchJSON<KioskPunchResult>('/api/attendance/kiosk-punch', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getRoster: (date?: string, companyId?: string) => {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (companyId) params.append('company_id', companyId);
    return fetchJSON<AttendanceRosterResponse>(`/api/attendance/roster?${params.toString()}`);
  },

  getReports: (startDate?: string, endDate?: string, companyId?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (companyId) params.append('company_id', companyId);
    return fetchJSON<any>(`/api/attendance/reports?${params.toString()}`);
  },

  manualOverride: (payload: {
    company_id?: string;
    employee_id: string;
    log_date: string;
    punch_in?: string;
    punch_out?: string;
    hours?: number;
    status?: string;
    reason: string;
  }) =>
    fetchJSON<{ ok: boolean; record: any }>('/api/attendance/manual-override', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getKiosks: (companyId?: string) =>
    fetchJSON<{ ok: boolean; kiosks: any[] }>(
      `/api/attendance/kiosks${companyId ? `?company_id=${companyId}` : ''}`
    ),

  saveKiosk: (kiosk: any) =>
    fetchJSON<{ ok: boolean; kiosk: any }>('/api/attendance/kiosks', {
      method: 'POST',
      body: JSON.stringify(kiosk),
    }),
};
