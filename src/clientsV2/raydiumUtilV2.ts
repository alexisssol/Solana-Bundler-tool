
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
import { 
  findProgramAddress,
  AMM_V4,
  OPEN_BOOK_PROGRAM,
  FEE_DESTINATION_ID,
  MARKET_STATE_LAYOUT_V3,
  Raydium,
  TxVersion,
  parseTokenAccountResp
} from '@raydium-io/raydium-sdk-v2';

// Legacy imports for compatibility
import { PublicKey, VersionedTransaction, Keypair, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';
import { SPL_ACCOUNT_LAYOUT } from '@raydium-io/raydium-sdk';
import { AppConfigV2 } from '../config/AppConfigV2';
import { BN } from '@project-serum/anchor';
import { makeTxVersion } from './constantsV2'

//=============================================================================
// RAYDIUM SDK V2 SINGLETON PATTERN
//=============================================================================

let raydiumInstance: Raydium | undefined;

/**
 * ✅ Initialize Raydium SDK V2 with singleton pattern
 * Based on official Raydium SDK V2 example
 * 
 * @param params - Optional parameters for SDK initialization
 * @returns Promise<Raydium> - Singleton Raydium instance
 */
export const initRaydiumSdk = async (params?: { 
  loadToken?: boolean;
  cluster?: 'mainnet' | 'devnet';
  rpcUrl?: string;
  owner?: KeyPairSigner;
}): Promise<Raydium> => {
  if (raydiumInstance) return raydiumInstance;
  
  // Get configuration
  const config = await AppConfigV2.create();
  await config.validateConfig();
  
  const cluster = params?.cluster || 'mainnet';
  const rpcUrl = params?.rpcUrl || config.rpcUrl;
  const owner = params?.owner || config.wallet;
  
  console.log(`🔗 Connecting to RPC ${rpcUrl} in ${cluster}`);
  
  if (rpcUrl.includes('api.mainnet-beta.solana.com')) {
    console.warn('⚠️ Using free RPC node might cause unexpected errors, strongly suggest using paid RPC node');
  }
  
  // Create legacy connection for Raydium SDK V2 compatibility
  const legacyConnection = {
    rpcEndpoint: rpcUrl,
    getAccountInfo: async (pubkey: PublicKey, commitment?: any) => {
      const rpc = createSolanaRpc(rpcUrl);
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
      const rpc = createSolanaRpc(rpcUrl);
      const response = await rpc.getLatestBlockhash({ commitment }).send();
      return {
        value: {
          blockhash: response.value.blockhash,
          lastValidBlockHeight: Number(response.value.lastValidBlockHeight)
        }
      };
    },
    sendTransaction: async (transaction: any) => {
      const rpc = createSolanaRpc(rpcUrl);
      return await rpc.sendTransaction(transaction).send();
    },
    getTokenAccountsByOwner: async (owner: PublicKey, filter: any, commitment?: any) => {
      const rpc = createSolanaRpc(rpcUrl);
      const response = await rpc.getTokenAccountsByOwner(
        address(owner.toBase58()),
        filter.programId ? { programId: address(filter.programId.toString()) } : filter,
        { commitment }
      ).send();
      return {
        context: response.context,
        value: response.value.map(acc => ({
          ...acc,
          account: {
            ...acc.account,
            owner: new PublicKey(acc.account.owner)
          }
        }))
      };
    }
  } as any;
  
  raydiumInstance = await Raydium.load({
    owner: new PublicKey(owner.address), // Convert V2 Address to legacy PublicKey
    connection: legacyConnection,
    cluster,
    disableFeatureCheck: true,
    disableLoadToken: !params?.loadToken,
    blockhashCommitment: 'finalized',
  });
  
  console.log('✅ Raydium SDK V2 initialized successfully');
  return raydiumInstance;
};

/**
 * ✅ Fetch token account data for Raydium SDK
 * Based on official example pattern
 * 
 * @param owner - Owner KeyPairSigner
 * @param rpcUrl - RPC URL
 * @returns Token account data for Raydium SDK
 */
export const fetchTokenAccountData = async (owner: KeyPairSigner, rpcUrl: string) => {
  const rpc = createSolanaRpc(rpcUrl);
  const ownerAddress = address(owner.address);
  
  // Get SOL account info
  const solAccountResp = await rpc.getAccountInfo(ownerAddress).send();
  
  // Get TOKEN_PROGRAM_ID accounts
  const tokenAccountResp = await rpc.getTokenAccountsByOwner(
    ownerAddress, 
    { programId: address(TOKEN_PROGRAM_ID.toString()) }
  ).send();
  
  // Get TOKEN_2022_PROGRAM_ID accounts
  const token2022Resp = await rpc.getTokenAccountsByOwner(
    ownerAddress,
    { programId: address(TOKEN_2022_PROGRAM_ID.toString()) }
  ).send();
  
  // Convert to legacy format for parseTokenAccountResp
  const tokenAccountData = parseTokenAccountResp({
    owner: new PublicKey(owner.address),
    solAccountResp: solAccountResp.value ? {
      ...solAccountResp.value,
      owner: new PublicKey(solAccountResp.value.owner),
      lamports: Number(solAccountResp.value.lamports),
      rentEpoch: Number(solAccountResp.value.rentEpoch),
      data: Buffer.from(solAccountResp.value.data[0], solAccountResp.value.data[1] as BufferEncoding)
    } : null,
    tokenAccountResp: {
      context: {
        slot: Number(tokenAccountResp.context.slot)
      },
      value: [
        ...tokenAccountResp.value.map(acc => ({
          ...acc,
          pubkey: new PublicKey(acc.pubkey),
          account: {
            ...acc.account,
            owner: new PublicKey(acc.account.owner),
            lamports: Number(acc.account.lamports),
            rentEpoch: Number(acc.account.rentEpoch),
            space: Number(acc.account.space),
            data: Buffer.from(acc.account.data[0], acc.account.data[1] as BufferEncoding)
          }
        })),
        ...token2022Resp.value.map(acc => ({
          ...acc,
          pubkey: new PublicKey(acc.pubkey),
          account: {
            ...acc.account,
            owner: new PublicKey(acc.account.owner),
            lamports: Number(acc.account.lamports),
            rentEpoch: Number(acc.account.rentEpoch),
            space: Number(acc.account.space),
            data: Buffer.from(acc.account.data[0], acc.account.data[1] as BufferEncoding)
          }
        }))
      ],
    },
  });
  
  return tokenAccountData;
};

/**
 * ✅ Get existing Raydium instance or throw error
 * Use this when you need the Raydium instance and expect it to be initialized
 */
export const getRaydiumInstance = (): Raydium => {
  if (!raydiumInstance) {
    throw new Error('Raydium SDK not initialized. Call initRaydiumSdk() first.');
  }
  return raydiumInstance;
};

/**
 * ✅ Reset Raydium instance (useful for testing)
 */
export const resetRaydiumInstance = (): void => {
  raydiumInstance = undefined;
};

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

export async function sleepTimeV2(ms: number): Promise<void> {
  console.log((new Date()).toLocaleString(), 'sleepTimeV2', ms);
  return new Promise(resolve => setTimeout(resolve, ms));
}


export function calcMarketStartPriceV2(input: CalcStartPriceV2): number {
  const baseAmount = input.addBaseAmount.toNumber() / 10 ** 6;
  const quoteAmount = input.addQuoteAmount.toNumber() / 10 ** 9;
  return baseAmount / quoteAmount;
}


export const sleepTime = sleepTimeV2;
export const calcMarketStartPrice = calcMarketStartPriceV2;


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

export const findAssociatedTokenAddress = findAssociatedTokenAddressV2;
export const getATAAddress = getATAAddressV2;
export const getWalletTokenAccount = getWalletTokenAccountV2;
export const sendTx = sendTxV2;
export const buildAndSendTx = buildAndSendTxV2;

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
  
  // Only log if not in test environment
  if (process.env.NODE_ENV !== 'test') {
    console.log(`✅ Successfully sent ${signatures.length} transactions`);
    signatures.forEach((sig, index) => {
      console.log(`   Transaction ${index + 1}: ${sig}`);
    });
  }
  
  return signatures;
}

/**
 * ✅ V2 AMM Create Pool Function
 * Updated to use singleton Raydium SDK pattern following official example
 * 
 * @param input - Pool creation input parameters (V2 format)
 * @returns Promise with execute function and extInfo
 */
export async function ammCreatePoolV2(input: TestTxInputInfoV2): Promise<{
  execute: (options?: { sendAndConfirm?: boolean }) => Promise<{ txId: string }>;
  extInfo: any;
}> {
  console.log('🏗️ Creating AMM Pool V2 with Raydium SDK V2...');
  
  // Get Raydium instance using singleton pattern
  const raydium = await initRaydiumSdk({ loadToken: true });
  
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


export const ammCreatePool = ammCreatePoolV2;


export const ZERO = new BN(0);
