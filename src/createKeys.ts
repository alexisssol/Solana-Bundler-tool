import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import promptSync from 'prompt-sync';
import path from 'path';
import bs58 from 'bs58';
import { secureKeypairManager } from './config/SecureKeypairManager';

const prompt = promptSync();

const keypairsDir = path.join(__dirname, 'keypairs');
const keyInfoPath = path.join(__dirname, 'keyInfo.json');

interface IPoolInfo {
  [key: string]: any;
  numOfWallets?: number;
}

// Ensure the keypairs directory exists
if (!fs.existsSync(keypairsDir)) {
  fs.mkdirSync(keypairsDir, { recursive: true });
}

// Legacy functions for backward compatibility
function generateWallets(numOfWallets: number): Keypair[] {
  let wallets: Keypair[] = [];
  for (let i = 0; i < numOfWallets; i++) {
    const wallet = Keypair.generate();
    wallets.push(wallet);
  }
  return wallets;
}

function saveKeypairToFile(keypair: Keypair, index: number) {
  const filename = `keypair${index + 1}.json`;
  secureKeypairManager.saveKeypairSecurely(keypair, filename);
}

function readKeypairs(): Keypair[] {
  return secureKeypairManager.loadAllKeypairs();
}

function updatePoolInfo(wallets: Keypair[]) {
  let poolInfo: IPoolInfo = {}; // Use the defined type here

  // Check if poolInfo.json exists and read its content
  if (fs.existsSync(keyInfoPath)) {
    const data = fs.readFileSync(keyInfoPath, 'utf8');
    poolInfo = JSON.parse(data);
  }

  // Update wallet-related information
  poolInfo.numOfWallets = wallets.length;
  wallets.forEach((wallet, index) => {
    poolInfo[`pubkey${index + 1}`] = wallet.publicKey.toString();
  });

  // Write updated data back to poolInfo.json
  fs.writeFileSync(keyInfoPath, JSON.stringify(poolInfo, null, 2));
}

export async function createKeypairs() {
  console.log('🔐 Secure Keypair Management System');
  console.log('WARNING: If you create new ones, ensure you don\'t have SOL, OR ELSE IT WILL BE GONE.');
  
  // Show current keypair info
  secureKeypairManager.getKeypairInfo();
  
  const action = prompt('Do you want to (c)reate new wallets, (u)se existing ones, or (m)igrate to encrypted? (c/u/m): ');
  let wallets: Keypair[] = [];

  if (action === 'c') {
    const numOfWallets = 27; // Hardcode 27 buyer keypairs here.
    if (isNaN(numOfWallets) || numOfWallets <= 0) {
      console.log('Invalid number. Please enter a positive integer.');
      return;
    }

    console.log(`🔑 Generating ${numOfWallets} new keypairs...`);
    wallets = secureKeypairManager.generateAndSaveKeypairs(numOfWallets);
    
  } else if (action === 'u') {
    console.log('🔍 Loading existing keypairs...');
    wallets = readKeypairs();
    wallets.forEach((wallet, index) => {
      console.log(`Read Wallet ${index + 1} Public Key: ${wallet.publicKey.toString()}`);
      console.log(`Read Wallet ${index + 1} Private Key: ${bs58.encode(wallet.secretKey)}\n`);
    });
    
  } else if (action === 'm') {
    console.log('🔄 Migrating to encrypted storage...');
    secureKeypairManager.migrateToEncrypted();
    wallets = readKeypairs();
    
  } else {
    console.log('Invalid option. Please enter "c" for create, "u" for use existing, or "m" for migrate.');
    return;
  }

  updatePoolInfo(wallets);
  console.log(`✅ ${wallets.length} wallets have been processed.`);
}

export function loadKeypairs(): Keypair[] {
  try {
    return secureKeypairManager.loadAllKeypairs();
  } catch (error) {
    console.error('❌ Error loading keypairs:', error);
    console.log('💡 Try running the createKeypairs function first to set up your wallets.');
    
    // Fallback to legacy method for backward compatibility
    try {
      console.log('🔄 Attempting legacy keypair loading...');
      const keypairRegex = /^keypair\d+\.json$/;
      return fs.readdirSync(keypairsDir)
        .filter(file => keypairRegex.test(file))
        .map(file => {
          const filePath = path.join(keypairsDir, file);
          const secretKeyString = fs.readFileSync(filePath, { encoding: 'utf8' });
          const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
          return Keypair.fromSecretKey(secretKey);
        });
    } catch (legacyError) {
      console.error('❌ Legacy loading also failed:', legacyError);
      return [];
    }
  }
}
