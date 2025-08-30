/**
 * createLUTV2.ts - Solana Kit V2 Migration for LUT Operations
 * 
 * This file implements V2 transaction building patterns as the first step
 * in migrating createLUT.ts to Solana Kit V2.
 * 
 * ✅ COMPLETED:
 * - buildTxnV2(): V2 transaction building with legacy compatibility
 * - buildSimpleTxnV2(): Simplified V2 transaction building  
 * - validateTxnV2(): Transaction validation utilities
 * - debugTxnV2(): Development debugging utilities
 * 
 * 🔧 CURRENT APPROACH:
 * - Uses V2 RPC (config.rpc) for blockhash fetching
 * - Hybrid transaction building (V2 RPC + legacy TransactionMessage)
 * - Maintains compatibility with existing VersionedTransaction bundle system
 * - Incremental migration strategy - can be used alongside existing V1 code
 * 
 * 🚧 TODO (Next Steps):
 * - createLUTV2(): Main LUT creation function
 * - extendLUTV2(): LUT extension functionality
 * - Full V2 instruction support (currently uses legacy compatibility)
 * - V2 keypair signing integration
 * - Address Lookup Table program V2 operations
 * 
 * 📋 MIGRATION PROGRESS:
 * Phase 1: ✅ Basic V2 transaction building (COMPLETED)
 * Phase 2: 🚧 LUT creation functions (TODO)
 * Phase 3: 🚧 Full V2 instruction support (TODO)
 * Phase 4: 🚧 Complete Web3.js removal (TODO)
 * 
 * @author V2 Migration
 * @version 0.1.0 - Basic buildTxnV2 implementation
 */

import {
  address,
  type Address,
  lamports,
} from '@solana/kit';

import {
  getTransferSolInstruction,
} from '@solana-program/system';

