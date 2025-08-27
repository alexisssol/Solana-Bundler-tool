import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import bs58 from 'bs58';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const SALT_LENGTH = 64;
const KEY_LENGTH = 32;

export class SecureKeypairManager {
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
    
    const cipher = crypto.createCipheriv(ALGORITHM.replace('-gcm', ''), key, iv);
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return {
      encryptedData: encrypted,
      salt: salt.toString('hex'),
      iv: iv.toString('hex'),
      authTag: '' // Not used with createCipher
    };
  }

  private decryptData(encryptedData: { encryptedData: string; salt: string; iv: string; authTag: string }): string {
    if (!this.password) {
      throw new Error('Encryption password not provided');
    }

    const salt = Buffer.from(encryptedData.salt, 'hex');
    const key = this.deriveKey(salt);
    
    const decipher = crypto.createDecipher(ALGORITHM.replace('-gcm', ''), key);
    
    let decrypted = decipher.update(encryptedData.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  public saveKeypairSecurely(keypair: Keypair, filename: string): void {
    const filePath = path.join(this.keypairsDir, filename);
    const secretKeyBase58 = bs58.encode(keypair.secretKey);

    if (this.password) {
      // Encrypt and save
      const encryptedData = this.encryptData(secretKeyBase58);
      const dataToSave = {
        encrypted: true,
        publicKey: keypair.publicKey.toString(),
        ...encryptedData
      };
      fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));
      console.log(`🔐 Keypair saved encrypted: ${filename}`);
    } else {
      // Save unencrypted (legacy format for compatibility)
      const secretKeyArray = Array.from(keypair.secretKey);
      fs.writeFileSync(filePath, JSON.stringify(secretKeyArray));
      console.log(`⚠️ Keypair saved unencrypted: ${filename}`);
    }
  }

  public loadKeypairSecurely(filename: string): Keypair {
    const filePath = path.join(this.keypairsDir, filename);
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`Keypair file not found: ${filename}`);
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    let secretKey: Uint8Array;

    if (data.encrypted) {
      // Decrypt encrypted keypair
      if (!this.password) {
        throw new Error('Keypair is encrypted but no password provided');
      }
      
      const decryptedBase58 = this.decryptData(data);
      secretKey = bs58.decode(decryptedBase58);
    } else if (Array.isArray(data)) {
      // Legacy unencrypted format (array of numbers)
      secretKey = new Uint8Array(data);
    } else {
      throw new Error(`Unknown keypair file format: ${filename}`);
    }

    return Keypair.fromSecretKey(secretKey);
  }

  public loadAllKeypairs(): Keypair[] {
    const files = fs.readdirSync(this.keypairsDir);
    const keypairFiles = files.filter(file => file.endsWith('.json'));
    
    return keypairFiles.map(file => this.loadKeypairSecurely(file));
  }

  public generateAndSaveKeypairs(count: number, prefix: string = 'keypair'): Keypair[] {
    const keypairs: Keypair[] = [];
    
    for (let i = 0; i < count; i++) {
      const keypair = Keypair.generate();
      const filename = `${prefix}${i + 1}.json`;
      
      this.saveKeypairSecurely(keypair, filename);
      keypairs.push(keypair);
      
      console.log(`Generated keypair ${i + 1}/${count}: ${keypair.publicKey.toString()}`);
    }
    
    return keypairs;
  }

  public migrateToEncrypted(): void {
    if (!this.password) {
      throw new Error('Cannot migrate to encrypted storage without password');
    }

    const files = fs.readdirSync(this.keypairsDir);
    const keypairFiles = files.filter(file => file.endsWith('.json'));
    
    let migratedCount = 0;
    
    for (const file of keypairFiles) {
      const filePath = path.join(this.keypairsDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(fileContent);
      
      // Check if already encrypted
      if (data.encrypted) {
        console.log(`⏭️ Skipping already encrypted file: ${file}`);
        continue;
      }
      
      // Check if it's the old array format
      if (Array.isArray(data)) {
        const keypair = Keypair.fromSecretKey(new Uint8Array(data));
        
        // Create backup
        const backupPath = filePath + '.backup';
        fs.writeFileSync(backupPath, fileContent);
        
        // Save encrypted version
        this.saveKeypairSecurely(keypair, file);
        migratedCount++;
        
        console.log(`🔐 Migrated to encrypted: ${file}`);
      }
    }
    
    console.log(`✅ Migration complete. ${migratedCount} files migrated.`);
  }

  public getKeypairInfo(): void {
    const files = fs.readdirSync(this.keypairsDir);
    const keypairFiles = files.filter(file => file.endsWith('.json'));
    
    console.log(`\n📁 Keypair Directory: ${this.keypairsDir}`);
    console.log(`🔑 Total keypair files: ${keypairFiles.length}`);
    
    for (const file of keypairFiles) {
      const filePath = path.join(this.keypairsDir, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(fileContent);
      
      if (data.encrypted) {
        console.log(`🔐 ${file}: Encrypted (Public Key: ${data.publicKey})`);
      } else {
        console.log(`⚠️ ${file}: Unencrypted`);
      }
    }
    console.log();
  }
}

// Create default instance
export const secureKeypairManager = new SecureKeypairManager();
