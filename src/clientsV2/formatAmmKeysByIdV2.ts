import {
  ApiPoolInfoV4,
  LIQUIDITY_STATE_LAYOUT_V4,
  Liquidity,
  MARKET_STATE_LAYOUT_V3,
  Market,
  SPL_MINT_LAYOUT
} from '@raydium-io/raydium-sdk';
import { address } from '@solana/addresses';
import type { Address } from '@solana/addresses';

import { createAppConfigV2 } from '../config/AppConfigV2';

export async function formatAmmKeysById(id: string): Promise<ApiPoolInfoV4> {
  const config = await createAppConfigV2();
  
  // ✅ V2 RPC call with proper response handling
  const accountResponse = await config.rpc.getAccountInfo(address(id));
  if (accountResponse.value === null) throw Error('get id info error');
  
  const account = accountResponse.value;
  const info = LIQUIDITY_STATE_LAYOUT_V4.decode(Buffer.from(account.data, 'base64'));

  const marketId = info.marketId;
  const marketResponse = await config.rpc.getAccountInfo(address(marketId.toString()));
  if (marketResponse.value === null) throw Error('get market info error');
  
  const marketAccount = marketResponse.value;
  const marketInfo = MARKET_STATE_LAYOUT_V3.decode(Buffer.from(marketAccount.data, 'base64'));

  const lpMint = info.lpMint;
  const lpMintResponse = await config.rpc.getAccountInfo(address(lpMint.toString()));
  if (lpMintResponse.value === null) throw Error('get lp mint info error');
  
  const lpMintAccount = lpMintResponse.value;
  const lpMintInfo = SPL_MINT_LAYOUT.decode(Buffer.from(lpMintAccount.data, 'base64'));

  return {
    id,
    baseMint: info.baseMint.toString(),
    quoteMint: info.quoteMint.toString(),
    lpMint: info.lpMint.toString(),
    baseDecimals: info.baseDecimal.toNumber(),
    quoteDecimals: info.quoteDecimal.toNumber(),
    lpDecimals: lpMintInfo.decimals,
    version: 4,
    programId: account.owner.toString(),
    authority: Liquidity.getAssociatedAuthority({ programId: address(account.owner) as any }).publicKey.toString(),
    openOrders: info.openOrders.toString(),
    targetOrders: info.targetOrders.toString(),
    baseVault: info.baseVault.toString(),
    quoteVault: info.quoteVault.toString(),
    withdrawQueue: info.withdrawQueue.toString(),
    lpVault: info.lpVault.toString(),
    marketVersion: 3,
    marketProgramId: info.marketProgramId.toString(),
    marketId: info.marketId.toString(),
    marketAuthority: Market.getAssociatedAuthority({ 
      programId: address(info.marketProgramId.toString()) as any, 
      marketId: address(info.marketId.toString()) as any 
    }).publicKey.toString(),
    marketBaseVault: marketInfo.baseVault.toString(),
    marketQuoteVault: marketInfo.quoteVault.toString(),
    marketBids: marketInfo.bids.toString(),
    marketAsks: marketInfo.asks.toString(),
    marketEventQueue: marketInfo.eventQueue.toString(),
    lookupTableAccount: address('11111111111111111111111111111111').toString() // Default address instead of PublicKey.default
  };
}
