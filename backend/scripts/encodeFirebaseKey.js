#!/usr/bin/env node
/**
 * Encodes Firebase service account JSON to Base64.
 * Usage: node scripts/encodeFirebaseKey.js <path-to-service-account.json>
 */

const fs = require('fs');
const path = require('path');

if (process.argv.length < 3) {
  console.log('Usage: node scripts/encodeFirebaseKey.js <path-to-service-account.json>');
  process.exit(1);
}

const filePath = process.argv[2];

if (!fs.existsSync(filePath)) {
  console.error(`File not found: ${filePath}`);
  process.exit(1);
}

const json = fs.readFileSync(filePath, 'utf8');
const base64 = Buffer.from(json).toString('base64');

console.log('Base64 encoded Firebase service account:');
console.log('\n' + base64);
console.log('\nSet this as FIREBASE_SERVICE_ACCOUNT_JSON_B64 environment variable in Render:');
console.log('https://dashboard.render.com > select service > Environment');
