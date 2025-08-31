//import { createKeypairs } from "./src/createKeys";
//import { buyBundle } from "./src/jitoPool";
import { createKeypairsV2 as createKeypairs} from './src/coreV2/createKeysV2'
import { buyBundleV2 as buyBundle } from './src/coreV2/jitoPoolV2'
import { createLUTV2 as createLUT } from './src/coreV2/createLUTV2'
import { executeBuyTokenV2 } from './src/coreV2/buyTokenV2'
import { AppConfigV2 } from './src/config/AppConfigV2'
import { address } from '@solana/kit'
// import { sender } from "./src/senderUI";
// import { createWalletSells, sellXPercentage } from "./src/sellFunc";
// import { remove } from "./src/removeLiq";
import promptSync from "prompt-sync";

const prompt = promptSync();

async function createLUTHandler() {
	try {
		console.log('🏗️ Creating Address Lookup Table (V2)...');
		
		// Initialize V2 configuration
		const config = await AppConfigV2.create();
		
		// Get user inputs
		const jitoTipInput = prompt('Jito tip in Sol (Ex. 0.01): ') || '0';
		const maxKeypairsInput = prompt('Max keypairs for WSOL ATA creation (default: 27): ') || '27';
		const saveFileInput = prompt('Save LUT address to file? (y/n, default: y): ') || 'y';
		
		const jitoTipAmount = parseFloat(jitoTipInput);
		const maxKeypairs = parseInt(maxKeypairsInput, 10);
		const saveToFile = saveFileInput.toLowerCase() === 'y';
		
		// Create LUT using V2 implementation
		const result = await createLUT(config, jitoTipAmount, maxKeypairs, saveToFile);
		
		console.log('✅ LUT creation completed successfully!');
		console.log(`📍 LUT Address: ${result.lutAddress}`);
		console.log(`📊 Total Transactions: ${result.summary.totalTransactions}`);
		console.log(`🏦 WSOL ATA Transactions: ${result.summary.wsolATACount}`);
		
		console.log('\n⚠️ Note: Transactions have been built but not sent.');
		console.log('💡 You can send them manually using your preferred bundle method.');
		
	} catch (error) {
		console.error('❌ Error creating LUT:', error);
	}
}

async function buyTokenHandler() {
	try {
		console.log('🚀 Multi-Wallet Token Purchase (V2)...');
		console.log('💡 This will use all loaded keypairs to buy a specified token using Raydium SDK 2.0\n');
		
		// Get user inputs
		const baseMint = prompt('Input token mint address (what you want to buy): ') || '';
		const quoteMint = prompt('Quote token mint (default WSOL): ') || 'So11111111111111111111111111111111111111112';
		const amountInput = prompt('Amount to buy per wallet (in smallest units, Ex. 1000000): ') || '1000000';
		const slippageInput = prompt('Slippage tolerance % (Ex. 1.0 for 1%): ') || '1.0';
		const priorityFeeInput = prompt('Priority fee in SOL (Ex. 0.001): ') || '0.001';
		const maxRetriesInput = prompt('Max retries per bundle (default: 3): ') || '3';
		const poolIdInput = prompt('Specific pool ID (optional, leave empty for auto-discovery): ') || '';
		
		// Validate inputs
		if (!baseMint || baseMint.length < 32) {
			throw new Error('Invalid base mint address');
		}
		
		const baseAmount = amountInput;
		const slippage = parseFloat(slippageInput);
		const priorityFee = parseFloat(priorityFeeInput);
		const maxRetries = parseInt(maxRetriesInput, 10);
		
		console.log('\n📋 Buy Configuration:');
		console.log(`🪙 Buying: ${baseMint}`);
		console.log(`💰 Quote: ${quoteMint}`);
		console.log(`📊 Amount per wallet: ${baseAmount}`);
		console.log(`📈 Slippage: ${slippage}%`);
		console.log(`⚡ Priority Fee: ${priorityFee} SOL`);
		console.log(`🔄 Max Retries: ${maxRetries}`);
		if (poolIdInput) {
			console.log(`🏊 Pool ID: ${poolIdInput}`);
		}
		
		const confirmInput = prompt('\nProceed with token purchase? (y/n): ') || 'n';
		if (confirmInput.toLowerCase() !== 'y') {
			console.log('❌ Purchase cancelled by user');
			return;
		}
		
		console.log('\n⏳ Starting multi-wallet token purchase...');
		
		// Execute the buy
		const results = await executeBuyTokenV2(
			baseMint,
			quoteMint,
			baseAmount,
			slippage
		);
		
		// Display results
		const successCount = results.filter(r => r.success).length;
		const failCount = results.filter(r => !r.success).length;
		
		console.log('\n📊 Purchase Results:');
		console.log(`✅ Successful: ${successCount}`);
		console.log(`❌ Failed: ${failCount}`);
		console.log(`📈 Success Rate: ${((successCount / results.length) * 100).toFixed(1)}%`);
		
		// Show detailed results
		if (results.length <= 10) {
			results.forEach((result, index) => {
				if (result.success) {
					console.log(`  ${index + 1}. ✅ ${result.signature || 'Success'}`);
				} else {
					console.log(`  ${index + 1}. ❌ ${result.error || 'Unknown error'}`);
				}
			});
		} else {
			console.log(`\n💡 ${results.length} total transactions. Use logs for detailed breakdown.`);
		}
		
		if (successCount > 0) {
			console.log('\n🎉 Token purchase completed successfully!');
			console.log('💡 Check your wallets for the new tokens.');
		} else {
			console.log('\n⚠️ No successful purchases. Check configuration and try again.');
		}
		
	} catch (error) {
		console.error('❌ Error during token purchase:', error);
		console.log('\n🔧 Troubleshooting tips:');
		console.log('  - Ensure all keypairs are created and funded');
		console.log('  - Verify the token mint address is correct');
		console.log('  - Check that the token has sufficient liquidity');
		console.log('  - Ensure your RPC endpoint is working');
	}
}

async function main() {
	let running = true;

	while (running) {
		console.log("DM me for support");
		console.log("https://t.me/benorizz0");
		console.log("\nMenu:");
		console.log("1. Create Keypairs");
		console.log("2. Create LUT (Address Lookup Table)");
		console.log("3. Pre Launch Checklist");
		console.log("4. Create Pool Bundle");
		console.log("5. Buy Token (Multi-Wallet V2)");
		console.log("6. Sell All Buyers");
		console.log("7. Sell % of Supply");
		console.log("8. Remove Liquidity");
		console.log("Type 'exit' to quit.");

		const answer = prompt("Choose an option or 'exit': "); // Use prompt-sync for user input

		switch (answer) {
			case "1":
				await createKeypairs();
				break;
			case "2":
				await createLUTHandler();
				break;
			case "3":
				// await sender();
				break;
			case "4":
				await buyBundle();
				break;
			case "5":
				await buyTokenHandler();
				break;
			case "6":
				// await createWalletSells();
				break;
			case "7":
				// await sellXPercentage();
				break;
			case "8":
				// await remove();
				break;
			case "exit":
				running = false;
				break;
			default:
				console.log("Invalid option, please choose again.");
		}
	}

	console.log("Exiting...");
	process.exit(0);
}

main().catch((err) => {
	console.error("Error:", err);
});
