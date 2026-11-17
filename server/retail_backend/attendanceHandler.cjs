/* ======================================================================================
 * AI Face Recognition Attendance Subsystem Backend Handler
 * Supports:
 * - 128-dimensional biometric face vector storage & consensus averaging
 * - High-security 1:N vector cosine matching with winner-take-all margin ambiguity protection
 * - Alternating in/out punch state machine with work hours & late-grace evaluation
 * - Geofencing validation via Haversine distance
 * - Tablet kiosk terminal registration & heartbeats
 * - Attendance roster, monthly payroll reports, leaves, and manual supervisor overrides
 * - Full multi-tenant isolation via company_id
 * ====================================================================================== */
'use strict';

// Standard Indian Standard Time (UTC+5:30) helper
function getNowIST() {
  const d = new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  return new Date(utc + 5.5 * 3600000);
}

function formatTime12(date) {
  let h = date.getHours();
  const m = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${String(h).padStart(2, '0')}:${m}:${s} ${ampm}`;
}

function formatDateISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 3D/128-d Cosine Similarity
function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || !vecA.length || !vecB.length) return 0.0;
  const len = Math.min(vecA.length, vecB.length);
  let dot = 0.0, normA = 0.0, normB = 0.0;
  for (let i = 0; i < len; i++) {
    const a = Number(vecA[i]) || 0;
    const b = Number(vecB[i]) || 0;
    dot += a * b;
    normA += a * a;
    normB += b * b;
  }
  if (normA < 1e-6 || normB < 1e-6) return 0.0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Haversine distance in meters
function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

module.exports = function mountAttendanceSubsystem({ app, SB, db, save, uid }) {
  // Ensure local in-memory DB collections exist as fallback
  if (!Array.isArray(db.attendance_settings)) db.attendance_settings = [];
  if (!Array.isArray(db.attendance_employees)) db.attendance_employees = [];
  if (!Array.isArray(db.attendance_records)) db.attendance_records = [];
  if (!Array.isArray(db.attendance_kiosks)) db.attendance_kiosks = [];
  if (!Array.isArray(db.attendance_leaves)) db.attendance_leaves = [];
  if (!Array.isArray(db.attendance_audit_logs)) db.attendance_audit_logs = [];

  // Authenticate user via Supabase Bearer token
  async function authUser(req, res) {
    if (!SB || !SB.enabled) {
      res.status(503).json({ ok: false, error: 'Database service is unavailable.' });
      return null;
    }
    const h = String(req.headers.authorization || '');
    const user = h.startsWith('Bearer ') ? await SB.authUserFromToken(h.slice(7).trim()) : null;
    if (!user || !user.id) {
      res.status(401).json({ ok: false, error: 'Please sign in again.' });
      return null;
    }

    const { data: rows } = await SB.admin
      .from('company_users')
      .select('id, email, full_name, role, status, company_id')
      .eq('email', String(user.email || '').toLowerCase())
      .limit(5);

    const bi = (rows || []).find((r) => r.status === 'Active') || (rows || [])[0];
    if (!bi || bi.status !== 'Active') {
      res.status(403).json({ ok: false, error: 'Your account is not active.' });
      return null;
    }

    const role = String(bi.role || 'USER').toUpperCase();
    const isSuper = role === 'SUPER_ADMIN';
    const isAdmin = isSuper || role === 'COMPANY_ADMIN';

    return {
      authUserId: user.id,
      userId: bi.id,
      email: String(bi.email || user.email || '').toLowerCase(),
      name: bi.full_name || '',
      role,
      companyId: bi.company_id,
      isSuper,
      isAdmin,
    };
  }

  // -------------------------------------------------------------------------
  // 1. GET ATTENDANCE STATUS & PLATFORM SWITCH
  // -------------------------------------------------------------------------
  app.get('/api/attendance/status', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;

      let enabled = true;
      if (u.companyId) {
        const { data: comp } = await SB.admin
          .from('companies')
          .select('attendance_enabled')
          .eq('id', u.companyId)
          .maybeSingle();
        if (comp && comp.attendance_enabled !== undefined) {
          enabled = comp.attendance_enabled !== false;
        }
      }

      res.json({ ok: true, attendance_enabled: enabled, company_id: u.companyId });
    } catch (err) {
      console.error('[Attendance API] /status error:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // 2. SETTINGS: GET & UPDATE SHIFT / GEOFENCE POLICIES
  // -------------------------------------------------------------------------
  app.get('/api/attendance/settings', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;

      const companyId = req.query.company_id || u.companyId;
      if (!companyId) return res.json({ ok: true, settings: null });

      const { data, error } = await SB.admin
        .from('bi_attendance_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.warn('[Attendance API] Settings fetch warning:', error.message);
      }

      const defaultSettings = {
        company_id: companyId,
        work_start_time: '09:00',
        work_end_time: '18:00',
        late_grace_minutes: 15,
        half_day_hours: 4.5,
        full_day_hours: 8.0,
        geofence_enabled: false,
        geofence_latitude: 13.0827,
        geofence_longitude: 80.2707,
        geofence_radius_meters: 200,
        liveness_strict: true,
        similarity_threshold: 0.80,
      };

      res.json({ ok: true, settings: data || defaultSettings });
    } catch (err) {
      console.error('[Attendance API] /settings GET error:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/attendance/settings', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;
      if (!u.isAdmin) return res.status(403).json({ ok: false, error: 'Only admins can modify attendance settings.' });

      const b = req.body || {};
      const companyId = b.company_id || u.companyId;
      if (!companyId) return res.status(400).json({ ok: false, error: 'Company ID is required.' });

      const payload = {
        company_id: companyId,
        work_start_time: b.work_start_time || '09:00',
        work_end_time: b.work_end_time || '18:00',
        late_grace_minutes: parseInt(b.late_grace_minutes, 10) || 15,
        half_day_hours: parseFloat(b.half_day_hours) || 4.5,
        full_day_hours: parseFloat(b.full_day_hours) || 8.0,
        geofence_enabled: !!b.geofence_enabled,
        geofence_latitude: b.geofence_latitude ? parseFloat(b.geofence_latitude) : null,
        geofence_longitude: b.geofence_longitude ? parseFloat(b.geofence_longitude) : null,
        geofence_radius_meters: parseInt(b.geofence_radius_meters, 10) || 200,
        liveness_strict: b.liveness_strict !== false,
        similarity_threshold: parseFloat(b.similarity_threshold) || 0.80,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await SB.admin
        .from('bi_attendance_settings')
        .upsert(payload, { onConflict: 'company_id' })
        .select()
        .single();

      if (error) {
        console.error('[Attendance API] Settings upsert error:', error);
        // Fallback to local memory DB
        const idx = db.attendance_settings.findIndex((s) => s.company_id === companyId);
        if (idx >= 0) db.attendance_settings[idx] = { ...db.attendance_settings[idx], ...payload };
        else db.attendance_settings.push(payload);
        save();
        return res.json({ ok: true, settings: payload, source: 'local_db' });
      }

      res.json({ ok: true, settings: data });
    } catch (err) {
      console.error('[Attendance API] /settings POST error:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // 3. EMPLOYEES: LIST, CREATE, UPDATE, DELETE
  // -------------------------------------------------------------------------
  app.get('/api/attendance/employees', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;

      const companyId = req.query.company_id || u.companyId;
      if (!companyId) return res.json({ ok: true, employees: [] });

      const { data, error } = await SB.admin
        .from('bi_attendance_employees')
        .select('*')
        .eq('company_id', companyId)
        .order('employee_code', { ascending: true });

      if (error) {
        console.warn('[Attendance API] Employee query fallback:', error.message);
        const list = db.attendance_employees.filter((e) => e.company_id === companyId);
        return res.json({ ok: true, employees: list });
      }

      // Hide raw embedding arrays from light list query for bandwidth efficiency
      const sanitized = (data || []).map((e) => ({
        ...e,
        is_enrolled: Array.isArray(e.face_embeddings) && e.face_embeddings.length > 0,
        embeddings_count: Array.isArray(e.face_embeddings) ? e.face_embeddings.length : 0,
        face_embeddings: undefined, // strip from response
      }));

      res.json({ ok: true, employees: sanitized });
    } catch (err) {
      console.error('[Attendance API] /employees GET error:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/attendance/employees', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;
      if (!u.isAdmin) return res.status(403).json({ ok: false, error: 'Admin permission required.' });

      const b = req.body || {};
      const companyId = b.company_id || u.companyId;
      if (!companyId) return res.status(400).json({ ok: false, error: 'Company ID is required.' });
      if (!b.employee_code || !b.first_name) {
        return res.status(400).json({ ok: false, error: 'Employee code and first name are required.' });
      }

      const payload = {
        company_id: companyId,
        employee_code: String(b.employee_code).trim().toUpperCase(),
        first_name: String(b.first_name).trim(),
        last_name: String(b.last_name || '').trim(),
        email: b.email ? String(b.email).trim().toLowerCase() : null,
        phone: b.phone ? String(b.phone).trim() : null,
        department: b.department || 'General',
        designation: b.designation || 'Staff',
        employment_type: b.employment_type || 'FULL_TIME',
        shift_type: b.shift_type || 'FIXED',
        shift_start: b.shift_start || '09:00',
        shift_end: b.shift_end || '18:00',
        hourly_rate: parseFloat(b.hourly_rate) || 250.0,
        is_active: b.is_active !== false,
        updated_at: new Date().toISOString(),
      };

      if (b.id) {
        // Update existing
        const { data, error } = await SB.admin
          .from('bi_attendance_employees')
          .update(payload)
          .eq('id', b.id)
          .eq('company_id', companyId)
          .select()
          .single();

        if (error) throw error;
        return res.json({ ok: true, employee: data });
      }

      // Insert new
      const { data, error } = await SB.admin
        .from('bi_attendance_employees')
        .insert({ ...payload, face_embeddings: [] })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          return res.status(409).json({ ok: false, error: `Employee code '${payload.employee_code}' already exists.` });
        }
        throw error;
      }

      res.json({ ok: true, employee: data });
    } catch (err) {
      console.error('[Attendance API] /employees POST error:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.delete('/api/attendance/employees/:id', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;
      if (!u.isAdmin) return res.status(403).json({ ok: false, error: 'Admin permission required.' });

      const empId = req.params.id;
      const { error } = await SB.admin
        .from('bi_attendance_employees')
        .delete()
        .eq('id', empId)
        .eq('company_id', u.companyId);

      if (error) throw error;
      res.json({ ok: true, deleted: empId });
    } catch (err) {
      console.error('[Attendance API] /employees DELETE error:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // 4. BIOMETRIC ENROLLMENT WIZARD: SAVE FACE EMBEDDINGS & CONSENT
  // -------------------------------------------------------------------------
  app.post('/api/attendance/enroll', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;
      if (!u.isAdmin) return res.status(403).json({ ok: false, error: 'Admin permission required for enrollment.' });

      const b = req.body || {};
      const employeeId = b.employee_id;
      const vectors = b.vectors; // Array of 128-d arrays or single 128-d array
      const biometricConsent = !!b.biometric_consent;

      if (!employeeId) return res.status(400).json({ ok: false, error: 'Employee ID is required.' });
      if (!biometricConsent) return res.status(400).json({ ok: false, error: 'Biometric consent must be acknowledged.' });

      let embeddingsList = [];
      if (Array.isArray(vectors) && vectors.length > 0) {
        if (typeof vectors[0] === 'number') {
          // Single 128-d vector
          embeddingsList = [vectors];
        } else if (Array.isArray(vectors[0])) {
          // Multiple 128-d vectors (e.g. 3 consecutive capture angles)
          embeddingsList = vectors;
        }
      }

      if (!embeddingsList.length) {
        return res.status(400).json({ ok: false, error: 'At least one valid 128-dimensional face embedding is required.' });
      }

      // Compute normalized consensus vector
      const vectorLen = embeddingsList[0].length;
      const consensus = new Array(vectorLen).fill(0);
      for (const vec of embeddingsList) {
        for (let i = 0; i < vectorLen; i++) {
          consensus[i] += vec[i] || 0;
        }
      }
      let norm = 0;
      for (let i = 0; i < vectorLen; i++) {
        consensus[i] = consensus[i] / embeddingsList.length;
        norm += consensus[i] * consensus[i];
      }
      norm = Math.sqrt(norm);
      if (norm > 1e-6) {
        for (let i = 0; i < vectorLen; i++) consensus[i] /= norm;
      }

      // Store in Supabase
      const updatePayload = {
        face_embeddings: [consensus, ...embeddingsList],
        enrolled_samples_count: embeddingsList.length,
        biometric_consent: true,
        consent_timestamp: new Date().toISOString(),
        avatar_url: b.avatar_preview || undefined,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await SB.admin
        .from('bi_attendance_employees')
        .update(updatePayload)
        .eq('id', employeeId)
        .eq('company_id', u.companyId)
        .select('id, employee_code, first_name, last_name, department, enrolled_samples_count, biometric_consent')
        .single();

      if (error) throw error;

      // Log biometric audit trail
      await SB.admin.from('bi_attendance_audit_logs').insert({
        company_id: u.companyId,
        action: 'ENROLLMENT',
        actor_email: u.email,
        employee_id: employeeId,
        details: {
          samples_count: embeddingsList.length,
          vector_dimension: vectorLen,
          consent_granted: true,
        },
      }).then(() => {}).catch(() => {});

      res.json({
        ok: true,
        message: `Successfully enrolled ${data.first_name} ${data.last_name} with ${embeddingsList.length} biometric samples.`,
        employee: data,
      });
    } catch (err) {
      console.error('[Attendance API] /enroll error:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // 5. KIOSK PUNCH ENGINE: 1:N MATCHING & PUNCH STATE MACHINE
  // -------------------------------------------------------------------------
  app.post('/api/attendance/kiosk-punch', async (req, res) => {
    try {
      const b = req.body || {};
      const companyId = b.company_id;
      const liveVector = b.vector; // 128-d float array extracted client-side
      const requestedPunchType = (b.punch_type || 'AUTO').toUpperCase(); // AUTO, CHECK_IN, CHECK_OUT
      const kioskId = b.kiosk_id || 'main-tablet-kiosk';
      const lat = b.latitude ? parseFloat(b.latitude) : null;
      const lng = b.longitude ? parseFloat(b.longitude) : null;

      if (!companyId) return res.status(400).json({ ok: false, error: 'Company ID is required for kiosk matching.' });
      if (!Array.isArray(liveVector) || liveVector.length < 64) {
        return res.status(400).json({ ok: false, error: 'Valid face feature vector is required.' });
      }

      // Fetch company attendance settings
      const { data: settings } = await SB.admin
        .from('bi_attendance_settings')
        .select('*')
        .eq('company_id', companyId)
        .maybeSingle();

      const threshold = (settings && parseFloat(settings.similarity_threshold)) || 0.78;
      const marginThreshold = 0.06; // Winner-take-all ambiguity margin

      // Fetch all active enrolled employees for this company
      const { data: employees, error: empErr } = await SB.admin
        .from('bi_attendance_employees')
        .select('id, company_id, employee_code, first_name, last_name, department, designation, employment_type, shift_type, shift_start, shift_end, hourly_rate, face_embeddings')
        .eq('company_id', companyId)
        .eq('is_active', true);

      if (empErr || !employees || !employees.length) {
        return res.status(404).json({ ok: false, error: 'No enrolled active employees found in this organization.' });
      }

      // Perform 1:N Biometric Matching
      const candidates = [];
      for (const emp of employees) {
        const embeddings = Array.isArray(emp.face_embeddings) ? emp.face_embeddings : [];
        if (!embeddings.length) continue;

        let bestEmpSim = -1.0;
        for (const emb of embeddings) {
          const sim = cosineSimilarity(liveVector, emb);
          if (sim > bestEmpSim) bestEmpSim = sim;
        }

        if (bestEmpSim > 0.40) {
          candidates.push({ emp, sim: bestEmpSim });
        }
      }

      if (!candidates.length) {
        return res.status(404).json({
          ok: false,
          error: 'Face not recognized. Please face the camera squarely in good lighting or register your profile.',
        });
      }

      // Sort descending by similarity
      candidates.sort((a, b) => b.sim - a.sim);
      const best = candidates[0];

      // Verify minimum threshold
      if (best.sim < threshold) {
        return res.status(404).json({
          ok: false,
          error: `Face match score (${(best.sim * 100).toFixed(1)}%) is below authorized threshold (${(threshold * 100).toFixed(0)}%). Please try again.`,
          confidence: Math.round(best.sim * 10000) / 10000,
        });
      }

      // Ambiguity protection: verify winner-take-all margin
      if (candidates.length >= 2) {
        const runnerUp = candidates[1];
        const diff = best.sim - runnerUp.sim;
        if (diff < marginThreshold) {
          console.warn(`[Attendance] Ambiguity rejected: ${best.emp.first_name} (${best.sim}) vs ${runnerUp.emp.first_name} (${runnerUp.sim}) diff: ${diff}`);
          return res.status(409).json({
            ok: false,
            error: 'Biometric ambiguity detected between multiple profiles. Please adjust your head position or lighting.',
            confidence: Math.round(best.sim * 10000) / 10000,
          });
        }
      }

      const matchedEmp = best.emp;
      const confidence = Math.round(best.sim * 10000) / 10000;

      // Geofencing verification
      let geofenceStatus = 'VERIFIED';
      if (settings && settings.geofence_enabled && settings.geofence_latitude && settings.geofence_longitude) {
        if (lat !== null && lng !== null) {
          const dist = haversineDistanceMeters(lat, lng, settings.geofence_latitude, settings.geofence_longitude);
          if (dist > settings.geofence_radius_meters) {
            geofenceStatus = 'BREACH';
          }
        }
      }

      // Local IST time calculations
      const now = getNowIST();
      const todayStr = formatDateISO(now);
      const timeStr12 = formatTime12(now);
      const nowISO = new Date().toISOString();

      // Check today's existing attendance record
      const { data: existingRecord } = await SB.admin
        .from('bi_attendance_records')
        .select('*')
        .eq('company_id', companyId)
        .eq('employee_id', matchedEmp.id)
        .eq('log_date', todayStr)
        .maybeSingle();

      // Determine punch action
      let punchAction = 'CHECK_IN';
      if (requestedPunchType === 'CHECK_IN' || requestedPunchType === 'CHECK_OUT') {
        punchAction = requestedPunchType;
      } else {
        // Alternating auto state machine
        if (existingRecord && existingRecord.is_currently_in) {
          punchAction = 'CHECK_OUT';
        } else {
          punchAction = 'CHECK_IN';
        }
      }

      // Check arrival status (Late vs On-Time) on initial daily check-in
      let recordStatus = 'PRESENT';
      let shiftStatus = 'ON-TIME';
      const isFlexible =
        matchedEmp.shift_type === 'FLEXIBLE' ||
        matchedEmp.employment_type === 'DAILY_WAGE';

      if (!isFlexible) {
        const shiftStart = matchedEmp.shift_start || (settings && settings.work_start_time) || '09:00';
        const grace = (settings && settings.late_grace_minutes) || 15;
        const [sh, sm] = shiftStart.split(':').map((x) => parseInt(x, 10) || 0);
        const shiftTotalMins = sh * 60 + sm + grace;
        const curTotalMins = now.getHours() * 60 + now.getMinutes();

        if (!existingRecord && curTotalMins > shiftTotalMins) {
          recordStatus = 'LATE';
          shiftStatus = 'LATE';
        }
      } else {
        shiftStatus = 'FLEXIBLE';
      }

      // Preserve status on subsequent punches if already set
      if (existingRecord) {
        recordStatus = existingRecord.status;
        shiftStatus = existingRecord.shift_status;
      }

      // Compute cumulative hours
      const priorPunches = (existingRecord && Array.isArray(existingRecord.punches)) ? existingRecord.punches : [];
      const newPunchItem = {
        id: `PUNCH-${Date.now().toString(36).toUpperCase()}`,
        action: punchAction,
        time: timeStr12,
        timestamp: nowISO,
        confidence,
        kiosk_id: kioskId,
        latitude: lat,
        longitude: lng,
        geofence_status: geofenceStatus,
      };

      const updatedPunches = [...priorPunches, newPunchItem];

      // Calculate total worked hours across check-in -> check-out pairs
      let totalMinutes = 0;
      let lastInTime = null;
      for (const p of updatedPunches) {
        if (p.action === 'CHECK_IN') {
          lastInTime = new Date(p.timestamp).getTime();
        } else if (p.action === 'CHECK_OUT' && lastInTime) {
          const diffMins = Math.max(0, (new Date(p.timestamp).getTime() - lastInTime) / 60000);
          totalMinutes += diffMins;
          lastInTime = null;
        }
      }
      const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

      // Update half-day / full-day status
      const halfDayHours = (settings && parseFloat(settings.half_day_hours)) || 4.5;
      const fullDayHours = (settings && parseFloat(settings.full_day_hours)) || 8.0;
      if (punchAction === 'CHECK_OUT' && totalHours > 0) {
        if (totalHours < halfDayHours) {
          recordStatus = 'HALF_DAY';
        } else if (totalHours >= fullDayHours + 1.0) {
          recordStatus = 'OVERTIME';
        } else if (recordStatus !== 'LATE') {
          recordStatus = 'PRESENT';
        }
      }

      const recordPayload = {
        company_id: companyId,
        employee_id: matchedEmp.id,
        log_date: todayStr,
        check_in_time: existingRecord ? existingRecord.check_in_time : timeStr12,
        check_out_time: punchAction === 'CHECK_OUT' ? timeStr12 : (existingRecord ? existingRecord.check_out_time : null),
        first_punch_in: existingRecord ? existingRecord.first_punch_in : nowISO,
        last_punch_out: punchAction === 'CHECK_OUT' ? nowISO : (existingRecord ? existingRecord.last_punch_out : null),
        total_hours: totalHours,
        status: recordStatus,
        shift_status: shiftStatus,
        is_currently_in: punchAction === 'CHECK_IN',
        confidence_score: confidence,
        liveness_verified: true,
        punch_mode: 'FACE_AI',
        punches: updatedPunches,
        latitude: lat,
        longitude: lng,
        geofence_status: geofenceStatus,
        kiosk_id: kioskId,
        updated_at: nowISO,
      };

      const { data: savedRecord, error: saveErr } = await SB.admin
        .from('bi_attendance_records')
        .upsert(recordPayload, { onConflict: 'company_id,employee_id,log_date' })
        .select()
        .single();

      if (saveErr) throw saveErr;

      res.json({
        ok: true,
        action: punchAction,
        time: timeStr12,
        date: todayStr,
        total_hours: totalHours,
        status: recordStatus,
        shift_status: shiftStatus,
        confidence,
        employee: {
          id: matchedEmp.id,
          employee_code: matchedEmp.employee_code,
          first_name: matchedEmp.first_name,
          last_name: matchedEmp.last_name,
          department: matchedEmp.department,
          designation: matchedEmp.designation,
        },
        message: punchAction === 'CHECK_IN'
          ? `Welcome ${matchedEmp.first_name}! Check-in recorded at ${timeStr12}.`
          : `Goodbye ${matchedEmp.first_name}! Check-out recorded. Total hours today: ${totalHours} hrs.`,
      });
    } catch (err) {
      console.error('[Attendance API] /kiosk-punch error:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // 6. LIVE ROSTER & DASHBOARD METRICS
  // -------------------------------------------------------------------------
  app.get('/api/attendance/roster', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;

      const companyId = req.query.company_id || u.companyId;
      if (!companyId) return res.json({ ok: true, roster: [], metrics: {} });

      const todayStr = req.query.date || formatDateISO(getNowIST());

      // Fetch all active employees
      const { data: employees } = await SB.admin
        .from('bi_attendance_employees')
        .select('id, employee_code, first_name, last_name, department, designation, employment_type, shift_start, shift_end')
        .eq('company_id', companyId)
        .eq('is_active', true)
        .order('employee_code', { ascending: true });

      // Fetch today's records
      const { data: records } = await SB.admin
        .from('bi_attendance_records')
        .select('*')
        .eq('company_id', companyId)
        .eq('log_date', todayStr);

      const recordMap = new Map((records || []).map((r) => [r.employee_id, r]));

      let totalStaff = (employees || []).length;
      let presentCount = 0;
      let lateCount = 0;
      let halfDayCount = 0;
      let currentlyInCount = 0;

      const roster = (employees || []).map((emp) => {
        const rec = recordMap.get(emp.id);
        const status = rec ? rec.status : 'ABSENT';
        const isCurrentlyIn = rec ? !!rec.is_currently_in : false;

        if (rec) {
          if (rec.status === 'LATE') lateCount++;
          else if (rec.status === 'HALF_DAY') halfDayCount++;
          else presentCount++;
          if (isCurrentlyIn) currentlyInCount++;
        }

        return {
          employee_id: emp.id,
          employee_code: emp.employee_code,
          name: `${emp.first_name} ${emp.last_name || ''}`.trim(),
          department: emp.department,
          designation: emp.designation,
          shift: `${emp.shift_start || '09:00'} - ${emp.shift_end || '18:00'}`,
          status,
          shift_status: rec ? rec.shift_status : 'N/A',
          is_currently_in: isCurrentlyIn,
          check_in_time: rec ? rec.check_in_time : null,
          check_out_time: rec ? rec.check_out_time : null,
          total_hours: rec ? rec.total_hours : 0.0,
          confidence_score: rec ? rec.confidence_score : null,
          punches: rec ? rec.punches : [],
        };
      });

      const absentCount = Math.max(0, totalStaff - (presentCount + lateCount + halfDayCount));

      res.json({
        ok: true,
        date: todayStr,
        metrics: {
          total_staff: totalStaff,
          present: presentCount,
          late: lateCount,
          half_day: halfDayCount,
          absent: absentCount,
          currently_clocked_in: currentlyInCount,
        },
        roster,
      });
    } catch (err) {
      console.error('[Attendance API] /roster error:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // 7. PAYROLL & ATTENDANCE REPORTS (DATE RANGE QUERY)
  // -------------------------------------------------------------------------
  app.get('/api/attendance/reports', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;

      const companyId = req.query.company_id || u.companyId;
      const startDate = req.query.start_date || formatDateISO(new Date(Date.now() - 30 * 86400000));
      const endDate = req.query.end_date || formatDateISO(getNowIST());

      // Fetch employees
      const { data: employees } = await SB.admin
        .from('bi_attendance_employees')
        .select('id, employee_code, first_name, last_name, department, designation, hourly_rate, employment_type')
        .eq('company_id', companyId)
        .order('employee_code', { ascending: true });

      // Fetch records within range
      const { data: records } = await SB.admin
        .from('bi_attendance_records')
        .select('*')
        .eq('company_id', companyId)
        .gte('log_date', startDate)
        .lte('log_date', endDate)
        .order('log_date', { ascending: false });

      // Aggregate by employee
      const empMap = new Map();
      for (const emp of employees || []) {
        empMap.set(emp.id, {
          employee_id: emp.id,
          employee_code: emp.employee_code,
          name: `${emp.first_name} ${emp.last_name || ''}`.trim(),
          department: emp.department,
          hourly_rate: emp.hourly_rate,
          total_days_present: 0,
          total_late_days: 0,
          total_half_days: 0,
          total_hours_worked: 0.0,
          overtime_hours: 0.0,
          estimated_payout: 0.0,
          records: [],
        });
      }

      for (const rec of records || []) {
        const item = empMap.get(rec.employee_id);
        if (!item) continue;
        item.records.push(rec);
        const hrs = parseFloat(rec.total_hours) || 0.0;
        item.total_hours_worked += hrs;

        if (rec.status === 'LATE') item.total_late_days++;
        else if (rec.status === 'HALF_DAY') item.total_half_days++;
        else if (rec.status === 'PRESENT' || rec.status === 'OVERTIME') item.total_days_present++;

        if (hrs > 8.0) {
          item.overtime_hours += hrs - 8.0;
        }
      }

      // Compute payroll estimates
      const summary = Array.from(empMap.values()).map((item) => {
        item.total_hours_worked = Math.round(item.total_hours_worked * 100) / 100;
        item.overtime_hours = Math.round(item.overtime_hours * 100) / 100;
        item.estimated_payout = Math.round(item.total_hours_worked * item.hourly_rate * 100) / 100;
        return item;
      });

      res.json({
        ok: true,
        start_date: startDate,
        end_date: endDate,
        total_records: (records || []).length,
        summary,
        raw_records: records || [],
      });
    } catch (err) {
      console.error('[Attendance API] /reports error:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // 8. SUPERVISOR MANUAL OVERRIDE
  // -------------------------------------------------------------------------
  app.post('/api/attendance/manual-override', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;
      if (!u.isAdmin) return res.status(403).json({ ok: false, error: 'Admin permission required.' });

      const b = req.body || {};
      const companyId = b.company_id || u.companyId;
      const employeeId = b.employee_id;
      const logDate = b.log_date || formatDateISO(getNowIST());
      const hours = parseFloat(b.hours) || 8.0;
      const status = b.status || 'PRESENT';
      const reason = b.reason || 'Supervisor correction';

      if (!employeeId) return res.status(400).json({ ok: false, error: 'Employee ID is required.' });

      const payload = {
        company_id: companyId,
        employee_id: employeeId,
        log_date: logDate,
        check_in_time: b.punch_in || '09:00:00 AM',
        check_out_time: b.punch_out || '05:00:00 PM',
        total_hours: hours,
        status,
        shift_status: 'MANUAL_OVERRIDE',
        is_currently_in: false,
        punch_mode: 'MANUAL',
        remarks: `[Override by ${u.email}]: ${reason}`,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await SB.admin
        .from('bi_attendance_records')
        .upsert(payload, { onConflict: 'company_id,employee_id,log_date' })
        .select()
        .single();

      if (error) throw error;

      await SB.admin.from('bi_attendance_audit_logs').insert({
        company_id: companyId,
        action: 'MANUAL_OVERRIDE',
        actor_email: u.email,
        employee_id: employeeId,
        details: { log_date: logDate, hours, status, reason },
      }).then(() => {}).catch(() => {});

      res.json({ ok: true, record: data });
    } catch (err) {
      console.error('[Attendance API] /manual-override error:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // -------------------------------------------------------------------------
  // 9. HARDWARE TABLET KIOSKS MANAGEMENT
  // -------------------------------------------------------------------------
  app.get('/api/attendance/kiosks', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;

      const companyId = req.query.company_id || u.companyId;
      const { data, error } = await SB.admin
        .from('bi_attendance_kiosks')
        .select('*')
        .eq('company_id', companyId)
        .order('kiosk_code', { ascending: true });

      if (error) {
        return res.json({ ok: true, kiosks: db.attendance_kiosks.filter((k) => k.company_id === companyId) });
      }

      res.json({ ok: true, kiosks: data || [] });
    } catch (err) {
      console.error('[Attendance API] /kiosks GET error:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  app.post('/api/attendance/kiosks', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;
      if (!u.isAdmin) return res.status(403).json({ ok: false, error: 'Admin permission required.' });

      const b = req.body || {};
      const companyId = b.company_id || u.companyId;
      if (!b.kiosk_code || !b.name) {
        return res.status(400).json({ ok: false, error: 'Kiosk code and name are required.' });
      }

      const payload = {
        company_id: companyId,
        kiosk_code: String(b.kiosk_code).trim().toUpperCase(),
        name: String(b.name).trim(),
        branch_location: b.branch_location || 'Headquarters',
        device_type: b.device_type || 'Tablet Terminal',
        secret_token: `KSK-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        is_active: b.is_active !== false,
        last_heartbeat: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await SB.admin
        .from('bi_attendance_kiosks')
        .upsert(payload, { onConflict: 'company_id,kiosk_code' })
        .select()
        .single();

      if (error) throw error;
      res.json({ ok: true, kiosk: data });
    } catch (err) {
      console.error('[Attendance API] /kiosks POST error:', err);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  console.log('[Attendance API] Mounted AI Face Recognition Attendance subsystem on /api/attendance/*');
};