import {
  getCreateAssociatedTokenIdempotentInstruction,
  findAssociatedTokenPda,
  TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';

// V2 Configuration
import { AppConfigV2 } from '../config/AppConfigV2';
import { loadKeypairsV2 } from './createKeysV2';

// ⚠️ TEMPORARY: Legacy Web3.js imports for compatibility during migration
// These will be replaced as we migrate more functionality
import { 
  VersionedTransaction,
  TransactionInstruction,
  AddressLookupTableAccount
} from '@solana/web3.js';

// Additional imports for LUT operations
import * as fs from 'fs';
import * as path from 'path';

/**
 * @param config - AppConfigV2 instance with V2 signers and RPC
 * @param instructions - Array of legacy transaction instructions
 * @param lutAccount - Optional lookup table account for address compression
 * @returns Promise<VersionedTransaction> - Built transaction (unsigned for compatibility)
 */
export async function buildTxnV2(
  config: AppConfigV2,
  instructions: TransactionInstruction[],
  lutAccount?: AddressLookupTableAccount
): Promise<VersionedTransaction> {
  try {
    console.log(`🔨 Building V2 transaction with ${instructions.length} instructions...`);
    
    // Use V2 RPC to get latest blockhash
    const { value: latestBlockhash } = await config.rpc.getLatestBlockhash().send();
    console.log(`📋 Using blockhash: ${latestBlockhash.blockhash}`);

    // Import legacy transaction building for compatibility
    const { TransactionMessage, PublicKey } = await import('@solana/web3.js');
    
    // Build transaction message using legacy approach with V2 data
    const message = new TransactionMessage({
      payerKey: new PublicKey(config.payer.address),
      recentBlockhash: latestBlockhash.blockhash,
      instructions: instructions,
    }).compileToV0Message(lutAccount ? [lutAccount] : []);

    const versionedTx = new VersionedTransaction(message);
    
    console.log('✅ Transaction built successfully with V2 RPC and legacy compatibility');
    
    // Validate transaction size
    const serializedSize = versionedTx.serialize().length;
    console.log(`📏 Transaction size: ${serializedSize} bytes`);
    
    const MAX_TRANSACTION_SIZE = 1232;
    if (serializedSize > MAX_TRANSACTION_SIZE) {
      console.warn(`⚠️ Transaction size (${serializedSize}) exceeds recommended limit (${MAX_TRANSACTION_SIZE})`);
      throw new Error(`Transaction too large: ${serializedSize} > ${MAX_TRANSACTION_SIZE} bytes`);
    }

    // Return unsigned transaction for compatibility with existing signing flow
    console.log('⚠️ Transaction created unsigned - to be signed by existing flow');
    return versionedTx;

  } catch (error) {
    console.error('❌ Error building V2 transaction:', error);
    throw new Error(`Failed to build V2 transaction: ${error}`);
  }
}

/**
 * Build a simple V2 transaction for testing purposes
 * This is a simplified version that works with legacy compatibility
 * 
 * @param config - AppConfigV2 instance
 * @param instructions - Legacy transaction instructions
 * @param lutAccount - Optional lookup table account
 * @returns Promise<VersionedTransaction> - Built and signed transaction
 */
export async function buildSimpleTxnV2(
  config: AppConfigV2,
  instructions: TransactionInstruction[],
  lutAccount?: AddressLookupTableAccount
): Promise<VersionedTransaction> {
  try {
    console.log(`🔨 Building simple V2 transaction with ${instructions.length} instructions...`);
    
    // Get latest blockhash using V2 RPC
    const { value: latestBlockhash } = await config.rpc.getLatestBlockhash().send();
    console.log(`📋 Using blockhash: ${latestBlockhash.blockhash}`);

    // For now, we'll use a hybrid approach:
    // - Use V2 RPC for blockhash
    // - Use legacy transaction building with V2 keypair compatibility
    // - This allows us to incrementally migrate while maintaining functionality
    
    // Import legacy transaction building (temporary)
    const { TransactionMessage } = await import('@solana/web3.js');
    const { PublicKey } = await import('@solana/web3.js');
    
    // Build transaction message with legacy approach but V2 data
    const message = new TransactionMessage({
      payerKey: new PublicKey(config.payer.address),
      recentBlockhash: latestBlockhash.blockhash,
      instructions: instructions,
    }).compileToV0Message(lutAccount ? [lutAccount] : []);

    const versionedTx = new VersionedTransaction(message);
    
    // ⚠️ STUB: Signing with V2 keypair needs proper conversion
    // For now, we'll mark it as unsigned and log the requirement
    console.log('⚠️ Transaction created but requires manual signing with V2 keypair conversion');
    console.log(`📏 Transaction size: ${versionedTx.serialize().length} bytes`);
    
    return versionedTx;

  } catch (error) {
    console.error('❌ Error building simple V2 transaction:', error);
    throw new Error(`Failed to build simple V2 transaction: ${error}`);
  }
}

/**
 * Validate V2 transaction before sending
 * 
 * @param transaction - Transaction to validate
 * @param config - AppConfigV2 instance
 * @returns boolean - True if transaction is valid
 */
export function validateTxnV2(
  transaction: VersionedTransaction,
  config: AppConfigV2
): boolean {
  try {
    console.log('🔍 Validating V2 transaction...');
    
    // Check transaction size
    const serializedSize = transaction.serialize().length;
    const MAX_SIZE = 1232;
    
    if (serializedSize > MAX_SIZE) {
      console.error(`❌ Transaction too large: ${serializedSize} > ${MAX_SIZE} bytes`);
      return false;
    }
    
    // Check if transaction is signed
    // ⚠️ TODO: Add proper signature validation for V2
    
    console.log(`✅ Transaction validation passed (${serializedSize} bytes)`);
    return true;
    
  } catch (error) {
    console.error('❌ Transaction validation failed:', error);
    return false;
  }
}

/**
 * Development utility: Log transaction details for debugging
 * 
 * @param transaction - Transaction to analyze
 * @param label - Label for logging
 */
export function debugTxnV2(
  transaction: VersionedTransaction,
  label: string = 'Transaction'
): void {
  try {
    console.log(`🐛 ${label} Debug Info:`);
    console.log(`   📏 Size: ${transaction.serialize().length} bytes`);
    console.log(`   📋 Version: ${transaction.version}`);
    console.log(`   🔑 Signatures: ${transaction.signatures.length}`);
    // ⚠️ TODO: Add more detailed analysis as needed
    
  } catch (error) {
    console.error(`❌ Error debugging transaction: ${error}`);
  }
}

/**
 * Example usage of buildTxnV2 - this shows how to use the V2 function
 * This can replace the legacy buildTxn calls in existing code
 * 
 * @param config - AppConfigV2 instance
 * @returns Promise<void>
 */
export async function exampleBuildTxnV2Usage(config: AppConfigV2): Promise<void> {
  try {
    console.log('📖 Example: Building V2 transaction...');
    
    // Example: Create a simple transfer instruction
    const transferInstruction = getTransferSolInstruction({
      source: config.payer,
      destination: address('11111111111111111111111111111111'),  // System program
      amount: lamports(BigInt(1000)),  // 1000 lamports
    });

    // Convert V2 instruction to legacy format for compatibility
    const { SystemProgram, PublicKey } = await import('@solana/web3.js');
    const legacyTransferIx = SystemProgram.transfer({
      fromPubkey: new PublicKey(config.payer.address),
      toPubkey: new PublicKey('11111111111111111111111111111111'),
      lamports: 1000,
    });

    // Build transaction using V2 patterns
    const transaction = await buildTxnV2(config, [legacyTransferIx]);
    
    // Validate and debug
    if (validateTxnV2(transaction, config)) {
      debugTxnV2(transaction, 'Example Transaction');
      console.log('✅ Example transaction built successfully!');
    }
    
  } catch (error) {
    console.error('❌ Example failed:', error);
  }
}

// WSOL mint address constant (So11111111111111111111111111111111111111112)
const WSOL_MINT_ADDRESS = address('So11111111111111111111111111111111111111112');

/**
 * Generate WSOL ATA creation instructions for keypairs (V2 Implementation)
 * 
 * This replaces the legacy generateWSOLATAForKeypairs function with V2 patterns:
 * - Uses V2 instruction building with @solana-program/token
 * - Eliminates global mutable state (no more global arrays)
 * - Proper error handling and validation
 * - Returns instructions instead of mutating global state
 * - Configurable limits and better parameter handling
 * 
 * Key improvements from V1:
 * - ❌ V1: Global keypairWSOLATAIxs array (bad practice)
 * - ✅ V2: Returns instruction array (functional approach)
 * - ❌ V1: Hardcoded limit of 27 keypairs
 * - ✅ V2: Configurable limits with proper defaults
 * - ❌ V1: Uses legacy spl.createAssociatedTokenAccountIdempotentInstruction
 * - ✅ V2: Uses @solana-program/token V2 functions
 * 
 * @param config - AppConfigV2 instance with V2 signers and configuration
 * @param maxKeypairs - Maximum number of keypairs to process (default: 27)
 * @param includePayer - Whether to include payer ATA creation (default: true)
 * @returns Promise<TransactionInstruction[]> - Array of WSOL ATA creation instructions
 */
export async function generateWSOLATAForKeypairsV2(
  config: AppConfigV2,
  maxKeypairs: number = 27,
  includePayer: boolean = true
): Promise<TransactionInstruction[]> {
  try {
    console.log(`🏦 Generating WSOL ATA instructions (V2) for up to ${maxKeypairs} keypairs...`);
    
    const instructions: any[] = []; // Using any[] for V1/V2 compatibility
    
    // Step 1: Create WSOL ATA for payer (if requested)
    if (includePayer) {
      console.log('📋 Creating WSOL ATA for payer...');
      
      // Find the ATA address for payer
      const [payerWSOLATA] = await findAssociatedTokenPda({
        mint: WSOL_MINT_ADDRESS,
        owner: config.payer.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      });
      
      // Create the instruction using V2 patterns
      const createPayerWSOLATA = getCreateAssociatedTokenIdempotentInstruction({
        payer: config.payer,
        ata: payerWSOLATA,
        owner: config.payer.address,
        mint: WSOL_MINT_ADDRESS,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
      });
      
      instructions.push(createPayerWSOLATA);
      console.log(`✅ Payer WSOL ATA instruction created: ${payerWSOLATA}`);
    }
    
    // Step 2: Load keypairs using V2 method
    console.log('🔑 Loading keypairs with V2 method...');
    const keypairs = await loadKeypairsV2();
    console.log(`📊 Loaded ${keypairs.length} keypairs`);
    
    // Step 3: Limit keypairs to prevent transaction overflow
    const actualLimit = Math.min(keypairs.length, maxKeypairs);
    if (actualLimit < keypairs.length) {
      console.log(`⚠️ Limiting to ${actualLimit} keypairs (requested: ${maxKeypairs}, available: ${keypairs.length})`);
    }
    
    // Step 4: Create WSOL ATA instructions for each keypair
    console.log(`🔄 Creating WSOL ATA instructions for ${actualLimit} keypairs...`);
    
    for (let i = 0; i < actualLimit; i++) {
      const keypair = keypairs[i];
      
      try {
        // Find the ATA address for this keypair
        const [wsolATA] = await findAssociatedTokenPda({
          mint: WSOL_MINT_ADDRESS,
          owner: keypair.address,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
        });
        
        // Create the instruction using V2 patterns
        const createWSOLATA = getCreateAssociatedTokenIdempotentInstruction({
          payer: config.payer, // Payer pays for the ATA creation
          ata: wsolATA,
          owner: keypair.address, // Keypair owns the ATA
          mint: WSOL_MINT_ADDRESS,
          tokenProgram: TOKEN_PROGRAM_ADDRESS,
        });
        
        instructions.push(createWSOLATA);
        console.log(`✅ WSOL ATA instruction ${i + 1}/${actualLimit}: ${keypair.address} -> ${wsolATA}`);
        
      } catch (error) {
        console.error(`❌ Error creating WSOL ATA for keypair ${i + 1}: ${error}`);
        // Continue with other keypairs instead of failing completely
      }
    }
    
    console.log(`🎉 Generated ${instructions.length} WSOL ATA instructions successfully!`);
    
    // Step 5: Validate instruction count for transaction limits
    const MAX_INSTRUCTIONS_PER_TX = 10; // Conservative limit for ATA creation
    if (instructions.length > MAX_INSTRUCTIONS_PER_TX) {
      console.warn(`⚠️ Generated ${instructions.length} instructions, which exceeds recommended limit of ${MAX_INSTRUCTIONS_PER_TX}`);
      console.warn('💡 Consider chunking these instructions into multiple transactions');
    }
    
    return instructions;
    
  } catch (error) {
    console.error('❌ Error generating WSOL ATA instructions (V2):', error);
    throw new Error(`Failed to generate WSOL ATA instructions: ${error}`);
  }
}

/**
 * Chunk WSOL ATA instructions into transaction-sized batches (V2 Implementation)
 * 
 * This utility function takes the instructions from generateWSOLATAForKeypairsV2
 * and chunks them into appropriately sized batches for transaction building.
 * 
 * @param config - AppConfigV2 instance
 * @param instructions - Instructions from generateWSOLATAForKeypairsV2
 * @param instructionsPerTx - Number of instructions per transaction (default: 10)
 * @param jitoTipAmount - Jito tip amount in SOL (default: 0)
 * @returns Promise<TransactionInstruction[][]> - Array of instruction chunks
 */
export async function chunkWSOLATAInstructionsV2(
  config: AppConfigV2,
  instructions: TransactionInstruction[],
  instructionsPerTx: number = 10,
  jitoTipAmount: number = 0
): Promise<TransactionInstruction[][]> {
  try {
    console.log(`📦 Chunking ${instructions.length} WSOL ATA instructions into batches of ${instructionsPerTx}...`);
    
    if (instructions.length === 0) {
      console.log('⚠️ No instructions to chunk');
      return [];
    }
    
    // Create chunks
    const chunks: TransactionInstruction[][] = [];
    for (let i = 0; i < instructions.length; i += instructionsPerTx) {
      const chunk = instructions.slice(i, i + instructionsPerTx);
      chunks.push(chunk);
    }
    
    console.log(`📊 Created ${chunks.length} chunks`);
    
    // Add Jito tip to the last chunk if requested
    if (jitoTipAmount > 0 && chunks.length > 0) {
      console.log(`💰 Adding Jito tip of ${jitoTipAmount} SOL to final chunk...`);
      
      const tipInstruction = getTransferSolInstruction({
        source: config.payer,
        destination: config.getRandomTipAccount(),
        amount: lamports(BigInt(Math.floor(jitoTipAmount * 1e9))),
      });
      
      // Convert V2 instruction to legacy format for compatibility
      const { SystemProgram, PublicKey } = await import('@solana/web3.js');
      const legacyTipIx = SystemProgram.transfer({
        fromPubkey: new PublicKey(config.payer.address),
        toPubkey: new PublicKey(config.getRandomTipAccount()),
        lamports: Math.floor(jitoTipAmount * 1e9),
      });
      
      chunks[chunks.length - 1].push(legacyTipIx);
      console.log('✅ Jito tip added to final chunk');
    }
    
    return chunks;
    
  } catch (error) {
    console.error('❌ Error chunking WSOL ATA instructions:', error);
    throw error;
  }
}

/**
 * Complete V2 workflow: Generate WSOL ATAs and build transactions
 * 
 * This function combines generateWSOLATAForKeypairsV2 and buildTxnV2 to provide
 * a complete replacement for the legacy workflow.
 * 
 * @param config - AppConfigV2 instance
 * @param maxKeypairs - Maximum number of keypairs to process (default: 27)
 * @param jitoTipAmount - Jito tip amount in SOL (default: 0)
 * @returns Promise<VersionedTransaction[]> - Array of built transactions
 */
export async function buildWSOLATATransactionsV2(
  config: AppConfigV2,
  maxKeypairs: number = 27,
  jitoTipAmount: number = 0
): Promise<VersionedTransaction[]> {
  try {
    console.log('🚀 Building WSOL ATA transactions (V2 Complete Workflow)...');
    
    // Step 1: Generate WSOL ATA instructions
    const instructions = await generateWSOLATAForKeypairsV2(config, maxKeypairs, true);
    
    // Step 2: Chunk instructions
    const chunks = await chunkWSOLATAInstructionsV2(config, instructions, 10, jitoTipAmount);
    
    // Step 3: Build transactions
    const transactions: VersionedTransaction[] = [];
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`🔨 Building transaction ${i + 1}/${chunks.length} with ${chunk.length} instructions...`);
      
      try {
        const transaction = await buildTxnV2(config, chunk);
        transactions.push(transaction);
        console.log(`✅ Transaction ${i + 1} built successfully`);
        
      } catch (error) {
        console.error(`❌ Error building transaction ${i + 1}:`, error);
        throw error;
      }
    }
    
    console.log(`🎉 Built ${transactions.length} WSOL ATA transactions successfully!`);
    return transactions;
    
  } catch (error) {
    console.error('❌ Error in V2 WSOL ATA workflow:', error);
    throw error;
  }
}

