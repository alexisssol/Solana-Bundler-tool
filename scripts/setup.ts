#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import promptSync from 'prompt-sync';
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const prompt = promptSync();

console.log('🚀 Solana Bundler Tool Setup');
console.log('===============================\n');

async function setupEnvironment() {
  const envPath = path.join(process.cwd(), '.env');
  
  if (fs.existsSync(envPath)) {
    const overwrite = prompt('⚠️ .env file already exists. Overwrite? (y/N): ').toLowerCase();
    if (overwrite !== 'y' && overwrite !== 'yes') {
      console.log('❌ Setup cancelled.');
      return;
    }
  }

  console.log('🔧 Setting up your environment configuration...\n');

  // RPC Configuration
  const rpcUrl = prompt('🌐 Enter your Solana RPC URL (or press Enter for default mainnet): ') || 'https://api.mainnet-beta.solana.com';
  
  // Private Keys
  console.log('\n🔑 Keypair Configuration');
  console.log('You can either:');
  console.log('1. Generate new keypairs (recommended for testing)');
  console.log('2. Import existing keypairs');
  
  const keyChoice = prompt('Choose option (1/2): ');
  
  let poolCreatorKey = '';
  let feePayerKey = '';
  
  if (keyChoice === '1') {
    console.log('🎲 Generating new keypairs...');
    const poolCreator = Keypair.generate();
    const feePayer = Keypair.generate();
    
    poolCreatorKey = bs58.encode(poolCreator.secretKey);
    feePayerKey = bs58.encode(feePayer.secretKey);
    
    console.log(`📝 Pool Creator Public Key: ${poolCreator.publicKey.toString()}`);
    console.log(`📝 Fee Payer Public Key: ${feePayer.publicKey.toString()}`);
    console.log('⚠️ IMPORTANT: Fund these wallets with SOL before using the tool!');
    
  } else if (keyChoice === '2') {
    poolCreatorKey = prompt('🔐 Enter Pool Creator private key (Base58): ');
    feePayerKey = prompt('🔐 Enter Fee Payer private key (Base58): ');
    
    // Validate the keys
    try {
      const poolCreator = Keypair.fromSecretKey(bs58.decode(poolCreatorKey));
      const feePayer = Keypair.fromSecretKey(bs58.decode(feePayerKey));
      console.log(`✅ Pool Creator Public Key: ${poolCreator.publicKey.toString()}`);
      console.log(`✅ Fee Payer Public Key: ${feePayer.publicKey.toString()}`);
    } catch (error) {
      console.error('❌ Invalid private key format!');
      return;
    }
  } else {
    console.log('❌ Invalid option selected.');
    return;
  }

  // Jito Configuration
  console.log('\n⚡ Jito Configuration');
  const minTipLamports = prompt('💰 Minimum tip in lamports (default: 10000): ') || '10000';
  const tipPercent = prompt('📈 Tip percentage (default: 50): ') || '50';
  
  // Security
  const encryptionPassword = prompt('🔒 Enter encryption password for keypairs (optional): ') || '';

  // Create environment file
  const envContent = `# Solana RPC Configuration
RPC_URL=${rpcUrl}
RPC_REQUESTS_PER_SECOND=0
RPC_MAX_BATCH_SIZE=20

# Private Keys (Base58 encoded) - KEEP THESE SECURE!
POOL_CREATOR_PRIVATE_KEY=${poolCreatorKey}
FEE_PAYER_PRIVATE_KEY=${feePayerKey}

# Jito Configuration
TIP_ACCOUNT=Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY
MIN_TIP_LAMPORTS=${minTipLamports}
TIP_PERCENT=${tipPercent}

# Jito Block Engine Configuration
BLOCK_ENGINE_URLS=frankfurt.mainnet.block-engine.jito.wtf
AUTH_KEYPAIR_PATH=./blockengine.json
GEYSER_URL=mainnet.rpc.jito.wtf
GEYSER_ACCESS_TOKEN=00000000-0000-0000-0000-000000000000

# Bot Configuration
BOT_NAME=local
NUM_WORKER_THREADS=4

# Arbitrage Configuration
ARB_CALCULATION_NUM_STEPS=3
MAX_ARB_CALCULATION_TIME_MS=15

# Program IDs
RAYDIUM_LIQUIDITY_POOL_V4=675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8

# Security Settings
KEYPAIRS_ENCRYPTION_PASSWORD=${encryptionPassword}
`;

  fs.writeFileSync(envPath, envContent);
  
  console.log('\n✅ Environment setup complete!');
  console.log(`📁 Configuration saved to: ${envPath}`);
  
  // Security warnings
  console.log('\n🔐 SECURITY REMINDERS:');
  console.log('1. Never commit your .env file to version control');
  console.log('2. Keep your private keys secure and backed up');
  console.log('3. Use different keypairs for mainnet vs devnet');
  console.log('4. Consider using a hardware wallet for large amounts');
  
  if (encryptionPassword) {
    console.log('5. Remember your encryption password - you cannot recover encrypted keypairs without it!');
  }
  
  console.log('\n🚀 You can now run the Solana Bundler Tool!');
  console.log('📖 Run `npm start` to begin or check the README for more information.');
}

async function validateConfiguration() {
  const envPath = path.join(process.cwd(), '.env');
  
  if (!fs.existsSync(envPath)) {
    console.log('❌ No .env file found. Please run setup first.');
    return false;
  }

  console.log('🔍 Validating configuration...');
  
  try {
    // Load and validate environment
    require('dotenv').config();
    
    const requiredVars = [
      'RPC_URL',
      'POOL_CREATOR_PRIVATE_KEY',
      'FEE_PAYER_PRIVATE_KEY'
    ];
    
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        console.log(`❌ Missing required variable: ${varName}`);
        return false;
      }
    }
    
    // Validate private keys
    try {
      Keypair.fromSecretKey(bs58.decode(process.env.POOL_CREATOR_PRIVATE_KEY!));
      Keypair.fromSecretKey(bs58.decode(process.env.FEE_PAYER_PRIVATE_KEY!));
    } catch (error) {
      console.log('❌ Invalid private key format');
      return false;
    }
    
    console.log('✅ Configuration is valid!');
    return true;
    
  } catch (error) {
    console.log('❌ Configuration validation failed:', error);
    return false;
  }
}

async function main() {
  const command = process.argv[2];
  
  switch (command) {
    case 'setup':
      await setupEnvironment();
      break;
    case 'validate':
      await validateConfiguration();
      break;
    case 'help':
    default:
      console.log('Available commands:');
      console.log('  setup    - Set up environment configuration');
      console.log('  validate - Validate existing configuration');
      console.log('  help     - Show this help message');
      break;
  }
}

if (require.main === module) {
  main().catch(console.error);
}
