import * as spl from '@solana/spl-token';
import { Market } from '@openbook-dex/openbook';
import { address, type Address } from '@solana/addresses';
import { Lamports } from '@solana/kit';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } from '@solana/spl-token';
import * as structs from './structs';
import { createAppConfigV2 } from '../config/AppConfigV2';
import { IPoolKeysV2 } from './interfaces';
import { ApiPoolInfoV4 } from "@raydium-io/raydium-sdk";

// ✅ V2 Address instead of PublicKey
const openbookProgram = address('srmqPvymJeFKQ4zGQed1GFppgkRHL9kaELCbyksJtPX');
const TOKEN_KEG_ADDRESS = address('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');


async function getMarketInfo(marketId: Address): Promise<any> {
  const config = await createAppConfigV2();
  let reqs = 0;
  
  // ✅ V2 RPC call
  let marketInfoResponse = await config.rpc.getAccountInfo(marketId).send();
  reqs++;

  while (!marketInfoResponse.value) {
    marketInfoResponse = await config.rpc.getAccountInfo(marketId).send();
    reqs++;
    if (marketInfoResponse.value) {
      break;
    } else if (reqs > 20) {
      console.log(`Could not get market info..`);
      return null;
    }
  }

  return marketInfoResponse.value;
}

async function getDecodedData(marketInfo: any) {
  // Convert Uint8Array to Buffer for Market.getLayout compatibility
  const bufferData = Buffer.from(marketInfo.data);
  return Market.getLayout(openbookProgram as any).decode(bufferData);
}

async function getMintData(mint: Address): Promise<any> {
  const config = await createAppConfigV2();
  const response = await config.rpc.getAccountInfo(mint).send();
  return response.value;
}

async function getDecimals(mintData: any): Promise<number> {
  if (!mintData) throw new Error('No mint data!');

  // Convert Uint8Array to Buffer for structs compatibility
  const bufferData = Buffer.from(mintData.data);
  return structs.SPL_MINT_LAYOUT.decode(bufferData).decimals;
}

async function getOwnerAta(mint: Address, publicKey: Address): Promise<Address> {
  // ✅ V2 approach - using @solana/spl-token helper
  // Note: This function might need adaptation based on available V2 SPL token utilities
  
  // For now, we'll use a compatibility approach
  const mintBytes = new Uint8Array(32); // Convert address to bytes representation
  const publicKeyBytes = new Uint8Array(32);
  
  // TODO: Implement proper V2 ATA derivation
  // This is a placeholder - you might need to use address derivation utilities
  // from Solana Kit or implement custom PDA derivation
  
  try {
    // Attempt to use legacy method with conversion
    const { PublicKey } = await import('@solana/web3.js');
    const legacyMint = new PublicKey(mint);
    const legacyOwner = new PublicKey(publicKey);
    
    const foundAta = PublicKey.findProgramAddressSync(
      [
        legacyOwner.toBuffer(), 
        TOKEN_PROGRAM_ID.toBuffer(), 
        legacyMint.toBuffer()
      ],
      ASSOCIATED_TOKEN_PROGRAM_ID
    )[0];
    
    return address(foundAta.toString());
  } catch (error) {
    throw new Error(`Failed to derive ATA: ${error}`);
  }
}

function getVaultSigner(marketId: Address, marketDeco: { vaultSignerNonce: { toString: () => any } }): Address {
  // TODO: Implement V2 PDA derivation
  // For now using compatibility layer
  try {
    const { PublicKey } = require('@solana/web3.js');
    const legacyMarketId = new PublicKey(marketId);
    const legacyOpenbookProgram = new PublicKey(openbookProgram);
    
    const seeds = [legacyMarketId.toBuffer()];
    const seedsWithNonce = seeds.concat(
      Buffer.from([Number(marketDeco.vaultSignerNonce.toString())]), 
      Buffer.alloc(7)
    );

    const result = PublicKey.createProgramAddressSync(seedsWithNonce, legacyOpenbookProgram);
    return address(result.toString());
  } catch (error) {
    throw new Error(`Failed to derive vault signer: ${error}`);
  }
}

// ✅ Helper function for PDA derivation with V2 patterns
async function deriveProgramAddress(seeds: (Buffer | Uint8Array)[], programId: Address): Promise<Address> {
  // TODO: Use proper V2 PDA derivation when available
  // For now, using compatibility layer
  try {
    const { PublicKey } = await import('@solana/web3.js');
    const legacyProgramId = new PublicKey(programId);
    const result = PublicKey.findProgramAddressSync(
      seeds.map(seed => Buffer.from(seed)),
      legacyProgramId
    )[0];
    return address(result.toString());
  } catch (error) {
    throw new Error(`Failed to derive program address: ${error}`);
  }
}

