import { createKeyPairSignerFromBytes, type KeyPairSigner } from '@solana/kit';
import { configV2 } from './configV2';
import { geyserClient as jitoGeyserClient } from 'jito-ts';
import {
  SearcherClient,
  searcherClient as jitoSearcherClient,
} from 'jito-ts/dist/sdk/block-engine/searcher.js';
import { promises as fs } from 'fs';

// Configuration constants
const BLOCK_ENGINE_URLS = configV2.get('block_engine_urls');
const AUTH_KEYPAIR_PATH = configV2.get('auth_keypair_path');
const GEYSER_URL = configV2.get('geyser_url');
const GEYSER_ACCESS_TOKEN = configV2.get('geyser_access_token');

// V2 Keypair and clients (async initialization required)
let authKeypairV2: KeyPairSigner;
let searcherClientsV2: SearcherClient[] = [];
let geyserClientV2: any;
let searcherClientV2: SearcherClient;

// Async initialization function
async function initializeJitoClientsV2(): Promise<{
  authKeypair: KeyPairSigner;
  searcherClient: SearcherClient;
  searcherClients: SearcherClient[];
  geyserClient: any;
}> {
  try {
    // Validate configuration
    if (!BLOCK_ENGINE_URLS) {
      throw new Error('Block engine URLs not configured');
    }
    
    if (!AUTH_KEYPAIR_PATH) {
      throw new Error('Auth keypair path not configured');
    }

    // Load keypair using V2 async pattern
    const secretKeyArray = JSON.parse(
      await fs.readFile(AUTH_KEYPAIR_PATH, 'utf-8')
    ) as number[];
    const secretKeyBytes = new Uint8Array(secretKeyArray);
    
    // Create V2 KeyPairSigner
    authKeypairV2 = await createKeyPairSignerFromBytes(secretKeyBytes);

    // Initialize searcher clients with proper legacy keypair conversion
    searcherClientsV2 = [];
    for (const url of BLOCK_ENGINE_URLS) {
      // Convert V2 signer to legacy keypair for Jito compatibility
      const legacyKeypair = await convertSignerToLegacyKeypair(secretKeyBytes);
      
      const client = jitoSearcherClient(url, legacyKeypair, {
        'grpc.keepalive_timeout_ms': 4000,
      });
      searcherClientsV2.push(client);
    }

    // Initialize geyser client
    geyserClientV2 = jitoGeyserClient(GEYSER_URL, GEYSER_ACCESS_TOKEN, {
      'grpc.keepalive_timeout_ms': 4000,
    });

    // Set primary searcher client (first in array - closest region)
    searcherClientV2 = searcherClientsV2[0];

    console.log('✅ Jito clients initialized successfully (Solana Kit V2)');
    console.log(`🔗 Connected to ${BLOCK_ENGINE_URLS.length} block engine(s)`);
    console.log(`🔑 Auth keypair address: ${authKeypairV2.address}`);

    return {
      authKeypair: authKeypairV2,
      searcherClient: searcherClientV2,
      searcherClients: searcherClientsV2,
      geyserClient: geyserClientV2,
    };
  } catch (error) {
    console.error('❌ Failed to initialize Jito clients:', error);
    throw error;
  }
}

// Updated compatibility helper function
async function convertSignerToLegacyKeypair(secretKeyBytes: Uint8Array): Promise<any> {
  try {
    // Import legacy Keypair for compatibility
    const { Keypair } = await import('@solana/web3.js');
    
    // Create legacy keypair directly from the same secret key bytes
    // that were used to create the V2 KeyPairSigner
    return Keypair.fromSecretKey(secretKeyBytes);
  } catch (error) {
    throw new Error(`Failed to create legacy keypair for Jito compatibility: ${error}`);
  }
}

// Getter functions for accessing initialized clients
export function getAuthKeypair(): KeyPairSigner {
  if (!authKeypairV2) {
    throw new Error('Jito clients not initialized. Call initializeJitoClientsV2() first.');
  }
  return authKeypairV2;
}

export function getSearcherClient(): SearcherClient {
  if (!searcherClientV2) {
    throw new Error('Jito clients not initialized. Call initializeJitoClientsV2() first.');
  }
  return searcherClientV2;
}

export function getSearcherClients(): SearcherClient[] {
  if (!searcherClientsV2 || searcherClientsV2.length === 0) {
    throw new Error('Jito clients not initialized. Call initializeJitoClientsV2() first.');
  }
  return searcherClientsV2;
}

export function getGeyserClient(): any {
  if (!geyserClientV2) {
    throw new Error('Jito clients not initialized. Call initializeJitoClientsV2() first.');
  }
  return geyserClientV2;
}

// Main export for initialization
export { initializeJitoClientsV2 };

// Backward compatibility exports (deprecated - use getter functions)
export const privateKey = () => {
  console.warn('⚠️ privateKey export is deprecated. Use getAuthKeypair() instead.');
  return getAuthKeypair();
};

export const searcherClient = () => {
  console.warn('⚠️ Direct searcherClient export is deprecated. Use getSearcherClient() instead.');
  return getSearcherClient();
};

export const searcherClients = () => {
  console.warn('⚠️ Direct searcherClients export is deprecated. Use getSearcherClients() instead.');
  return getSearcherClients();
};

export const geyserClient = () => {
  console.warn('⚠️ Direct geyserClient export is deprecated. Use getGeyserClient() instead.');
  return getGeyserClient();
};