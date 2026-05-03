const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config();

function getClientConfig() {
  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

  if (hasDatabaseUrl) {
    const shouldDisableSsl = process.env.DB_SSLMODE === 'disable';
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: shouldDisableSsl ? false : { rejectUnauthorized: false },
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'restaurant_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
  };
}

async function run() {
  const schemaPath = path.join(__dirname, '..', 'schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf8');
  const client = new Client(getClientConfig());

  try {
    await client.connect();
    await client.query(sql);
    console.log('✅ Schema applied successfully.');
  } catch (error) {
    console.error('❌ Failed to apply schema:', error.message);
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => {});
  }
}

run();