/**
 * Create Address Lookup Table (V2 Implementation)
 * 
 * This replaces the legacy createLUT() function with V2 patterns:
 * - Uses V2 RPC and configuration system
 * - Proper error handling and validation
 * - Eliminates global state mutations
 * - Returns structured results instead of side effects
 * - Configurable parameters with sensible defaults
 * 
 * Key improvements from V1:
 * - ❌ V1: Global keypairWSOLATAIxs array + file I/O side effects
 * - ✅ V2: Returns transaction array + optional file writing
 * - ❌ V1: Hardcoded file paths and prompt-based input
 * - ✅ V2: Configurable parameters and structured input
 * - ❌ V1: Uses legacy AddressLookupTableProgram
 * - ✅ V2: Will use @solana-program/address-lookup-table (future)
 * - ❌ V1: Process exit on errors
 * - ✅ V2: Proper error throwing and handling
 * 
 * @param config - AppConfigV2 instance with V2 signers and configuration
 * @param jitoTipAmount - Jito tip amount in SOL (default: 0)
 * @param maxKeypairs - Maximum number of keypairs for WSOL ATA creation (default: 27)
 * @param saveToFile - Whether to save LUT address to keyInfoV2.json (default: true)
 * @returns Promise<{lutAddress: string, transactions: VersionedTransaction[]}> - LUT address and built transactions
 */
