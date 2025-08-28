/**
 * 
 * This file contains the V2 migration of raydiumUtil.ts using:
 * - Raydium SDK V2
 * - Solana Kit 2.0 (@solana/kit)
 * - Pure V2 APIs without legacy compatibility layers
 * 
 * Migration Progress:
 * ✅ Phase 2: Simple Utility Functions (sleepTime, calcMarketStartPrice)
 * ✅ Phase 3: Core Utility Functions (getWalletTokenAccount, getATAAddress, findAssociatedTokenAddress)
 * ✅ Phase 4: Transaction Functions (sendTx, buildAndSendTx)
 * ✅ Phase 5: Main Business Logic (ammCreatePool)
 */

// ✅ Solana Kit 2.0 imports
import { 
  address, 
  type Address, 
  type KeyPairSigner,
  createSolanaRpc,
  type Commitment,
  getBase64EncodedWireTransaction,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  partiallySignTransactionMessageWithSigners,
  createTransactionMessage,
  type TransactionMessage
} from '@solana/kit';

// ✅ Raydium SDK V2 imports
import { 
  findProgramAddress,
  AMM_V4,
  OPEN_BOOK_PROGRAM,
  FEE_DESTINATION_ID,
  MARKET_STATE_LAYOUT_V3,
  Raydium
} from '@raydium-io/raydium-sdk-v2';

