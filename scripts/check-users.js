/**
 * Check users in database
 * Run: node scripts/check-users.js
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function checkUsers() {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    console.error('❌ MONGODB_URI not found');
    process.exit(1);
  }

  const client = new MongoClient(uri);

  try {
    await client.connect();
    console.log('✅ Connected to MongoDB\n');

    // Get the default database from connection string
    const db = client.db();
    const dbName = db.databaseName;
    console.log(`📁 Database name: ${dbName}\n`);
    
    // Count total users
    const totalUsers = await db.collection('users').countDocuments({});
    console.log(`📊 Total users in database '${dbName}': ${totalUsers}\n`);

    // Find all users
    const users = await db.collection('users').find({}).toArray();
    
    console.log('👥 Users found:\n');
    users.forEach((user, index) => {
      console.log(`${index + 1}. User Details:`);
      console.log(`   _id: ${user._id}`);
      console.log(`   _id type: ${typeof user._id}`);
      console.log(`   _id constructor: ${user._id.constructor.name}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Name: ${user.name || 'N/A'}`);
      console.log(`   Tokens: ${user.tokens !== undefined ? user.tokens : 'Not set'}`);
      console.log(`   Created: ${user.createdAt || 'N/A'}`);
      console.log('');
    });

    // Search specifically for mixifyhub7@gmail.com
    console.log('\n🔍 Searching for mixifyhub7@gmail.com...\n');
    const mixifyUser = await db.collection('users').findOne({ email: 'mixifyhub7@gmail.com' });
    
    if (mixifyUser) {
      console.log('✅ Found user by email!');
      console.log('Full user object:');
      console.log(JSON.stringify(mixifyUser, null, 2));
    } else {
      console.log('❌ User not found by email');
    }

    // Try case-insensitive search
    console.log('\n🔍 Trying case-insensitive email search...\n');
    const caseInsensitiveUser = await db.collection('users').findOne({ 
      email: { $regex: new RegExp('^mixifyhub7@gmail.com$', 'i') }
    });
    
    if (caseInsensitiveUser) {
      console.log('✅ Found with case-insensitive search!');
      console.log('Email in DB:', caseInsensitiveUser.email);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await client.close();
    console.log('\n✅ Connection closed');
  }
}

checkUsers();
