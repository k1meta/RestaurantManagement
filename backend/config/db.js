const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'restaurant_db',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    console.log('   PostgreSQL may not be running. Make sure to:');
    console.log('   1. Start PostgreSQL server');
    console.log('   2. Create restaurant_db database: createdb -U postgres restaurant_db');
    console.log('   3. Run schema.sql: psql -U postgres -d restaurant_db -f schema.sql');
  } else {
    console.log('✅ Connected to PostgreSQL');
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
