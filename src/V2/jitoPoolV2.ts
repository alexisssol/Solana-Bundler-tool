import { 
  address,
  lamports,
  type Address,
  type KeyPairSigner,
  type TransactionMessage,
  type IInstruction
} from '@solana/kit';
import { AppConfigV2 } from '../config/AppConfigV2';
import { loadKeypairsV2 } from './createKeysV2';
import { DEFAULT_TOKEN, PROGRAMIDS } from "../clients/constants";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Liquidity, MARKET_STATE_LAYOUT_V3, Token, MAINNET_PROGRAM_ID } from "@raydium-io/raydium-sdk";
import { BN } from "@project-serum/anchor";
import { ammCreatePool, getWalletTokenAccount } from "../clients/raydiumUtil";
import { promises as fsPromises } from "fs";
import { lookupTableProvider } from "../clients/LookupTableProvider";
import { searcherClient } from "../clients/jito";
import { Bundle as JitoBundle } from "jito-ts/dist/sdk/block-engine/types.js";
import promptSync from "prompt-sync";
import * as spl from "@solana/spl-token";
import { IPoolKeys } from "../clients/interfaces";
import { derivePoolKeys } from "../clients/poolKeysReassigned";
import path from "path";
import fs from "fs";

// Import legacy types for compatibility with existing libraries
import { PublicKey, VersionedTransaction, TransactionInstruction, TransactionMessage as LegacyTransactionMessage, SystemProgram, Keypair, LAMPORTS_PER_SOL, AddressLookupTableAccount } from "@solana/web3.js";
import { fromLegacyPublicKey, fromLegacyKeypair } from "@solana/compat";

const prompt = promptSync();
const keyInfoPath = path.join(__dirname, "../../", "keyInfoV2.json");

type LiquidityPairTargetInfoV2 = {
	baseToken: Token;
	quoteToken: Token;
	targetMarketId: Address;
};

type AssociatedPoolKeysV2 = {
	lpMint: Address;
	id: Address;
	baseMint: Address;
	quoteMint: Address;
};

