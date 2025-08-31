# BuyTokenV2 Implementation

## Overview
This implementation replaces the legacy `buyToken.ts` custom program approach with a fully compliant Raydium SDK 2.0 and Solana Kit V2 solution.

## Key Features

### ✅ **Official Raydium SDK 2.0 Integration**
- Uses `@raydium-io/raydium-sdk-v2` instead of custom program
- Eliminates dependency on `Axz6g5nHgKzm5CbLJcAQauxpdpkL1BafBywSvotyTUSv`
- Proper pool discovery and route finding
- Built-in slippage protection and amount calculations

### ✅ **Solana Kit V2 Compatibility**
- Uses `Address` and `KeyPairSigner` types from `@solana/kit`
- Modern transaction building patterns
- Type-safe operations throughout

### ✅ **Multi-Wallet Bundle Support**
- Supports up to 7 wallets per Jito bundle
- Automatic chunking for larger wallet sets
- Proper retry logic with exponential backoff

### ✅ **V2 Pattern Consistency**
- Follows the same patterns as `jitoPoolV2.ts`
- Uses `AppConfigV2.create()` async initialization
- Compatible with existing V2 infrastructure

## Architecture

### Core Classes

#### `BuyTokenV2`
Main class that orchestrates the multi-wallet token buying process.

**Key Methods:**
- `initialize()`: Async setup of Raydium SDK and configuration
- `buyToken(params)`: Execute multi-wallet purchase
- `processBuyChunk()`: Handle individual bundle creation and submission
- `getPoolInfo()`: Discover or validate trading pools

### Integration Points

#### Raydium SDK 2.0 Integration
```typescript
// Pool discovery
const routes = await this.raydium.tradeV2.getAllRoute({
  inputMint: baseMintPubkey,
  outputMint: quoteMintPubkey,
  ...(await this.raydium.tradeV2.fetchRoutePoolBasicInfo())
});

// Amount calculations
const swapResult = this.raydium.liquidity.computeAmountOut({
  poolInfo: poolInfo.poolInfo,
  amountIn: new BN(baseAmount),
  mintIn: baseMintPubkey,
  mintOut: quoteMintPubkey,
  slippage: slippage / 100,
});

// Swap execution
const { transaction } = await this.raydium.liquidity.swap({
  poolInfo: poolInfo.poolInfo,
  poolKeys: poolInfo.poolKeys,
  amountIn: new BN(baseAmount),
  amountOut: swapResult.minAmountOut,
  inputMint: baseMintPubkey.toString(),
  fixedSide: 'in',
  txVersion: TxVersion.V0,
  // ... additional config
});
```

#### Jito Bundle Submission
```typescript
// Using existing jitoPoolV2 pattern
const bundleId = await searcherClient.sendBundle(
  new JitoBundle(signedTransactions, signedTransactions.length)
);

// Bundle result tracking
const result = await Promise.race([
  new Promise((resolve, reject) => {
    searcherClient.onBundleResult(
      (result) => resolve(result),
      (e: Error) => reject(e)
    );
  }),
  new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Bundle result timeout')), 30000)
  )
]);
```

## Usage Examples

### Basic Usage
```typescript
import { executeBuyTokenV2 } from './buyTokenV2';

const results = await executeBuyTokenV2(
  'So11111111111111111111111111111111111111112', // WSOL
  'TokenMintAddressHere',                           // Target token
  '1000000',                                        // Amount in smallest units
  1.0                                               // 1% slippage
);

console.log(`${results.filter(r => r.success).length} successful purchases`);
```

### Advanced Usage
```typescript
import { BuyTokenV2 } from './buyTokenV2';

const buyToken = new BuyTokenV2();
await buyToken.initialize();

const results = await buyToken.buyToken({
  baseMint: address('So11111111111111111111111111111111111111112'),
  quoteMint: address('TokenMintAddressHere'),
  baseAmount: '1000000',
  slippage: 1.0,
  poolId: address('PoolIdIfKnown'), // Optional
  priorityFee: 0.001,               // SOL
  maxRetries: 3,
});
```

## Migration Benefits

### From Legacy buyToken.ts
1. **No Custom Program Dependency**: Uses official Raydium SDK
2. **Better Error Handling**: Comprehensive retry logic and error reporting
3. **Type Safety**: Full TypeScript integration with Solana Kit V2
4. **Maintainability**: Follows established V2 patterns
5. **Future-Proof**: Uses actively maintained official SDKs

### Performance Improvements
- Automatic pool discovery reduces setup time
- Built-in slippage calculations prevent failed transactions
- Optimized bundle sizing (7 transactions max per bundle)
- Proper timeout handling prevents hanging operations

## Configuration

### Required Environment Variables
```bash
# Standard AppConfigV2 variables
RPC_URL=https://api.mainnet-beta.solana.com
POOL_CREATOR_PRIVATE_KEY_64=base64_encoded_private_key
FEE_PAYER_PRIVATE_KEY_64=base64_encoded_private_key

# Jito configuration (handled by jitoV2.ts)
AUTH_KEYPAIR_PATH=./blockengine.json
BLOCK_ENGINE_URLS=frankfurt.mainnet.block-engine.jito.wtf
```

### Dependencies
- `@raydium-io/raydium-sdk-v2`: Official Raydium SDK
- `@solana/kit`: Solana Kit V2 for modern Web3.js 2.0 patterns
- `jito-ts`: Jito bundle submission
- Existing V2 infrastructure (`AppConfigV2`, `loadKeypairsV2`, etc.)

## Error Handling

The implementation includes comprehensive error handling:
- Individual transaction failures don't break the entire bundle
- Automatic retry logic with exponential backoff
- Detailed error reporting per wallet
- Graceful degradation when pools aren't found
- Bundle timeout protection

## Testing

### Verification Commands
```bash
# Check compilation
npm run build

# Run TypeScript checks
npx tsc --noEmit

# Test pool discovery (optional)
# Create a simple test script to verify pool finding
```

## Next Steps

1. **Integration Testing**: Test with small amounts on devnet
2. **Pool Validation**: Verify pool discovery works for target tokens
3. **Performance Tuning**: Adjust bundle sizes and retry logic as needed
4. **Monitoring**: Add metrics and logging for production use

This implementation successfully eliminates the custom program dependency while maintaining all the functionality of the original `buyToken.ts` with improved reliability and maintainability.