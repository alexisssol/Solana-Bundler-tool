import {
  generateWalletsV2,
  createKeypairFromBase64,
  createKeypairWithBase64Enhanced,
  createKeypairWithBase64,
  validateBase64PrivateKey,
  exportKeypairAsBase64,
  batchCreateKeypairsWithBase64,
  loadKeypairsV2
} from '../../src/V2/createKeysV2';
import { generateKeyPairSigner, createKeyPairSignerFromBytes, type KeyPairSigner } from '@solana/kit';
import { Keypair } from '@solana/web3.js';
import * as fs from 'fs';
import * as path from 'path';

// Mock the SecureKeypairManagerV2 to avoid file system dependencies in tests
jest.mock('../../src/config/SecureKeypairManagerV2', () => {
  return {
    SecureKeypairManagerV2: jest.fn().mockImplementation(() => ({
      loadAllKeypairs: jest.fn().mockResolvedValue([]),
      getKeypairInfo: jest.fn().mockResolvedValue(undefined),
    }))
  };
});

// Mock the prompt to avoid interactive input in tests
jest.mock('prompt-sync', () => {
  return jest.fn(() => jest.fn().mockReturnValue('u'));
});

describe('createKeysV2', () => {
  
  describe('generateWalletsV2', () => {
    test('should generate specified number of wallets', async () => {
      const numWallets = 3;
      const wallets = await generateWalletsV2(numWallets);
      
      expect(wallets).toBeDefined();
      expect(Array.isArray(wallets)).toBe(true);
      expect(wallets.length).toBe(numWallets);
      
      // Verify each wallet has required properties
      wallets.forEach((wallet, index) => {
        expect(wallet).toBeDefined();
        expect(wallet.address).toBeDefined();
        expect(typeof wallet.address).toBe('string');
        expect(wallet.address.length).toBeGreaterThan(0);
      });
      
      // Verify all addresses are unique
      const addresses = wallets.map(w => w.address);
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(numWallets);
    });

    test('should handle zero wallets request', async () => {
      const wallets = await generateWalletsV2(0);
      expect(wallets).toBeDefined();
      expect(Array.isArray(wallets)).toBe(true);
      expect(wallets.length).toBe(0);
    });

    test('should create single wallet correctly', async () => {
      const wallets = await generateWalletsV2(1);
      expect(wallets.length).toBe(1);
      expect(wallets[0]).toBeDefined();
      expect(wallets[0].address).toBeDefined();
      expect(typeof wallets[0].address).toBe('string');
    });

    test('should create multiple unique wallets', async () => {
      const wallets = await generateWalletsV2(5);
      
      // Check that all wallets are unique
      const addresses = wallets.map(w => w.address);
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(5);
      
      // Check that each wallet has a valid-looking Solana address
      addresses.forEach(address => {
        expect(address).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/); // Base58 format
      });
    });
  });
  
  describe('createKeypairFromBase64', () => {
    test('should create keypair from valid 64-byte base64 private key', async () => {
      // Generate a test keypair to get valid 64-byte format
      const testKeypair = Keypair.generate();
      const privateKeyBase64 = Buffer.from(testKeypair.secretKey).toString('base64');
      
      const result = await createKeypairFromBase64(privateKeyBase64);
      
      expect(result).toBeDefined();
      expect(result.address).toBeDefined();
      expect(typeof result.address).toBe('string');
      expect(result.address.length).toBeGreaterThan(0);
    });

    test('should throw error for invalid base64 format', async () => {
      const invalidBase64 = 'invalid-base64-string';
      
      await expect(createKeypairFromBase64(invalidBase64)).rejects.toThrow(
        'Failed to create keypair from base64'
      );
    });

    test('should throw error for wrong length private key', async () => {
      // Create a 32-byte key (wrong length for this function)
      const wrongLengthKey = Buffer.alloc(32, 1).toString('base64');
      
      await expect(createKeypairFromBase64(wrongLengthKey)).rejects.toThrow(
        'Invalid private key length: expected 64 bytes, got 32'
      );
    });
  });

  describe('createKeypairWithBase64Enhanced', () => {
    test('should create enhanced keypair with all required properties', async () => {
      const result = await createKeypairWithBase64Enhanced();
      
      expect(result).toBeDefined();
      expect(result.signer).toBeDefined();
      expect(result.privateKeyBase64).toBeDefined();
      expect(result.address).toBeDefined();
      expect(result.privateKeyBytes).toBeDefined();
      
      // Verify types
      expect(typeof result.privateKeyBase64).toBe('string');
      expect(typeof result.address).toBe('string');
      expect(result.privateKeyBytes).toBeInstanceOf(Uint8Array);
      
      // Verify address matches signer address
      expect(result.address).toBe(result.signer.address);
      
      // Verify private key bytes length (should be 64 bytes)
      expect(result.privateKeyBytes.length).toBe(64);
      
      // Verify base64 encoding is correct
      const decodedBytes = Buffer.from(result.privateKeyBase64, 'base64');
      expect(decodedBytes).toEqual(Buffer.from(result.privateKeyBytes));
    });

    test('should create unique keypairs on multiple calls', async () => {
      const result1 = await createKeypairWithBase64Enhanced();
      const result2 = await createKeypairWithBase64Enhanced();
      
      expect(result1.address).not.toBe(result2.address);
      expect(result1.privateKeyBase64).not.toBe(result2.privateKeyBase64);
    });
  });

  describe('createKeypairWithBase64', () => {
    test('should create keypair with basic required properties', async () => {
      const result = await createKeypairWithBase64();
      
      expect(result).toBeDefined();
      expect(result.signer).toBeDefined();
      expect(result.privateKeyBase64).toBeDefined();
      expect(result.address).toBeDefined();
      
      // Verify types
      expect(typeof result.privateKeyBase64).toBe('string');
      expect(typeof result.address).toBe('string');
      
      // Verify address matches signer address
      expect(result.address).toBe(result.signer.address);
    });

    test('should create unique keypairs on multiple calls', async () => {
      const result1 = await createKeypairWithBase64();
      const result2 = await createKeypairWithBase64();
      
      expect(result1.address).not.toBe(result2.address);
      expect(result1.privateKeyBase64).not.toBe(result2.privateKeyBase64);
    });
  });

  describe('validateBase64PrivateKey', () => {
    test('should validate 32-byte base64 private key', () => {
      const validKey32 = Buffer.alloc(32, 1).toString('base64');
      expect(validateBase64PrivateKey(validKey32)).toBe(true);
    });

    test('should validate 64-byte base64 private key', () => {
      const validKey64 = Buffer.alloc(64, 1).toString('base64');
      expect(validateBase64PrivateKey(validKey64)).toBe(true);
    });

    test('should reject invalid base64', () => {
      expect(validateBase64PrivateKey('invalid-base64!')).toBe(false);
    });

    test('should reject wrong length keys', () => {
      const wrongLengthKey = Buffer.alloc(16, 1).toString('base64');
      expect(validateBase64PrivateKey(wrongLengthKey)).toBe(false);
    });
  });

  describe('batchCreateKeypairsWithBase64', () => {
    test('should create specified number of keypairs', async () => {
      const count = 3;
      const results = await batchCreateKeypairsWithBase64(count);
      
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(count);
      
      // Verify each result has required properties
      results.forEach((result, index) => {
        expect(result.signer).toBeDefined();
        expect(result.privateKeyBase64).toBeDefined();
        expect(result.address).toBeDefined();
        expect(typeof result.address).toBe('string');
        expect(typeof result.privateKeyBase64).toBe('string');
        expect(result.address).toBe(result.signer.address);
      });
      
      // Verify all addresses are unique
      const addresses = results.map(r => r.address);
      const uniqueAddresses = new Set(addresses);
      expect(uniqueAddresses.size).toBe(count);
    });

    test('should handle zero count', async () => {
      const results = await batchCreateKeypairsWithBase64(0);
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBe(0);
    });

    test('should handle single keypair creation', async () => {
      const results = await batchCreateKeypairsWithBase64(1);
      expect(results.length).toBe(1);
      expect(results[0].signer).toBeDefined();
      expect(results[0].address).toBeDefined();
    });
  });

  describe('loadKeypairsV2', () => {
    test('should handle empty keypair directory gracefully', async () => {
      const result = await loadKeypairsV2();
      
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      // Should return empty array when no keypairs are found or manager fails
      expect(result.length).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    test('should create keypair and validate its properties', async () => {
      const enhanced = await createKeypairWithBase64Enhanced();
      
      // Verify the private key is valid according to our validator
      expect(validateBase64PrivateKey(enhanced.privateKeyBase64)).toBe(true);
      
      // Verify we can create a keypair from the base64 (should work after fixing length issue)
      // Note: This might need adjustment based on the 32 vs 64 byte issue resolution
      const decodedBytes = Buffer.from(enhanced.privateKeyBase64, 'base64');
      expect(decodedBytes.length).toBe(64);
    });

    test('should maintain consistency between enhanced and basic creation', async () => {
      const enhanced = await createKeypairWithBase64Enhanced();
      const basic = await createKeypairWithBase64();
      
      // Both should have valid addresses
      expect(enhanced.address).toBeDefined();
      expect(basic.address).toBeDefined();
      
      // Both should have valid base64 keys
      expect(validateBase64PrivateKey(enhanced.privateKeyBase64)).toBe(true);
      expect(validateBase64PrivateKey(basic.privateKeyBase64)).toBe(true);
      
      // They should be different
      expect(enhanced.address).not.toBe(basic.address);
    });
  });

  describe('Error Handling', () => {
    test('should handle crypto API failures gracefully', async () => {
      // Mock crypto.getRandomValues to throw an error
      const originalGetRandomValues = global.crypto.getRandomValues;
      global.crypto.getRandomValues = jest.fn(() => {
        throw new Error('Crypto API failure');
      });

      await expect(createKeypairWithBase64Enhanced()).rejects.toThrow();

      // Restore original function
      global.crypto.getRandomValues = originalGetRandomValues;
    });
  });
});
