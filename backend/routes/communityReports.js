const path = require('path');
const fs = require('fs');
const express = require('express');
const multer = require('multer');

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const MAX_FILE_BYTES = 5 * 1024 * 1024;

const CATEGORIES = ['Water Pollution', 'Garbage Dumping', 'Blocked Drainage', 'Bad Odour', 'Contaminated Supply', 'Other'];

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().replace(/[^.a-z0-9]/g, '') || '.jpg';
    const base = path.basename(file.originalname || 'photo', path.extname(file.originalname || ''))
      .replace(/[^a-zA-Z0-9_-]/g, '-')
      .slice(0, 40) || 'photo';
    cb(null, `${Date.now()}-${base}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => {
    if (/^image\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('Only image files are allowed'));
  }
});

module.exports = (app, { db, io, logAction, authenticateToken, authenticateAdmin }) => {
  app.use('/api/uploads', express.static(UPLOAD_DIR));

  app.get('/api/community-reports/categories', (req, res) => {
    res.json({ data: CATEGORIES });
  });

  app.post('/api/community-reports', authenticateToken, upload.single('photo'), async (req, res) => {
    const { source_id, source_name, category, description } = req.body;
    if (!description || !String(description).trim()) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'Description is required' });
    }
    if (category && !CATEGORIES.includes(category)) {
      if (req.file) fs.unlink(req.file.path, () => {});
      return res.status(400).json({ message: 'Unknown category' });
    }

    try {
      const photoUrl = req.file ? `/api/uploads/${req.file.filename}` : null;
      const doc = await db.insertDoc('community_reports', {
        user_id: Number(req.user.id),
        user_name: req.user.name || 'User',
        user_email: req.user.email,
        source_id: source_id ? Number(source_id) : null,
        source_name: source_name || null,
        category: category || 'Other',
        description: String(description).trim(),
        photo_url: photoUrl,
        status: 'Pending',
        admin_note: null,
        created_at: new Date(),
        resolved_at: null
      });
      logAction('User', req.user.id, `Reported issue: ${category || 'Other'}`);
      const report = db.present(doc, 'report_id');
      io.emit('new-community-report', report);
      res.json({ message: 'Report submitted successfully', data: report });
    } catch (err) {
      console.error('Community report error:', err.message);
      if (req.file) fs.unlink(req.file.path, () => {});
      res.status(500).json({ message: 'Could not save the report' });
    }
  });

  // Upload errors should be a clean 400, not a server error.
  app.use((err, req, res, next) => {
    if (err && (err.name === 'MulterError' || /Only image files/.test(err.message || ''))) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'Image is too large (max 5 MB)'
        : err.message || 'Invalid upload';
      return res.status(400).json({ message });
    }
    next(err);
  });

  app.get('/api/community-reports', authenticateToken, async (req, res) => {
    try {
      const rows = await db.collection('community_reports')
        .find({ user_id: Number(req.user.id) })
        .sort({ created_at: -1 })
        .limit(50)
        .toArray();
      res.json({ data: db.presentAll(rows, 'report_id') });
    } catch (e) {
      console.error('Community reports error:', e.message);
      res.status(500).json({ message: 'Database Error' });
    }
  });

  app.get('/api/community-reports/all', authenticateToken, authenticateAdmin, async (req, res) => {
    try {
      const rows = await db.collection('community_reports').find({}).sort({ created_at: -1 }).limit(200).toArray();
      res.json({ data: db.presentAll(rows, 'report_id') });
    } catch (e) {
      console.error('Community reports error:', e.message);
      res.status(500).json({ message: 'Database Error' });
    }
  });

  app.put('/api/community-reports/:id', authenticateToken, authenticateAdmin, async (req, res) => {
    const { status, admin_note } = req.body;
    const nextStatus = status === 'Resolved' ? 'Resolved' : status === 'Dismissed' ? 'Dismissed' : 'Pending';
    try {
      await db.collection('community_reports').updateOne(
        { _id: Number(req.params.id) },
        {
          $set: {
            status: nextStatus,
            admin_note: admin_note || null,
            resolved_at: nextStatus === 'Pending' ? null : new Date()
          }
        }
      );
      logAction('Admin', req.user.id, `${nextStatus} community report ${req.params.id}`);
      const updated = await db.collection('community_reports').findOne({ _id: Number(req.params.id) });
      const report = db.present(updated, 'report_id');
      if (report) io.emit('community-report-updated', report);
      res.json({ message: 'Report updated', data: report });
    } catch (e) {
      console.error('Community report update error:', e.message);
      res.status(500).json({ message: 'Database Error' });
    }
  });
};

module.exports.CATEGORIES = CATEGORIES;
