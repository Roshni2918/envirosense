// database/migrate-mysql-to-mongo.js
// One-time migration from the legacy MySQL database into MongoDB.
//
// Usage:   node database/migrate-mysql-to-mongo.js
//
// What it does:
//   * copies users, sensor_readings, alerts, settings, queries,
//     water_sources, system_logs and community_reports into MongoDB
//   * keeps only the monitored parameters: pH, TDS and Turbidity
//   * keeps the original numeric ids (user_id, reading_id, ...) so the
//     API and the dashboard keep working unchanged
//   * seeds the auto-increment counters so new records continue the ids
//   * skips any collection that already contains data (safe to re-run)

const path = require('path');

const load = (name) => require(path.join(__dirname, '..', 'backend', 'node_modules', name));
const mysql = load('mysql2');
const { MongoClient } = load('mongodb');
require(path.join(__dirname, '..', 'backend', 'node_modules', 'dotenv')).config({
  path: path.join(__dirname, '..', 'backend', '.env')
});

const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || '',
  database: process.env.MYSQL_DATABASE || 'envirosense_system'
};
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'envirosense_system';

const MONITORED_SETTINGS = ['pH', 'TDS', 'Turbidity'];
const MONITORED_ALERTS = ['pH', 'TDS', 'Turbidity'];

const num = (v) => (v === null || v === undefined ? null : Number(v));

// Table → { collection, idKey (legacy id column), map(row) → document }
const PLAN = [
  {
    table: 'users',
    collection: 'users',
    idKey: 'user_id',
    map: (r) => ({
      user_name: r.user_name,
      email: r.email,
      mobile_no: r.mobile_no,
      password_hash: r.password_hash,
      village_name: r.village_name,
      language_preference: r.language_preference || 'mr',
      role: r.role || 'USER',
      status: r.status || 'ACTIVE',
      created_at: r.created_at
    })
  },
  {
    table: 'sensor_readings',
    collection: 'sensor_readings',
    idKey: 'reading_id',
    // only pH, TDS and Turbidity are kept
    map: (r) => ({
      sensor_id: num(r.sensor_id) || 1,
      reading_value: num(r.reading_value) || 0,
      reading_unit: r.reading_unit || null,
      reading_time: r.reading_time || r.recorded_at,
      recorded_at: r.recorded_at,
      ph: num(r.ph),
      tds: num(r.tds),
      turbidity: num(r.turbidity)
    })
  },
  {
    table: 'alerts',
    collection: 'alerts',
    idKey: 'alert_id',
    filter: (r) => MONITORED_ALERTS.includes(r.parameter_name),
    map: (r) => ({
      parameter_name: r.parameter_name,
      measured_value: num(r.measured_value),
      threshold_value: num(r.threshold_value),
      alert_message_en: r.alert_message_en,
      alert_message_mr: r.alert_message_mr,
      alert_status: r.alert_status || 'Active',
      generated_at: r.generated_at
    })
  },
  {
    table: 'settings',
    collection: 'settings',
    idKey: 'id',
    filter: (r) => MONITORED_SETTINGS.includes(r.parameter_name),
    map: (r) => ({
      parameter_name: r.parameter_name,
      min_value: num(r.min_value),
      max_value: num(r.max_value),
      unit: r.unit,
      updated_at: r.updated_at || new Date()
    })
  },
  {
    table: 'queries',
    collection: 'queries',
    idKey: 'id',
    map: (r) => ({
      user_id: num(r.user_id),
      user_name: r.user_name,
      user_email: r.user_email,
      subject: r.subject,
      message: r.message,
      status: r.status || 'Pending',
      created_at: r.created_at
    })
  },
  {
    table: 'water_sources',
    collection: 'water_sources',
    idKey: 'source_id',
    map: (r) => ({
      source_name: r.source_name,
      source_type: r.source_type,
      village_name: r.village_name,
      latitude: num(r.latitude),
      longitude: num(r.longitude),
      description_text: r.description_text,
      source_status: r.source_status || 'Active',
      created_by: num(r.created_by),
      created_at: r.created_at
    })
  },
  {
    table: 'system_logs',
    collection: 'system_logs',
    idKey: 'log_id',
    map: (r) => ({
      user_role: r.user_role,
      user_ref_id: num(r.user_ref_id),
      action_text: r.action_text,
      action_time: r.action_time
    })
  },
  {
    table: 'community_reports',
    collection: 'community_reports',
    idKey: 'report_id',
    map: (r) => ({
      user_id: num(r.user_id),
      user_name: r.user_name,
      user_email: r.user_email,
      source_id: num(r.source_id),
      source_name: r.source_name,
      category: r.category,
      description: r.description,
      photo_url: r.photo_url,
      status: r.status || 'Pending',
      admin_note: r.admin_note || null,
      created_at: r.created_at,
      resolved_at: r.resolved_at || null
    })
  }
];

const queryAll = (conn, sql) =>
  new Promise((resolve, reject) => conn.query(sql, (err, rows) => (err ? reject(err) : resolve(rows))));

(async () => {
  console.log('MySQL → MongoDB migration');
  console.log(`  source: mysql://${MYSQL_CONFIG.host}/${MYSQL_CONFIG.database}`);
  console.log(`  target: ${MONGODB_URI}/${DB_NAME}\n`);

  const conn = mysql.createConnection(MYSQL_CONFIG);
  await new Promise((resolve, reject) => conn.connect((err) => (err ? reject(err) : resolve())));

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const mongo = client.db(DB_NAME);

  let total = 0;
  let skipped = 0;

  for (const step of PLAN) {
    const target = mongo.collection(step.collection);
    const existing = await target.countDocuments({});
    if (existing > 0) {
      console.log(`SKIP  ${step.table} → ${step.collection} (already has ${existing} documents)`);
      skipped++;
      continue;
    }

    let rows;
    try {
      rows = await queryAll(conn, `SELECT * FROM ${step.table}`);
    } catch (e) {
      console.log(`WARN  ${step.table}: ${e.message}`);
      continue;
    }

    const docs = rows
      .filter((r) => (step.filter ? step.filter(r) : true))
      .map((r) => ({ _id: num(r[step.idKey]), ...step.map(r) }))
      .filter((d) => d._id !== null && !isNaN(d._id));

    if (docs.length > 0) {
      await target.insertMany(docs, { ordered: false });
    }

    // keep the auto-increment counter above the migrated ids
    const maxId = docs.reduce((m, d) => Math.max(m, d._id), 0);
    if (maxId > 0) {
      await mongo.collection('counters').updateOne(
        { _id: step.collection },
        { $max: { seq: maxId } },
        { upsert: true }
      );
    }

    console.log(`OK    ${step.table} → ${step.collection}: ${docs.length} documents`);
    total += docs.length;
  }

  await client.close();
  conn.end();

  console.log(`\nDone. Migrated ${total} documents${skipped ? `, skipped ${skipped} non-empty collections` : ''}.`);
  console.log('Start the backend with:  cd backend && npm start');
})().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
