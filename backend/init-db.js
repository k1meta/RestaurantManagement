const pool = require('./config/db');
const bcryptjs = require('bcryptjs');

async function initializeDatabase() {
  console.log('🔐 Initializing database users...\n');

  try {
    // Generate bcrypt hash for "password123" with 10 salt rounds
    const passwordHash = await bcryptjs.hash('password123', 10);
    console.log(`✓ Password hash: ${passwordHash}\n`);

    // Insert test users
    const users = [
      { name: 'Owner Ali', email: 'owner@restaurant.com', role: 'owner', location_id: null },
      { name: 'Manager Sara', email: 'manager@restaurant.com', role: 'manager', location_id: 1 },
      { name: 'Waiter Tom', email: 'waiter@restaurant.com', role: 'waiter', location_id: 1 },
      { name: 'Kitchen Marco', email: 'kitchen@restaurant.com', role: 'kitchen', location_id: 1 }
    ];

    for (const user of users) {
      try {
        // Check if user exists
        const check = await pool.query('SELECT id FROM users WHERE email = $1', [user.email]);
        
        if (check.rows.length === 0) {
          // User doesn't exist, create them
          await pool.query(
            'INSERT INTO users (name, email, password_hash, role, location_id) VALUES ($1, $2, $3, $4, $5)',
            [user.name, user.email, passwordHash, user.role, user.location_id]
          );
          console.log(`✓ Created: ${user.name} (${user.email}) - ${user.role}`);
        } else {
          // User exists, update password
          await pool.query(
            'UPDATE users SET password_hash = $1 WHERE email = $2',
            [passwordHash, user.email]
          );
          console.log(`✓ Updated: ${user.name} (${user.email}) - ${user.role}`);
        }
      } catch (err) {
        console.log(`⚠ ${user.name}: ${err.message}`);
      }
    }

    console.log('\n✓ Database initialization complete!\n');
    console.log('Test Credentials:');
    users.forEach(u => {
      console.log(`  ${u.role.toUpperCase()}: ${u.email} / password123`);
    });

    pool.end();
  } catch (err) {
    console.error('❌ Error:', err.message);
    pool.end();
    process.exit(1);
  }
}

initializeDatabase();
