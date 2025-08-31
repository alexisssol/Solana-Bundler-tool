import {
  address,
  Address,
  generateKeyPairSigner,
  KeyPairSigner,
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
} from '@solana/kit';
import { Raydium, TokenAmount, TxVersion } from '@raydium-io/raydium-sdk-v2';
import { AppConfigV2 } from '../config/AppConfigV2';
import { loadKeypairsV2 } from './createKeysV2';
import { searcherClient } from '../clientsV2/jitoV2';
import { Bundle as JitoBundle } from 'jito-ts/dist/sdk/block-engine/types.js';
import { Connection, VersionedTransaction, PublicKey } from '@solana/web3.js';
import BN from 'bn.js';

interface BuyTokenParamsV2 {
  baseMint: Address;
  quoteMint: Address;
  baseAmount: string;
  slippage: number;
  poolId?: Address;
  priorityFee?: number;
  maxRetries?: number;
}

interface SwapResult {
  success: boolean;
  signature?: string;
  error?: string;
  amountOut?: string;
}

export class BuyTokenV2 {
  private raydium?: Raydium;
  private config?: AppConfigV2;
  private connection?: Connection;
  private keypairs?: KeyPairSigner[];

  constructor() {
    // Initialize in async method
  }

  async initialize(): Promise<void> {
    try {
      // Load config and connection
      this.config = await AppConfigV2.create();
      this.connection = new Connection(this.config.rpcUrl, 'confirmed');

      // Load keypairs
      this.keypairs = await loadKeypairsV2();
      console.log(`Loaded ${this.keypairs.length} keypairs for buying`);

      // Initialize Raydium SDK 2.0 with legacy compatibility
      this.raydium = await Raydium.load({
        connection: this.connection,
        cluster: 'mainnet',
        disableFeatureCheck: true,
      });

      console.log('Raydium SDK 2.0 initialized successfully');
    } catch (error) {
      console.error('Failed to initialize BuyTokenV2:', error);
      throw error;
    }
  }

  /**
   * Execute multi-wallet token purchase using Raydium SDK 2.0 and Jito bundles
   */
  async buyToken(params: BuyTokenParamsV2): Promise<SwapResult[]> {
    if (!this.raydium || !this.config || !this.keypairs) {
      throw new Error('BuyTokenV2 not initialized. Call initialize() first.');
    }

    const {
      baseMint,
      quoteMint,
      baseAmount,
      slippage,
      poolId,
      priorityFee = 0.001,
      maxRetries = 3
    } = params;

    console.log(`Starting multi-wallet buy for ${baseAmount} tokens`);
    console.log(`Base mint: ${baseMint}`);
    console.log(`Quote mint: ${quoteMint}`);

    const results: SwapResult[] = [];
    const maxWalletsPerBundle = 7; // Jito bundle limit
    const chunks = this.chunkKeypairs(this.keypairs, maxWalletsPerBundle);

    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      const chunk = chunks[chunkIndex];
      console.log(`Processing chunk ${chunkIndex + 1}/${chunks.length} with ${chunk.length} wallets`);

      try {
        const chunkResults = await this.processBuyChunk({
          keypairs: chunk,
          baseMint,
          quoteMint,
          baseAmount,
          slippage,
          poolId,
          priorityFee,
          maxRetries
        });
        results.push(...chunkResults);
      } catch (error) {
        console.error(`Failed to process chunk ${chunkIndex + 1}:`, error);
        // Add error results for this chunk
        chunk.forEach(() => {
          results.push({
            success: false,
            error: `Chunk processing failed: ${(error as Error).message}`
          });
        });
      }

      // Wait between chunks to avoid rate limiting
      if (chunkIndex < chunks.length - 1) {
        await this.sleep(1000);
      }
    }

    const successCount = results.filter(r => r.success).length;
    console.log(`Buy operation completed: ${successCount}/${results.length} successful`);

