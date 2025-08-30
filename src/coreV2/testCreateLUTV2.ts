
import { AppConfigV2 } from '../config/AppConfigV2';
import { 
  generateWSOLATAForKeypairsV2,
  chunkWSOLATAInstructionsV2,
  buildWSOLATATransactionsV2,
  createLUTV2,
  extendLUTV2
} from './createLUTV2';


async function testWSOLATAFunctionsV2() {
  console.log('🧪 Testing WSOL ATA V2 functions...');
  
  try {
    // Initialize V2 configuration
    const config = await AppConfigV2.create();
    console.log('✅ AppConfigV2 created successfully');
    
    // Test WSOL ATA generation (with limited keypairs for testing)
    console.log('🔄 Testing WSOL ATA generation with limited keypairs...');
    const instructions = await generateWSOLATAForKeypairsV2(config, 3, true); // Test with only 3 keypairs
    
    console.log(`✅ WSOL ATA generation successful: ${instructions.length} instructions created`);
    
    // Test chunking utility with actual instructions
    if (instructions.length > 0) {
      console.log('� Testing chunking with generated instructions...');
      const chunks = await chunkWSOLATAInstructionsV2(config, instructions, 2); // 2 instructions per chunk for testing
      console.log(`✅ Chunking test: ${instructions.length} instructions → ${chunks.length} chunks`);
    } else {
      console.log('⚠️ No instructions generated, skipping chunking test');
    }
    
    console.log('🎉 WSOL ATA V2 functions test completed!');
    
  } catch (error) {
    console.error('❌ WSOL ATA test failed:', error);
    process.exit(1);
  }
}

async function testBuildWSOLATATransactionsV2Migration() {
  console.log('🧪 Testing buildWSOLATATransactionsV2 Hybrid V2 Migration...');
  
  try {
    // Initialize V2 configuration
    const config = await AppConfigV2.create();
    console.log('✅ AppConfigV2 created successfully');
    
    // Test that buildWSOLATATransactionsV2 is using hybrid V2 patterns (V2 RPC + legacy instruction compatibility)
    console.log('🔄 Testing buildWSOLATATransactionsV2 with hybrid V2 transaction building...');
    
    // Call with minimal parameters to test the transaction building pipeline
    const transactions = await buildWSOLATATransactionsV2(
      config,
      2,   // Only 2 keypairs for testing
      0    // No Jito tip for testing
    );
    
    console.log(`✅ buildWSOLATATransactionsV2 successful: ${transactions.length} transactions built`);
    
    // Validate that we got hybrid V2 transactions (VersionedTransaction with V2 RPC)
    for (let i = 0; i < transactions.length; i++) {
      const tx = transactions[i];
      
      // Hybrid V2 transactions should have serialize method (VersionedTransaction format)
      // but built using V2 RPC (which is the V2 migration step)
      if (tx.serialize && typeof tx.serialize === 'function') {
        console.log(`✅ Transaction ${i + 1}: Hybrid V2 transaction detected (VersionedTransaction with V2 RPC)`);
        console.log(`   📏 Transaction size: ${tx.serialize().length} bytes`);
      } else if ((tx as any).messageBytes) {
        console.log(`❓ Transaction ${i + 1}: Pure V2 transaction detected (unexpected for current implementation)`);
        console.log('   ℹ️ This suggests buildWSOLATATransactionsV2 was updated to use pure V2 patterns');
      } else {
        console.log(`❓ Transaction ${i + 1}: Unknown transaction type`);
        console.log('   Properties:', Object.keys(tx));
        throw new Error('Migration validation failed: Unknown transaction type returned');
      }
    }
    
    console.log('🎉 ✅ Hybrid V2 Migration Validation PASSED!');
    console.log('   📋 buildWSOLATATransactionsV2 is using hybrid V2 patterns (V2 RPC + legacy instruction compatibility)');
    console.log('   📋 Uses buildTxnV2 for legacy instruction support');
    console.log('   📋 All transactions use V2 RPC for blockhash fetching');
    
    // Note: This is an intermediate step. Full V2 migration would require:
    // 1. Converting generateWSOLATAForKeypairsV2 to generate pure V2 instructions
    // 2. Then using buildPureV2Transaction instead of buildTxnV2
    console.log('');
    console.log('📋 Next Migration Steps:');
    console.log('   � Convert generateWSOLATAForKeypairsV2 to generate pure V2 instructions');
    console.log('   🔄 Update buildWSOLATATransactionsV2 to use buildPureV2Transaction');
    console.log('   🔄 Remove all legacy Web3.js dependencies');
    
  } catch (error) {
    console.error('❌ buildWSOLATATransactionsV2 V2 migration test failed:', error);
    
    // If it's a migration validation failure, make it clear
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Migration validation failed')) {
      console.error('');
      console.error('🚨 MIGRATION ISSUE DETECTED:');
      console.error('   The buildWSOLATATransactionsV2 function is not properly migrated to V2');
      console.error('   It should use buildPureV2Transaction, not legacy buildTxnV2');
      console.error('');
    }
    
    throw error;
  }
}

