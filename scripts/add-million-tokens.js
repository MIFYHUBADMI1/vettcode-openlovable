/**
 * Script to add 1 million tokens to your user account
 * Run with: node scripts/add-million-tokens.js
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const uri = process.env.MONGODB_URI;
const targetEmail = 'mixifyhub7@gmail.com';
const tokensToAdd = 1000000; // 1 million tokens

async function addMillionTokens() {
  if (!uri) {
    console.error('❌ MONGODB_URI not found in .env.local');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    console.log('🔗 Connecting to MongoDB...');
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    const usersCollection = db.collection('users');

    // Find the user
    console.log(`\n🔍 Looking for user: ${targetEmail}`);
    const user = await usersCollection.findOne({ email: targetEmail });

    if (!user) {
      console.error(`❌ User not found: ${targetEmail}`);
      process.exit(1);
    }

    console.log(`✅ User found!`);
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Current tokens: ${user.tokens || 0}`);

    // Add 1 million tokens
    const newBalance = (user.tokens || 0) + tokensToAdd;
    
    console.log(`\n💰 Adding ${tokensToAdd.toLocaleString()} tokens...`);
    
    const result = await usersCollection.updateOne(
      { email: targetEmail },
      {
        $set: { tokens: newBalance },
        $push: {
          tokenHistory: {
            type: 'admin_grant',
            amount: tokensToAdd,
            timestamp: new Date(),
            reason: 'Admin grant - 1 million tokens',
            grantedBy: 'script'
          }
        }
      }
    );

    if (result.modifiedCount === 1) {
      console.log('✅ Tokens added successfully!');
      console.log(`\n📊 Updated Balance:`);
      console.log(`   Previous: ${(user.tokens || 0).toLocaleString()} tokens`);
      console.log(`   Added: ${tokensToAdd.toLocaleString()} tokens`);
      console.log(`   New Balance: ${newBalance.toLocaleString()} tokens`);
      console.log(`\n🎉 You now have 1 MILLION tokens! Happy building! 🚀`);
    } else {
      console.error('❌ Failed to update tokens');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
}

// Run the script
addMillionTokens();
