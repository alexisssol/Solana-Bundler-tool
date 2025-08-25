import { 
  createSolanaRpc, 
  createSolanaRpcSubscriptions,
  address,
  generateKeyPairSigner,
  createKeyPairSignerFromBytes,
  type Address,
  type Rpc,
  type SolanaRpcApi,
  type SolanaRpcSubscriptionsApi,
  type RpcSubscriptions,
  type KeyPairSigner,
  type Commitment,
} from '@solana/kit';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

export class AppConfigV2 {
  // RPC Configuration
  public readonly rpcUrl: string;
  public readonly rpcRequestsPerSecond: number;
  public readonly rpcMaxBatchSize: number;
  public readonly rpc: Rpc<SolanaRpcApi>;
  public readonly rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>;

  // Keypairs (Solana Kit Signers)
  public readonly wallet: KeyPairSigner;
  public readonly payer: KeyPairSigner;

  // Jito Configuration
  public readonly tipAccount: Address;
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
  public readonly rayLiqPoolv4: Address;

  // Tip Accounts Pool
  public readonly tipAccounts: Address[];

  private constructor(
    rpcUrl: string,
    rpc: Rpc<SolanaRpcApi>,
    rpcSubscriptions: RpcSubscriptions<SolanaRpcSubscriptionsApi>,
    wallet: KeyPairSigner,
    payer: KeyPairSigner
  ) {
    // RPC Configuration
    this.rpcUrl = rpcUrl;
    this.rpcRequestsPerSecond = parseInt(process.env.RPC_REQUESTS_PER_SECOND || '0');
    this.rpcMaxBatchSize = parseInt(process.env.RPC_MAX_BATCH_SIZE || '20');
    this.rpc = rpc;
    this.rpcSubscriptions = rpcSubscriptions;

    // Keypairs
    this.wallet = wallet;
    this.payer = payer;

    // Jito Configuration
    this.tipAccount = address(process.env.TIP_ACCOUNT || 'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY');
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
    this.rayLiqPoolv4 = address(process.env.RAYDIUM_LIQUIDITY_POOL_V4 || '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8');

    // Initialize tip accounts pool
    this.tipAccounts = this.initializeTipAccounts();
  }

  // Static factory method for async initialization
  public static async create(): Promise<AppConfigV2> {
    // Validate required environment variables
    AppConfigV2.validateRequiredEnvVars();

    // RPC Configuration
    const rpcUrl = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
    const wsUrl = rpcUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    
    const rpc = createSolanaRpc(rpcUrl);
    const rpcSubscriptions = createSolanaRpcSubscriptions(wsUrl);

    // Load keypairs from environment variables
    const wallet = await AppConfigV2.loadKeypairFromEnv('POOL_CREATOR_PRIVATE_KEY');
    const payer = await AppConfigV2.loadKeypairFromEnv('FEE_PAYER_PRIVATE_KEY');

    return new AppConfigV2(rpcUrl, rpc, rpcSubscriptions, wallet, payer);
  }

  private static validateRequiredEnvVars(): void {
    const requiredVars = [
      'POOL_CREATOR_PRIVATE_KEY',
      'FEE_PAYER_PRIVATE_KEY'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`);
    }
  }

  private static async loadKeypairFromEnv(envVarName: string): Promise<KeyPairSigner> {
    const privateKeyBase64 = process.env[envVarName];
    
    if (!privateKeyBase64) {
        throw new Error(`Environment variable ${envVarName} is required`);
    }

    try {
        // Convert base64 private key to bytes
        const privateKeyBytes = Uint8Array.from(Buffer.from(privateKeyBase64, 'base64'));
        
        // Create KeyPairSigner from bytes
        return await createKeyPairSignerFromBytes(privateKeyBytes);
    } catch (error) {
        throw new Error(`Invalid private key format in ${envVarName}: ${error}`);
    }
  }

  private static async loadKeypairFromFile(filePath: string): Promise<KeyPairSigner> {
    try {
      const fullPath = path.resolve(filePath);
      if (!fs.existsSync(fullPath)) {
        throw new Error(`Keypair file not found: ${fullPath}`);
      }

      const secretKeyArray = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
      const secretKeyBytes = new Uint8Array(secretKeyArray);
      
      return await createKeyPairSignerFromBytes(secretKeyBytes);
    } catch (error) {
      throw new Error(`Failed to load keypair from ${filePath}: ${error}`);
    }
  }

  private initializeTipAccounts(): Address[] {
    const tipAccountStrings = [
      '96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5',
      'HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe',
      'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
      'ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49',
      'DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh',
      'ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt',
      'DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL',
      '3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT',
    ];

    return tipAccountStrings.map((pubkeyString) => address(pubkeyString));
  }

  public getRandomTipAccount(): Address {
    return this.tipAccounts[Math.floor(Math.random() * this.tipAccounts.length)];
  }

  public async getAuthKeypair(): Promise<KeyPairSigner> {
    const authKeypairPath = process.env.AUTH_KEYPAIR_PATH || './blockengine.json';
    return await AppConfigV2.loadKeypairFromFile(authKeypairPath);
  }

  // Utility method to validate configuration
  public async validateConfig(): Promise<boolean> {
    try {
      // Test RPC connection
      const commitment: Commitment = "processed";
      const latestBlockhash = await this.rpc.getLatestBlockhash({ commitment }).send();
      
      // Validate keypairs (addresses should be defined)
      if (!this.wallet.address || !this.payer.address) {
        throw new Error('Invalid keypairs');
      }

      console.log('✅ Configuration validated successfully (Solana Kit V2)');
      console.log(`🌐 RPC URL: ${this.rpcUrl}`);
      console.log(`🔑 Pool Creator: ${this.wallet.address}`);
      console.log(`💰 Fee Payer: ${this.payer.address}`);
      console.log(`🎯 Tip Account: ${this.tipAccount}`);
      
      return true;
    } catch (error) {
      console.error('❌ Configuration validation failed:', error);
      return false;
    }
  }

  // Helper method for backward compatibility - get wallet address
  public get walletAddress(): Address {
    return this.wallet.address;
  }

  // Helper method for backward compatibility - get payer address
  public get payerAddress(): Address {
    return this.payer.address;
  }
}

// Note: Since Solana Kit requires async initialization, we cannot create a singleton instance
// like in the original AppConfig. Instead, users should call AppConfigV2.create()
// and manage the instance themselves.

// Export factory method for easier use
export const createAppConfigV2 = () => AppConfigV2.create();
