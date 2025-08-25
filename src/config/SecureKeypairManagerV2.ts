import { 
  generateKeyPairSigner,
  createKeyPairSignerFromBytes,
  type KeyPairSigner,
  type Address
} from '@solana/kit';
import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;

export class SecureKeypairManagerV2 {
  private readonly keypairsDir: string;
  private readonly password: string;

  constructor(keypairsDir?: string, password?: string) {
    this.keypairsDir = keypairsDir || path.join(__dirname, '../keypairs');
    this.password = password || process.env.KEYPAIRS_ENCRYPTION_PASSWORD || '';
    
    if (!this.password) {
      console.warn('⚠️ No encryption password provided. Keypairs will be stored unencrypted.');
    }

    // Ensure the keypairs directory exists
    if (!fs.existsSync(this.keypairsDir)) {
      fs.mkdirSync(this.keypairsDir, { recursive: true });
    }
  }

  private deriveKey(salt: Buffer): Buffer {
    return crypto.pbkdf2Sync(this.password, salt, 100000, KEY_LENGTH, 'sha256');
  }

  private encryptData(data: string): { encryptedData: string; salt: string; iv: string; authTag: string } {
    if (!this.password) {
      throw new Error('Encryption password not provided');
    }

    const salt = crypto.randomBytes(SALT_LENGTH);
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = this.deriveKey(salt);
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return {
      encryptedData: encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  private decryptData(encryptedData: { encryptedData: string; salt: string; iv: string; authTag: string }): string {
    if (!this.password) {
      throw new Error('Encryption password not provided');
    }

    const salt = Buffer.from(encryptedData.salt, 'hex');
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const authTag = Buffer.from(encryptedData.authTag, 'hex');
    const key = this.deriveKey(salt);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  // Extract private key as base64 from KeyPairSigner
  private async extractPrivateKeyAsBase64(keypair: KeyPairSigner): Promise<string> {
    try {
      // In Solana Kit V2, KeyPairSigners use the Web Crypto API internally
      // We need to work around the fact that private keys might not be directly extractable
      
      // First, try to access the internal CryptoKeyPair if available
      const cryptoKeyPair = keypair as any;
      
      if (cryptoKeyPair.privateKey && cryptoKeyPair.privateKey instanceof CryptoKey) {
        try {
          // Try to export the private key as raw bytes
          const exported = await crypto.subtle.exportKey('raw', cryptoKeyPair.privateKey);
          const privateKeyBytes = new Uint8Array(exported);
          return Buffer.from(privateKeyBytes).toString('base64');
        } catch (exportError) {
          // If raw export fails, try PKCS8 format
          try {
            const exported = await crypto.subtle.exportKey('pkcs8', cryptoKeyPair.privateKey);
            const privateKeyBytes = new Uint8Array(exported);
            return Buffer.from(privateKeyBytes).toString('base64');
          } catch (pkcs8Error) {
            throw new Error('Unable to export private key in any supported format');
          }
        }
      }
      
      // Fallback: Check if keypair has a secretKey property (compatibility layer)
      if (cryptoKeyPair.secretKey) {
        const secretKey = cryptoKeyPair.secretKey;
        if (secretKey instanceof Uint8Array) {
          return Buffer.from(secretKey).toString('base64');
        }
      }
      
      // If all else fails, try to sign a message and derive from that (less secure)
      // This is a last resort and might not work in all cases
      throw new Error('Unable to extract private key from KeyPairSigner - Solana Kit V2 uses secure CryptoKey storage');
      
    } catch (error) {
      throw new Error(`Failed to extract private key as base64: ${error instanceof Error ? error.message : error}`);
    }
  }

  // Create KeyPairSigner from base64 private key
  private async createKeypairFromBase64(base64PrivateKey: string): Promise<KeyPairSigner> {
    try {
      const privateKeyBytes = Uint8Array.from(Buffer.from(base64PrivateKey, 'base64'));
      return await createKeyPairSignerFromBytes(privateKeyBytes);
    } catch (error) {
      throw new Error(`Failed to create keypair from base64: ${error}`);
    }
  }

  public async saveKeypairSecurely(keypair: KeyPairSigner, filename: string): Promise<void> {
    const filePath = path.join(this.keypairsDir, filename);
    const privateKeyBase64 = await this.extractPrivateKeyAsBase64(keypair);

    if (this.password) {
      // Encrypt and save
      const encryptedData = this.encryptData(privateKeyBase64);
      const dataToSave = {
        version: 'v2',
        encrypted: true,
        keyFormat: 'base64',
        address: keypair.address,
        ...encryptedData
      };
      fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
      console.log(`🔐 V2 Keypair saved encrypted: ${filename} (${keypair.address})`);
    } else {
      // Save unencrypted with V2 format
      const dataToSave = {
        version: 'v2',
        encrypted: false,
        keyFormat: 'base64',
        address: keypair.address,
        privateKeyBase64: privateKeyBase64
      };
      fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
      console.log(`⚠️ V2 Keypair saved unencrypted: ${filename} (${keypair.address})`);
    }
  }

  public async loadKeypairSecurely(filename: string): Promise<KeyPairSigner> {
    const filePath = path.join(this.keypairsDir, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Keypair file not found: ${filename}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    let privateKeyBase64: string;

    if (data.version === 'v2') {
      // Handle V2 format
      if (data.encrypted) {
        // Decrypt encrypted V2 keypair
        if (!this.password) {
          throw new Error('Keypair is encrypted but no password provided');
        }
        privateKeyBase64 = this.decryptData(data);
      } else {
        // Unencrypted V2 format
        privateKeyBase64 = data.privateKeyBase64;
      }
    } else {
      throw new Error(`Unsupported keypair file format: ${filename}. Expected V2 format.`);
    }

    return await this.createKeypairFromBase64(privateKeyBase64);
  }

  public async loadAllKeypairs(): Promise<KeyPairSigner[]> {
    const files = fs.readdirSync(this.keypairsDir);
    const v2KeypairFiles = files.filter(file => 
      file.endsWith('.json') && 
      (file.includes('V2_') || file.includes('v2_') || this.isV2File(file))
    );
    
    const keypairs: KeyPairSigner[] = [];
    
    for (const file of v2KeypairFiles) {
      try {
        const keypair = await this.loadKeypairSecurely(file);
        keypairs.push(keypair);
      } catch (error) {
        console.warn(`⚠️ Failed to load keypair from ${file}: ${error}`);
      }
    }
    
    return keypairs;
  }

  private isV2File(filename: string): boolean {
    try {
      const filePath = path.join(this.keypairsDir, filename);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(fileContent);
      return data.version === 'v2';
    } catch {
      return false;
    }
  }

  public async generateAndSaveKeypairs(count: number, prefix: string = 'keypairV2'): Promise<KeyPairSigner[]> {
    const keypairs: KeyPairSigner[] = [];
    
    console.log(`🔑 Generating ${count} V2 keypairs with base64 encoding...`);
    
    for (let i = 0; i < count; i++) {
      // Generate private key bytes directly for better control
      const privateKeyBytes = new Uint8Array(32);
      crypto.getRandomValues(privateKeyBytes);
      
      const web3Keypair = Keypair.generate();
      const fullKeypairBytes = web3Keypair.secretKey; // This is 64 bytes
    
      const keypair = await createKeyPairSignerFromBytes(fullKeypairBytes);
      const filename = `${prefix}_${i + 1}.json`;
    
      await this.saveKeypairWithKnownKey(keypair, fullKeypairBytes, filename);
      keypairs.push(keypair);
      
      console.log(`Generated V2 keypair ${i + 1}/${count}: ${keypair.address}`);
    }
    
    return keypairs;
  }

  // Enhanced save method that accepts known private key bytes
  private async saveKeypairWithKnownKey(keypair: KeyPairSigner, privateKeyBytes: Uint8Array, filename: string): Promise<void> {
    const filePath = path.join(this.keypairsDir, filename);
    const privateKeyBase64 = Buffer.from(privateKeyBytes).toString('base64');

    if (this.password) {
      // Encrypt and save
      const encryptedData = this.encryptData(privateKeyBase64);
      const dataToSave = {
        version: 'v2',
        encrypted: true,
        keyFormat: 'base64',
        address: keypair.address,
        ...encryptedData
      };
      fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
      console.log(`🔐 V2 Keypair saved encrypted: ${filename} (${keypair.address})`);
    } else {
      // Save unencrypted with V2 format
      const dataToSave = {
        version: 'v2',
        encrypted: false,
        keyFormat: 'base64',
        address: keypair.address,
        privateKeyBase64: privateKeyBase64
      };
      fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
      console.log(`⚠️ V2 Keypair saved unencrypted: ${filename} (${keypair.address})`);
    }
  }

  public async migrateFromV1ToV2(): Promise<void> {
    console.log('🔄 Migrating V1 keypairs to V2 format...');
    
    const files = fs.readdirSync(this.keypairsDir);
    const v1KeypairFiles = files.filter(file => 
      file.endsWith('.json') && 
      !file.includes('V2_') && 
      !file.includes('v2_') &&
      !this.isV2File(file)
    );
    
    let migratedCount = 0;
    
    for (const file of v1KeypairFiles) {
      try {
        const filePath = path.join(this.keypairsDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);
        
        let v1Keypair: Keypair;
        
        if (data.encrypted && data.version !== 'v2') {
          // V1 encrypted format - would need original SecureKeypairManager to decrypt
          console.warn(`⚠️ Skipping encrypted V1 file (requires V1 manager): ${file}`);
          continue;
        } else if (Array.isArray(data)) {
          // V1 unencrypted array format
          v1Keypair = Keypair.fromSecretKey(new Uint8Array(data));
        } else {
          console.warn(`⚠️ Unknown V1 format: ${file}`);
          continue;
        }
        
        // Convert V1 Keypair to V2 KeyPairSigner
        const privateKeyBytes = v1Keypair.secretKey.slice(0, 32); // First 32 bytes are private key
        const v2Keypair = await createKeyPairSignerFromBytes(privateKeyBytes);
        
        // Create backup
        const backupPath = filePath + '.v1.backup';
        fs.writeFileSync(backupPath, fileContent);
        
        // Save as V2 format
        const v2Filename = file.replace('.json', '_migrated_v2.json');
        await this.saveKeypairSecurely(v2Keypair, v2Filename);
        migratedCount++;
        
        console.log(`🔐 Migrated to V2: ${file} -> ${v2Filename} (${v2Keypair.address})`);
        
      } catch (error) {
        console.error(`❌ Failed to migrate ${file}: ${error}`);
      }
    }
    
    console.log(`✅ Migration complete. ${migratedCount} files migrated to V2 format.`);
  }

  public async getKeypairInfo(): Promise<void> {
    const files = fs.readdirSync(this.keypairsDir);
    const allKeypairFiles = files.filter(file => file.endsWith('.json'));
    const v2Files = allKeypairFiles.filter(file => 
      file.includes('V2_') || file.includes('v2_') || this.isV2File(file)
    );
    
    console.log(`\n📁 V2 Keypair Directory: ${this.keypairsDir}`);
    console.log(`🔑 Total V2 keypair files: ${v2Files.length}`);
    console.log(`📄 Total all keypair files: ${allKeypairFiles.length}`);
    
    for (const file of v2Files) {
      try {
        const filePath = path.join(this.keypairsDir, file);
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);
        
        if (data.version === 'v2') {
          const status = data.encrypted ? 'Encrypted' : 'Unencrypted';
          console.log(`🔐 ${file}: V2 ${status} (Address: ${data.address})`);
        }
      } catch (error) {
        console.log(`❌ ${file}: Error reading file`);
      }
    }
    console.log();
  }

  // Utility method to export all V2 keypairs as base64
  public async exportAllAsBase64(): Promise<Array<{ filename: string; address: Address; privateKeyBase64: string }>> {
    const keypairs = await this.loadAllKeypairs();
    const exports = [];
    
    for (let i = 0; i < keypairs.length; i++) {
      const keypair = keypairs[i];
      const privateKeyBase64 = await this.extractPrivateKeyAsBase64(keypair);
      exports.push({
        filename: `keypairV2_${i + 1}.json`,
        address: keypair.address,
        privateKeyBase64
      });
    }
    
    return exports;
  }

  // Validate a V2 keypair file
  public async validateKeypairFile(filename: string): Promise<boolean> {
    try {
      const keypair = await this.loadKeypairSecurely(filename);
      return keypair.address !== undefined;
    } catch (error) {
      console.error(`❌ Validation failed for ${filename}: ${error}`);
      return false;
    }
  }
}

// Create default instance
export const secureKeypairManagerV2 = new SecureKeypairManagerV2();