export async function derivePoolKeys(marketId: Address) {
  const config = await createAppConfigV2();
  const rayLiqPoolv4 = config.rayLiqPoolv4; // Get from config
  const walletAddress = config.walletAddress; // Get wallet address from config
  
  const marketInfo = await getMarketInfo(marketId);
  if (!marketInfo) return null;
  
  const marketDeco = await getDecodedData(marketInfo);
  
  // ✅ V2 Address handling
  const baseMint = address(marketDeco.baseMint.toString());
  const baseMintData = await getMintData(baseMint);
  const baseDecimals = await getDecimals(baseMintData);
  const ownerBaseAta = await getOwnerAta(baseMint, walletAddress);
  
  const quoteMint = address(marketDeco.quoteMint.toString());
  const quoteMintData = await getMintData(quoteMint);
  const quoteDecimals = await getDecimals(quoteMintData);
  const ownerQuoteAta = await getOwnerAta(quoteMint, walletAddress);
  
  // ✅ V2 PDA derivations
  const authority = await deriveProgramAddress(
    [Buffer.from([97, 109, 109, 32, 97, 117, 116, 104, 111, 114, 105, 116, 121])],
    rayLiqPoolv4
  );

  const marketAuthority = getVaultSigner(marketId, marketDeco);

  // ✅ Derive all pool keys with V2 patterns
  const poolKeys = {
    keg: TOKEN_KEG_ADDRESS,
    version: 4,
    marketVersion: 3,
    programId: rayLiqPoolv4,
    baseMint,
    quoteMint,
    ownerBaseAta,
    ownerQuoteAta,
    baseDecimals,
    quoteDecimals,
    lpDecimals: baseDecimals,
    authority,
    marketAuthority,
    marketProgramId: openbookProgram,
    marketId,
    marketBids: address(marketDeco.bids.toString()),
    marketAsks: address(marketDeco.asks.toString()),
    marketQuoteVault: address(marketDeco.quoteVault.toString()),
    marketBaseVault: address(marketDeco.baseVault.toString()),
    marketEventQueue: address(marketDeco.eventQueue.toString()),
    
    // ✅ V2 PDA derivations for pool accounts
    id: await deriveProgramAddress(
      [
        Buffer.from(rayLiqPoolv4), 
        Buffer.from(marketId), 
        Buffer.from('amm_associated_seed', 'utf-8')
      ],
      rayLiqPoolv4
    ),
    
    baseVault: await deriveProgramAddress(
      [
        Buffer.from(rayLiqPoolv4), 
        Buffer.from(marketId), 
        Buffer.from('coin_vault_associated_seed', 'utf-8')
      ],
      rayLiqPoolv4
    ),
    
    coinVault: await deriveProgramAddress(
      [
        Buffer.from(rayLiqPoolv4), 
        Buffer.from(marketId), 
        Buffer.from('pc_vault_associated_seed', 'utf-8')
      ],
      rayLiqPoolv4
    ),
    
    lpMint: await deriveProgramAddress(
      [
        Buffer.from(rayLiqPoolv4), 
        Buffer.from(marketId), 
        Buffer.from('lp_mint_associated_seed', 'utf-8')
      ],
      rayLiqPoolv4
    ),
    
    lpVault: await deriveProgramAddress(
      [
        Buffer.from(rayLiqPoolv4), 
        Buffer.from(marketId), 
        Buffer.from('temp_lp_token_associated_seed', 'utf-8')
      ],
      rayLiqPoolv4
    ),
    
    targetOrders: await deriveProgramAddress(
      [
        Buffer.from(rayLiqPoolv4), 
        Buffer.from(marketId), 
        Buffer.from('target_associated_seed', 'utf-8')
      ],
      rayLiqPoolv4
    ),
    
    withdrawQueue: await deriveProgramAddress(
      [
        Buffer.from(rayLiqPoolv4), 
        Buffer.from(marketId), 
        Buffer.from('withdraw_associated_seed', 'utf-8')
      ],
      rayLiqPoolv4
    ),
    
    openOrders: await deriveProgramAddress(
      [
        Buffer.from(rayLiqPoolv4), 
        Buffer.from(marketId), 
        Buffer.from('open_order_associated_seed', 'utf-8')
      ],
      rayLiqPoolv4
    ),
    
    quoteVault: await deriveProgramAddress(
      [
        Buffer.from(rayLiqPoolv4), 
        Buffer.from(marketId), 
        Buffer.from('pc_vault_associated_seed', 'utf-8')
      ],
      rayLiqPoolv4
    ),
    
    // ✅ V2 default address instead of PublicKey.default
    lookupTableAccount: address('11111111111111111111111111111111')
  };

  return poolKeys;
}

export async function PoolKeysCorrector(poolkeys: IPoolKeysV2): Promise<ApiPoolInfoV4 | undefined> {
  const config = await createAppConfigV2();
  
  return {
    id: poolkeys.id.toString(),
    baseMint: poolkeys.baseMint.toString(),
    quoteMint: poolkeys.quoteMint.toString(),
    lpMint: poolkeys.lpMint.toString(),
    baseDecimals: poolkeys.baseDecimals,
    quoteDecimals: poolkeys.quoteDecimals,
    lpDecimals: poolkeys.lpDecimals,
    version: 4,
    programId: poolkeys.programId?.toString() || config.rayLiqPoolv4.toString(),
    authority: poolkeys.authority.toString(),
    openOrders: poolkeys.openOrders.toString(),
    targetOrders: poolkeys.targetOrders.toString(),
    baseVault: poolkeys.baseVault.toString(),
    quoteVault: poolkeys.quoteVault.toString(),
    withdrawQueue: poolkeys.withdrawQueue?.toString() || '',
    lpVault: poolkeys.lpVault?.toString() || '',
    marketVersion: 3,
    marketProgramId: poolkeys.marketProgramId.toString(),
    marketId: poolkeys.marketId.toString(),
    marketAuthority: poolkeys.marketAuthority.toString(),
    marketBaseVault: poolkeys.baseVault.toString(),
    marketQuoteVault: poolkeys.quoteVault.toString(),
    marketBids: poolkeys.marketBids.toString(),
    marketAsks: poolkeys.marketAsks.toString(),
    marketEventQueue: poolkeys.marketEventQueue.toString(),
    lookupTableAccount: address('11111111111111111111111111111111').toString()
  };
}