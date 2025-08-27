# RaydiumUtil V2 Migration Plan

## Executive Summary

This document outlines the step-by-step migration of `src/clients/raydiumUtil.ts` to `src/clientsV2/raydiumUtilV2.ts` using Raydium SDK V2 and Solana Kit 2.0. The goal is to eliminate legacy compatibility layers and use pure V2 APIs.

## Current State Assessment

### Existing raydiumUtil.ts Functions
1. `sendTx()` - Transaction sending utility
2. `getWalletTokenAccount()` - Fetch wallet token accounts
3. `sendTransaction()` - Wrapper for sending transactions
4. `buildAndSendTx()` - Build and send simple transactions
5. `getATAAddress()` - Get Associated Token Account address
6. `sleepTime()` - Utility delay function
7. `ammCreatePool()` - Create AMM pool (main function)
8. `calcMarketStartPrice()` - Calculate market start price
9. `findAssociatedTokenAddress()` - Find ATA address

### Key Dependencies to Migrate
- **Raydium SDK V1** → **Raydium SDK V2**
- **@solana/web3.js** → **@solana/kit**
- **Legacy Connection/Keypair** → **V2 RPC/KeyPairSigner**
- **Legacy PublicKey** → **Address type**

## Migration Strategy - Function by Function

## Migration Strategy - Function by Function

### Phase 1: Foundation Setup ✅ (COMPLETED)
- [x] Created `AppConfigV2.ts` with Solana Kit 2.0 RPC and signers
- [x] Set up basic V2 project structure
- [x] Identified all functions requiring migration

### Phase 2: Utility Functions ✅ (COMPLETED)

#### Step 1: `sleepTime()` - Simple Utility Migration ✅ 
**Priority:** HIGH (Easy win, no dependencies)
**Status:** ✅ COMPLETED

**Implementation:** `sleepTimeV2()` - No changes needed from V1
**Tests:** ✅ Comprehensive unit tests in `tests/unit/raydiumUtilV2.test.ts`

---

#### Step 2: `calcMarketStartPrice()` - Pure Calculation Function ✅
**Priority:** HIGH (No external dependencies)
**Status:** ✅ COMPLETED

**Implementation:** `calcMarketStartPriceV2()` - Uses V2 types
**Tests:** ✅ Comprehensive unit tests including edge cases and performance tests

---

#### Step 3: `findAssociatedTokenAddress()` - Address Derivation ✅
**Priority:** MEDIUM (Helper function, now critical dependency)
**Status:** ✅ COMPLETED

**V2 Implementation:** `findAssociatedTokenAddressV2()`
- ✅ Uses V2 `Address` types instead of `PublicKey`
- ✅ Leverages Raydium SDK V2 `findProgramAddress` pattern
- ✅ Maintains identical behavior to V1
- ✅ Full backward compatibility with alias

**Tests:** ✅ Comprehensive unit tests including V1 vs V2 compatibility validation

---

#### Step 4: `getATAAddress()` & Related Functions ✅
**Priority:** MEDIUM (Helper functions)
**Status:** ✅ COMPLETED

**V2 Implementation:** 
- ✅ `getATAAddressV2()` - Returns both address and nonce
- ✅ `findProgramAddressV2()` - Core V2 program address derivation
- ✅ Proper V2 `Address` type handling throughout

**Tests:** ✅ Unit tests covering deterministic results and cross-function consistency

---

### Phase 3: Transaction Functions (Complex Migration)

#### Step 5: `sendTx()` - Core Transaction Sending
**Priority:** HIGH (Foundation for transaction sending)
**Status:** ⏳ PENDING

**Current Implementation:**
```typescript
export async function sendTx(
  connection: Connection,
  payer: Keypair | Signer,
  txs: (VersionedTransaction | Transaction)[],
  options?: SendOptions
): Promise<string[]> {
  // Legacy transaction signing and sending
}
```

**V2 Migration Plan:**
- Replace `Connection` with `AppConfigV2.rpc`
- Replace `Keypair` with `KeyPairSigner`
- Use Solana Kit transaction patterns
- Handle V2 transaction message format

**Test Required:** `tests/unit/raydiumUtilV2.test.ts`

---

#### Step 6: `buildAndSendTx()` - Transaction Building
**Priority:** HIGH (Used by pool creation)
**Status:** ⏳ PENDING

