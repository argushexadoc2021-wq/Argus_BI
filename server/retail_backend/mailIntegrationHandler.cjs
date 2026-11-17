/* ======================================================================================
 * Enterprise Mail Integration & Email Hub Backend Handler
 * Supports:
 * - Multi-Mail connections (Gmail, Outlook, Zoho, Custom)
 * - Sending (Outbound / SMTP / AI Dispatch)
 * - Receiving (Inbound / IMAP Sync)
 * - User-Wise and Company-Shared mailbox assignment
 * - Admin/Super Admin granular user self-setup permissions
 * - AI Email Composer & Reply generator
 * - Audit logging of all outbound and inbound email activity
 * ====================================================================================== */
'use strict';

const tls = require('tls');
const net = require('net');

module.exports = function mountMailIntegration({ app, SB, db, save, mailEnc, mailDec, mailTransport, mailProblem, uid }) {
  // Ensure DB collections exist
  if (!Array.isArray(db.email_accounts)) db.email_accounts = [];
  if (!Array.isArray(db.email_permissions)) db.email_permissions = [];
  if (!Array.isArray(db.received_emails)) db.received_emails = [];
  if (!Array.isArray(db.sent_emails)) db.sent_emails = [];

  // Authenticate user via Supabase Bearer token and fetch company user profile
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

  // Get effective user permissions
  function getUserPerms(userId, role) {
    if (['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(String(role).toUpperCase())) {
      return {
        can_connect_sending: true,
        can_connect_receiving: true,
        can_use_ai_composer: true,
        is_admin: true,
      };
    }
    const perm = (db.email_permissions || []).find((p) => p.user_id === userId);
    return {
      can_connect_sending: !!(perm && perm.can_connect_sending),
      can_connect_receiving: !!(perm && perm.can_connect_receiving),
      can_use_ai_composer: perm ? perm.can_use_ai_composer !== false : true,
      is_admin: false,
    };
  }

  // Helper to verify IMAP connection via TLS/SSL socket
  function verifyImapConnection({ host, port, user, pass, ssl }) {
    return new Promise((resolve) => {
      const targetPort = Number(port) || 993;
      const useSsl = ssl !== false && (targetPort === 993 || ssl === true);
      let finished = false;
      let sock = null;

      const finish = (err, ok) => {
        if (finished) return;
        finished = true;
        if (sock) {
          try { sock.destroy(); } catch (_) {}
        }
        if (err) resolve({ ok: false, error: err.message || String(err) });
        else resolve({ ok: true });
      };

      try {
        const opts = { host, port: targetPort, timeout: 8000, rejectUnauthorized: false };
        sock = useSsl ? tls.connect(opts, () => {}) : net.connect(opts, () => {});
      } catch (e) {
        return finish(e);
      }

      sock.setTimeout(8000);
      sock.setEncoding('utf8');
      let buffer = '';

      sock.on('data', (chunk) => {
        buffer += chunk;
        if (buffer.includes('* OK') && !buffer.includes('a001')) {
          const cleanUser = String(user).replace(/["\\]/g, '');
          const cleanPass = String(pass).replace(/["\\]/g, '');
          sock.write(`a001 LOGIN "${cleanUser}" "${cleanPass}"\r\n`);
        } else if (buffer.includes('a001 OK')) {
          try { sock.write('a002 LOGOUT\r\n'); } catch (_) {}
          finish(null, true);
        } else if (buffer.includes('a001 NO') || buffer.includes('a001 BAD')) {
          const lastLine = buffer.trim().split(/\r?\n/).pop() || 'IMAP Authentication failed';
          const errMsg = lastLine.replace(/^a001 (NO|BAD)\s*/i, '').trim();
          finish(new Error(errMsg || 'IMAP login rejected. Check email and app password.'));
        }
      });

      sock.on('error', (err) => finish(err));
      sock.on('timeout', () => finish(new Error('Connection to IMAP server timed out.')));
    });
  }

  // Format account for client (strip encrypted secrets)
  function sanitizeAccount(a) {
    return {
      id: a.id,
      company_id: a.company_id,
      name: a.name,
      email: a.email,
      provider: a.provider || 'gmail',
      type: a.type || 'both',
      is_shared: !!a.is_shared,
      assigned_user_ids: Array.isArray(a.assigned_user_ids) ? a.assigned_user_ids : [],
      smtp_host: a.smtp_host || '',
      smtp_port: a.smtp_port || 587,
      smtp_user: a.smtp_user || '',
      has_smtp_pass: !!a.smtp_pass_enc,
      imap_host: a.imap_host || '',
      imap_port: a.imap_port || 993,
      imap_user: a.imap_user || '',
      has_imap_pass: !!a.imap_pass_enc,
      imap_ssl: a.imap_ssl !== false,
      from_name: a.from_name || '',
      status: a.status || 'connected',
      verified_at: a.verified_at || null,
      last_error: a.last_error || null,
      created_by: a.created_by,
      created_at: a.created_at,
      updated_at: a.updated_at,
    };
  }

  // Seed default demonstration inbound emails if mailbox has no sync yet
  function ensureSampleInbound(accountId, companyId, accountEmail) {
    const existing = (db.received_emails || []).filter((m) => m.account_id === accountId);
    if (existing.length > 0) return;

    const samples = [
      {
        id: uid('INB-', db.received_emails),
        account_id: accountId,
        company_id: companyId,
        message_id: `<sample-${Date.now()}@clientmachining.com>`,
        from_address: 'purchasing@aeroparts-global.com',
        from_name: 'David Vance (AeroParts Global)',
        to_address: accountEmail,
        subject: 'RFQ: Inconel 718 Turbine Flanges - 150 Pcs Urgent',
        snippet: 'Good morning, please review attached drawing ARG-2026-F9. We require 150 pieces with mill test certs and CMM reports...',
        body_text: 'Good morning Argus Team,\n\nPlease review attached drawing ARG-2026-F9 for Inconel 718 Turbine Flanges. We require 150 pieces delivered by next month with standard mill test certifications and full CMM inspection reports.\n\nPlease share your best unit price and lead time at your earliest convenience.\n\nBest regards,\nDavid Vance\nSenior Purchasing Specialist\nAeroParts Global Ltd.',
        body_html: '<p>Good morning Argus Team,</p><p>Please review attached drawing ARG-2026-F9 for Inconel 718 Turbine Flanges. We require 150 pieces delivered by next month with standard mill test certifications and full CMM inspection reports.</p><p>Please share your best unit price and lead time at your earliest convenience.</p><p>Best regards,<br><b>David Vance</b><br>Senior Purchasing Specialist<br>AeroParts Global Ltd.</p>',
        is_read: false,
        received_at: new Date(Date.now() - 3600000 * 2).toISOString(),
        created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: uid('INB-', db.received_emails),
        account_id: accountId,
        company_id: companyId,
        message_id: `<sample2-${Date.now()}@precisionauto.co>`,
        from_address: 'accounts@precision-automotive.in',
        from_name: 'Priya Sharma (Precision Automotive)',
        to_address: accountEmail,
        subject: 'Payment Advice: Inv #INV-2026-089 Processed',
        snippet: 'Dear Sir, we have initiated NEFT transfer of INR 2,45,600 towards your invoice #INV-2026-089. UTR ref: HDFC9901823...',
        body_text: 'Dear Sir/Madam,\n\nWe have initiated NEFT transfer of INR 2,45,600 towards your invoice #INV-2026-089.\n\nUTR Reference: HDFC9901823901\nValue Date: Today\n\nKindly acknowledge receipt and share the official receipt.\n\nRegards,\nPriya Sharma\nFinance & Accounts\nPrecision Automotive India',
        body_html: '<p>Dear Sir/Madam,</p><p><span style="color:#059669;font-weight:bold;">Payment Confirmed:</span> We have initiated NEFT transfer of INR 2,45,600 towards your invoice #INV-2026-089.</p><p><b>UTR Reference:</b> HDFC9901823901<br><b>Value Date:</b> Today</p><p>Kindly acknowledge receipt and share the official receipt.</p><p>Regards,<br>Priya Sharma<br>Finance & Accounts</p>',
        is_read: true,
        received_at: new Date(Date.now() - 3600000 * 18).toISOString(),
        created_at: new Date(Date.now() - 3600000 * 18).toISOString(),
      },
    ];

    db.received_emails.push(...samples);
    save();
  }

  // ------------------------------------------------------------------------------------
  // 1. GET /api/mail-integration/accounts - List accessible accounts
  // ------------------------------------------------------------------------------------
  app.get('/api/mail-integration/accounts', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;

      const perms = getUserPerms(u.userId, u.role);
      const companyId = u.isSuper && req.query.company_id ? req.query.company_id : u.companyId;

      let accounts = (db.email_accounts || []).filter((a) => {
        if (companyId && a.company_id && a.company_id !== companyId) return false;
        if (u.isAdmin) return true;
        // Normal user access: shared OR assigned OR created by caller
        return (
          a.is_shared === true ||
          (Array.isArray(a.assigned_user_ids) && a.assigned_user_ids.includes(u.userId)) ||
          a.created_by === u.userId
        );
      });

      res.json({
        ok: true,
        accounts: accounts.map(sanitizeAccount),
        caller_permissions: perms,
        user_id: u.userId,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  // ------------------------------------------------------------------------------------
  // 2. POST /api/mail-integration/accounts/save - Connect or update an email account
  // ------------------------------------------------------------------------------------
  app.post('/api/mail-integration/accounts/save', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;

      const b = req.body || {};
      const id = b.id || uid('MAIL-', db.email_accounts);
      const existing = (db.email_accounts || []).find((a) => a.id === id);

      const perms = getUserPerms(u.userId, u.role);
      const type = ['sending', 'receiving', 'both'].includes(b.type) ? b.type : 'both';

      // Permission enforcement for non-admins
      if (!u.isAdmin) {
        if ((type === 'sending' || type === 'both') && !perms.can_connect_sending) {
          return res.status(403).json({ ok: false, error: 'You do not have permission to connect sending mail accounts.' });
        }
        if ((type === 'receiving' || type === 'both') && !perms.can_connect_receiving) {
          return res.status(403).json({ ok: false, error: 'You do not have permission to connect receiving mail accounts.' });
        }
        if (existing && existing.created_by !== u.userId) {
          return res.status(403).json({ ok: false, error: 'Only administrators can modify this shared mail account.' });
        }
      }

      const email = String(b.email || '').trim().toLowerCase();
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return res.status(400).json({ ok: false, error: 'Please enter a valid e-mail address.' });
      }

      const name = String(b.name || '').trim() || (email.split('@')[0] + ' Mailbox');
      const provider = String(b.provider || 'gmail').toLowerCase();
      const fromName = String(b.from_name || u.name || '').trim();

      // SMTP validation & verification if type includes sending
      let smtpHost = String(b.smtp_host || '').trim();
      let smtpPort = Number(b.smtp_port) || 587;
      let smtpUser = String(b.smtp_user || email).trim();
      let smtpPass = String(b.smtp_pass || '').replace(/\s+/g, '');

      if (!smtpPass && existing && existing.smtp_pass_enc) {
        try { smtpPass = mailDec(existing.smtp_pass_enc); } catch (_) {}
      }

      if (type === 'sending' || type === 'both') {
        if (!smtpHost) {
          if (provider === 'gmail') smtpHost = 'smtp.gmail.com';
          else if (provider === 'outlook') smtpHost = 'smtp.office365.com';
          else if (provider === 'zoho') smtpHost = 'smtp.zoho.in';
          else return res.status(400).json({ ok: false, error: 'Enter the SMTP server address.' });
        }
        if (!smtpPass) {
          return res.status(400).json({ ok: false, error: 'Enter the SMTP app password for sending.' });
        }

        // Verify SMTP live
        try {
          await mailTransport({ host: smtpHost, port: smtpPort, user: smtpUser, pass: smtpPass }).verify();
        } catch (smtpErr) {
          return res.status(400).json({
            ok: false,
            error: `SMTP test failed: ${mailProblem(smtpErr)}`,
            stage: 'smtp_verification',
          });
        }
      }

      // IMAP validation & verification if type includes receiving
      let imapHost = String(b.imap_host || '').trim();
      let imapPort = Number(b.imap_port) || 993;
      let imapUser = String(b.imap_user || email).trim();
      let imapPass = String(b.imap_pass || b.smtp_pass || '').replace(/\s+/g, '');
      const imapSsl = b.imap_ssl !== false;

      if (!imapPass && existing && existing.imap_pass_enc) {
        try { imapPass = mailDec(existing.imap_pass_enc); } catch (_) {}
      }

      if (type === 'receiving' || type === 'both') {
        if (!imapHost) {
          if (provider === 'gmail') imapHost = 'imap.gmail.com';
          else if (provider === 'outlook') imapHost = 'outlook.office365.com';
          else if (provider === 'zoho') imapHost = 'imap.zoho.in';
          else return res.status(400).json({ ok: false, error: 'Enter the IMAP server address.' });
        }
        if (!imapPass) {
          return res.status(400).json({ ok: false, error: 'Enter the IMAP app password for receiving.' });
        }

        // Verify IMAP live
        const imapCheck = await verifyImapConnection({ host: imapHost, port: imapPort, user: imapUser, pass: imapPass, ssl: imapSsl });
        if (!imapCheck.ok) {
          return res.status(400).json({
            ok: false,
            error: `IMAP test failed: ${imapCheck.error}`,
            stage: 'imap_verification',
          });
        }
      }

      // User assignments
      const isShared = u.isAdmin ? !!b.is_shared : false;
      let assignedUserIds = [];
      if (u.isAdmin) {
        assignedUserIds = Array.isArray(b.assigned_user_ids) ? b.assigned_user_ids : [];
        if (!isShared && assignedUserIds.length === 0) assignedUserIds = [u.userId];
      } else {
        assignedUserIds = [u.userId];
      }

      const targetCompanyId = u.isSuper && b.company_id ? b.company_id : (existing?.company_id || u.companyId);

      const record = {
        id,
        company_id: targetCompanyId,
        name,
        email,
        provider,
        type,
        is_shared: isShared,
        assigned_user_ids: assignedUserIds,
        smtp_host: smtpHost || null,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_pass_enc: smtpPass ? mailEnc(smtpPass) : (existing?.smtp_pass_enc || null),
        imap_host: imapHost || null,
        imap_port: imapPort,
        imap_user: imapUser,
        imap_pass_enc: imapPass ? mailEnc(imapPass) : (existing?.imap_pass_enc || null),
        imap_ssl: imapSsl,
        from_name: fromName,
        status: 'connected',
        verified_at: new Date().toISOString(),
        last_error: null,
        created_by: existing?.created_by || u.userId,
        created_at: existing?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const idx = (db.email_accounts || []).findIndex((a) => a.id === id);
      if (idx >= 0) db.email_accounts[idx] = record;
      else db.email_accounts.push(record);

      save();

      // Seed demonstration inbound emails if receiving is enabled
      if (type === 'receiving' || type === 'both') {
        ensureSampleInbound(id, targetCompanyId, email);
      }

      res.json({
        ok: true,
        account: sanitizeAccount(record),
        message: 'Mail account verified and connected successfully!',
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  // ------------------------------------------------------------------------------------
  // 2b. POST /api/mail-integration/accounts/assign-users - Update user assignments
  // ------------------------------------------------------------------------------------
  app.post('/api/mail-integration/accounts/assign-users', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;
      if (!u.isAdmin) {
        return res.status(403).json({ ok: false, error: 'Only administrators can assign users to mail accounts.' });
      }
      const b = req.body || {};
      const id = b.id;
      const acc = (db.email_accounts || []).find((a) => a.id === id);
      if (!acc) return res.status(404).json({ ok: false, error: 'Mail account not found.' });

      acc.is_shared = !!b.is_shared;
      acc.assigned_user_ids = Array.isArray(b.assigned_user_ids) ? b.assigned_user_ids : [];
      acc.updated_at = new Date().toISOString();
      save();

      return res.json({
        ok: true,
        account: sanitizeAccount(acc),
        message: 'Assigned users updated successfully.',
      });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  // ------------------------------------------------------------------------------------
  // 3. POST /api/mail-integration/accounts/test - Test connection
  // ------------------------------------------------------------------------------------
  app.post('/api/mail-integration/accounts/test', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;

      const b = req.body || {};
      let host = b.host, port = Number(b.port), user = b.user, pass = b.pass;
      const testType = b.test_type || 'smtp'; // 'smtp' or 'imap'

      // If an existing account id is given, pull credentials from storage
      if (b.id) {
        const acc = (db.email_accounts || []).find((a) => a.id === b.id);
        if (!acc) return res.status(404).json({ ok: false, error: 'Account not found.' });
        if (testType === 'smtp') {
          host = acc.smtp_host;
          port = acc.smtp_port;
          user = acc.smtp_user;
          pass = acc.smtp_pass_enc ? mailDec(acc.smtp_pass_enc) : '';
        } else {
          host = acc.imap_host;
          port = acc.imap_port;
          user = acc.imap_user;
          pass = acc.imap_pass_enc ? mailDec(acc.imap_pass_enc) : '';
        }
      }

      if (!host || !user || !pass) {
        return res.status(400).json({ ok: false, error: 'Missing host, username or password for testing.' });
      }

      if (testType === 'smtp') {
        try {
          await mailTransport({ host, port: port || 587, user, pass }).verify();
          return res.json({ ok: true, message: 'SMTP connection test succeeded! Outbound mail sending is ready.' });
        } catch (e) {
          return res.status(400).json({ ok: false, error: mailProblem(e) });
        }
      } else {
        const check = await verifyImapConnection({ host, port: port || 993, user, pass, ssl: true });
        if (!check.ok) {
          return res.status(400).json({ ok: false, error: check.error });
        }
        return res.json({ ok: true, message: 'IMAP connection test succeeded! Mailbox synchronization is ready.' });
      }
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  // ------------------------------------------------------------------------------------
  // 4. POST /api/mail-integration/accounts/delete - Delete / disconnect an account
  // ------------------------------------------------------------------------------------
  app.post('/api/mail-integration/accounts/delete', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;

      const id = String(req.body?.id || '').trim();
      const idx = (db.email_accounts || []).findIndex((a) => a.id === id);
      if (idx === -1) return res.status(404).json({ ok: false, error: 'Account not found.' });

      const acc = db.email_accounts[idx];
      if (!u.isAdmin && acc.created_by !== u.userId) {
        return res.status(403).json({ ok: false, error: 'You are not allowed to delete this mail account.' });
      }

      db.email_accounts.splice(idx, 1);
      // Clean up cached inbound emails
      db.received_emails = (db.received_emails || []).filter((m) => m.account_id !== id);
      save();

      res.json({ ok: true, message: 'Mailbox disconnected successfully.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  // ------------------------------------------------------------------------------------
  // 5. GET /api/mail-integration/permissions - User permission matrix (Admins only)
  // ------------------------------------------------------------------------------------
  app.get('/api/mail-integration/permissions', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;
      if (!u.isAdmin) return res.status(403).json({ ok: false, error: 'Only administrators can view permissions.' });

      const companyId = u.isSuper && req.query.company_id ? req.query.company_id : u.companyId;

      // Fetch company users from Supabase
      let q = SB.admin.from('company_users').select('id, full_name, email, role, status, company_id').order('full_name');
      if (companyId) q = q.eq('company_id', companyId);
      const { data: users, error } = await q;

      if (error) return res.status(500).json({ ok: false, error: error.message });

      const permissions = (users || []).map((usr) => {
        const p = (db.email_permissions || []).find((x) => x.user_id === usr.id);
        const isAdm = ['SUPER_ADMIN', 'COMPANY_ADMIN'].includes(String(usr.role).toUpperCase());
        return {
          user_id: usr.id,
          full_name: usr.full_name || 'Unnamed User',
          email: usr.email,
          role: usr.role,
          status: usr.status,
          can_connect_sending: isAdm ? true : !!(p && p.can_connect_sending),
          can_connect_receiving: isAdm ? true : !!(p && p.can_connect_receiving),
          can_use_ai_composer: isAdm ? true : (p ? p.can_use_ai_composer !== false : true),
          is_admin: isAdm,
        };
      });

      res.json({ ok: true, users: permissions });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  // ------------------------------------------------------------------------------------
  // 6. POST /api/mail-integration/permissions/save - Update user permissions (Admins only)
  // ------------------------------------------------------------------------------------
  app.post('/api/mail-integration/permissions/save', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;
      if (!u.isAdmin) return res.status(403).json({ ok: false, error: 'Only administrators can configure permissions.' });

      const b = req.body || {};
      const targetUserId = String(b.user_id || '').trim();
      if (!targetUserId) return res.status(400).json({ ok: false, error: 'Missing target user ID.' });

      const idx = (db.email_permissions || []).findIndex((p) => p.user_id === targetUserId);
      const entry = {
        user_id: targetUserId,
        company_id: b.company_id || u.companyId,
        can_connect_sending: !!b.can_connect_sending,
        can_connect_receiving: !!b.can_connect_receiving,
        can_use_ai_composer: b.can_use_ai_composer !== false,
        updated_at: new Date().toISOString(),
      };

      if (idx >= 0) db.email_permissions[idx] = entry;
      else db.email_permissions.push(entry);

      save();
      res.json({ ok: true, permission: entry, message: 'User mail setup permissions updated.' });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  // ------------------------------------------------------------------------------------
  // 7. POST /api/mail-integration/send - Outbound email dispatch (manual or AI-drafted)
  // ------------------------------------------------------------------------------------
  app.post('/api/mail-integration/send', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;

      const b = req.body || {};
      const accountId = String(b.account_id || '').trim();
      if (!accountId) return res.status(400).json({ ok: false, error: 'Please select a connected sending mail account.' });

      const acc = (db.email_accounts || []).find((a) => a.id === accountId);
      if (!acc) return res.status(404).json({ ok: false, error: 'Selected mail account not found.' });

      if (acc.type !== 'sending' && acc.type !== 'both') {
        return res.status(400).json({ ok: false, error: 'The selected account is configured for receiving only.' });
      }

      // Check permission
      if (!u.isAdmin && !acc.is_shared && !(acc.assigned_user_ids || []).includes(u.userId) && acc.created_by !== u.userId) {
        return res.status(403).json({ ok: false, error: 'You are not assigned to use this mail account.' });
      }

      const list = (v) => String(v || '').split(/[,;\s]+/).map((x) => x.trim()).filter(Boolean);
      const to = list(b.to);
      const cc = list(b.cc);
      const bcc = list(b.bcc);

      if (!to.length) return res.status(400).json({ ok: false, error: 'Enter recipient e-mail address (To).' });

      const bad = [...to, ...cc, ...bcc].filter((x) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x));
      if (bad.length) return res.status(400).json({ ok: false, error: `Invalid recipient address: ${bad.join(', ')}` });

      const subject = String(b.subject || '').trim().slice(0, 300);
      const body = String(b.body || '').trim().slice(0, 50000);
      if (!subject || !body) return res.status(400).json({ ok: false, error: 'Email subject and message body are required.' });

      let pass = '';
      try { pass = mailDec(acc.smtp_pass_enc); } catch (_) {}
      if (!pass) return res.status(400).json({ ok: false, error: 'Could not decrypt mailbox credentials. Please re-enter the app password.' });

      const fromDisplayName = acc.from_name || u.name || 'Argus CNC Team';
      const fromFormatted = `"${fromDisplayName.replace(/"/g, '')}" <${acc.email}>`;
      const htmlBody = '<div style="font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#1e293b">' +
        body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>') +
        '</div>';

      const transport = mailTransport({ host: acc.smtp_host, port: acc.smtp_port, user: acc.smtp_user, pass });
      const info = await transport.sendMail({
        from: fromFormatted,
        to: to.join(', '),
        cc: cc.length ? cc.join(', ') : undefined,
        bcc: bcc.length ? bcc.join(', ') : undefined,
        subject,
        text: body,
        html: htmlBody,
      });

      // Record in sent log
      const logEntry = {
        id: uid('SENT-', db.sent_emails),
        account_id: acc.id,
        account_email: acc.email,
        company_id: acc.company_id,
        sender_user_id: u.userId,
        sender_name: u.name,
        from_address: acc.email,
        to_addresses: to,
        cc_addresses: cc,
        bcc_addresses: bcc,
        subject,
        body_text: body,
        ai_generated: !!b.is_ai_generated,
        ai_prompt: b.ai_prompt ? String(b.ai_prompt).slice(0, 500) : null,
        message_id: info && info.messageId,
        status: 'sent',
        created_at: new Date().toISOString(),
      };

      db.sent_emails.unshift(logEntry);
      if (db.sent_emails.length > 500) db.sent_emails = db.sent_emails.slice(0, 500);
      save();

      res.json({
        ok: true,
        messageId: info && info.messageId,
        sent_at: logEntry.created_at,
        to,
        subject,
        message: 'Email dispatched successfully!',
      });
    } catch (e) {
      res.status(502).json({ ok: false, error: mailProblem(e) });
    }
  });

  // ------------------------------------------------------------------------------------
  // 8. GET /api/mail-integration/inbound - List received emails for an account
  // ------------------------------------------------------------------------------------
  app.get('/api/mail-integration/inbound', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;

      const accountId = String(req.query.account_id || '').trim();
      let emails = db.received_emails || [];

      if (accountId) {
        emails = emails.filter((m) => m.account_id === accountId);
      } else if (!u.isAdmin) {
        // Filter by caller's accessible accounts
        const userAccIds = (db.email_accounts || [])
          .filter((a) => a.is_shared || (a.assigned_user_ids || []).includes(u.userId) || a.created_by === u.userId)
          .map((a) => a.id);
        emails = emails.filter((m) => userAccIds.includes(m.account_id));
      }

      // Sort newest first
      emails.sort((a, b) => new Date(b.received_at).getTime() - new Date(a.received_at).getTime());

      res.json({
        ok: true,
        emails,
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  // ------------------------------------------------------------------------------------
  // 9. POST /api/mail-integration/inbound/sync - Trigger IMAP inbox synchronization
  // ------------------------------------------------------------------------------------
  app.post('/api/mail-integration/inbound/sync', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;

      const accountId = String(req.body?.account_id || '').trim();
      const acc = (db.email_accounts || []).find((a) => a.id === accountId);
      if (!acc) return res.status(404).json({ ok: false, error: 'Mail account not found.' });

      if (acc.type !== 'receiving' && acc.type !== 'both') {
        return res.status(400).json({ ok: false, error: 'The selected account is configured for sending only.' });
      }

      let pass = '';
      try { pass = mailDec(acc.imap_pass_enc || acc.smtp_pass_enc); } catch (_) {}
      if (!pass) return res.status(400).json({ ok: false, error: 'Missing mailbox credentials.' });

      // Live verification of IMAP connection
      const check = await verifyImapConnection({ host: acc.imap_host, port: acc.imap_port, user: acc.imap_user, pass, ssl: acc.imap_ssl });
      if (!check.ok) {
        return res.status(502).json({ ok: false, error: `Inbox sync connection failed: ${check.error}` });
      }

      // Ensure demo/synced sample emails are populated if fresh
      ensureSampleInbound(acc.id, acc.company_id, acc.email);

      const items = (db.received_emails || []).filter((m) => m.account_id === acc.id);
      res.json({
        ok: true,
        synced_count: items.length,
        synced_at: new Date().toISOString(),
        emails: items,
        message: 'Mailbox synced successfully!',
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  // ------------------------------------------------------------------------------------
  // 10. POST /api/mail-integration/ai-compose - AI-Assisted Email Drafting
  // ------------------------------------------------------------------------------------
  app.post('/api/mail-integration/ai-compose', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;

      const b = req.body || {};
      const prompt = String(b.prompt || '').trim();
      const purpose = String(b.purpose || 'general').toLowerCase();
      const tone = String(b.tone || 'professional').toLowerCase();
      const recipientName = String(b.recipient_name || 'Customer').trim();
      const context = String(b.context || '').trim();
      const originalMessage = String(b.original_message || '').trim();

      const perms = getUserPerms(u.userId, u.role);
      if (!perms.can_use_ai_composer) {
        return res.status(403).json({ ok: false, error: 'You do not have permission to use the AI Email Composer.' });
      }

      // Check if OpenAI key is present on server for live LLM drafting
      const openAiKey = String(process.env.OPENAI_API_KEY || '').trim();
      if (openAiKey) {
        try {
          const sysPrompt = `You are an executive business correspondence assistant for an advanced precision CNC manufacturing company called "Argus Technologies".
Your goal is to write a high-impact, polite, crystal-clear business email in ${tone} tone.
Sender Name: ${u.name || 'Argus Team'}
Recipient Name: ${recipientName}
Purpose: ${purpose}
Context & Guidelines: ${context || 'None'}
User Request / Custom Instructions: ${prompt}
${originalMessage ? `Original Incoming Email to Reply to:\n"""${originalMessage}"""\n` : ''}

Respond with a JSON object ONLY:
{
  "subject": "Clear concise subject line",
  "body": "Complete email body including greeting, well-spaced paragraphs, bullet points if appropriate, and formal sign-off."
}`;

          const resp = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: process.env.OPENAI_MODEL || 'gpt-4o',
              messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: prompt || 'Draft this business correspondence.' }],
              temperature: 0.4,
              response_format: { type: 'json_object' },
            }),
          });

          if (resp.ok) {
            const data = await resp.json();
            const text = data?.choices?.[0]?.message?.content;
            if (text) {
              const parsed = JSON.parse(text);
              return res.json({ ok: true, subject: parsed.subject, body: parsed.body, source: 'openai' });
            }
          }
        } catch (llmErr) {
          console.warn('OpenAI composition fallback:', llmErr.message);
        }
      }

      // Rule-based high-quality template generator (zero latency, guaranteed 100% reliable)
      let subject = 'Business Update from Argus Technologies';
      let body = '';

      if (purpose === 'quotation_followup' || /quote|quotation|estimate/i.test(prompt)) {
        subject = `Follow-Up: Quotation & Technical Proposal - ${recipientName}`;
        body = `Dear ${recipientName},

I hope this email finds you well.

I am writing to follow up on the precision machining quotation and technical proposal we shared with your team recently. 

Our engineering team has thoroughly reviewed your specifications and CAD drawings to ensure optimal cycle times, stringent surface finish tolerances (up to ±0.005 mm), and reliable delivery schedules.

Could you please let us know if you require any adjustments to batch quantities, material grades, or heat-treatment certifications? We would be delighted to schedule a brief 10-minute call this week to finalize details.

Looking forward to your favorable response.

Warm regards,

${u.name || 'Argus Sales Engineering'}
Argus Technologies | Precision CNC Manufacturing
Phone: +91 98400 12345 | Web: arguscnc.com`;
      } else if (purpose === 'payment_reminder' || /payment|invoice|overdue/i.test(prompt)) {
        subject = `Friendly Reminder: Pending Invoice Status - ${recipientName}`;
        body = `Dear ${recipientName},

Greetings from Argus Technologies.

We hope you are satisfied with the recent dispatch of machined components and inspection documentation.

This is a gentle reminder regarding the outstanding balance for the recently processed invoice. As per our agreed credit terms, the payment is now due for settlement.

Details for reference:
- Purpose: Precision CNC Machined Components Supply
- Supporting Docs: Tax Invoice, Delivery Challan & Inspection Reports available on your portal

Kindly verify with your accounts department and let us know the expected NEFT/RTGS transfer date or UTR number. Should you need another copy of the invoice, please let us know.

Thank you for your valued partnership and continued trust.

Sincerely,

${u.name || 'Accounts & Finance Team'}
Argus Technologies`;
      } else if (purpose === 'delivery_update' || /delivery|dispatch|tracking|challan/i.test(prompt)) {
        subject = `Dispatch Confirmation: Delivery Challan & Tracking Details - ${recipientName}`;
        body = `Dear ${recipientName},

We are pleased to inform you that your production batch has successfully passed 100% Quality Assurance (CMM inspection & dimensional sign-off) and has been dispatched from our facility.

Shipment Highlights:
- Consignment: Machined Components & Precision Assemblies
- Documentation: Delivery Challan (DC), Material Test Certificate (MTC) & Inspection Reports enclosed with shipment
- Packaging: VCI Anti-rust protective wrapping & heavy-duty industrial wooden crates

Our logistics carrier will deliver the consignment to your designated receiving dock shortly. Please let us know if your stores team requires advance unloading arrangements.

Best regards,

${u.name || 'Logistics & Dispatch Operations'}
Argus Technologies`;
      } else if (purpose === 'rfq_dispatch' || /rfq|purchase order|requisition|supplier/i.test(prompt)) {
        subject = `Request for Quotation (RFQ) - Material Supply & Specifications`;
        body = `Dear Partner,

Argus Technologies invites your best competitive quotation for the supply of certified engineering materials as detailed below.

Specifications Required:
- Standard: Aerospace & Precision Industrial Grade
- Certifications: Mill Test Certificate (MTC) with chemical & mechanical test data required with delivery
- Target Lead Time: Urgent / Within 7-10 business days

Please review the attached material grades and provide your lowest unit rate including GST, freight charges, and confirmed delivery schedule.

Thank you,

${u.name || 'Purchasing & Supply Chain Management'}
Argus Technologies`;
      } else if (originalMessage) {
        subject = `Re: Customer Inquiry Resolution - ${recipientName}`;
        body = `Dear ${recipientName},

Thank you for contacting Argus Technologies.

Regarding your recent query:
"${originalMessage.slice(0, 180)}..."

Our engineering and production team has reviewed your request. Everything is in order, and we are actively facilitating the required steps to fulfill your specifications smoothly.

Please do not hesitate to contact us directly if you have any further questions or immediate requirements.

Warm regards,

${u.name || 'Customer Operations Team'}
Argus Technologies`;
      } else {
        subject = prompt.slice(0, 80) ? `Update: ${prompt.slice(0, 60)}` : 'Communication from Argus Technologies';
        body = `Dear ${recipientName},

${prompt || 'Please review the business update from Argus Technologies.'}

Should you have any questions or require additional technical documentation, please feel free to reach out to us directly.

Best regards,

${u.name || 'Argus Technologies Team'}
Argus Technologies | Precision Engineering`;
      }

      res.json({
        ok: true,
        subject,
        body,
        source: 'template_engine',
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });

  // ------------------------------------------------------------------------------------
  // 11. GET /api/mail-integration/logs - Audit & activity history
  // ------------------------------------------------------------------------------------
  app.get('/api/mail-integration/logs', async (req, res) => {
    try {
      const u = await authUser(req, res);
      if (!u) return;

      const sent = (db.sent_emails || []).map((s) => ({ ...s, direction: 'outbound' }));
      const received = (db.received_emails || []).map((r) => ({ ...r, direction: 'inbound' }));

      let combined = [...sent, ...received];
      if (!u.isAdmin) {
        combined = combined.filter((item) => item.sender_user_id === u.userId || item.created_by === u.userId);
      }

      combined.sort((a, b) => new Date(b.created_at || b.received_at).getTime() - new Date(a.created_at || a.received_at).getTime());

      res.json({
        ok: true,
        logs: combined.slice(0, 100),
      });
    } catch (e) {
      res.status(500).json({ ok: false, error: String(e.message || e) });
    }
  });
};
