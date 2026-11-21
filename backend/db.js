// db.js — MongoDB connection layer for EnviroSense
const { MongoClient } = require('mongodb');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'envirosense_system';

let client = null;
let db = null;

async function connect() {
  if (db) return db;
  client = new MongoClient(MONGODB_URI);
  await client.connect();
  db = client.db(DB_NAME);

  // Indexes that mirror the old MySQL indexes (best-effort, never fatal)
  const indexes = [
    ['sensor_readings', { recorded_at: -1 }],
    // Prevents duplicate hourly slots when the on-read backfill runs concurrently
    ['sensor_readings', { recorded_at: 1 }, { unique: true }],
    ['sensor_readings', { sensor_id: 1 }],
    ['alerts', { generated_at: -1 }],
    ['alerts', { alert_status: 1, parameter_name: 1 }],
    ['users', { email: 1 }, { unique: true }],
    ['queries', { created_at: -1 }],
    ['system_logs', { action_time: -1 }],
    ['community_reports', { created_at: -1 }],
    ['water_sources', { source_status: 1 }],
    ['settings', { parameter_name: 1 }, { unique: true }],
    ['alert_subscribers', { email: 1 }, { unique: true }]
  ];
  for (const [name, keys, opts] of indexes) {
    try {
      await db.collection(name).createIndex(keys, opts || {});
    } catch (e) {
      console.warn(`Index warning (${name}): ${e.message}`);
    }
  }

  // Never print credentials: mask any user:password@ part of the URI.
  const safeUri = String(MONGODB_URI).replace(/\/\/[^@/]*@/, '//***:***@');
  console.log(`MongoDB Connected ✅ (${DB_NAME} @ ${safeUri})`);
  return db;
}

function getDb() {
  if (!db) throw new Error('MongoDB not connected — call connect() first');
  return db;
}

const collection = (name) => getDb().collection(name);

// Atomic auto-increment ids — keeps API ids numeric exactly like the old MySQL tables.
async function nextId(counterName) {
  const result = await collection('counters').findOneAndUpdate(
    { _id: counterName },
    { $inc: { seq: 1 } },
    { returnDocument: 'after', upsert: true }
  );
  // mongodb driver v6 returns the document; v4/v5 wrap it under .value
  const doc = result && typeof result === 'object' && result.value !== undefined && result.value !== null
    ? result.value
    : result;
  if (!doc || typeof doc.seq !== 'number') {
    throw new Error(`Could not allocate id for "${counterName}"`);
  }
  return doc.seq;
}

// Insert a document with an auto-incremented numeric _id.
async function insertDoc(counterName, doc) {
  doc._id = await nextId(counterName);
  await collection(counterName).insertOne(doc);
  return doc;
}

// Convert a Mongo doc to the legacy API shape: drop _id, expose it under the old column name.
function present(doc, idKey) {
  if (!doc) return doc;
  const out = { ...doc };
  const id = out._id;
  delete out._id;
  if (idKey) out[idKey] = id;
  return out;
}

function presentAll(docs, idKey) {
  return (docs || []).map((d) => present(d, idKey));
}

module.exports = { connect, getDb, collection, nextId, insertDoc, present, presentAll };
