// Alert-subscriber registration routes.
// Villagers register their email (and optionally mobile) on the public landing
// page; when a reading goes CRITICAL they receive an email with recommendations
// — and an SMS to their mobile when an SMS gateway is configured.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Accept 9876543210 / +919876543210 / 09876543210 → store as +919876543210.
const normalizeMobile = (raw) => {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length !== 10 || !/^[6-9]/.test(digits)) return null;
  return `+91${digits}`;
};

module.exports = (app, { db, authenticateToken, authenticateAdmin, logAction, emailAlerts }) => {
  // ---- PUBLIC: register for critical alerts ------------------------------
  app.post('/api/alert-subscribers', async (req, res) => {
    try {
      const name = String(req.body.name || '').trim();
      const email = String(req.body.email || '').trim().toLowerCase();
      const rawMobile = String(req.body.mobile || '').trim();

      if (name.length < 2 || name.length > 60) {
        return res.status(400).json({ message: 'Please provide your name (2-60 characters).' });
      }
      if (!EMAIL_RE.test(email) || email.length > 120) {
        return res.status(400).json({ message: 'Please provide a valid email address.' });
      }
      let mobile = null;
      if (rawMobile) {
        mobile = normalizeMobile(rawMobile);
        if (!mobile) {
          return res.status(400).json({ message: 'Please provide a valid 10-digit mobile number.' });
        }
      }

      const existing = await db.collection('alert_subscribers').findOne({ email });
      let doc;
      let updated = false;
      if (existing) {
        const $set = { name, active: true, updated_at: new Date() };
        if (mobile) $set.mobile = mobile;
        await db.collection('alert_subscribers').updateOne({ _id: existing._id }, { $set });
        doc = { ...existing, ...$set };
        updated = true;
      } else {
        doc = await db.insertDoc('alert_subscribers', {
          name,
          email,
          mobile,
          active: true,
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      logAction('Public', 0, `${updated ? 'Updated' : 'New'} critical-alert subscription: ${email}`);
      emailAlerts.sendWelcomeEmail({ to: email, name }).catch(() => {});

      res.status(updated ? 200 : 201).json({
        message: updated
          ? 'You are already registered — your details have been updated.'
          : 'Registered successfully. You will receive critical water alerts on your email.',
        data: {
          subscriber_id: doc._id,
          name: doc.name,
          email: doc.email,
          mobile: doc.mobile,
          active: doc.active
        }
      });
    } catch (err) {
      console.error('Alert subscription failed:', err.message);
      res.status(500).json({ message: 'Registration failed. Please try again.' });
    }
  });

  // ---- ADMIN: list & manage subscribers ----------------------------------
  app.get('/api/alert-subscribers', authenticateToken, authenticateAdmin, async (req, res) => {
    const subs = await db.collection('alert_subscribers')
      .find({})
      .sort({ created_at: -1 })
      .toArray();
    res.json({ data: db.presentAll(subs, 'subscriber_id') });
  });

  app.delete('/api/alert-subscribers/:id', authenticateToken, authenticateAdmin, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid subscriber id.' });
    const result = await db.collection('alert_subscribers').deleteOne({ _id: id });
    if (!result.deletedCount) return res.status(404).json({ message: 'Subscriber not found.' });
    logAction('Admin', req.user.id, `Removed alert subscriber ${id}`);
    res.json({ message: 'Subscriber removed.' });
  });
};