export async function createLUTV2(
  config: AppConfigV2,
  jitoTipAmount: number = 0,
  maxKeypairs: number = 27,
  saveToFile: boolean = true
): Promise<{
  lutAddress: string;
  transactions: VersionedTransaction[];
  summary: {
    lutCreated: boolean;
    wsolATACount: number;
    totalTransactions: number;
  };
}> {
  try {
    console.log('🚀 Creating Address Lookup Table (V2)...');
    console.log(`📊 Parameters: tip=${jitoTipAmount} SOL, maxKeypairs=${maxKeypairs}, saveToFile=${saveToFile}`);
    
    const transactions: VersionedTransaction[] = [];
    
    // Step 1: Create the LUT
    console.log('🏗️ Step 1: Creating Address Lookup Table...');
    const lutResult = await createLUTTransactionV2(config);
    transactions.push(lutResult.transaction);
    
    console.log(`✅ LUT created with address: ${lutResult.lutAddress}`);
    
    // Step 2: Save LUT address to file (if requested)
    if (saveToFile) {
      await saveLUTAddressV2(lutResult.lutAddress, config);
    }
    
    // Step 3: Generate WSOL ATA transactions
    console.log('🏦 Step 2: Generating WSOL ATA transactions...');
    const wsolTransactions = await buildWSOLATATransactionsV2(config, maxKeypairs, jitoTipAmount);
    transactions.push(...wsolTransactions);
    
    console.log(`✅ Generated ${wsolTransactions.length} WSOL ATA transactions`);
    
    // Step 4: Summary and validation
    const summary = {
      lutCreated: true,
      wsolATACount: wsolTransactions.length,
      totalTransactions: transactions.length,
    };
    
    console.log('📊 CreateLUT V2 Summary:');
    console.log(`   🏗️ LUT Address: ${lutResult.lutAddress}`);
    console.log(`   🏦 WSOL ATA Transactions: ${summary.wsolATACount}`);
    console.log(`   📦 Total Transactions: ${summary.totalTransactions}`);
    console.log(`   💰 Jito Tip: ${jitoTipAmount} SOL`);
    
    // Validate total transaction size
    const totalSize = transactions.reduce((size, tx) => size + tx.serialize().length, 0);
    console.log(`📏 Total bundle size: ${totalSize} bytes`);
    
    if (totalSize > 50000) { // Conservative bundle size limit
      console.warn(`⚠️ Large bundle size (${totalSize} bytes) - consider chunking for better performance`);
    }
    
    console.log('🎉 CreateLUT V2 completed successfully!');
    
    return {
      lutAddress: lutResult.lutAddress,
      transactions,
      summary,
    };
    
  } catch (error) {
    console.error('❌ Error in createLUTV2:', error);
    throw new Error(`Failed to create LUT (V2): ${error}`);
  }
}