**V2 Migration Plan:**
- Use Raydium SDK V2 transaction building
- Replace legacy simple transaction builder
- Implement proper V2 signing patterns

**Test Required:** `tests/unit/raydiumUtilV2.test.ts`

---

#### Step 7: `ammCreatePool()` - Main Pool Creation Function
**Priority:** CRITICAL (Core business logic)
**Status:** ⏳ PENDING

**Current Implementation:**
```typescript
export async function ammCreatePool(input: TestTxInputInfo) {
  const initPoolInstructionResponse = await Liquidity.makeCreatePoolV4InstructionV2Simple({
    connection,
    programId: PROGRAMIDS.AmmV4,
    marketInfo: {
      marketId: input.targetMarketId,
      programId: PROGRAMIDS.OPENBOOK_MARKET,
    },
    // ... rest of configuration
  })
  return { txs: initPoolInstructionResponse }
}
```

**V2 Migration Plan:**
- Use Raydium SDK V2 `Raydium.load()` pattern
- Replace all legacy types with V2 equivalents
- Use `AppConfigV2` for configuration
- Implement proper V2 pool creation flow

**Test Required:** `tests/integration/raydiumUtilV2.integration.test.ts` (Priority)

---

## Implementation Approach

### Step-by-Step Process

1. **Start with Simple Functions** (`sleepTime`, `calcMarketStartPrice`)
   - Minimal changes required
   - Build confidence and establish patterns

2. **Core Utility Functions** (`getWalletTokenAccount`, `getATAAddress`)
   - Address type system migration
   - RPC pattern changes

3. **Transaction Functions** (`sendTx`, `buildAndSendTx`)
   - Complex transaction handling
   - V2 signing patterns

4. **Main Business Logic** (`ammCreatePool`)
   - Integration of all previous functions
   - Full Raydium SDK V2 integration

### Testing Strategy

#### Unit Tests
```bash
# Test individual functions as they're migrated
npm test tests/unit/raydiumUtilV2.test.ts

# Focus on specific function
npm test -- --testNamePattern="getWalletTokenAccountV2"
```

#### Integration Tests
```bash
# Test complete workflows
npm test tests/integration/raydiumUtilV2.integration.test.ts

# Test pool creation end-to-end
npm test -- --testNamePattern="ammCreatePool"
```

### Success Criteria

#### For Each Function:
- [ ] Compiles without errors
- [ ] Passes unit tests
- [ ] Maintains identical behavior to V1
- [ ] Uses only V2 APIs (no compatibility layers)

#### For Complete Migration:
- [ ] All functions migrated and tested
- [ ] Integration tests pass
- [ ] Performance comparable to V1
- [ ] Ready for production use

### Current Blockers

1. **TokenAccount Type Mapping**
   - Raydium SDK V2 `TokenAccount` structure needs proper mapping to `TokenAccountV2`
   - Need to understand exact property names from `parseTokenAccountResp()`

2. **Connection/RPC Pattern**
   - Need clear pattern for using `AppConfigV2.rpc` vs legacy `Connection`
   - Raydium SDK V2 compatibility requirements

3. **Type System Migration**
   - `PublicKey` → `Address` conversion throughout
   - Proper handling of V2 signer types

### Next Steps

1. **Fix `getWalletTokenAccountV2()` compilation errors**
2. **Start with `sleepTime()` and `calcMarketStartPrice()` (easy wins)**
3. **Create comprehensive test suite for each function**
4. **Document V2 patterns for team reference**

---

## Required Package Changes

### Current Dependencies (Web3.js v1.x)
```json
"@solana/web3.js": "^1.98.4",
"@solana/spl-token": "^0.3.9",
"bs58": "^5.0.0"
```

### New Dependencies (Solana Kit)
```json
"@solana/kit": "^2.0.0",
"@solana-program/system": "^1.0.0",
"@solana-program/token": "^1.0.0", 
"@solana-program/compute-budget": "^1.0.0",
"@solana/compat": "^2.0.0"
```

### Dependencies to Remove
- `bs58` - No longer needed (Solana Kit handles encoding internally)

## Files Requiring Complete Rewrite

### High Priority (Core Functionality)

#### 1. `src/createKeys.ts` - Key Management
**Current Issues:**
- Uses `Keypair.generate()` and `Keypair.fromSecretKey()`
- Uses `bs58.encode(wallet.secretKey)`
- File-based key storage approach

