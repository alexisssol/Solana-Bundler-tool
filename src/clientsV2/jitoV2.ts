import { createKeyPairSignerFromBytes, type KeyPairSigner } from '@solana/kit';
import { configV2 } from './configV2';
import { geyserClient as jitoGeyserClient } from 'jito-ts';
import {
  SearcherClient,
  searcherClient as jitoSearcherClient,
} from 'jito-ts/dist/sdk/block-engine/searcher.js';
import { Keypair } from '@solana/web3.js';
import { promises as fs } from 'fs';

// Configuration constants
const BLOCK_ENGINE_URLS = configV2.get('block_engine_urls');
const AUTH_KEYPAIR_PATH = configV2.get('auth_keypair_path');
const GEYSER_URL = configV2.get('geyser_url');
const GEYSER_ACCESS_TOKEN = configV2.get('geyser_access_token');

// Validation
if (!BLOCK_ENGINE_URLS || BLOCK_ENGINE_URLS.length === 0) {
  throw new Error('Block engine URLs not configured');
}

if (!AUTH_KEYPAIR_PATH) {
  throw new Error('Auth keypair path not configured');
}

// Load keypair synchronously (at module load time)
const secretKeyArray = JSON.parse(
  require('fs').readFileSync(AUTH_KEYPAIR_PATH, 'utf-8')
) as number[];
const secretKeyBytes = new Uint8Array(secretKeyArray);

// Create both V2 and legacy keypairs
export const authKeypairV2: KeyPairSigner = createKeyPairSignerFromBytes(secretKeyBytes);
export const authKeypairLegacy: Keypair = Keypair.fromSecretKey(secretKeyBytes);

// Initialize searcher clients
export const searcherClients: SearcherClient[] = BLOCK_ENGINE_URLS.map(url => 
  jitoSearcherClient(url, authKeypairLegacy, {
    'grpc.keepalive_timeout_ms': 4000,
  })
);

// Primary searcher client (first in array - closest region)
export const searcherClient: SearcherClient = searcherClients[0];

// Initialize geyser client
export const geyserClient = jitoGeyserClient(GEYSER_URL, GEYSER_ACCESS_TOKEN, {
  'grpc.keepalive_timeout_ms': 4000,
});

// Log successful initialization
console.log('✅ Jito clients initialized successfully (Solana Kit V2)');
console.log(`🔗 Connected to ${BLOCK_ENGINE_URLS.length} block engine(s)`);
console.log(`🔑 Auth keypair address: ${authKeypairV2.address}`);

// Export everything for easy access
export {
  authKeypairV2 as authKeypair,
  searcherClient as defaultSearcherClient,
  searcherClients as allSearcherClients,
  geyserClient as defaultGeyserClient
};