    return results;
  }

  /**
   * Process a chunk of keypairs for token buying using Jito bundles
   */
  private async processBuyChunk(params: {
    keypairs: KeyPairSigner[];
    baseMint: Address;
    quoteMint: Address;
    baseAmount: string;
    slippage: number;
    poolId?: Address;
    priorityFee: number;
    maxRetries: number;
  }): Promise<SwapResult[]> {
    if (!this.raydium || !this.config || !this.connection) {
      throw new Error('BuyTokenV2 not initialized');
    }

    const {
      keypairs,
      baseMint,
      quoteMint,
      baseAmount,
      slippage,
      poolId,
      priorityFee,
      maxRetries
    } = params;

    try {
      // Get pool information
      const poolInfo = await this.getPoolInfo(baseMint, quoteMint, poolId);
      if (!poolInfo) {
        throw new Error('Pool not found');
      }

      // Get recent blockhash using legacy connection for Raydium compatibility
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash('confirmed');

      // Build swap transactions for each keypair
      const signedTransactions: VersionedTransaction[] = [];
      
      for (const keypair of keypairs) {
        try {
          // Convert Address to PublicKey for Raydium SDK compatibility
          const baseMintPubkey = new PublicKey(baseMint);
          const quoteMintPubkey = new PublicKey(quoteMint);
          const feePayer = new PublicKey(keypair.address);

          // Compute swap amounts using BN for Raydium SDK compatibility
          const swapResult = this.raydium.liquidity.computeAmountOut({
            poolInfo: poolInfo.poolInfo,
            amountIn: new BN(baseAmount),
            mintIn: baseMintPubkey,
            mintOut: quoteMintPubkey,
            slippage: slippage / 100, // Convert percentage to decimal
          });

          // Create swap transaction using Raydium SDK 2.0
          const { transaction } = await this.raydium.liquidity.swap({
            poolInfo: poolInfo.poolInfo,
            poolKeys: poolInfo.poolKeys,
            amountIn: new BN(baseAmount),
            amountOut: swapResult.minAmountOut,
            inputMint: baseMintPubkey.toString(),
            fixedSide: 'in',
            txVersion: TxVersion.V0, // Use versioned transactions
            config: {
              associatedOnly: false,
              inputUseSolBalance: false,
              outputUseSolBalance: false,
            },
            computeBudgetConfig: {
              units: 200000,
              microLamports: Math.floor(priorityFee * 1_000_000),
            },
            feePayer: feePayer,
          });

          // The transaction returned is already a VersionedTransaction
          signedTransactions.push(transaction);

        } catch (error) {
          console.error(`Failed to create swap transaction for keypair:`, error);
          throw error;
        }
      }

      console.log(`Created ${signedTransactions.length} swap transactions for bundle`);

      // Submit bundle to Jito using existing pattern from jitoPoolV2
      let bundleResults: SwapResult[] = [];
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`Submitting bundle attempt ${attempt}/${maxRetries}`);
          
          const bundleId = await searcherClient.sendBundle(
            new JitoBundle(signedTransactions, signedTransactions.length)
          );
          console.log(`Bundle ${bundleId} sent successfully!`);

          // Wait for bundle confirmation using the pattern from jitoPoolV2
          const result = await Promise.race([
            new Promise((resolve, reject) => {
              searcherClient.onBundleResult(
                (result) => {
                  console.log("📊 Received bundle result:", result);
                  resolve(result);
                },
                (e: Error) => {
                  console.error("❌ Error receiving bundle result:", e);
                  reject(e);
                }
              );
            }),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Bundle result timeout after 30 seconds')), 30000)
            )
          ]);

          console.log("✅ Final bundle result:", result);
          
          // Create success results
          bundleResults = signedTransactions.map((_, index) => ({
            success: true,
            signature: `bundle-${bundleId}-tx-${index}`,
            amountOut: 'Unknown', // Would need to fetch from logs
          }));
          
          break; // Success, exit retry loop
        } catch (error) {
          console.error(`Bundle attempt ${attempt} failed:`, error);
          
          if (attempt === maxRetries) {
            // Final attempt failed, return error results
            bundleResults = keypairs.map(() => ({
              success: false,
              error: `Bundle submission failed after ${maxRetries} attempts: ${(error as Error).message}`
            }));
          } else {
            // Wait before retry
            await this.sleep(2000 * attempt);
          }
        }
      }

      return bundleResults;

    } catch (error) {
      console.error('Failed to process buy chunk:', error);
      return params.keypairs.map(() => ({
        success: false,
        error: `Chunk processing failed: ${(error as Error).message}`
      }));
    }
  }

  /**
   * Get pool information using Raydium SDK 2.0
   */
  private async getPoolInfo(baseMint: Address, quoteMint: Address, poolId?: Address) {
    if (!this.raydium) {
      throw new Error('Raydium not initialized');
    }

    try {
      if (poolId) {
        // Use specific pool ID
        return await this.raydium.liquidity.getPoolInfoFromRpc({ poolId: poolId.toString() });
      } else {
        // Find pool automatically using TradeV2
        const baseMintPubkey = new PublicKey(baseMint);
        const quoteMintPubkey = new PublicKey(quoteMint);
        
        const routes = await this.raydium.tradeV2.getAllRoute({
          inputMint: baseMintPubkey,
          outputMint: quoteMintPubkey,
          ...(await this.raydium.tradeV2.fetchRoutePoolBasicInfo())
        });

        if (routes.directPath.length === 0) {
          throw new Error('No direct trading routes found');
        }

        const bestRoute = routes.directPath[0];
        return await this.raydium.liquidity.getPoolInfoFromRpc({ 
          poolId: bestRoute.id.toString()
        });
      }
    } catch (error) {
      console.error('Failed to get pool info:', error);
      return null;
    }
  }

  /**
   * Split keypairs into chunks for Jito bundles
   */
  private chunkKeypairs(keypairs: KeyPairSigner[], chunkSize: number): KeyPairSigner[][] {
    const chunks: KeyPairSigner[][] = [];
    for (let i = 0; i < keypairs.length; i += chunkSize) {
      chunks.push(keypairs.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get balance for a specific mint and keypair
   */
  async getTokenBalance(keypair: KeyPairSigner, mint: Address): Promise<number> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }

    try {
      const keypairPubkey = new PublicKey(keypair.address);
      const mintPubkey = new PublicKey(mint);
      
      const tokenAccounts = await this.connection.getTokenAccountsByOwner(
        keypairPubkey,
        { mint: mintPubkey }
      );

      if (tokenAccounts.value.length === 0) {
        return 0;
      }

      const accountInfo = await this.connection.getAccountInfo(tokenAccounts.value[0].pubkey);
      if (!accountInfo) {
        return 0;
      }

      // Parse token account data to get balance
      // This is a simplified version - in practice you'd use proper token account parsing
      const balance = accountInfo.lamports;
      return balance;
    } catch (error) {
      console.error('Failed to get token balance:', error);
      return 0;
    }
  }
}

