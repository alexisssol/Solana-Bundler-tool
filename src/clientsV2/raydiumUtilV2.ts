/**
 * RaydiumUtilV2 - Clean V2 Implementation
 * 
 * This file contains the V2 migration of raydiumUtil.ts using:
 * - Raydium SDK V2
 * - Solana Kit 2.0 (@solana/kit)
 * - Pure V2 APIs without legacy compatibility layers
 * 
 * Migration Progress:
 * ✅ Phase 2: Simple Utility Functions (sleepTime, calcMarketStartPrice)
 * ✅ Phase 3: Core Utility Functions (getWalletTokenAccount, getATAAddress, findAssociatedTokenAddress)
 * ⏳ Phase 4: Transaction Functions (sendTx, buildAndSendTx)
 * ⏳ Phase 5: Main Business Logic (ammCreatePool)
 */

//=============================================================================
// IMPORTS - V2 APIs ONLY
//=============================================================================

// ✅ Solana Kit 2.0 imports
import { 
  address, 
  type Address, 
  type KeyPairSigner,
  createSolanaRpc,
  type Rpc,
  type SolanaRpcApi
} from '@solana/kit';
import { findProgramAddress } from '@raydium-io/raydium-sdk-v2'

// ✅ Legacy Web3.js imports for compatibility where needed
import { PublicKey } from '@solana/web3.js';

// ✅ SPL Token imports
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';

// ✅ Raydium SDK imports for layout decoding (needed for compatibility)
import { SPL_ACCOUNT_LAYOUT } from '@raydium-io/raydium-sdk';

// ✅ Local V2 configuration
import { AppConfigV2 } from '../config/AppConfigV2';

// ✅ BN for calculations (keeping for compatibility with existing patterns)
import { BN } from '@project-serum/anchor';

//=============================================================================
// V2 TYPE DEFINITIONS
//=============================================================================

/**
 * ✅ V2 Types - Using Address instead of PublicKey throughout
 */
export type CalcStartPriceV2 = {
  addBaseAmount: BN;
  addQuoteAmount: BN;
};

export type LiquidityPairTargetInfoV2 = {
  baseToken: any; // TODO: Define proper V2 Token type
  quoteToken: any; // TODO: Define proper V2 Token type  
  targetMarketId: Address;
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

/**
 * ✅ V2 Get Wallet Token Account using Solana Kit 2.0 RPC
 * Migrated from V1 raydiumUtil.ts with V2 RPC patterns
 * 
 * @param rpcUrl - RPC endpoint URL (from AppConfigV2)
 * @param walletAddress - Wallet address as V2 Address type
 * @returns Promise<TokenAccountV2[]> - Array of token accounts in V2 format
 */
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
 * @param walletAddress - Wallet address as V2 Address type
 * @param tokenMintAddress - Token mint address as V2 Address type
 * @returns Associated Token Account address as V2 Address type
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

//=============================================================================
// PHASE 4: TRANSACTION FUNCTIONS (PENDING ⏳)  
//=============================================================================

// TODO: Implement sendTxV2()
// TODO: Implement sendTransactionV2()
// TODO: Implement buildAndSendTxV2()

//=============================================================================
// PHASE 5: MAIN BUSINESS LOGIC (PENDING ⏳)
//=============================================================================

// TODO: Implement ammCreatePoolV2()

//=============================================================================
// UTILITY CONSTANTS
//=============================================================================

const ZERO = new BN(0);

//=============================================================================
// EXPORTS FOR TESTING
//=============================================================================

export {
  ZERO
};
