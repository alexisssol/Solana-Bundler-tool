/**
 * Simple test script to validate buildTxnV2 functionality
 * Run this to test the V2 transaction building
 */

import { AppConfigV2 } from '../config/AppConfigV2';
import { 
  buildTxnV2, 
  validateTxnV2, 
  debugTxnV2, 
  generateWSOLATAForKeypairsV2,
  chunkWSOLATAInstructionsV2,
  buildWSOLATATransactionsV2
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

// Run test if this file is executed directly
if (require.main === module) {
  (async () => {
    try {
      // Run basic buildTxnV2 test
      await testBuildTxnV2();
      
      console.log('\n' + '='.repeat(50) + '\n');
      
      // Run WSOL ATA functions test
      await testWSOLATAFunctionsV2();
      
      console.log('\n🎊 All tests completed successfully!');
    } catch (error) {
      console.error('💥 Test suite failed:', error);
      process.exit(1);
    }
  })().catch(console.error);
}

export { testBuildTxnV2, testWSOLATAFunctionsV2 };