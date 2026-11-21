// migrate-to-atlas.js — one-time copy of the LOCAL MongoDB database into
// MongoDB Atlas (free M0). Safe to re-run: documents that already exist in
// Atlas (same _id) are skipped. Credentials are never printed.
//
// Usage:
//   1. Put your Atlas connection string into backend/.env as MONGODB_URI:
//      MONGODB_URI=mongodb+srv://envirosense_user:<password>@cluster0.8sepz3g.mongodb.net/envirosense_system
//   2. cd backend && node migrate-to-atlas.js
require('dotenv').config();
const { MongoClient } = require('mongodb');

const LOCAL_URI = process.env.LOCAL_MONGODB_URI || 'mongodb://localhost:27017';
const ATLAS_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'envirosense_system';

// Mask user:password@ in any string that might carry credentials.
const mask = (s) => String(s).replace(/\/\/[^@/]*@/, '//***:***@');

async function main() {
  if (!ATLAS_URI || ATLAS_URI.includes('localhost')) {
    console.error('❌ MONGODB_URI in backend/.env is not set to your Atlas connection string.');
    console.error('   Edit backend/.env and set:');
    console.error('   MONGODB_URI=mongodb+srv://envirosense_user:<password>@cluster0.8sepz3g.mongodb.net/envirosense_system');
    console.error('   (put your real password there — the file is gitignored), then re-run.');
    process.exit(1);
  }

  console.log('Source (local) :', mask(LOCAL_URI));
  console.log('Target (Atlas) :', mask(ATLAS_URI));
  console.log('Database       :', DB_NAME, '\n');

  const local = await MongoClient.connect(LOCAL_URI);
  const atlas = await MongoClient.connect(ATLAS_URI);
  const ldb = local.db(DB_NAME);
  const adb = atlas.db(DB_NAME);

  const cols = (await ldb.listCollections().toArray()).map((c) => c.name).sort();
  if (!cols.length) {
    console.log('Nothing found in the local database — nothing to migrate.');
    await local.close(); await atlas.close();
    process.exit(0);
  }
  console.log('Collections found locally (' + cols.length + '):', cols.join(', '), '\n');

  let allOk = true;
  let grandLocal = 0;
  let grandAtlas = 0;

  for (const name of cols) {
    const docs = await ldb.collection(name).find({}).toArray();
    const existing = new Set(
      (await adb.collection(name).find({}, { projection: { _id: 1 } }).toArray()).map((d) => d._id)
    );
    const todo = docs.filter((d) => !existing.has(d._id));
    if (todo.length) {
      try {
        await adb.collection(name).insertMany(todo, { ordered: false });
      } catch (e) {
        if (e.code !== 11000) throw new Error(mask(e.message)); // only race-condition dupes tolerated
      }
    }
    const atlasCount = await adb.collection(name).countDocuments();
    const ok = atlasCount >= docs.length;
    if (!ok) allOk = false;
    grandLocal += docs.length;
    grandAtlas += atlasCount;
    console.log(
      `${ok ? 'OK     ' : 'MISMATCH'}  ${name.padEnd(24)} local=${String(docs.length).padStart(5)}  new_copied=${String(todo.length).padStart(5)}  atlas=${String(atlasCount).padStart(5)}`
    );
  }

  const atlasCols = (await adb.listCollections().toArray()).map((c) => c.name);
  const extra = atlasCols.filter((c) => !cols.includes(c));
  if (extra.length) console.log('\nAtlas-only collections (left untouched):', extra.join(', '));

  // Ensure the exact same indexes the app uses (db.js reads MONGODB_URI = Atlas).
  console.log('\nCreating app indexes on Atlas via db.js ...');
  const appDb = require('./db');
  await appDb.connect();
  console.log('Indexes ensured.');

  console.log(`\nTotals: local=${grandLocal}  atlas=${grandAtlas}`);
  await local.close();
  await atlas.close();

  if (!allOk) {
    console.error('❌ Some collections have fewer documents in Atlas than locally — re-run this script.');
    process.exit(1);
  }
  console.log('✅ Migration complete — every local document exists in Atlas.');
  process.exit(0);
}

main().catch((e) => {
  console.error('Migration failed:', mask(e && e.message ? e.message : e));
  process.exit(1);
});