export async function buyBundleV2() {
	console.log('🚀 Starting V2 Bundle Creation with Solana Kit...');
	
	// Initialize V2 configuration
	const config = await AppConfigV2.create();
	await config.validateConfig();
	
	const bundledTxns: VersionedTransaction[] = [];
	const keypairsV2: KeyPairSigner[] = await loadKeypairsV2();
	
	if (keypairsV2.length === 0) {
		console.log('❌ No V2 keypairs found. Please run createKeypairsV2() first.');
		process.exit(0);
	}

	let poolInfo: { [key: string]: any } = {};
	if (fs.existsSync(keyInfoPath)) {
		const data = fs.readFileSync(keyInfoPath, "utf-8");
		poolInfo = JSON.parse(data);
	}

	const lut = address(poolInfo.addressLUT?.toString() || '');

	// Get address lookup table using V2 RPC
	const lookupTableResponse = await config.rpc.getAccountInfo(lut, { commitment: 'finalized' }).send();
	const lookupTableAccount = lookupTableResponse.value;

	if (lookupTableAccount == null) {
		console.log("Lookup table account not found!");
		process.exit(0);
	}

	// -------- step 1: ask necessary questions for pool build --------
	const baseAddr = prompt("Token address: ") || "";
	const percentOfSupplyInput = prompt("% of your token balance in pool (Ex. 80): ") || "0";
	const solInPoolInput = prompt("# of SOL in LP (Ex. 10): ") || "0";
	const OpenBookID = prompt("OpenBook MarketID: ") || "";
	const jitoTipAmtInput = prompt("Jito tip in Sol (Ex. 0.01): ") || "0";
	const iterations = parseInt(prompt("Enter the number of iterations for bundle creation: ") || "0", 10);
	const delaySeconds = parseInt(prompt("Enter the delay between each iteration in seconds: ") || "0", 10);
	const jitoTipAmt = parseFloat(jitoTipAmtInput) * LAMPORTS_PER_SOL;
	const percentOfSupply = parseFloat(percentOfSupplyInput);
	const solInPool = parseFloat(solInPoolInput);

	const myTokenAddress = address(baseAddr);
	
	// Get mint info using legacy compatibility for Raydium SDK
	const myTokenLegacy = new PublicKey(baseAddr);
	const tokenInfo = await config.rpc.getAccountInfo(myTokenAddress, { commitment: 'finalized' }).send();
	
	if (!tokenInfo.value) {
		console.log('❌ Token not found');
		process.exit(0);
	}

	// For now, we'll use a compatibility approach with existing Raydium SDK
	// TODO: This should be migrated to use @solana-program/token when available
	const tokenInfoLegacy = await spl.getMint(
		// Convert Solana Kit RPC to legacy connection for compatibility
		{ 
			getAccountInfo: async (pubkey: any, commitment: any) => {
				const response = await config.rpc.getAccountInfo(fromLegacyPublicKey(pubkey), { commitment }).send();
				return response.value ? {
					...response.value,
					owner: new PublicKey(response.value.owner),
					executable: response.value.executable,
					lamports: response.value.lamports,
					data: Buffer.from(response.value.data[0], response.value.data[1] as BufferEncoding)
				} : null;
			}
		} as any,
		myTokenLegacy,
		"finalized",
		TOKEN_PROGRAM_ID
	);

	// Fetch balance of token
	const TokenBalance = await fetchTokenBalanceV2(baseAddr, tokenInfoLegacy.decimals, config);
	
	// Declare the tokens to put into the pool
	const baseToken = new Token(TOKEN_PROGRAM_ID, new PublicKey(tokenInfoLegacy.address), tokenInfoLegacy.decimals);
	const quoteToken = DEFAULT_TOKEN.SOL; // SOL as quote
	const targetMarketId = address(OpenBookID);

	for (let i = 0; i < iterations; i++) {
		console.log(`\n🔄 Processing iteration ${i + 1}/${iterations}...`);
		
		// -------- step 2: create pool txn --------
		const startTime = Math.floor(Date.now() / 1000);
		
		// Get latest blockhash using V2 RPC
		const latestBlockhash = await config.rpc.getLatestBlockhash({ commitment: 'finalized' }).send();
		const blockhash = latestBlockhash.value.blockhash;

		// Get wallet token accounts (compatibility layer needed)
		const walletAddress = config.wallet.address;
		const walletTokenAccounts = await getWalletTokenAccountV2(config, walletAddress);

		// Get market buffer info using V2 RPC
		const marketBufferInfo = await config.rpc.getAccountInfo(targetMarketId, { commitment: 'finalized' }).send();
		
		if (!marketBufferInfo.value) {
			console.log('❌ Market account not found');
			process.exit(0);
		}

		const marketData = Buffer.from(marketBufferInfo.value.data[0], marketBufferInfo.value.data[1] as BufferEncoding);
		const { baseMint, quoteMint, baseLotSize, quoteLotSize, baseVault, quoteVault, bids, asks, eventQueue, requestQueue } = MARKET_STATE_LAYOUT_V3.decode(marketData);

		// Generate pool keys using existing Raydium SDK (convert addresses as needed)
		let poolKeys: any = Liquidity.getAssociatedPoolKeys({
			version: 4,
			marketVersion: 3,
			baseMint,
			quoteMint,
			baseDecimals: tokenInfoLegacy.decimals,
			quoteDecimals: 9,
			marketId: new PublicKey(targetMarketId),
			programId: PROGRAMIDS.AmmV4,
			marketProgramId: PROGRAMIDS.OPENBOOK_MARKET,
		});
		
		poolKeys.marketBaseVault = baseVault;
		poolKeys.marketQuoteVault = quoteVault;
		poolKeys.marketBids = bids;
		poolKeys.marketAsks = asks;
		poolKeys.marketEventQueue = eventQueue;

		// Calculate amounts
		const baseMintAmount = new BN(Math.floor((percentOfSupply / 100) * TokenBalance).toString());
		const quoteMintAmount = new BN((solInPool * Math.pow(10, 9)).toString());
		const addBaseAmount = new BN(baseMintAmount.toString());
		const addQuoteAmount = new BN(quoteMintAmount.toString());

		// Fetch LP Mint and write to json
		const associatedPoolKeys = getMarketAssociatedPoolKeysV2({
			baseToken,
			quoteToken,
			targetMarketId,
		});
		await writeDetailsToJsonFileV2(associatedPoolKeys, startTime, targetMarketId.toString());

		// Create pool transaction using existing ammCreatePool but with V2 compatibility
		const poolCreationResult = await createPoolTransactionV2({
			startTime,
			addBaseAmount,
			addQuoteAmount,
			baseToken,
			quoteToken,
			targetMarketId,
			config,
			walletTokenAccounts,
			blockhash
		});

		if (poolCreationResult) {
			bundledTxns.push(poolCreationResult);
		}

		// -------- step 3: create swap txns --------
		const txMainSwaps: VersionedTransaction[] = await createWalletSwapsV2(
			targetMarketId, 
			blockhash, 
			keypairsV2, 
			jitoTipAmt, 
			lookupTableAccount,
			config
		);
		bundledTxns.push(...txMainSwaps);

		// -------- step 4: send bundle --------
		await sendBundleV2(bundledTxns);

		// Delay between iterations
		await new Promise((resolve) => setTimeout(resolve, delaySeconds * 1000));
		bundledTxns.length = 0;
	}

	console.log('✅ V2 Bundle creation completed!');
	return;
}

