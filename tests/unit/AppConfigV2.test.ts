import { AppConfigV2, createAppConfigV2 } from '../../src/config/AppConfigV2';
import { AppConfig } from '../../src/config/AppConfig';
import { generateKeyPairSigner, createKeyPairSignerFromBytes, address } from '@solana/kit';
import * as fs from 'fs';
import * as path from 'path';

// Mock environment variables for testing
const mockEnvVars = {
  POOL_CREATOR_PRIVATE_KEY: '54HCTAreGHMUqy6+o+KE8mVwzWrottBe848AGGRPq/Lcu/Okt+CD3VP3iLfwb9gKRHV6Oi6BJvrnrc9IsINZJQ==',
  FEE_PAYER_PRIVATE_KEY: '6b4QJOpe9ww+76EI+Ht3eiOMQ18t26iVF3s1ARA6vtkfsoWG//PHUxRw4GrLd4XmJNk6wRGd0aUmIZB8e5omGg==',
  RPC_URL: 'https://api.devnet.solana.com',
  TIP_ACCOUNT: 'Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY',
  MIN_TIP_LAMPORTS: '10000',
  TIP_PERCENT: '50',
  BLOCK_ENGINE_URLS: 'frankfurt.mainnet.block-engine.jito.wtf',
  GEYSER_URL: 'mainnet.rpc.jito.wtf',
  GEYSER_ACCESS_TOKEN: '00000000-0000-0000-0000-000000000000',
  BOT_NAME: 'test-bot',
  NUM_WORKER_THREADS: '4',
  ARB_CALCULATION_NUM_STEPS: '3',
  MAX_ARB_CALCULATION_TIME_MS: '15',
  RAYDIUM_LIQUIDITY_POOL_V4: '675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8'
};

describe('AppConfigV2', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeAll(() => {
    // Store original environment
    originalEnv = { ...process.env };
    
    // Set mock environment variables
    Object.assign(process.env, mockEnvVars);
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe('Initialization', () => {
    test('should create AppConfigV2 instance with valid environment variables', async () => {
      const config = await AppConfigV2.create();
      
      expect(config).toBeInstanceOf(AppConfigV2);
      expect(config.rpcUrl).toBe('https://api.devnet.solana.com');
      expect(config.botName).toBe('test-bot');
      expect(config.minTipLamports).toBe(10000);
      expect(config.tipPercent).toBe(50);
    });

    test('should throw error if required environment variables are missing', async () => {
      // Temporarily remove required env vars
      delete process.env.POOL_CREATOR_PRIVATE_KEY;
      delete process.env.FEE_PAYER_PRIVATE_KEY;

      await expect(AppConfigV2.create()).rejects.toThrow(
        'Missing required environment variables: POOL_CREATOR_PRIVATE_KEY, FEE_PAYER_PRIVATE_KEY'
      );

      // Restore env vars
      process.env.POOL_CREATOR_PRIVATE_KEY = mockEnvVars.POOL_CREATOR_PRIVATE_KEY;
      process.env.FEE_PAYER_PRIVATE_KEY = mockEnvVars.FEE_PAYER_PRIVATE_KEY;
    });

    test('should use default values when optional environment variables are not set', async () => {
      // Remove optional env vars
      delete process.env.RPC_URL;
      delete process.env.BOT_NAME;
      delete process.env.MIN_TIP_LAMPORTS;

      const config = await AppConfigV2.create();
      
      expect(config.rpcUrl).toBe('https://api.mainnet-beta.solana.com');
      expect(config.botName).toBe('local');
      expect(config.minTipLamports).toBe(10000);

      // Restore env vars
      process.env.RPC_URL = mockEnvVars.RPC_URL;
      process.env.BOT_NAME = mockEnvVars.BOT_NAME;
      process.env.MIN_TIP_LAMPORTS = mockEnvVars.MIN_TIP_LAMPORTS;
    });
  });

  describe('Solana Kit Integration', () => {
    test('should create Solana Kit RPC instances', async () => {
      const config = await AppConfigV2.create();
      
      expect(config.rpc).toBeDefined();
      expect(config.rpcSubscriptions).toBeDefined();
      expect(typeof config.rpc.getLatestBlockhash).toBe('function');
    });

    test('should create KeyPairSigner instances for wallet and payer', async () => {
      const config = await AppConfigV2.create();
      
      expect(config.wallet).toBeDefined();
      expect(config.payer).toBeDefined();
      expect(config.wallet.address).toBeDefined();
      expect(config.payer.address).toBeDefined();
      expect(typeof config.wallet.address).toBe('string');
      expect(typeof config.payer.address).toBe('string');
    });

    test('should create Address instances for program IDs and tip accounts', async () => {
      const config = await AppConfigV2.create();
      
      expect(config.tipAccount).toBeDefined();
      expect(config.rayLiqPoolv4).toBeDefined();
      expect(config.tipAccounts).toHaveLength(8);
      expect(typeof config.tipAccount).toBe('string');
      expect(typeof config.rayLiqPoolv4).toBe('string');
      
      // Check that all tip accounts are Address types
      config.tipAccounts.forEach(tipAccount => {
        expect(typeof tipAccount).toBe('string');
      });
    });
  });

  describe('Utility Methods', () => {
    test('should return random tip account', async () => {
      const config = await AppConfigV2.create();
      const tipAccount1 = config.getRandomTipAccount();
      const tipAccount2 = config.getRandomTipAccount();
      
      expect(config.tipAccounts).toContain(tipAccount1);
      expect(config.tipAccounts).toContain(tipAccount2);
    });

    test('should provide backward compatibility address getters', async () => {
      const config = await AppConfigV2.create();
      
      expect(config.walletAddress).toBe(config.wallet.address);
      expect(config.payerAddress).toBe(config.payer.address);
    });

  });

  describe('Factory Method', () => {
    test('should create instance using factory method', async () => {
      const config = await createAppConfigV2();
      
      expect(config).toBeInstanceOf(AppConfigV2);
      expect(config.wallet).toBeDefined();
      expect(config.payer).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid private key format', async () => {
      process.env.POOL_CREATOR_PRIVATE_KEY = 'invalid-base58-key';
      
      await expect(AppConfigV2.create()).rejects.toThrow(
        'Invalid private key format in POOL_CREATOR_PRIVATE_KEY'
      );
      
      // Restore valid key
      process.env.POOL_CREATOR_PRIVATE_KEY = mockEnvVars.POOL_CREATOR_PRIVATE_KEY;
    });
  });
});