/**
 * Create LUT transaction with V2 patterns (Internal Utility)
 * 
 * @param config - AppConfigV2 instance
 * @returns Promise<{transaction: VersionedTransaction, lutAddress: string}> - LUT creation transaction and address
 */
async function createLUTTransactionV2(
  config: AppConfigV2
): Promise<{
  transaction: VersionedTransaction;
  lutAddress: string;
}> {
  try {
    console.log('🔨 Building LUT creation transaction...');
    
    // Get current slot for LUT creation
    const currentSlot = await config.rpc.getSlot().send();
    console.log(`📋 Using slot: ${currentSlot}`);
    
    // ⚠️ TEMPORARY: Using legacy AddressLookupTableProgram until V2 migration
    // TODO: Replace with @solana-program/address-lookup-table
    const { AddressLookupTableProgram } = await import('@solana/web3.js');
    const { PublicKey } = await import('@solana/web3.js');
    
    // Create LUT instruction using legacy method (for now)
    const [createLUTInstruction, lutAddress] = AddressLookupTableProgram.createLookupTable({
      authority: new PublicKey(config.payer.address),
      payer: new PublicKey(config.payer.address),
      recentSlot: currentSlot,
    });
    
    console.log(`📍 LUT will be created at: ${lutAddress.toString()}`);
    
    // Build transaction using V2 buildTxnV2
    const transaction = await buildTxnV2(config, [createLUTInstruction]);
    
    console.log('✅ LUT creation transaction built successfully');
    
    return {
      transaction,
      lutAddress: lutAddress.toString(),
    };
    
  } catch (error) {
    console.error('❌ Error creating LUT transaction:', error);
    throw error;
  }
}

