const fs = require('fs');
const path = require('path');

const pathsToEnsure = [
  path.join(process.cwd(), 'node_modules', 'node-addon-api', 'doc'),
];

for (const targetPath of pathsToEnsure) {
  try {
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
      console.log(`[mobile:prepare] Created missing path: ${targetPath}`);
    }
  } catch (error) {
    console.warn(`[mobile:prepare] Could not create path: ${targetPath}`);
    console.warn(`[mobile:prepare] ${error.message}`);
  }
}