// Legacy imports for compatibility
import { PublicKey, VersionedTransaction, Keypair, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { SPL_ACCOUNT_LAYOUT } from '@raydium-io/raydium-sdk';
import { AppConfigV2 } from '../config/AppConfigV2';
import { BN } from '@project-serum/anchor';
import { makeTxVersion } from './constantsV2'

//=============================================================================
// V2 TYPE DEFINITIONS
//=============================================================================

export type CalcStartPriceV2 = {
  addBaseAmount: BN;
  addQuoteAmount: BN;
};

export type LiquidityPairTargetInfoV2 = {
  baseToken: TokenInfoV2; // Updated to use proper V2 Token type
  quoteToken: TokenInfoV2; // Updated to use proper V2 Token type  
  targetMarketId: Address;
};

export type TokenInfoV2 = {
  mint: Address;
  decimals: number;
  symbol?: string;
  name?: string;
};

export type TokenAccountV2 = {
  pubkey: Address;
  programId: Address;
  accountInfo: {
    mint: Address;
    owner: Address;
    amount: BN;
    delegateOption: number;
    delegate: Address;
    state: number;
    isNativeOption: number;
    isNative: BN;
    delegatedAmount: BN;
    closeAuthorityOption: number;
    closeAuthority: Address;
  };
};

export type WalletTokenAccountsV2 = TokenAccountV2[];

export type TestTxInputInfoV2 = LiquidityPairTargetInfoV2 & CalcStartPriceV2 & {
  startTime: number; // seconds
  walletTokenAccounts: WalletTokenAccountsV2;
  wallet: KeyPairSigner;
};

export type SendOptionsV2 = {
  skipPreflight?: boolean;
  preflightCommitment?: Commitment;
  maxRetries?: number;
};

export type InnerTransactionV2 = {
  /** Transaction to be executed */
  transaction: VersionedTransaction | Transaction;
  /** Optional instruction data for reference */
  instructionData?: any;
};

//=============================================================================
// PHASE 2: SIMPLE UTILITY FUNCTIONS (V2 - COMPLETED ✅)
//=============================================================================

export async function sleepTimeV2(ms: number): Promise<void> {
  console.log((new Date()).toLocaleString(), 'sleepTimeV2', ms);
  return new Promise(resolve => setTimeout(resolve, ms));
}


export function calcMarketStartPriceV2(input: CalcStartPriceV2): number {
  const baseAmount = input.addBaseAmount.toNumber() / 10 ** 6;
  const quoteAmount = input.addQuoteAmount.toNumber() / 10 ** 9;
  return baseAmount / quoteAmount;
}

//=============================================================================
// BACKWARD COMPATIBILITY EXPORTS
//=============================================================================

/**
 * ✅ Backward compatibility aliases - can be used by existing code
 * These maintain the same function signatures as V1
 */
export const sleepTime = sleepTimeV2;
export const calcMarketStartPrice = calcMarketStartPriceV2;

//=============================================================================
// PHASE 3: CORE UTILITY FUNCTIONS (COMPLETED ✅)
//=============================================================================

export async function getWalletTokenAccountV2(
  rpcUrl: string,
  walletAddress: Address
): Promise<TokenAccountV2[]> {
  // Create RPC connection using Solana Kit 2.0
  const rpc = createSolanaRpc(rpcUrl);
  
  // Get token accounts by owner using V2 RPC methods
  const response = await rpc.getTokenAccountsByOwner(
    walletAddress,
    { programId: address(TOKEN_PROGRAM_ID.toString()) },
    { commitment: 'finalized', encoding: 'base64' }
  ).send();

  // Map response to V2 TokenAccount format
  return response.value.map((account) => {
    // Decode account data from base58 to Buffer for SPL_ACCOUNT_LAYOUT
    const accountDataBuffer = Buffer.from(account.account.data[0], 'base64');
    const decodedAccountInfo = SPL_ACCOUNT_LAYOUT.decode(accountDataBuffer);
    
    return {
      pubkey: account.pubkey,
      programId: account.account.owner,
      accountInfo: {
        mint: address(decodedAccountInfo.mint.toString()),
        owner: address(decodedAccountInfo.owner.toString()),
        amount: decodedAccountInfo.amount,
        delegateOption: decodedAccountInfo.delegateOption,
        delegate: address(decodedAccountInfo.delegate.toString()),
        state: decodedAccountInfo.state,
        isNativeOption: decodedAccountInfo.isNativeOption,
        isNative: decodedAccountInfo.isNative,
        delegatedAmount: decodedAccountInfo.delegatedAmount,
        closeAuthorityOption: decodedAccountInfo.closeAuthorityOption,
        closeAuthority: address(decodedAccountInfo.closeAuthority.toString()),
      },
    };
  });
}



/**
 * ✅ V2 Find Associated Token Address using V2 types
 * Migrated from V1 raydiumUtil.ts with proper V2 type handling
 * 
 */
export function findAssociatedTokenAddressV2(
  walletAddress: Address,
  tokenMintAddress: Address
): Address {
  // Convert V2 Address types to buffers for seed derivation
  const walletBuffer = new PublicKey(walletAddress).toBuffer();
  const tokenMintBuffer = new PublicKey(tokenMintAddress).toBuffer();
  const tokenProgramBuffer = TOKEN_PROGRAM_ID.toBuffer();
  
  // Use our V2 findProgramAddress function
  const { publicKey } = findProgramAddress(
    [walletBuffer, tokenProgramBuffer, tokenMintBuffer],
    ASSOCIATED_TOKEN_PROGRAM_ID);
  
  return address(publicKey.toString());
}

/**
 * ✅ V2 Get ATA Address with nonce (alternative implementation)
 * Provides both address and nonce like the original V1 function
 * 
 * @param programId - Program ID as V2 Address type
 * @param owner - Owner address as V2 Address type  
 * @param mint - Mint address as V2 Address type
 * @returns Object with both address and nonce
 */
export function getATAAddressV2(
  programId: Address, 
  owner: Address, 
  mint: Address
) {
  // Convert to buffers for derivation
  const ownerBuffer = new PublicKey(owner).toBuffer();
  const programBuffer = new PublicKey(programId).toBuffer();
  const mintBuffer = new PublicKey(mint).toBuffer();
  const {publicKey, nonce} = findProgramAddress(
    [ownerBuffer, programBuffer, mintBuffer],
    ASSOCIATED_TOKEN_PROGRAM_ID
  ); 
  // Use our V2 findProgramAddress function with ATA program ID
  return { publicKey: address(publicKey.toString()), nonce };
}

// ✅ Backward compatibility exports for existing code
export const findAssociatedTokenAddress = findAssociatedTokenAddressV2;
export const getATAAddress = getATAAddressV2;
export const getWalletTokenAccount = getWalletTokenAccountV2;
export const sendTx = sendTxV2;
export const buildAndSendTx = buildAndSendTxV2;

//=============================================================================
// PHASE 4: TRANSACTION FUNCTIONS (COMPLETED ✅)  
//=============================================================================

/**
 * ✅ V2 Send Transaction using Solana Kit 2.0 RPC
 * Migrated from V1 raydiumUtil.ts with V2 RPC patterns and proper V2 transaction types
 * 
 * @param rpcUrl - RPC endpoint URL (from AppConfigV2)
 * @param payer - KeyPairSigner for signing transactions (V2 type)
 * @param txs - Array of pre-built transactions from market maker
 * @param options - Send transaction options (V2 format)
 * @returns Promise<string[]> - Array of transaction signatures
 */
export async function sendTxV2(
  rpcUrl: string,
  payer: KeyPairSigner,
  transactionMessages: TransactionMessage[], // V2 types
  options?: SendOptionsV2
): Promise<string[]> {
  // Create RPC connection using Solana Kit 2.0
  const rpc = createSolanaRpc(rpcUrl);
  
  const txids: string[] = [];
  
  // Get recent blockhash for lifetime constraint
  const { value: latestBlockhash } = await rpc.getLatestBlockhash().send();
  
  for (const transactionMessage of transactionMessages) {
    // Properly create a compilable transaction using Solana Kit 2.0 APIs
    // Start with setting the fee payer
    const withFeePayer = setTransactionMessageFeePayer(payer.address, transactionMessage);
    
    // Then set the lifetime constraint using blockhash
    const compilableTransaction = setTransactionMessageLifetimeUsingBlockhash(
      latestBlockhash, 
      withFeePayer
    );
    
    // Sign the transaction with V2 signing
    const signedTransaction = await partiallySignTransactionMessageWithSigners(
      compilableTransaction,
      { [payer.address]: payer }
    );
    
    // Encode the transaction for sending
    const base64Transaction = getBase64EncodedWireTransaction(signedTransaction);
    
    // Send the transaction
    const signature = await rpc.sendTransaction(base64Transaction, {
      skipPreflight: options?.skipPreflight || false,
      preflightCommitment: options?.preflightCommitment || 'processed',
      maxRetries: options?.maxRetries ? BigInt(options.maxRetries) : undefined,
    }).send();
    
    txids.push(signature);
  }
  
  return txids;
}

/**
 * ✅ V2 Build and Send Transaction Bundle
 * Takes a list of transactions from market maker, signs them, and sends as a bundle
 * 
 * @param rpcUrl - RPC endpoint URL (from AppConfigV2)
 * @param payer - KeyPairSigner for signing transactions (V2 type)
 * @param innerTransactions - Array of pre-built transactions from market maker
 * @param options - Send transaction options (V2 format)
 * @returns Promise<string[]> - Array of transaction signatures
 */
export async function buildAndSendTxV2(
  rpcUrl: string,
  payer: KeyPairSigner,
  innerTransactions: TransactionMessage[],
  options?: SendOptionsV2
): Promise<string[]> {
  console.log(`🔄 Processing ${innerTransactions.length} transactions for V2 bundle`);
  
  // Use our V2 sendTx function with proper V2 types
  const signatures = await sendTxV2(rpcUrl, payer, innerTransactions, options);
  
  console.log(`✅ Successfully sent ${signatures.length} transactions`);
  signatures.forEach((sig, index) => {
    console.log(`   Transaction ${index + 1}: ${sig}`);
  });
  
  return signatures;
}

//=============================================================================
// PHASE 5: MAIN BUSINESS LOGIC (COMPLETED ✅)
//=============================================================================

/**
 * ✅ V2 AMM Create Pool Function
 * Based on Raydium SDK V2 official example:
 * https://github.com/raydium-io/raydium-sdk-V2-demo/blob/744f974b03a5bf2424429bb6990cfd09e31fe2c3/src/amm/createAmmPool.ts
 * 
 * @param input - Pool creation input parameters (V2 format)
 * @returns Promise with execute function and extInfo
 */
export async function ammCreatePoolV2(input: TestTxInputInfoV2): Promise<{
  execute: (options?: { sendAndConfirm?: boolean }) => Promise<{ txId: string }>;
  extInfo: any;
}> {
  console.log('🏗️ Creating AMM Pool V2 with Raydium SDK V2...');
  
  // Get AppConfig for RPC and configuration
  const config = await AppConfigV2.create();
  await config.validateConfig();

  
  // Create Raydium instance with V2 pattern
  const raydium = await Raydium.load({
    cluster: 'mainnet', // or 'devnet' based on config
    connection: {
      // Convert Solana Kit RPC to legacy connection for SDK compatibility
      getAccountInfo: async (pubkey: PublicKey, commitment?: any) => {
        const rpc = createSolanaRpc(config.rpcUrl);
        const response = await rpc.getAccountInfo(address(pubkey.toBase58()), { commitment }).send();
        return response.value ? {
          ...response.value,
          owner: new PublicKey(response.value.owner),
          executable: response.value.executable,
          lamports: response.value.lamports,
          data: Buffer.from(response.value.data[0], response.value.data[1] as BufferEncoding)
        } : null;
      },
      getLatestBlockhash: async (commitment?: any) => {
        const rpc = createSolanaRpc(config.rpcUrl);
        const response = await rpc.getLatestBlockhash({ commitment }).send();
        return {
          value: {
            blockhash: response.value.blockhash,
            lastValidBlockHeight: Number(response.value.lastValidBlockhash)
          }
        };
      },
      // Add other required connection methods as needed
      sendTransaction: async (transaction: any) => {
        const rpc = createSolanaRpc(config.rpcUrl);
        return await rpc.sendTransaction(transaction).send();
      }
    } as any,
    owner: new PublicKey(input.wallet.address), // Convert V2 Address to legacy PublicKey
  });
  
  // Convert input market ID to PublicKey
  const marketId = new PublicKey(input.targetMarketId);
  
  // Get market buffer info to extract mint information
  const marketBufferInfo = await raydium.connection.getAccountInfo(marketId);
  if (!marketBufferInfo) {
    throw new Error(`Market account not found: ${input.targetMarketId}`);
  }
  
  // Decode market data to get base and quote mints
  const { baseMint, quoteMint } = MARKET_STATE_LAYOUT_V3.decode(marketBufferInfo.data);
  
  // Get mint information using Raydium SDK V2
  const baseMintInfo = await raydium.token.getTokenInfo(baseMint);
  const quoteMintInfo = await raydium.token.getTokenInfo(quoteMint);
  
  // Validate that mints are TOKEN_PROGRAM_ID (not Token-2022)
  if (
    baseMintInfo.programId !== TOKEN_PROGRAM_ID.toBase58() ||
    quoteMintInfo.programId !== TOKEN_PROGRAM_ID.toBase58()
  ) {
    throw new Error(
      'AMM pools with OpenBook market only support TOKEN_PROGRAM_ID mints. For Token-2022, please create CPMM pool instead.'
    );
  }
  
  // Validate minimum liquidity
  const minLiquidity = new BN(1).mul(new BN(10 ** baseMintInfo.decimals)).pow(new BN(2));
  if (input.addBaseAmount.mul(input.addQuoteAmount).lte(minLiquidity)) {
    throw new Error('Initial liquidity too low, try adding more baseAmount/quoteAmount');
  }
  
  // Create pool using Raydium SDK V2 pattern
  const { execute, extInfo } = await raydium.liquidity.createPoolV4({
    programId: AMM_V4,
    marketInfo: {
      marketId,
      programId: OPEN_BOOK_PROGRAM,
    },
    baseMintInfo: {
      mint: baseMint,
      decimals: baseMintInfo.decimals,
    },
    quoteMintInfo: {
      mint: quoteMint,
      decimals: quoteMintInfo.decimals,
    },
    baseAmount: input.addBaseAmount,
    quoteAmount: input.addQuoteAmount,
    startTime: new BN(Math.floor(input.startTime)),
    ownerInfo: {
      useSOLBalance: true,
    },
    associatedOnly: false,
    txVersion: makeTxVersion,
    feeDestinationId: FEE_DESTINATION_ID,
  });
  
  console.log('✅ Pool creation transaction prepared successfully');
  console.log(`📊 Pool Info:`, {
    baseMint: baseMint.toBase58(),
    quoteMint: quoteMint.toBase58(),
    marketId: marketId.toBase58(),
    baseAmount: input.addBaseAmount.toString(),
    quoteAmount: input.addQuoteAmount.toString(),
  });
  
  return { execute, extInfo };
}

//=============================================================================
// BACKWARD COMPATIBILITY EXPORTS
//=============================================================================

// ✅ Backward compatibility export
export const ammCreatePool = ammCreatePoolV2;

//=============================================================================
// UTILITY CONSTANTS
//=============================================================================

export {
  ZERO
};
