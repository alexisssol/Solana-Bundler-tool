import { 
  generateKeyPairSigner, 
  createKeyPairSignerFromBytes,
  type KeyPairSigner,
  type Address
} from '@solana/kit';
import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import promptSync from 'prompt-sync';
import path from 'path';
import { SecureKeypairManagerV2 } from '../config/SecureKeypairManagerV2';

const prompt = promptSync();

const keypairsDir = path.join(__dirname, '../../', 'keypairs');
const keyInfoPath = path.join(__dirname, '../../', 'keypairs/keyInfoV2.json');

interface IPoolInfoV2 {
  [key: string]: any;
  numOfWallets?: number;
  version: 'v2';
  keyFormat: 'base64';
}

// Ensure the keypairs directory exists
if (!fs.existsSync(keypairsDir)) {
  fs.mkdirSync(keypairsDir, { recursive: true });
}

// Generate wallets using Solana Kit V2
export async function generateWalletsV2(numOfWallets: number): Promise<KeyPairSigner[]> {
  const wallets: KeyPairSigner[] = [];
  
  console.log(`🔑 Generating ${numOfWallets} Solana Kit V2 keypairs...`);
  
  for (let i = 0; i < numOfWallets; i++) {
    const wallet = await generateKeyPairSigner();
    wallets.push(wallet);
    console.log(`Generated wallet ${i + 1}/${numOfWallets}: ${wallet.address}`);
  }
  
  return wallets;
}

// Save keypair using SecureKeypairManagerV2
async function saveKeypairToFileV2(keypair: KeyPairSigner, index: number, manager: SecureKeypairManagerV2) {
  const filename = `keypairV2_${index + 1}.json`;
  await manager.saveKeypairSecurely(keypair, filename);
}

// Read all V2 keypairs
async function readKeypairsV2(manager: SecureKeypairManagerV2): Promise<KeyPairSigner[]> {
  return await manager.loadAllKeypairs();
}

// Update pool info with V2 format
async function updatePoolInfoV2(wallets: KeyPairSigner[]) {
  let poolInfo: IPoolInfoV2 = {
    version: 'v2',
    keyFormat: 'base64'
  };

  // Check if poolInfoV2.json exists and read its content
  if (fs.existsSync(keyInfoPath)) {
    const data = fs.readFileSync(keyInfoPath, 'utf8');
    poolInfo = { ...poolInfo, ...JSON.parse(data) };
  }

  // Update wallet-related information
  poolInfo.numOfWallets = wallets.length;
  poolInfo.version = 'v2';
  poolInfo.keyFormat = 'base64';
  
  wallets.forEach((wallet, index) => {
    poolInfo[`pubkeyV2_${index + 1}`] = wallet.address;
  });

  // Write updated data back to poolInfoV2.json
  fs.writeFileSync(keyInfoPath, JSON.stringify(poolInfo, null, 2));
  console.log(`📄 Updated pool info with ${wallets.length} V2 wallets`);
}

// Convert base64 private key to KeyPairSigner
export async function createKeypairFromBase64(base64PrivateKey: string): Promise<KeyPairSigner> {
  try {
    const privateKeyBytes = Buffer.from(base64PrivateKey, 'base64');
    
    // Handle different key lengths
    let keyBytes: Uint8Array;
    if (privateKeyBytes.length === 64) {
      // 64 bytes = already in correct format
      keyBytes = new Uint8Array(privateKeyBytes);
    } else {
      throw new Error(`Invalid private key length: expected 64 bytes, got ${privateKeyBytes.length}`);
    }
    
    return await createKeyPairSignerFromBytes(keyBytes);
  } catch (error) {
    throw new Error(`Failed to create keypair from base64: ${error instanceof Error ? error.message : error}`);
  }
}

// Enhanced keypair creation that tracks private key bytes
export async function createKeypairWithBase64Enhanced(): Promise<{ 
  signer: KeyPairSigner; 
  privateKeyBase64: string; 
  address: Address;
  privateKeyBytes: Uint8Array;
}> {
  // Generate keypair using Solana Kit's method
  const signer = await generateKeyPairSigner();
  
  // Try to extract the private key bytes (this is the tricky part with Solana Kit V2)
  // For now, we'll need to work around the extraction limitation
  const privateKeyBase64 = await extractPrivateKeyAsBase64(signer);
  const privateKeyBytes = new Uint8Array(Buffer.from(privateKeyBase64, 'base64'));
  
  return {
    signer,
    privateKeyBase64,
    address: signer.address,
    privateKeyBytes
  };
}

