# 🚀 Solana Bundler Tool - Secure Edition

A comprehensive Solana DeFi tool for token bundling, liquidity operations, and market creation with enhanced security features.

## 🔧 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Setup
Run the interactive setup to configure your environment:
```bash
npm run setup
```

This will create a `.env` file with your configuration. You can also manually copy `.env.example` to `.env` and fill in your values.

### 3. Validate Configuration
```bash
npm run validate-config
```

### 4. Run the Tool
```bash
npm start
```

## 🔐 Security Features

### Environment Variables
All sensitive data is now stored in environment variables:
- **Private Keys**: Base58 encoded and loaded from `.env`
- **RPC URLs**: Configurable for different networks
- **Jito Configuration**: All endpoints and tokens externalized

### Encrypted Keypair Storage
- **AES Encryption**: Keypairs can be encrypted at rest
- **Password Protection**: Optional encryption password
- **Migration Tool**: Migrate existing unencrypted keypairs

### Key Management
```bash
# Create or manage keypairs
npm run migrate-keypairs
```

## 📁 Configuration Files

### `.env` File Structure
```env
# Solana Configuration
RPC_URL=https://api.mainnet-beta.solana.com
POOL_CREATOR_PRIVATE_KEY=your_base58_private_key
FEE_PAYER_PRIVATE_KEY=your_base58_private_key

# Jito Configuration
TIP_ACCOUNT=Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY
MIN_TIP_LAMPORTS=10000
TIP_PERCENT=50

# Security
KEYPAIRS_ENCRYPTION_PASSWORD=your_encryption_password
```

### Environment Files
- `.env.example` - Template with documentation
- `.env.production` - Production configuration template

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│              User Interface             │
├─────────────────────────────────────────┤
│           src/config/AppConfig          │  ← Centralized Configuration
├─────────────────────────────────────────┤
│      src/config/SecureKeypairManager    │  ← Encrypted Key Management
├─────────────────────────────────────────┤
│              Core Modules               │
│  ┌─────────────┬─────────────────────┐  │
│  │ jitoPool.ts │ Main Entry Point    │  │
│  ├─────────────┼─────────────────────┤  │
│  │ buyToken.ts │ Token Purchase      │  │
│  │ sellFunc.ts │ Token Sales         │  │
│  │ removeLiq.ts│ Liquidity Removal   │  │
│  │ createMarket│ Market Creation     │  │
│  │ createLUT.ts│ Lookup Tables       │  │
│  └─────────────┴─────────────────────┘  │
├─────────────────────────────────────────┤
│              Client Layer               │
│       (Jito, Raydium, OpenBook)        │
├─────────────────────────────────────────┤
│             Solana Network              │
└─────────────────────────────────────────┘
```

## 🛠️ Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start the main application |
| `npm run setup` | Interactive environment setup |
| `npm run validate-config` | Validate configuration |
| `npm run migrate-keypairs` | Manage keypairs (create/migrate) |
| `npm run build` | Build TypeScript |
| `npm run dev` | Development mode with watch |

## 📊 Features

### Core Functionality
- **Token Bundling**: Efficient token purchase/sale bundling across 27 wallets
- **Liquidity Operations**: Add/remove liquidity from pools
- **Market Creation**: Create new OpenBook markets
- **Jito Integration**: MEV protection and priority fees

### Security Enhancements
- **Environment Variables**: No hardcoded secrets
- **Encrypted Storage**: Optional keypair encryption
- **Secure Configuration**: Centralized config management
- **Git Safety**: Comprehensive .gitignore

### Developer Experience
- **Interactive Setup**: Easy initial configuration
- **Configuration Validation**: Verify setup before running
- **Migration Tools**: Upgrade existing installations
- **TypeScript**: Full type safety

## ⚠️ Security Best Practices

1. **Never commit `.env` files** to version control
2. **Use different keypairs** for mainnet vs devnet
3. **Enable encryption** for keypair storage
4. **Use premium RPC** endpoints for production
5. **Regular backups** of encrypted keypairs
6. **Monitor wallet balances** for unauthorized activity

## 🔄 Migration from Legacy Version

If upgrading from the old version:

1. Run the setup script: `npm run setup`
2. Migrate existing keypairs: `npm run migrate-keypairs`
3. Choose option 'm' to migrate to encrypted storage
4. Update any custom scripts to use the new config

## 🐛 Troubleshooting

### Common Issues

**"Missing required environment variables"**
- Run `npm run setup` to configure your environment
- Ensure all required variables are set in `.env`

**"Invalid private key format"**
- Verify private keys are Base58 encoded
- Use the setup script to generate new keys

**"Keypair file not found"**
- Run `npm run migrate-keypairs` to create keypairs
- Check the `src/keypairs/` directory exists

### Configuration Validation
```bash
npm run validate-config
```

## 🤝 Contributing

When contributing:
1. Never commit real private keys or `.env` files
2. Use the `.env.example` template for documentation
3. Test with devnet before mainnet
4. Follow the existing TypeScript patterns

## 📄 License

ISC License

## ⚡ Support

For issues and questions:
- Check the troubleshooting section
- Validate your configuration with `npm run validate-config`
- Ensure all dependencies are installed with `npm install`

For technical queries, reach out via tg @ilertha.

---

**⚠️ DISCLAIMER**: This tool handles real cryptocurrency transactions. Always test on devnet first and never risk more than you can afford to lose.