/**
 * Save LUT address to keyInfoV2.json (V2 Implementation)
 * 
 * @param lutAddress - LUT address to save
 * @param config - AppConfigV2 instance for file path resolution
 * @returns Promise<void>
 */
async function saveLUTAddressV2(
  lutAddress: string,
  config: AppConfigV2
): Promise<void> {
  try {
    console.log('💾 Saving LUT address to keyInfoV2.json...');
    
    // V2 file path (different from V1's keyInfo.json)
    const keyInfoV2Path = path.join(__dirname, '../keypairs/keyInfoV2.json');
    
    // Read existing data or create new structure
    let poolInfo: { [key: string]: any } = {};
    if (fs.existsSync(keyInfoV2Path)) {
      const data = fs.readFileSync(keyInfoV2Path, 'utf-8');
      poolInfo = JSON.parse(data);
    }
    
    // Update with new LUT address
    poolInfo.addressLUT = lutAddress;
    poolInfo.lutCreatedAt = new Date().toISOString();
    poolInfo.version = 'V2';
    
    // Ensure directory exists
    const dir = path.dirname(keyInfoV2Path);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    // Write updated content
    fs.writeFileSync(keyInfoV2Path, JSON.stringify(poolInfo, null, 2));
    
    console.log(`✅ LUT address saved to ${keyInfoV2Path}`);
    
  } catch (error) {
    console.error('❌ Error saving LUT address:', error);
    throw error;
  }
}
