// Test environment setup
import * as dotenv from 'dotenv';

// Load test environment variables
dotenv.config({ path: '.env.test' });

// Set default test environment variables if not provided
process.env.POOL_CREATOR_PRIVATE_KEY = process.env.POOL_CREATOR_PRIVATE_KEY || 'test_private_key_base58_here';
process.env.FEE_PAYER_PRIVATE_KEY = process.env.FEE_PAYER_PRIVATE_KEY || 'test_private_key_base58_here';
process.env.RPC_URL = process.env.RPC_URL || 'https://api.devnet.solana.com';

// Increase timeout for Solana operations
jest.setTimeout(30000);
