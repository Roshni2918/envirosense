const ExcelJS = require('exceljs');

// Only pH, TDS and Turbidity are monitored now.
const PARAM_COLUMNS = [
  { key: 'ph', header: 'pH', setting: 'pH', fallback: [6.5, 8.5] },
  { key: 'tds', header: 'TDS (ppm)', setting: 'TDS', fallback: [50, 300] },
  { key: 'turbidity', header: 'Turbidity (NTU)', setting: 'Turbidity', fallback: [0, 5] }
];

const loadThresholds = async (db) => {
  const rows = await db.collection('settings').find({}).toArray();
  if (!rows || rows.length === 0) return null;
  const map = {};
  rows.forEach((r) => { map[r.parameter_name] = { min: Number(r.min_value), max: Number(r.max_value) }; });
  return map;
};

const statusOf = (key, value, thresholds) => {
  const meta = PARAM_COLUMNS.find((c) => c.key === key);
  const range = (thresholds && thresholds[meta.setting]) || { min: meta.fallback[0], max: meta.fallback[1] };
  const num = parseFloat(value);
  if (isNaN(num)) return 'No data';
  return num >= range.min && num <= range.max ? 'Safe' : 'Unsafe';
};

const fetchReadings = async (db, req) => {
  const { start_date, end_date } = req.query;
  const filter = {};
  if (start_date && end_date) {
    filter.recorded_at = { $gte: new Date(start_date), $lte: new Date(`${end_date}T23:59:59.999`) };
  }
  const rows = await db.collection('sensor_readings').find(filter).sort({ recorded_at: -1 }).toArray();
  return db.presentAll(rows, 'reading_id');
};

const decorate = (rows, thresholds) =>
  rows.map((r) => {
    const statuses = {};
    PARAM_COLUMNS.forEach((c) => { statuses[c.key] = statusOf(c.key, r[c.key], thresholds); });
    const unsafe = Object.values(statuses).filter((s) => s === 'Unsafe').length;
    return {
      reading_id: r.reading_id,
      recorded_at: r.recorded_at,
      ph: r.ph,
      tds: r.tds,
      turbidity: r.turbidity,
      status: unsafe === 0 ? 'Safe' : `Unsafe (${unsafe} parameter${unsafe > 1 ? 's' : ''})`,
      per_parameter: statuses
    };
  });

module.exports = (app, { db, authenticateToken }) => {
  app.get('/api/export/json', authenticateToken, async (req, res) => {
    try {
      const thresholds = await loadThresholds(db);
      const rows = await fetchReadings(db, req);
      const readings = decorate(rows, thresholds);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="envirosense-readings.json"');
      res.send(JSON.stringify({
        meta: {
          system: 'EnviroSense v3.0',
          generated_at: new Date().toISOString(),
          start_date: req.query.start_date || null,
          end_date: req.query.end_date || null,
          reading_count: readings.length,
          unsafe_count: readings.filter((r) => r.status !== 'Safe').length
        },
        readings
      }, null, 2));
    } catch (e) {
      res.status(500).json({ message: 'JSON export failed: ' + e.message });
    }
  });

  app.get('/api/export/xlsx', authenticateToken, async (req, res) => {
    try {
      const thresholds = await loadThresholds(db);
      const rows = await fetchReadings(db, req);
      const readings = decorate(rows, thresholds);

      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'EnviroSense v3.0';
      workbook.created = new Date();

      const sheet = workbook.addWorksheet('Readings');
      sheet.columns = [
        { header: 'Date & Time', key: 'recorded_at', width: 22 },
        ...PARAM_COLUMNS.map((c) => ({ header: c.header, key: c.key, width: 18 })),
        { header: 'Overall Status', key: 'status', width: 24 }
      ];
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0EA5E9' } };
      sheet.getRow(1).alignment = { vertical: 'middle' };
      sheet.getRow(1).height = 22;

      readings.forEach((r) => {
        const row = sheet.addRow({
          recorded_at: new Date(r.recorded_at).toLocaleString(),
          ph: r.ph, tds: r.tds, turbidity: r.turbidity,
          status: r.status
        });
        if (r.status !== 'Safe') {
          row.getCell('status').font = { color: { argb: 'FFDC2626' }, bold: true };
        }
      });
      sheet.autoFilter = { from: 'A1', to: { row: 1, column: sheet.columnCount } };

      const summary = workbook.addWorksheet('Summary');
      summary.columns = [
        { header: 'Metric', key: 'metric', width: 28 },
        { header: 'Value', key: 'value', width: 24 }
      ];
      summary.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      summary.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0C4A6E' } };
      summary.addRows([
        { metric: 'Generated at', value: new Date().toLocaleString() },
        { metric: 'Start date', value: req.query.start_date || 'All time' },
        { metric: 'End date', value: req.query.end_date || 'All time' },
        { metric: 'Total readings', value: readings.length },
        { metric: 'Safe readings', value: readings.filter((r) => r.status === 'Safe').length },
        { metric: 'Unsafe readings', value: readings.filter((r) => r.status !== 'Safe').length }
      ]);
      PARAM_COLUMNS.forEach((c) => {
        const unsafe = readings.filter((r) => r.per_parameter[c.key] === 'Unsafe').length;
        summary.addRow({ metric: `${c.header} unsafe count`, value: unsafe });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="envirosense-report.xlsx"');
      await workbook.xlsx.write(res);
      res.end();
    } catch (e) {
      res.status(500).json({ message: 'Excel export failed: ' + e.message });
    }
  });
};
