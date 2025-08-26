import { address, type Address } from '@solana/addresses';
import { fetchAddressesForLookupTables } from '@solana/kit';
import type { AddressesByLookupTableAddress } from '@solana/transaction-messages';
import { createAppConfigV2 } from '../config/AppConfigV2';

/**
 * V2 Lookup Table Provider using Solana Kit functional patterns
 * Simplified approach leveraging built-in fetchAddressesForLookupTables()
 */
export class LookupTableProviderV2 {
  private lookupTableCache: Map<string, Address[]> = new Map();
  private addressToLookupTablesMapping: Map<string, Set<string>> = new Map();

  async getLookupTableAddresses(
    lutAddress: Address,
  ): Promise<Address[] | null> {
    const lutAddressStr = lutAddress.toString();
    
    // Check cache first
    if (this.lookupTableCache.has(lutAddressStr)) {
      return this.lookupTableCache.get(lutAddressStr)!;
    }

    try {
      const config = await createAppConfigV2();
      
      // ✅ Use Solana Kit v2.0 functional approach
      const addressesByLookupTable = await fetchAddressesForLookupTables(
        [lutAddress], 
        config.rpc
      );

      const addresses = addressesByLookupTable[lutAddress];
      if (!addresses) {
        return null;
      }

      // Update cache
      this.updateCache(lutAddress, addresses);
      return addresses;
    } catch (error) {
      console.error('Failed to fetch lookup table:', error);
      return null;
    }
  }

  private updateCache(lutAddress: Address, addresses: Address[]) {
    const lutAddressStr = lutAddress.toString();
    this.lookupTableCache.set(lutAddressStr, addresses);

    // Update reverse mapping for optimization algorithm
    for (const addr of addresses) {
      const addrStr = addr.toString();
      if (!this.addressToLookupTablesMapping.has(addrStr)) {
        this.addressToLookupTablesMapping.set(addrStr, new Set());
      }
      this.addressToLookupTablesMapping.get(addrStr)!.add(lutAddressStr);
    }
  }

  /**
   * Core optimization algorithm - remains the same logic, just updated types
   */
  async computeIdealLookupTablesForAddresses(
    addresses: Address[],
    knownLookupTables: Address[] = []
  ): Promise<{ lutAddress: Address; addresses: Address[] }[]> {
    const MIN_ADDRESSES_TO_INCLUDE_TABLE = 2;
    const MAX_TABLE_COUNT = 3;

    // Ensure all known lookup tables are cached
    for (const lutAddr of knownLookupTables) {
      await this.getLookupTableAddresses(lutAddr);
    }

    const addressSet = new Set<string>();
    const tableIntersections = new Map<string, number>();
    const selectedTables: { lutAddress: Address; addresses: Address[] }[] = [];
    const remainingAddresses = new Set<string>();

    // Build intersection counts
    for (const addr of addresses) {
      const addrStr = addr.toString();
      if (addressSet.has(addrStr)) continue;
      addressSet.add(addrStr);

      const tablesForAddress = this.addressToLookupTablesMapping.get(addrStr) || new Set();
      if (tablesForAddress.size === 0) continue;

      remainingAddresses.add(addrStr);

      for (const lutAddress of tablesForAddress) {
        const count = tableIntersections.get(lutAddress) || 0;
        tableIntersections.set(lutAddress, count + 1);
      }
    }

    // Select optimal tables
    const sortedIntersections = Array.from(tableIntersections.entries())
      .sort((a, b) => b[1] - a[1]);

    for (const [lutAddressStr, intersectionSize] of sortedIntersections) {
      if (intersectionSize < MIN_ADDRESSES_TO_INCLUDE_TABLE) break;
      if (selectedTables.length >= MAX_TABLE_COUNT) break;
      if (remainingAddresses.size <= 1) break;

      const lutAddresses = this.lookupTableCache.get(lutAddressStr);
      if (!lutAddresses) continue;

      const matchingAddresses = lutAddresses.filter(addr => 
        remainingAddresses.has(addr.toString())
      );

      if (matchingAddresses.length >= MIN_ADDRESSES_TO_INCLUDE_TABLE) {
        selectedTables.push({
          lutAddress: address(lutAddressStr),
          addresses: matchingAddresses
        });

        // Remove matched addresses from remaining set
        for (const addr of matchingAddresses) {
          remainingAddresses.delete(addr.toString());
        }
      }
    }

    return selectedTables;
  }
}

const lookupTableProviderV2 = new LookupTableProviderV2();

export { lookupTableProviderV2 as lookupTableProvider };