async function createPoolTransactionV2(params: {
	startTime: number;
	addBaseAmount: BN;
	addQuoteAmount: BN;
	baseToken: Token;
	quoteToken: Token;
	targetMarketId: Address;
	config: AppConfigV2;
	walletTokenAccounts: any[];
	blockhash: string;
}): Promise<VersionedTransaction | null> {
	const { config, blockhash } = params;
	
	try {
		// Use existing ammCreatePool function with compatibility layer
		const poolResult = await ammCreatePool({
			startTime: params.startTime,
			addBaseAmount: params.addBaseAmount,
			addQuoteAmount: params.addQuoteAmount,
			baseToken: params.baseToken,
			quoteToken: params.quoteToken,
			targetMarketId: new PublicKey(params.targetMarketId), // Convert to legacy
			wallet: await toLegacyKeypairSigner(config.wallet), // Convert to legacy
			walletTokenAccounts: params.walletTokenAccounts,
		});

		const createPoolInstructions: TransactionInstruction[] = [];
		for (const itemIx of poolResult.txs.innerTransactions) {
			createPoolInstructions.push(...itemIx.instructions);
		}

		// Create lookup tables for addresses
		const addressesMain: PublicKey[] = [];
		createPoolInstructions.forEach((ixn) => {
			ixn.keys.forEach((key) => {
				addressesMain.push(key.pubkey);
			});
		});
		const lookupTablesMain = lookupTableProvider.computeIdealLookupTablesForAddresses(addressesMain);

		// Create transaction using legacy method for compatibility
		const messageMain = new LegacyTransactionMessage({
			payerKey: new PublicKey(config.wallet.address),
			recentBlockhash: blockhash,
			instructions: createPoolInstructions,
		}).compileToV0Message(lookupTablesMain);
		
		const txPool = new VersionedTransaction(messageMain);

		// Check transaction size
		const serializedMsg = txPool.serialize();
		if (serializedMsg.length > 1232) {
			console.log("❌ Transaction too big:", serializedMsg.length);
			return null;
		}

		// Sign with legacy compatibility
		const legacySigner = await toLegacyKeypairSigner(config.wallet);
		txPool.sign([legacySigner]);

		console.log('✅ Pool creation transaction prepared');
		return txPool;

	} catch (error) {
		console.error('❌ Error creating pool transaction:', error);
		return null;
	}
}