**Required Changes:**
```typescript
// BEFORE (Web3.js v1.x)
import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const wallet = Keypair.generate();
console.log(`Private Key: ${bs58.encode(wallet.secretKey)}`);
const keypair = Keypair.fromSecretKey(secretKey);

// AFTER (Solana Kit)
import { generateKeyPairSigner, createKeyPairSignerFromBytes } from '@solana/kit';

const wallet = await generateKeyPairSigner();
// Private keys are handled internally by CryptoKeyPair
const signer = await createKeyPairSignerFromBytes(secretKeyBytes);
```

#### 2. `src/jitoPool.ts` - Transaction Building & Signing
**Current Issues:**
- Uses `Connection` class
- Uses `VersionedTransaction` and old signing methods
- Manual transaction building

**Required Changes:**
```typescript
// BEFORE (Web3.js v1.x)
import { Connection, VersionedTransaction, TransactionMessage } from '@solana/web3.js';

const connection = new Connection(endpoint);
const message = new TransactionMessage({...}).compileToV0Message();
const tx = new VersionedTransaction(message);
tx.sign([keypair]);

// AFTER (Solana Kit)
import { 
  createSolanaRpc, 
  pipe, 
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners
} from '@solana/kit';

const rpc = createSolanaRpc(endpoint);
const transactionMessage = pipe(
  createTransactionMessage({ version: 0 }),
  (tx) => setTransactionMessageFeePayer(signer, tx),
  (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
  (tx) => appendTransactionMessageInstructions(instructions, tx)
);
const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
```

#### 3. `src/sellFunc.ts` & `src/buyToken.ts` - Trading Logic
**Current Issues:**
- Same transaction building patterns as jitoPool.ts
- Manual signing processes

#### 4. `src/createLUT.ts` - Lookup Table Management  
**Current Issues:**
- Uses old transaction patterns
- Manual serialization

#### 5. `src/removeLiq.ts` - Liquidity Removal
**Current Issues:**
- Old signing methods

### Medium Priority (Configuration & Utilities)

#### 6. `src/config/AppConfig.ts`
**Required Changes:**
- Replace `Connection` with `createSolanaRpc()`
- Update wallet configuration

#### 7. `src/config/SecureKeypairManager.ts`
**Required Changes:**
- Update to use Solana Kit signer patterns
- Potentially leverage native `CryptoKeyPair` security

#### 8. `src/clients/` directory
**Required Changes:**
- Update all utility functions to use Solana Kit APIs
- Replace PublicKey with address() function

## Migration Strategy (Updated - Safe Testing Approach)

### Phase 1: Setup & Dependencies (1-2 days)

#### Core Solana Kit Packages
```bash
npm install @solana/kit @solana-program/system @solana-program/token @solana-program/compute-budget @solana/compat
```

#### Testing & Development Libraries
```bash
# Testing frameworks
npm install --save-dev jest @types/jest ts-jest


# Performance and comparison testing
npm install --save-dev benchmark @types/benchmark

# Type checking and validation
npm install --save-dev typescript @types/node

# Environment and configuration testing
npm install --save-dev dotenv @types/dotenv

# Mock and stub utilities for Jito testing
npm install --save-dev sinon @types/sinon nock
```

#### Development Setup
1. **Create test directory structure**:
   ```bash
   mkdir -p tests/unit tests/integration tests/performance tests/migration
   ```

2. **Configure Jest** for TypeScript and Solana testing
3. **Set up test environment** with proper RPC endpoints

### Phase 2: Core Infrastructure - V2 File Creation & Testing (3-5 days)

#### Step 1: Create V2 Configuration Files
1. **Create `src/config/AppConfigV2.ts`**:
   - Replace `Connection` with `createSolanaRpc()`
   - Set up RPC and RPC subscriptions
   - **Test**: `tests/unit/AppConfigV2.test.ts`

2. **Create `src/createKeysV2.ts`**:
   - Replace `Keypair` with `generateKeyPairSigner()`
   - Update key storage/loading logic
   - Remove `bs58` dependency
   - **Test**: `tests/unit/createKeysV2.test.ts`

#### Step 2: Core Infrastructure Testing
```bash
# Run specific tests for infrastructure
npm test tests/unit/AppConfigV2.test.ts
npm test tests/unit/createKeysV2.test.ts
```

