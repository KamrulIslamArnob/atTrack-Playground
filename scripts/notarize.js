const { notarize } = require('@electron/notarize');

module.exports = async function(context) {
  // Only notarize macOS builds
  if (context.platformName !== 'mac') {
    console.log('[notarize] Skipping — not macOS');
    return;
  }

  // Skip if no credentials (e.g., local dev build)
  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD) {
    console.warn('[notarize] Skipping — no Apple credentials in environment');
    console.warn('[notarize] Set APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID to enable notarization');
    return;
  }

  const { appOutDir } = context;
  const appName = context.packager.appInfo.productFilename;
  const appPath = `${appOutDir}/${appName}.app`;

  console.log(`[notarize] Notarizing ${appName}...`);
  console.log(`[notarize] App path: ${appPath}`);
  console.log(`[notarize] Apple ID: ${process.env.APPLE_ID}`);
  console.log(`[notarize] Team ID: ${process.env.APPLE_TEAM_ID}`);

  try {
    await notarize({
      appBundleId: 'com.attrack.desktop',
      appPath: appPath,
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID,
      tool: 'notarytool',  // Use the modern notarytool (Xcode 13+)
    });
    console.log('[notarize] ✅ Notarization complete!');
  } catch (error) {
    console.error('[notarize] ❌ Notarization failed:', error.message);
    console.warn('[notarize] Build will continue but app may be blocked by Gatekeeper');
    // Don't throw — let the build continue but warn the user
  }
};
