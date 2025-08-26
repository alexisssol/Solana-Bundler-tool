import { 
  getStructCodec, 
  getU8Codec, 
  getU32Codec, 
  getU64Codec 
} from '@solana/codecs';
import { getAddressCodec } from '@solana/addresses';
import type { Address } from '@solana/addresses';

// ✅ Modern Solana Kit 2.0 approach using codecs
export const SPL_MINT_CODEC = getStructCodec([
  ['mintAuthorityOption', getU32Codec()],
  ['mintAuthority', getAddressCodec()],
  ['supply', getU64Codec()],
  ['decimals', getU8Codec()],
  ['isInitialized', getU8Codec()],
  ['freezeAuthorityOption', getU32Codec()],
  ['freezeAuthority', getAddressCodec()]
]);

export const SPL_ACCOUNT_CODEC = getStructCodec([
  ['mint', getAddressCodec()],
  ['owner', getAddressCodec()],
  ['amount', getU64Codec()],
  ['delegateOption', getU32Codec()],
  ['delegate', getAddressCodec()],
  ['state', getU8Codec()],
  ['isNativeOption', getU32Codec()],
  ['isNative', getU64Codec()],
  ['delegatedAmount', getU64Codec()],
  ['closeAuthorityOption', getU32Codec()],
  ['closeAuthority', getAddressCodec()]
]);

// ✅ Type definitions for better TypeScript support
export type SPLMintData = {
  mintAuthorityOption: number;
  mintAuthority: Address;
  supply: bigint;
  decimals: number;
  isInitialized: number;
  freezeAuthorityOption: number;
  freezeAuthority: Address;
};

export type SPLAccountData = {
  mint: Address;
  owner: Address;
  amount: bigint;
  delegateOption: number;
  delegate: Address;
  state: number;
  isNativeOption: number;
  isNative: bigint;
  delegatedAmount: bigint;
  closeAuthorityOption: number;
  closeAuthority: Address;
};

// ✅ Backward compatibility layer (if needed)
// Keep the old buffer-layout exports for existing code
import { u8, u32, struct } from '@solana/buffer-layout';
import { u64, publicKey } from '@solana/buffer-layout-utils';

export const SPL_MINT_LAYOUT = struct<any>([
  u32('mintAuthorityOption'),
  publicKey('mintAuthority'),
  u64('supply'),
  u8('decimals'),
  u8('isInitialized'),
  u32('freezeAuthorityOption'),
  publicKey('freezeAuthority')
]);

export const SPL_ACCOUNT_LAYOUT = struct<any>([
  publicKey('mint'),
  publicKey('owner'),
  u64('amount'),
  u32('delegateOption'),
  publicKey('delegate'),
  u8('state'),
  u32('isNativeOption'),
  u64('isNative'),
  u64('delegatedAmount'),
  u32('closeAuthorityOption'),
  publicKey('closeAuthority')
]);

// ✅ Helper functions for encoding/decoding
export function encodeSPLMint(data: SPLMintData): Uint8Array {
  return SPL_MINT_CODEC.encode(data);
}

export function decodeSPLMint(bytes: Uint8Array): SPLMintData {
  return SPL_MINT_CODEC.decode(bytes);
}

export function encodeSPLAccount(data: SPLAccountData): Uint8Array {
  return SPL_ACCOUNT_CODEC.encode(data);
}

export function decodeSPLAccount(bytes: Uint8Array): SPLAccountData {
  return SPL_ACCOUNT_CODEC.decode(bytes);
}