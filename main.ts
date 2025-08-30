//import { createKeypairs } from "./src/createKeys";
//import { buyBundle } from "./src/jitoPool";
import { createKeypairsV2 as createKeypairs} from './src/coreV2/createKeysV2'
import { buyBundleV2 as buyBundle } from './src/coreV2/jitoPoolV2'
import { createLUTV2 as createLUT } from './src/coreV2/createLUTV2'
import { AppConfigV2 } from './src/config/AppConfigV2'
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
		console.log("5. Sell All Buyers");
		console.log("6. Sell % of Supply");
		console.log("7. Remove Liquidity");
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
				// await createWalletSells();
				break;
			case "6":
				// await sellXPercentage();
				break;
			case "7":
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
