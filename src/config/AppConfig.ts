import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import { Wallet } from '@project-serum/anchor';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

export class AppConfig {
  // RPC Configuration
  public readonly rpcUrl: string;
  public readonly rpcRequestsPerSecond: number;
  public readonly rpcMaxBatchSize: number;
  public readonly connection: Connection;

  // Keypairs
  public readonly wallet: Keypair;
  public readonly payer: Keypair;
  public readonly walletconn: Wallet;

  // Jito Configuration
  public readonly tipAccount: PublicKey;
  public readonly minTipLamports: number;
  public readonly tipPercent: number;
  public readonly blockEngineUrls: string[];
  public readonly geyserUrl: string;
  public readonly geyserAccessToken: string;

  // Bot Configuration
  public readonly botName: string;
  public readonly numWorkerThreads: number;

  // Arbitrage Configuration
  public readonly arbCalculationNumSteps: number;
  public readonly maxArbCalculationTimeMs: number;

  // Program IDs
  public readonly rayLiqPoolv4: PublicKey;

  // Tip Accounts Pool
  public readonly tipAccounts: PublicKey[];

  constructor() {
    // Validate required environment variables
    this.validateRequiredEnvVars();

    // RPC Configuration
    this.rpcUrl = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
    this.rpcRequestsPerSecond = parseInt(process.env.RPC_REQUESTS_PER_SECOND || '0');
    this.rpcMaxBatchSize = parseInt(process.env.RPC_MAX_BATCH_SIZE || '20');
    
    this.connection = new Connection(this.rpcUrl, {
      commitment: 'confirmed',
    });

    // Load keypairs from environment variables
    this.wallet = this.loadKeypairFromEnv('POOL_CREATOR_PRIVATE_KEY');
    this.payer = this.loadKeypairFromEnv('FEE_PAYER_PRIVATE_KEY');
    this.walletconn = new Wallet(this.wallet);

    // Jito Configuration
    this.tipAccount = new PublicKey(process.env.TIP_ACCOUNT || 'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY');
    this.minTipLamports = parseInt(process.env.MIN_TIP_LAMPORTS || '10000');
    this.tipPercent = parseInt(process.env.TIP_PERCENT || '50');
    this.blockEngineUrls = (process.env.BLOCK_ENGINE_URLS || 'frankfurt.mainnet.block-engine.jito.wtf').split(',');
    this.geyserUrl = process.env.GEYSER_URL || 'mainnet.rpc.jito.wtf';
    this.geyserAccessToken = process.env.GEYSER_ACCESS_TOKEN || '00000000-0000-0000-0000-000000000000';

    // Bot Configuration
    this.botName = process.env.BOT_NAME || 'local';
    this.numWorkerThreads = parseInt(process.env.NUM_WORKER_THREADS || '4');

    // Arbitrage Configuration
    this.arbCalculationNumSteps = parseInt(process.env.ARB_CALCULATION_NUM_STEPS || '3');
    this.maxArbCalculationTimeMs = parseInt(process.env.MAX_ARB_CALCULATION_TIME_MS || '15');

    // Program IDs
    this.rayLiqPoolv4 = new PublicKey(process.env.RAYDIUM_LIQUIDITY_POOL_V4 || '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

    // Initialize tip accounts pool
    this.tipAccounts = this.initializeTipAccounts();
  }

  private validateRequiredEnvVars(): void {
    const requiredVars = [
      'POOL_CREATOR_PRIVATE_KEY',
      'FEE_PAYER_PRIVATE_KEY'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
  }

  private loadKeypairFromEnv(envVarName: string): Keypair {
    const privateKeyBase58 = process.env[envVarName];
    
    if (!privateKeyBase58) {
      throw new Error(`Environment variable ${envVarName} is required`);
    }

    try {
      return Keypair.fromSecretKey(bs58.decode(privateKeyBase58));
    } catch (error) {
      throw new Error(`Invalid private key format in ${envVarName}: ${error}`);
    }
  }

  private loadKeypairFromFile(filePath: string): Keypair {
    try {
      const fullPath = path.resolve(filePath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Keypair file not found: ${fullPath}`);
      }

      const secretKeyArray = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      return Keypair.fromSecretKey(new Uint8Array(secretKeyArray));
    } catch (error) {
      throw new Error(`Failed to load keypair from ${filePath}: ${error}`);
    }
  }

  private initializeTipAccounts(): PublicKey[] {
    return [
      '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
      'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
      'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
      'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
      'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
      'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
      'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
      '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
    ].map((pubkey) => new PublicKey(pubkey));
  }

  public getRandomTipAccount(): PublicKey {
    return this.tipAccounts[Math.floor(Math.random() * this.tipAccounts.length)];
  }

  public getAuthKeypair(): Keypair {
    const authKeypairPath = process.env.AUTH_KEYPAIR_PATH || './blockengine.json';
    return this.loadKeypairFromFile(authKeypairPath);
  }

  // Utility method to validate configuration
  public validateConfig(): boolean {
    try {
      // Test RPC connection
      this.connection.getLatestBlockhash();
      
      // Validate keypairs
      if (!this.wallet.publicKey || !this.payer.publicKey) {
        throw new Error('Invalid keypairs');
      }

      console.log('✅ Configuration validated successfully');
      console.log(`🌐 RPC URL: ${this.rpcUrl}`);
      console.log(`🔑 Pool Creator: ${this.wallet.publicKey.toString()}`);
      console.log(`💰 Fee Payer: ${this.payer.publicKey.toString()}`);
      console.log(`🎯 Tip Account: ${this.tipAccount.toString()}`);
      
      return true;
    } catch (error) {
      console.error('❌ Configuration validation failed:', error);
      return false;
    }
  }
}

// Create singleton instance
export const appConfig = new AppConfig();

// Export individual values for backward compatibility
export const { 
  connection, 
  wallet, 
  payer, 
  walletconn, 
  rpcUrl: rpc, 
  tipAccount: tipAcct,
  rayLiqPoolv4: RayLiqPoolv4 
} = appConfig;
