#!/usr/bin/env node

/**
 * Simple starter script for Flutter Tools MCP
 */

// Check if built files exist, otherwise run from source
try {
  // First try to require the built version
  require('./dist/index');
} catch (err) {
  console.log('Built files not found, running from source with ts-node...');
  
  // If that fails, use ts-node to run the TypeScript source directly
  try {
    require('ts-node/register');
    require('./src/index');
  } catch (tsErr) {
    console.error('Failed to start the server:', tsErr);
    console.log('\nPlease make sure to install dependencies with:\nnpm install\n');
    process.exit(1);
  }
} 