async function createWalletSwapsV2(
	marketID: Address, 
	blockhash: string, 
	keypairs: KeyPairSigner[], 
	jitoTip: number, 
	lut: any,
	config: AppConfigV2
): Promise<VersionedTransaction[]> {
	const txsSigned: VersionedTransaction[] = [];
	const chunkedKeypairs = chunkArray(keypairs, 7);
	
	// Convert Address to PublicKey for legacy compatibility
	const keys = await derivePoolKeys(new PublicKey(marketID));

	for (let chunkIndex = 0; chunkIndex < chunkedKeypairs.length; chunkIndex++) {
		const chunk = chunkedKeypairs[chunkIndex];
		const instructionsForChunk: TransactionInstruction[] = [];

		console.log(`🔄 Processing chunk ${chunkIndex + 1}/${chunkedKeypairs.length} with ${chunk.length} keypairs...`);

		for (let i = 0; i < chunk.length; i++) {
			const keypair = chunk[i];
			console.log(`Processing keypair ${i + 1}/${chunk.length}:`, keypair.address);

			if (keys == null) {
				console.log("❌ Error fetching pool keys");
				process.exit(0);
			}

			// Get associated token addresses using legacy methods
			const keypairLegacy = await toLegacyKeypairSigner(keypair);
			const TokenATA = await spl.getAssociatedTokenAddress(new PublicKey(keys.baseMint), keypairLegacy.publicKey);
			const wSolATA = await spl.getAssociatedTokenAddress(spl.NATIVE_MINT, keypairLegacy.publicKey);

			const { buyIxs } = makeBuyV2(keys, wSolATA, TokenATA, false, keypairLegacy);
			instructionsForChunk.push(...buyIxs);
		}

		// Create transaction message using legacy approach for compatibility
		const message = new LegacyTransactionMessage({
			payerKey: new PublicKey(config.wallet.address),
			recentBlockhash: blockhash,
			instructions: instructionsForChunk,
		}).compileToV0Message([lut]);

		const versionedTx = new VersionedTransaction(message);

		// Check transaction size
		const serializedMsg = versionedTx.serialize();
		console.log("📏 Transaction size:", serializedMsg.length);
		if (serializedMsg.length > 1232) {
			console.log("⚠️ Transaction too big");
		}

		// Sign transaction
		const walletLegacy = await toLegacyKeypairSigner(config.wallet);
		if (chunkIndex === chunkedKeypairs.length - 1) {
			versionedTx.sign([walletLegacy]);
		}

		for (const keypair of chunk) {
			const legacyKeypair = await toLegacyKeypairSigner(keypair);
			versionedTx.sign([legacyKeypair]);
		}

		txsSigned.push(versionedTx);
	}

	console.log(`✅ Created ${txsSigned.length} swap transactions`);
	return txsSigned;
}

function chunkArray<T>(array: T[], size: number): T[][] {
	return Array.from({ length: Math.ceil(array.length / size) }, (v, i) => array.slice(i * size, i * size + size));
}

export async function sendBundleV2(bundledTxns: VersionedTransaction[]) {
	try {
		console.log(`📦 Sending bundle with ${bundledTxns.length} transactions...`);
		
		const bundleId = await searcherClient.sendBundle(new JitoBundle(bundledTxns, bundledTxns.length));
		console.log(`🚀 Bundle ${bundleId} sent successfully!`);

		// Listen for bundle result
		const result = await new Promise((resolve, reject) => {
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
		});

		console.log("✅ Final result:", result);
	} catch (error) {
		const err = error as any;
		console.error("❌ Error sending bundle:", err.message);

		if (err?.message?.includes("Bundle Dropped, no connected leader up soon")) {
			console.error("❌ Bundle dropped: no connected leader up soon.");
		} else {
			console.error("❌ Unexpected error:", err.message);
		}
	}
}

