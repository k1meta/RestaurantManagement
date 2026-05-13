const functions = require('firebase-functions');

// Require main Express app
const app = require('../server');

// Export Cloud Function
exports.api = functions.https.onRequest(app);
