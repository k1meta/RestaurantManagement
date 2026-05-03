const { Pool } = require('pg');
require('dotenv').config();

const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const shouldDisableSsl = process.env.DB_SSLMODE === 'disable';

const poolConfig = hasDatabaseUrl
  ? {
      connectionString: process.env.DATABASE_URL,
      // Neon requires SSL by default; allow opting out for local/testing URLs.
      ssl: shouldDisableSsl ? false : { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'restaurant_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

const pool = new Pool(poolConfig);

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    if (hasDatabaseUrl) {
      console.log('   Check your DATABASE_URL and Neon project/branch availability.');
      console.log('   If needed for local testing, set DB_SSLMODE=disable.');
    } else {
      console.log('   PostgreSQL may not be running. Make sure to:');
      console.log('   1. Start PostgreSQL server');
      console.log('   2. Create restaurant_db database: createdb -U postgres restaurant_db');
      console.log('   3. Run schema.sql: psql -U postgres -d restaurant_db -f schema.sql');
    }
  } else {
    console.log(hasDatabaseUrl ? '✅ Connected to PostgreSQL (DATABASE_URL)' : '✅ Connected to PostgreSQL (DB_* env)');
    client.query('SELECT NOW()', (err, result) => {
      if (!err) {
        console.log(`   Database time: ${result.rows[0].now}`);
      }
      release();
    });
  }
});

// Handle pool errors
pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

module.exports = pool;
