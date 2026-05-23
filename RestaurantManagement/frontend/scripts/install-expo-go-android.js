/**
 * Installs Expo Go for SDK 55 on a USB-connected Android device.
 * Play Store Expo Go may still be SDK 54 and will not load SDK 55 projects.
 *
 * Usage:
 *   npm run mobile:install-expo-go
 *   npm run mobile:install-expo-go -- --apk-only
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const https = require('https');
const path = require('path');

const EXPO_GO_APK_URL =
  'https://github.com/expo/expo-go-releases/releases/download/Expo-Go-55.0.7/Expo-Go-55.0.7.apk';
const EXPO_GO_PAGE =
  'https://expo.dev/go?sdkVersion=55&platform=android&device=true';

const apkOnly = process.argv.includes('--apk-only');
const outDir = path.join(process.cwd(), '.expo-cache');
const apkPath = path.join(outDir, 'Expo-Go-55.0.7.apk');

function log(message) {
  console.log(`[expo-go] ${message}`);
}

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destination);
    https
      .get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close(() => fs.unlinkSync(destination));
          downloadFile(response.headers.location, destination).then(resolve).catch(reject);
          return;
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed (${response.statusCode})`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
      })
      .on('error', (error) => {
        fs.unlink(destination, () => {});
        reject(error);
      });
  });
}

function hasAdb() {
  try {
    execSync('adb version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

async function main() {
  log('Your project uses Expo SDK 55.');
  log('Google Play Expo Go is still on SDK 54, which causes the incompatible-version error.');
  log('');
  log(`Manual install page: ${EXPO_GO_PAGE}`);
  log(`Direct APK: ${EXPO_GO_APK_URL}`);
  log('');

  fs.mkdirSync(outDir, { recursive: true });

  if (!fs.existsSync(apkPath)) {
    log(`Downloading Expo Go 55 APK to ${apkPath} ...`);
    await downloadFile(EXPO_GO_APK_URL, apkPath);
    log('Download complete.');
  } else {
    log(`Using cached APK: ${apkPath}`);
  }

  if (apkOnly) {
    log('Done (--apk-only). Copy the APK to your phone and install it, or run without --apk-only with USB debugging enabled.');
    return;
  }

  if (!hasAdb()) {
    log('adb not found. Install Android platform-tools, enable USB debugging, then re-run this script.');
    log(`Or open the APK on your phone: ${apkPath}`);
    return;
  }

  const devices = execSync('adb devices', { encoding: 'utf8' });
  if (!/\tdevice\s*$/m.test(devices)) {
    log('No Android device detected. Connect your phone via USB, enable USB debugging, accept the trust prompt, then re-run.');
    log(`APK is ready at: ${apkPath}`);
    return;
  }

  log('Installing Expo Go 55 on the connected device (replaces the Play Store build)...');
  const install = spawnSync('adb', ['install', '-r', apkPath], { encoding: 'utf8' });
  if (install.status !== 0) {
    console.error(install.stdout || install.stderr);
    process.exitCode = 1;
    log('Install failed. You can still open the APK file on your phone manually.');
    return;
  }

  log('Expo Go 55 installed. Run `npm run start:mobile` and scan the QR code again.');
}

main().catch((error) => {
  console.error('[expo-go] Failed:', error.message);
  process.exitCode = 1;
});
