import { MongoClient, Db, MongoServerSelectionError } from 'mongodb';

const uri = process.env.MONGODB_URI;

// Check if MongoDB URI is properly configured
if (!uri || uri === 'your_mongodb_connection_string_here') {
  console.warn('⚠️  MongoDB URI not configured. Please add a valid MONGODB_URI to .env.local');
  console.warn('   Authentication and database features will not work until configured.');
}

const options = {
  serverSelectionTimeoutMS: 10000, // 10 seconds timeout
  socketTimeoutMS: 45000, // 45 seconds socket timeout
  maxPoolSize: 10,
  minPoolSize: 2,
  retryWrites: true,
  retryReads: true,
};

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// Only initialize MongoDB if URI is valid
if (uri && (uri.startsWith('mongodb://') || uri.startsWith('mongodb+srv://'))) {
  if (process.env.NODE_ENV === 'development') {
    // In development mode, use a global variable to preserve the client across hot reloads
    if (!global._mongoClientPromise) {
      client = new MongoClient(uri, options);
      global._mongoClientPromise = client.connect();
    }
    clientPromise = global._mongoClientPromise;
  } else {
    // In production mode, create a new client for each request
    client = new MongoClient(uri, options);
    clientPromise = client.connect();
  }
}

export default clientPromise;

// Helper function to get the database with retry logic
export async function getDatabase(): Promise<Db> {
  if (!clientPromise) {
    throw new Error('MongoDB not initialized. Please configure MONGODB_URI in .env.local');
  }
  
  try {
    const client = await clientPromise;
    // Use the default database from connection string (usually 'test' in MongoDB)
    return client.db();
  } catch (error) {
    if (error instanceof MongoServerSelectionError) {
      console.error('❌ MongoDB Connection Error: Unable to connect to database');
      console.error('   This usually means:');
      console.error('   1. Your IP address is not whitelisted in MongoDB Atlas');
      console.error('   2. The database cluster is paused or unreachable');
      console.error('   3. Network connectivity issues');
      console.error('   4. Invalid connection string');
      throw new Error('Database connection failed. Please check your MongoDB configuration.');
    }
    throw error;
  }
}