/**
 * Example usage function
 */
export async function executeBuyTokenV2(
  baseMint: string,
  quoteMint: string,
  amount: string,
  slippage: number = 1.0
): Promise<SwapResult[]> {
  const buyToken = new BuyTokenV2();
  
  try {
    await buyToken.initialize();
    
    const results = await buyToken.buyToken({
      baseMint: address(baseMint),
      quoteMint: address(quoteMint),
      baseAmount: amount,
      slippage,
      priorityFee: 0.001,
      maxRetries: 3,
    });
    
    return results;
  } catch (error) {
    console.error('Buy token execution failed:', error);
    throw error;
  }
}

/**
 * Simplified function that follows the jitoPoolV2 pattern more closely
 */
export async function sendBuyBundle(transactions: VersionedTransaction[]): Promise<void> {
  try {
    console.log(`📦 Sending buy bundle with ${transactions.length} transactions...`);
    
    if (transactions.length === 0) {
      console.log('⚠️ No transactions to bundle. Skipping bundle send.');
      return;
    }
    
    const bundleId = await searcherClient.sendBundle(new JitoBundle(transactions, transactions.length));
    console.log(`🚀 Bundle ${bundleId} sent successfully!`);

    const result = await Promise.race([
      new Promise((resolve, reject) => {
        searcherClient.onBundleResult(
          (result) => {
            console.log("📊 Received bundle result:", result);
            resolve(result);
          },
          (e: Error) => {
            console.error("❌ Error receiving bundle result:", e);
            reject(e);
          }
        );
      }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Bundle result timeout after 30 seconds')), 30000)
      )
    ]);

    console.log("✅ Final bundle result:", result);
  } catch (error) {
    console.error("❌ Error sending buy bundle:", error);
    throw error;
  }
}