async function fetchTokenBalanceV2(TokenPubKey: string, decimalsToken: number, config: AppConfigV2): Promise<number> {
	const ownerAddress = config.wallet.address;
	
	try {
		// Get token accounts using V2 RPC
		const response = await config.rpc.getTokenAccountsByOwner(
			ownerAddress,
			{ mint: address(TokenPubKey) },
			{ commitment: 'finalized' }
		).send();

		let TokenBalance = 0;
		for (const account of response.value) {
			// Parse token account data
			const accountInfo = await config.rpc.getAccountInfo(account.pubkey, { commitment: 'finalized' }).send();
			if (accountInfo.value) {
				// This would need proper token account parsing with @solana-program/token
				// For now, using a simplified approach
				console.log('📊 Token account found:', account.pubkey);
				// TODO: Implement proper token balance parsing with Solana Kit
				TokenBalance += 1; // Placeholder
			}
		}

		return TokenBalance * 10 ** decimalsToken;
	} catch (error) {
		console.error('❌ Error fetching token balance:', error);
		return 0;
	}
}

function makeBuyV2(poolKeys: IPoolKeys, wSolATA: PublicKey, TokenATA: PublicKey, reverse: boolean, keypair: Keypair): { buyIxs: TransactionInstruction[], sellIxs: TransactionInstruction[] } {
	// This function remains largely the same as it deals with low-level instruction creation
	// The main change is in the function signature and how keypairs are handled
	
	const programId = new PublicKey("4BsBhTFFxKaswZioPvRMqRqVYTd668wZvAc3oKLZP2tx");
	const account1 = TOKEN_PROGRAM_ID;
	const account2 = poolKeys.id;
	const account3 = poolKeys.authority;
	const account4 = poolKeys.openOrders;
	const account5 = poolKeys.targetOrders;
	const account6 = poolKeys.baseVault;
	const account7 = poolKeys.quoteVault;
	const account8 = poolKeys.marketProgramId;
	const account9 = poolKeys.marketId;
	const account10 = poolKeys.marketBids;
	const account11 = poolKeys.marketAsks;
	const account12 = poolKeys.marketEventQueue;
	const account13 = poolKeys.marketBaseVault;
	const account14 = poolKeys.marketQuoteVault;
	const account15 = poolKeys.marketAuthority;
	let account16 = wSolATA;
	let account17 = TokenATA;
	const account18 = keypair.publicKey;
	const account19 = MAINNET_PROGRAM_ID.AmmV4;

	if (reverse === true) {
		account16 = TokenATA;
		account17 = wSolATA;
	}

	const buffer = Buffer.alloc(16);
	const prefix = Buffer.from([0x09]);
	const instructionData = Buffer.concat([prefix, buffer]);
	
	const accountMetas = [
		{ pubkey: account1, isSigner: false, isWritable: false },
		{ pubkey: account2, isSigner: false, isWritable: true },
		{ pubkey: account3, isSigner: false, isWritable: false },
		{ pubkey: account4, isSigner: false, isWritable: true },
		{ pubkey: account5, isSigner: false, isWritable: true },
		{ pubkey: account6, isSigner: false, isWritable: true },
		{ pubkey: account7, isSigner: false, isWritable: true },
		{ pubkey: account8, isSigner: false, isWritable: false },
		{ pubkey: account9, isSigner: false, isWritable: true },
		{ pubkey: account10, isSigner: false, isWritable: true },
		{ pubkey: account11, isSigner: false, isWritable: true },
		{ pubkey: account12, isSigner: false, isWritable: true },
		{ pubkey: account13, isSigner: false, isWritable: true },
		{ pubkey: account14, isSigner: false, isWritable: true },
		{ pubkey: account15, isSigner: false, isWritable: false },
		{ pubkey: account16, isSigner: false, isWritable: true },
		{ pubkey: account17, isSigner: false, isWritable: true },
		{ pubkey: account18, isSigner: true, isWritable: true },
		{ pubkey: account19, isSigner: false, isWritable: true },
	];

	const swap = new TransactionInstruction({
		keys: accountMetas,
		programId,
		data: instructionData,
	});

	let buyIxs: TransactionInstruction[] = [];
	let sellIxs: TransactionInstruction[] = [];

	if (reverse === false) {
		buyIxs.push(swap);
	}

	if (reverse === true) {
		sellIxs.push(swap);
	}

	return { buyIxs, sellIxs };
}

