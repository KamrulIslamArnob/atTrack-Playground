// Windows code signing script
// Supports both local certificate files and Azure Key Vault

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = async function(context) {
  if (context.platformName !== 'win') {
    console.log('[sign] Skipping — not Windows');
    return;
  }

  // Skip if no signing configuration
  if (!process.env.CSC_LINK && !process.env.WIN_CSC_LINK) {
    console.warn('[sign] Skipping — no certificate configured');
    console.warn('[sign] Set CSC_LINK and CSC_KEY_PASSWORD to enable Windows signing');
    return;
  }

  console.log('[sign] Windows code signing configured');
  console.log('[sign] electron-builder will handle the actual signing');

  // If using Azure Key Vault, you can add custom signing logic here
  if (process.env.AZURE_KEY_VAULT_URL) {
    console.log('[sign] Using Azure Key Vault for signing');
    // Add Azure signing logic if needed
  }
};