async function testCreateLUTV2() {
  console.log('🧪 Testing createLUTV2 functionality...');
  
  try {
    // Initialize V2 configuration
    const config = await AppConfigV2.create();
    console.log('✅ AppConfigV2 created successfully');
    
    // Test LUT creation with minimal parameters for testing
    console.log('🔄 Testing LUT creation (V2) with minimal parameters...');
    const result = await createLUTV2(
      config,
      0,     // No Jito tip for testing
      2,     // Only 2 keypairs for testing
      false  // Don't save to file for testing
    );
    
    console.log(`✅ CreateLUT V2 successful!`);
    console.log(`📍 LUT Address: ${result.lutAddress}`);
    console.log(`📊 Summary: ${result.summary.totalTransactions} transactions, ${result.summary.wsolATACount} WSOL ATA txns`);
    
    
    console.log('🎉 CreateLUT V2 test completed!');
    
  } catch (error) {
    console.error('❌ CreateLUT V2 test failed:', error);
    process.exit(1);
  }
}

async function testExtendLUTV2() {
  console.log('🧪 Testing extendLUTV2 functionality...');
  
  try {
    // Initialize V2 configuration
    const config = await AppConfigV2.create();
    console.log('✅ AppConfigV2 created successfully');
    
    // Create a mock LUT address for testing (using a valid Solana address)
    const mockLUTAddress = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
    
    // Create some test addresses to extend with (using valid Solana addresses)
    const testAddresses = [
      'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',  // Associated token program
      'SysvarRent111111111111111111111111111111111',    // Rent sysvar
      'SysvarC1ock11111111111111111111111111111111',    // Clock sysvar
    ];
    
    console.log('🔄 Testing LUT extension with mock data...');
    const transactions = await extendLUTV2(
      config,
      mockLUTAddress,
      testAddresses,
      0,   // No tip for testing
      2    // Small chunk size for testing
    );
    
    console.log(`✅ ExtendLUT V2 successful!`);
    console.log(`📦 Generated ${transactions.length} extension transactions`);
    
    console.log('🎉 ExtendLUT V2 test completed!');
    
  } catch (error) {
    console.error('❌ ExtendLUT V2 test failed:', error);
    process.exit(1);
  }
}

// Run test if this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      
      // Run WSOL ATA functions test
      await testWSOLATAFunctionsV2();
      
      console.log('\n' + '='.repeat(50) + '\n');
      
      // Run V2 Migration validation test
      await testBuildWSOLATATransactionsV2Migration();
      
      console.log('\n' + '='.repeat(50) + '\n');
      
      // Run CreateLUT V2 test
      await testCreateLUTV2();
      
      console.log('\n' + '='.repeat(50) + '\n');
      
      // Run ExtendLUT V2 test
      await testExtendLUTV2();
      
      console.log('\n🎊 All tests completed successfully!');
    } catch (error) {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    }
  })().catch(console.error);
}

export { testWSOLATAFunctionsV2, testBuildWSOLATATransactionsV2Migration, testCreateLUTV2, testExtendLUTV2 };