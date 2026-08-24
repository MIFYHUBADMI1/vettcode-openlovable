/**
 * One-time migration script to add 500 tokens to existing users
 * Run this once: node scripts/migrate-users-tokens.js
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrateUsers() {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('❌ MONGODB_URI not found in environment variables');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB');

    const db = client.db();
    
    // Find all users without tokens
    const usersWithoutTokens = await db.collection('users')
      .find({
        $or: [
          { tokens: { $exists: false } },
          { tokens: null }
        ]
      })
      .toArray();

    console.log(`\n📊 Found ${usersWithoutTokens.length} users without tokens\n`);

    if (usersWithoutTokens.length === 0) {
      console.log('✅ All users already have tokens!');
      return;
    }

    // Show users that will be updated
    console.log('Users to update:');
    usersWithoutTokens.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email} (${user.name || 'No name'})`);
    });

    // Update all users without tokens
    const result = await db.collection('users').updateMany(
      {
        $or: [
          { tokens: { $exists: false } },
          { tokens: null }
        ]
      },
      {
        $set: { 
          tokens: 500
        },
        $push: {
          tokenHistory: {
            type: 'bonus',
            amount: 500,
            timestamp: new Date(),
            reason: 'Welcome bonus - Initial migration'
          }
        }
      }
    );

    console.log(`\n✅ Successfully updated ${result.modifiedCount} users with 500 tokens each\n`);

    // Verify the update
    const verifyUsers = await db.collection('users')
      .find({
        email: { $in: usersWithoutTokens.map(u => u.email) }
      })
      .toArray();

    console.log('Verification:');
    verifyUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.email}: ${user.tokens} tokens ✓`);
    });

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('\n✅ Migration complete! Database connection closed.\n');
  }
}

migrateUsers();
