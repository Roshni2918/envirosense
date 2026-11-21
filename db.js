// db.js — MongoDB connection (root helper, same config as backend/db.js)
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
  console.log(`MongoDB Connected ✅ (${DB_NAME} @ ${MONGODB_URI})`);
  return db;
}

function getDb() {
  if (!db) throw new Error('MongoDB not connected — call connect() first');
  return db;
}

module.exports = { connect, getDb, MONGODB_URI, DB_NAME };
