require('dotenv').config();
const { ensureSeedData } = require('../config/db');

async function run() {
  try {
    await ensureSeedData();
    console.log('✅ Firestore seed complete.');
  } catch (error) {
    console.error('❌ Failed to seed Firestore:', error.message);
    process.exitCode = 1;
  }
}

run();