### Phase 3: Transaction Handling - V2 Implementation (5-7 days)

#### Step 1: Critical Transaction Files
1. **Create `src/jitoPoolV2.ts`** (most critical):
   - Implement new transaction building patterns
   - Update signing logic with Solana Kit
   - **Test**: `tests/integration/jitoPoolV2.test.ts`
   - **Performance Test**: `tests/performance/jitoPoolV2.benchmark.ts`

#### Step 2: Trading Function V2 Files
2. **Create `src/sellFuncV2.ts`**:
   - **Test**: `tests/unit/sellFuncV2.test.ts`

3. **Create `src/buyTokenV2.ts`**:
   - **Test**: `tests/unit/buyTokenV2.test.ts`

4. **Create `src/createLUTV2.ts`**:
   - **Test**: `tests/unit/createLUTV2.test.ts`

5. **Create `src/removeLiqV2.ts`**:
   - **Test**: `tests/unit/removeLiqV2.test.ts`

#### Step 3: Transaction Testing Suite
```bash
# Run transaction tests individually
npm test tests/unit/sellFuncV2.test.ts
npm test tests/unit/buyTokenV2.test.ts
npm test tests/integration/jitoPoolV2.test.ts

# Run performance benchmarks
npm test tests/performance/jitoPoolV2.benchmark.ts
```

### Phase 4: Supporting Systems - V2 Utilities (2-3 days)

#### Step 1: Client Utilities V2
1. **Create client V2 files** (`src/clients/`):
   - `src/clients/configV2.ts`
   - `src/clients/jitoV2.ts`
   - `src/clients/raydiumUtilV2.ts`
   - **Test**: `tests/unit/clients/` directory

#### Step 2: Configuration V2
2. **Create `src/config/SecureKeypairManagerV2.ts`**:
   - **Test**: `tests/unit/SecureKeypairManagerV2.test.ts`

### Phase 5: Comprehensive Testing & Validation (3-5 days)

#### Step 1: Integration Testing
1. **Migration comparison tests**:
   - `tests/migration/v1-vs-v2-comparison.test.ts`
   - Compare outputs between original and V2 files
   - Validate identical behavior

2. **End-to-end workflow tests**:
   - `tests/integration/complete-bundle-workflow-v2.test.ts`
   - Test entire Jito bundle process with V2 files

#### Step 2: Performance & Compatibility Testing
1. **Bundle functionality validation**:
   - `tests/integration/jito-bundle-v2.test.ts`
   - Ensure Jito SDK compatibility

2. **Performance benchmarks**:
   - `tests/performance/transaction-speed-comparison.benchmark.ts`
   - Compare V1 vs V2 performance

#### Step 3: Production Readiness Testing
```bash
# Run full test suite
npm test

# Run specific migration tests
npm test tests/migration/

# Run performance benchmarks
npm run benchmark

# Run integration tests
npm test tests/integration/
```

## Implementation Notes

### New Patterns for Solana Kit

#### RPC Setup
```typescript
import { createSolanaRpc, createSolanaRpcSubscriptions } from '@solana/kit';

const rpc = createSolanaRpc('https://api.mainnet-beta.solana.com');
const rpcSubscriptions = createSolanaRpcSubscriptions('wss://api.mainnet-beta.solana.com');
```

#### Key Management
```typescript
import { generateKeyPairSigner, createKeyPairSignerFromBytes } from '@solana/kit';

// Generate new signer
const signer = await generateKeyPairSigner();

// Load from bytes
const signer = await createKeyPairSignerFromBytes(keyBytes);
```

#### Transaction Building
```typescript
import { 
  pipe, 
  createTransactionMessage,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners
} from '@solana/kit';

const transactionMessage = pipe(
  createTransactionMessage({ version: 0 }),
  (tx) => setTransactionMessageFeePayer(signer, tx),
  (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
  (tx) => appendTransactionMessageInstructions(instructions, tx)
);

const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
```

#### Address Handling
```typescript
import { address } from '@solana/kit';

// Replace PublicKey
const addr = address('1234..5678');
```

## Compatibility Strategy

