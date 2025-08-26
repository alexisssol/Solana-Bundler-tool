import { address, type Address } from '@solana/addresses';
import { fetchAddressesForLookupTables } from '@solana/kit';
import type { AddressesByLookupTableAddress } from '@solana/transaction-messages';
import { LookupTableProviderV2 } from '../../src/clientsV2/LookupTableProviderV2';

// Mock external dependencies
jest.mock('@solana/kit', () => ({
  fetchAddressesForLookupTables: jest.fn(),
}));

jest.mock('../../src/config/AppConfigV2', () => ({
  createAppConfigV2: jest.fn(() => ({
    rpc: { mockRpc: 'test' }
  })),
}));

const mockFetchAddressesForLookupTables = fetchAddressesForLookupTables as jest.MockedFunction<typeof fetchAddressesForLookupTables>;

describe('LookupTableProviderV2', () => {
  let provider: LookupTableProviderV2;

  // Test addresses
  const lutAddress1 = address('Gr8rXuDwE2Vd2F5tifkPyMaUR67636YgrZEjkJf9RR9V');
  const lutAddress2 = address('22222222222222222222222222222222222222222222');
  const addr1 = address('11111111111111111111111111111111111111111111');
  const addr2 = address('33333333333333333333333333333333333333333333');
  const addr3 = address('44444444444444444444444444444444444444444444');
  const addr4 = address('55555555555555555555555555555555555555555555');

  beforeEach(() => {
    provider = new LookupTableProviderV2();
    jest.clearAllMocks();
  });

  describe('Unit Tests - Pure Logic', () => {
    describe('getLookupTableAddresses', () => {
      it('should fetch and cache lookup table addresses', async () => {
        // Arrange
        const mockResponse: AddressesByLookupTableAddress = {
          [lutAddress1]: [addr1, addr2, addr3]
        };
        mockFetchAddressesForLookupTables.mockResolvedValue(mockResponse);

        // Act
        const result = await provider.getLookupTableAddresses(lutAddress1);

        // Assert
        expect(result).toEqual([addr1, addr2, addr3]);
        expect(mockFetchAddressesForLookupTables).toHaveBeenCalledTimes(1);
        expect(mockFetchAddressesForLookupTables).toHaveBeenCalledWith(
          [lutAddress1],
          expect.any(Object)
        );
      });

      it('should return cached results on subsequent calls', async () => {
        // Arrange
        const mockResponse: AddressesByLookupTableAddress = {
          [lutAddress1]: [addr1, addr2]
        };
        mockFetchAddressesForLookupTables.mockResolvedValue(mockResponse);

        // Act
        const result1 = await provider.getLookupTableAddresses(lutAddress1);
        const result2 = await provider.getLookupTableAddresses(lutAddress1);

        // Assert
        expect(result1).toEqual(result2);
        expect(mockFetchAddressesForLookupTables).toHaveBeenCalledTimes(1); // Only called once
      });

      it('should return null when lookup table does not exist', async () => {
        // Arrange
        const mockResponse: AddressesByLookupTableAddress = {};
        mockFetchAddressesForLookupTables.mockResolvedValue(mockResponse);

        // Act
        const result = await provider.getLookupTableAddresses(lutAddress1);

        // Assert
        expect(result).toBeNull();
      });

      it('should handle RPC errors gracefully', async () => {
        // Arrange
        mockFetchAddressesForLookupTables.mockRejectedValue(new Error('RPC Error'));

        // Act
        const result = await provider.getLookupTableAddresses(lutAddress1);

        // Assert
        expect(result).toBeNull();
      });
    });

    describe('computeIdealLookupTablesForAddresses - Core Algorithm', () => {
      beforeEach(async () => {
        // Pre-populate cache with test data
        const mockResponse1: AddressesByLookupTableAddress = {
          [lutAddress1]: [addr1, addr2, addr3]
        };
        const mockResponse2: AddressesByLookupTableAddress = {
          [lutAddress2]: [addr2, addr3, addr4]
        };
        
        mockFetchAddressesForLookupTables
          .mockResolvedValueOnce(mockResponse1)
          .mockResolvedValueOnce(mockResponse2);

        await provider.getLookupTableAddresses(lutAddress1);
        await provider.getLookupTableAddresses(lutAddress2);
      });

      it('should select optimal lookup tables based on address overlap', async () => {
        // Act
        const result = await provider.computeIdealLookupTablesForAddresses(
          [addr1, addr2, addr3, addr4],
          [lutAddress1, lutAddress2]
        );

        // Assert
        expect(result).toHaveLength(2);
        
        // Both tables should be selected as they have sufficient overlap
        const lutAddresses = result.map(r => r.lutAddress.toString());
        expect(lutAddresses).toContain(lutAddress1.toString());
        expect(lutAddresses).toContain(lutAddress2.toString());
        
        // Verify addresses are correctly mapped
        const lut1Result = result.find(r => r.lutAddress.toString() === lutAddress1.toString());
        const lut2Result = result.find(r => r.lutAddress.toString() === lutAddress2.toString());
        
        expect(lut1Result?.addresses).toEqual(expect.arrayContaining([addr1, addr2, addr3]));
        expect(lut2Result?.addresses).toEqual(expect.arrayContaining([addr2, addr3, addr4]));
      });

      it('should not select tables with insufficient address overlap', async () => {
        // Act - only ask for addr1, which only appears in lutAddress1
        const result = await provider.computeIdealLookupTablesForAddresses(
          [addr1],
          [lutAddress1, lutAddress2]
        );

        // Assert
        expect(result).toHaveLength(0); // No tables selected (need minimum 2 addresses)
      });

      it('should respect MAX_TABLE_COUNT limit', async () => {
        // Arrange - Create multiple lookup tables
        const lutAddress3 = address('66666666666666666666666666666666666666666666');
        const mockResponse3: AddressesByLookupTableAddress = {
          [lutAddress3]: [addr1, addr2] // Overlaps with addr1, addr2
        };
        mockFetchAddressesForLookupTables.mockResolvedValueOnce(mockResponse3);
        await provider.getLookupTableAddresses(lutAddress3);

        // Act
        const result = await provider.computeIdealLookupTablesForAddresses(
          [addr1, addr2, addr3, addr4],
          [lutAddress1, lutAddress2, lutAddress3]
        );

        // Assert
        expect(result.length).toBeLessThanOrEqual(3); // MAX_TABLE_COUNT = 3
      });

      it('should prioritize tables with higher intersection counts', async () => {
        // Act
        const result = await provider.computeIdealLookupTablesForAddresses(
          [addr2, addr3], // These addresses appear in both tables
          [lutAddress1, lutAddress2]
        );

        // Assert - Should select both tables as they have equal intersection
        expect(result).toHaveLength(2);
      });

      it('should handle empty address array', async () => {
        // Act
        const result = await provider.computeIdealLookupTablesForAddresses(
          [],
          [lutAddress1, lutAddress2]
        );

        // Assert
        expect(result).toHaveLength(0);
      });

      it('should handle duplicate addresses in input', async () => {
        // Act
        const result = await provider.computeIdealLookupTablesForAddresses(
          [addr1, addr2, addr2, addr3], // addr2 is duplicated
          [lutAddress1, lutAddress2]
        );

        // Assert - Should work the same as [addr1, addr2, addr3]
        expect(result).toHaveLength(2);
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle unknown lookup table addresses gracefully', async () => {
      // Arrange
      const unknownLutAddress = address('99999999999999999999999999999999999999999999');
      const mockResponse: AddressesByLookupTableAddress = {};
      mockFetchAddressesForLookupTables.mockResolvedValue(mockResponse);

      // Act
      const result = await provider.computeIdealLookupTablesForAddresses(
        [addr1, addr2],
        [unknownLutAddress]
      );

      // Assert
      expect(result).toHaveLength(0);
    });

    it('should handle mixed known and unknown lookup tables', async () => {
      // Arrange
      const knownLutResponse: AddressesByLookupTableAddress = {
        [lutAddress1]: [addr1, addr2]
      };
      const unknownLutResponse: AddressesByLookupTableAddress = {};
      
      mockFetchAddressesForLookupTables
        .mockResolvedValueOnce(knownLutResponse)
        .mockResolvedValueOnce(unknownLutResponse);

      // Act
      const unknownLutAddress = address('99999999999999999999999999999999999999999999');
      const result = await provider.computeIdealLookupTablesForAddresses(
        [addr1, addr2],
        [lutAddress1, unknownLutAddress]
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].lutAddress.toString()).toBe(lutAddress1.toString());
    });
  });

  describe('Cache Behavior', () => {
    it('should build reverse mapping correctly', async () => {
      // Arrange
      const mockResponse: AddressesByLookupTableAddress = {
        [lutAddress1]: [addr1, addr2]
      };
      mockFetchAddressesForLookupTables.mockResolvedValue(mockResponse);

      // Act
      await provider.getLookupTableAddresses(lutAddress1);
      
      // Test that reverse mapping works by using it in optimization
      const result = await provider.computeIdealLookupTablesForAddresses(
        [addr1, addr2],
        [lutAddress1]
      );

      // Assert
      expect(result).toHaveLength(1);
      expect(result[0].addresses).toEqual([addr1, addr2]);
    });
  });
});