// Extract private key from KeyPairSigner as base64
export async function extractPrivateKeyAsBase64(keypair: KeyPairSigner): Promise<string> {
  try {
    // In Solana Kit V2, KeyPairSigners use the Web Crypto API internally
    // This is a complex operation that may not always be possible due to security restrictions
    
    const cryptoKeyPair = keypair as any;
    
    if (cryptoKeyPair.privateKey && cryptoKeyPair.privateKey instanceof CryptoKey) {
      try {
        // Try to export the private key as raw bytes (Ed25519 format)
        const exported = await crypto.subtle.exportKey('raw', cryptoKeyPair.privateKey);
        const privateKeyBytes = new Uint8Array(exported);
        return Buffer.from(privateKeyBytes).toString('base64');
      } catch (rawError) {
        // If raw export fails, try PKCS8 format
        try {
          const exported = await crypto.subtle.exportKey('pkcs8', cryptoKeyPair.privateKey);
          const privateKeyBytes = new Uint8Array(exported);
          return Buffer.from(privateKeyBytes).toString('base64');
        } catch (pkcs8Error) {
          // Last resort: check for compatibility layer properties
          if (cryptoKeyPair.secretKey instanceof Uint8Array) {
            return Buffer.from(cryptoKeyPair.secretKey).toString('base64');
          }
          throw new Error('Private key extraction not supported - Solana Kit V2 uses secure storage');
        }
      }
    }
    
    // Check for compatibility layer
    if (cryptoKeyPair.secretKey instanceof Uint8Array) {
      return Buffer.from(cryptoKeyPair.secretKey).toString('base64');
    }
    
    throw new Error('Unable to extract private key from KeyPairSigner - secure storage prevents extraction');
    
  } catch (error) {
    throw new Error(`Failed to extract private key as base64: ${error instanceof Error ? error.message : error}`);
  }
}

// Create a single keypair and return both the signer and base64 private key
export async function createKeypairWithBase64(): Promise<{ signer: KeyPairSigner; privateKeyBase64: string; address: Address }> {
  const enhanced = await createKeypairWithBase64Enhanced();
  return {
    signer: enhanced.signer,
    privateKeyBase64: enhanced.privateKeyBase64,
    address: enhanced.address
  };
}

// Main function for V2 keypair creation
export async function createKeypairsV2() {
  console.log('🔐 Solana Kit V2 Keypair Management System');
  console.log('✨ Using base64 encoding for private keys');
  console.log('WARNING: If you create new ones, ensure you don\'t have SOL, OR ELSE IT WILL BE GONE.');
  
  const manager = new SecureKeypairManagerV2();
  
  // Show current keypair info
  await manager.getKeypairInfo();
  
  const action = prompt('Do you want to (c)reate new V2 wallets, (u)se existing V2 ones, or (m)igrate V1 to V2? (c/u/m): ');
  let wallets: KeyPairSigner[] = [];

  if (action === 'c') {
    const numInput = prompt('How many V2 wallets do you want to create? ');
    const numOfWallets = parseInt(numInput || '0', 10);
    if (isNaN(numOfWallets) || numOfWallets <= 0) {
      console.log('Invalid number. Please enter a positive integer.');
      return;
    }

    console.log(`🔑 Generating ${numOfWallets} new V2 keypairs with base64 encoding...`);
    wallets = await manager.generateAndSaveKeypairs(numOfWallets);
    
    // Display generated keypairs
    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      console.log(`\nWallet ${i + 1}:`);
      console.log(`  Address: ${wallet.address}`);
      console.log(`  Private Key (Base64): [Generated and securely stored]`);
    }
    
  } else if (action === 'u') {
    console.log('🔍 Loading existing V2 keypairs...');
    wallets = await readKeypairsV2(manager);
    
    for (let i = 0; i < wallets.length; i++) {
      const wallet = wallets[i];
      console.log(`\nRead V2 Wallet ${i + 1}:`);
      console.log(`  Address: ${wallet.address}`);
      console.log(`  Private Key (Base64): [Loaded from secure storage]`);
    }
    
  } else if (action === 'm') {
    console.log('🔄 Migrating V1 to V2 encrypted storage...');
    await manager.migrateFromV1ToV2();
    wallets = await readKeypairsV2(manager);
    
  } else {
    console.log('Invalid option. Please enter "c" for create, "u" for use existing, or "m" for migrate.');
    return;
  }

  await updatePoolInfoV2(wallets);
  console.log(`✅ ${wallets.length} V2 wallets have been processed with base64 encoding.`);
}

// Load V2 keypairs with error handling
export async function loadKeypairsV2(): Promise<KeyPairSigner[]> {
  try {
    const manager = new SecureKeypairManagerV2();
    return await manager.loadAllKeypairs();
  } catch (error) {
    console.error('❌ Error loading V2 keypairs:', error);
    console.log('💡 Try running the createKeypairsV2 function first to set up your V2 wallets.');
    return [];
  }
}

// Utility function to validate a base64 private key
export function validateBase64PrivateKey(base64Key: string): boolean {
  try {
    const decoded = Buffer.from(base64Key, 'base64');
    // Solana private keys should be 64 bytes (32 bytes private key + 32 bytes public key)
    // or 32 bytes (just private key)
    return decoded.length === 32 || decoded.length === 64;
  } catch (error) {
    return false;
  }
}

// Export a keypair to base64 format for external use
export async function exportKeypairAsBase64(keypair: KeyPairSigner): Promise<{ address: Address; privateKeyBase64: string }> {
  const privateKeyBase64 = await extractPrivateKeyAsBase64(keypair);
  return {
    address: keypair.address,
    privateKeyBase64
  };
}

// Batch create keypairs with base64 export
export async function batchCreateKeypairsWithBase64(count: number): Promise<Array<{ signer: KeyPairSigner; privateKeyBase64: string; address: Address }>> {
  const results = [];
  
  console.log(`🔄 Batch creating ${count} keypairs with base64 encoding...`);
  
  for (let i = 0; i < count; i++) {
    const result = await createKeypairWithBase64();
    results.push(result);
    console.log(`Created ${i + 1}/${count}: ${result.address}`);
  }
  
  return results;
}