### Using @solana/compat for Gradual Migration
```typescript
import { Keypair, PublicKey } from '@solana/web3.js';
import { createSignerFromKeyPair } from '@solana/kit';
import {
  fromLegacyKeypair,
  fromLegacyPublicKey,
  fromLegacyTransactionInstruction,
  fromVersionedTransaction,
} from '@solana/compat';

// Convert existing types
const address = fromLegacyPublicKey(new PublicKey('1234..5678'));
const cryptoKeypair = await fromLegacyKeypair(Keypair.generate());
const signer = await createSignerFromKeyPair(cryptoKeypair);
```

## Risk Assessment

### High Risk Areas
- **Complete architectural change** - No simple upgrade path
- **Jito Bundle compatibility** - Ensure Jito SDK works with Solana Kit
- **Performance impact** - New patterns may affect bundle creation speed
- **Key management security** - Different approach to private key handling

### Compatibility Concerns
- **Jito Integration**: Verify jito-ts SDK compatibility with Solana Kit transactions
- **Raydium SDK**: Check `@raydium-io/raydium-sdk` compatibility
- **Anchor Integration**: Anchor may not support Solana Kit yet

## Testing Infrastructure Setup

### Jest Configuration (`jest.config.js`)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: [
    '**/__tests__/**/*.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000, // Extended for Solana operations
  globals: {
    'ts-jest': {
      useESM: true
    }
  }
};
```

### Test Directory Structure
```
tests/
├── setup.ts                           # Test environment setup
├── unit/                             # Unit tests for individual functions
│   ├── createKeysV2.test.ts
│   ├── AppConfigV2.test.ts
│   ├── sellFuncV2.test.ts
│   ├── buyTokenV2.test.ts
│   ├── createLUTV2.test.ts
│   ├── removeLiqV2.test.ts
│   ├── SecureKeypairManagerV2.test.ts
│   └── clients/
│       ├── configV2.test.ts
│       ├── jitoV2.test.ts
│       └── raydiumUtilV2.test.ts
├── integration/                      # Integration tests
│   ├── jitoPoolV2.test.ts
│   ├── complete-bundle-workflow-v2.test.ts
│   └── jito-bundle-v2.test.ts
├── migration/                        # V1 vs V2 comparison tests
│   └── v1-vs-v2-comparison.test.ts
├── performance/                      # Performance benchmarks
│   ├── jitoPoolV2.benchmark.ts
│   └── transaction-speed-comparison.benchmark.ts
└── mocks/                           # Mock data and utilities
    ├── solana-rpc.mock.ts
    ├── jito-bundle.mock.ts
    └── keypair.mock.ts
```

### Package.json Test Scripts
```json
{
  "scripts": {
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:migration": "jest tests/migration",
    "test:performance": "jest tests/performance",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "benchmark": "node tests/performance/*.benchmark.js"
  }
}
```

### Sample Test Template (`tests/unit/createKeysV2.test.ts`)
```typescript
import { generateKeyPairSigner, createKeyPairSignerFromBytes } from '@solana/kit';
import { createKeysV2 } from '../../src/createKeysV2';