function getMarketAssociatedPoolKeysV2(input: LiquidityPairTargetInfoV2) {
	// Convert Address back to PublicKey for Raydium SDK compatibility
	const poolInfo = Liquidity.getAssociatedPoolKeys({
		version: 4,
		marketVersion: 3,
		baseMint: input.baseToken.mint,
		quoteMint: input.quoteToken.mint,
		baseDecimals: input.baseToken.decimals,
		quoteDecimals: input.quoteToken.decimals,
		marketId: new PublicKey(input.targetMarketId),
		programId: PROGRAMIDS.AmmV4,
		marketProgramId: MAINNET_PROGRAM_ID.OPENBOOK_MARKET,
	});
	
	// Convert back to V2 format
	return {
		lpMint: address(poolInfo.lpMint.toString()),
		id: address(poolInfo.id.toString()),
		baseMint: address(poolInfo.baseMint.toString()),
		quoteMint: address(poolInfo.quoteMint.toString()),
	};
}

async function writeDetailsToJsonFileV2(associatedPoolKeys: AssociatedPoolKeysV2, startTime: number, marketID: string) {
	const filePath = path.join(__dirname, "../../", "keyInfoV2.json");

	try {
		let fileData = {};
		try {
			const currentData = await fsPromises.readFile(filePath, "utf-8");
			fileData = JSON.parse(currentData);
		} catch (error) {
			console.log("📄 keyInfoV2.json doesn't exist or is empty. Creating a new one.");
		}

		const updatedData = {
			...fileData,
			lpTokenAddr: associatedPoolKeys.lpMint.toString(),
			targetPool: associatedPoolKeys.id.toString(),
			baseMint: associatedPoolKeys.baseMint.toString(),
			quoteMint: associatedPoolKeys.quoteMint.toString(),
			openTime: new Date(startTime * 1000).toISOString(),
			marketID,
		};

		await fsPromises.writeFile(filePath, JSON.stringify(updatedData, null, 2), "utf8");
		console.log("✅ Successfully updated keyInfoV2.json with new pool details.");
	} catch (error) {
		console.error("❌ Failed to write to keyInfoV2.json:", error);
	}
}

// Helper function to get wallet token accounts with V2 compatibility
async function getWalletTokenAccountV2(config: AppConfigV2, walletAddress: Address): Promise<any[]> {
	try {
		// This is a simplified version - in a full implementation, 
		// you'd want to properly parse token accounts using @solana-program/token
		const accounts = await config.rpc.getTokenAccountsByOwner(
			walletAddress,
			{ programId: address(TOKEN_PROGRAM_ID.toString()) },
			{ commitment: 'finalized' }
		).send();

		return accounts.value.map(account => ({
			pubkey: account.pubkey,
			account: account.account
		}));
	} catch (error) {
		console.error('❌ Error getting wallet token accounts:', error);
		return [];
	}
}

// Helper function to convert Solana Kit KeyPairSigner to legacy Keypair
async function toLegacyKeypairSigner(signer: KeyPairSigner): Promise<Keypair> {
	// This is a compatibility function - in practice, you might need to 
	// extract the private key and reconstruct the Keypair
	// For now, this is a placeholder that would need proper implementation
	
	try {
		// This would require extracting the private key from the KeyPairSigner
		// which might not be possible due to security restrictions in Solana Kit V2
		throw new Error('KeyPairSigner to Keypair conversion needs implementation');
	} catch (error) {
		console.error('❌ Error converting KeyPairSigner to legacy Keypair:', error);
		throw error;
	}
}

// Export the main function
export { buyBundleV2 as default };
