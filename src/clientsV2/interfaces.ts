import { address } from '@solana/addresses';
import type { Address } from '@solana/addresses';
import BN from 'bn.js';

export interface IPoolKeysV2 {
  keg?: Address;
  version?: number;
  marketVersion?: number;
  programId?: Address;
  baseMint: any;
  quoteMint?: any;
  ownerBaseAta: Address;
  ownerQuoteAta: Address;
  baseDecimals: any;
  quoteDecimals?: any;
  lpDecimals?: any;
  authority?: any;
  marketAuthority?: any;
  marketProgramId?: any;
  marketId?: any;
  marketBids?: any;
  marketAsks?: any;
  marketQuoteVault?: any;
  marketBaseVault?: any;
  marketEventQueue?: any;
  id?: any;
  baseVault?: any;
  coinVault?: Address;
  lpMint: Address;
  lpVault?: Address;
  targetOrders?: any;
  withdrawQueue?: Address;
  openOrders?: any;
  quoteVault?: any;
  lookupTableAccount?: Address;
}

export interface ISwpBaseInV2 {
  swapBaseIn?: {
    amountIn?: BN;
    minimumAmountOut?: BN;
  };
}