describe('createKeysV2', () => {
  test('should generate keypairs using Solana Kit', async () => {
    const signer = await generateKeyPairSigner();
    expect(signer).toBeDefined();
    expect(signer.address).toBeDefined();
  });

  test('should load keypairs from bytes', async () => {
    const originalSigner = await generateKeyPairSigner();
    // Test serialization/deserialization logic
    // Compare with V1 behavior
  });

  test('should maintain compatibility with V1 output format', async () => {
    // Compare V2 output with V1 output
    // Ensure same wallet addresses are generated
  });
});
```

## V2 File Migration Priority Order

### Phase 1: Infrastructure (Critical Dependencies)
1. `src/config/AppConfigV2.ts` 
2. `src/createKeysV2.ts`
3. `src/config/SecureKeypairManagerV2.ts`

### Phase 2: Core Transaction Logic
4. `src/jitoPoolV2.ts` (HIGHEST PRIORITY - Core bundle functionality)
5. `src/sellFuncV2.ts`
6. `src/buyTokenV2.ts`

### Phase 3: Supporting Transaction Files
7. `src/createLUTV2.ts`
8. `src/removeLiqV2.ts`

### Phase 4: Client Utilities
9. `src/clients/configV2.ts`
10. `src/clients/jitoV2.ts`
11. `src/clients/raydiumUtilV2.ts`
12. `src/clients/LookupTableProviderV2.ts`

## Testing Strategy Per File

### Unit Testing Approach
- **Test each V2 file independently**
- **Compare outputs with original V1 files**
- **Mock external dependencies (RPC, Jito API)**
- **Validate key generation produces same addresses**

### Integration Testing Approach
- **End-to-end workflow testing**
- **Real RPC endpoint testing (devnet/testnet)**
- **Jito Bundle submission testing**
- **Performance benchmarking**

### Migration Validation
- **Side-by-side comparison tests**
- **Identical output validation**
- **Performance regression testing**
- **Memory usage comparison**

## Timeline Estimate (Updated)

- **Phase 1**: 2-3 days (setup, dependencies, testing infrastructure)
- **Phase 2**: 4-6 days (core infrastructure V2 files + tests)
- **Phase 3**: 6-8 days (transaction handling V2 files + tests)
- **Phase 4**: 3-4 days (supporting systems V2 files + tests)
- **Phase 5**: 4-6 days (comprehensive testing & validation)

**Total Estimated Time**: 19-27 days

## Recommendation (Updated for V2 Testing Approach)

Given the scope of changes required and the need for safe incremental testing:

### 1. **V2 File Strategy Benefits**
- **Zero risk to production code** - Original files remain untouched
- **Side-by-side testing** - Direct comparison between V1 and V2 implementations
- **Gradual validation** - Test each component independently
- **Easy rollback** - Can abandon V2 files if issues arise

### 2. **Incremental Development Approach**
- **Start with infrastructure files** (AppConfigV2, createKeysV2)
- **Build comprehensive test suite** for each V2 file
- **Validate identical behavior** between V1 and V2
- **Only replace original files** after thorough validation

### 3. **Risk Mitigation**
- **Comprehensive testing infrastructure** before any migration
- **Performance benchmarking** to ensure no regressions
- **Jito Bundle compatibility validation** at each step
- **Maintain backup strategy** with original files

### 4. **Production Transition Strategy**
- **Phase 1**: Development and testing with V2 files
- **Phase 2**: Limited production testing (small transactions)
- **Phase 3**: Gradual rollout with monitoring
- **Phase 4**: Full replacement only after validation

## Next Steps (Immediate Actions)

### 1. **Set Up Testing Infrastructure** (Day 1)
```bash
# Install all testing dependencies
npm install --save-dev jest @types/jest ts-jest @solana/test-helpers @solana/jest-environment-solana benchmark @types/benchmark sinon @types/sinon nock

# Create test directory structure
mkdir -p tests/{unit,integration,migration,performance,mocks}

# Set up Jest configuration
```

### 2. **Install Solana Kit Packages** (Day 1)
```bash
# Core Solana Kit packages
npm install @solana/kit @solana-program/system @solana-program/token @solana-program/compute-budget @solana/compat
```

### 3. **Create First V2 File** (Day 2-3)
- Start with `src/createKeysV2.ts`
- Create corresponding test: `tests/unit/createKeysV2.test.ts`
- Validate key generation produces identical addresses
- Performance test key generation speed

### 4. **Validate Testing Approach** (Day 3-4)
- Ensure V1 vs V2 comparison tests work correctly
- Verify mock infrastructure for RPC/Jito testing
- Test CI/CD integration if applicable

### 5. **Document Progress** (Ongoing)
- Track each V2 file completion status
- Document any API differences discovered
- Record performance benchmarks
- Note compatibility issues with Jito/Raydium SDKs

## Success Criteria for Each V2 File

### ✅ **File Completion Checklist**
- [ ] V2 file implements all original functionality
- [ ] Unit tests pass with 100% coverage
- [ ] Integration test validates end-to-end workflow  
- [ ] Performance benchmark shows no regression
- [ ] V1 vs V2 comparison test passes
- [ ] No breaking changes to external interfaces
- [ ] Documentation updated with new patterns

### 🔍 **Quality Gates**
- **Functionality**: Identical behavior to V1 file
- **Performance**: No more than 5% performance degradation  
- **Compatibility**: Works with existing Jito/Raydium integrations
- **Security**: Maintains or improves security posture
- **Testing**: Comprehensive test coverage (>90%)

---

*Note: This V2 testing approach significantly reduces migration risk while providing a clear validation path for the complete Solana Kit transition.*
