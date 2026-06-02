require('dotenv').config();

const app = require('./app');
const { ensureSeedData } = require('./config/db');

const PORT = process.env.PORT || 3000;

async function start() {
  try {
    require('./config/auth');
    await ensureSeedData();
    app.listen(PORT, () => {
      console.log(`🍽️  Restaurant API listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to initialize Firestore:', error.message);
    process.exit(1);
  }
}

start();
