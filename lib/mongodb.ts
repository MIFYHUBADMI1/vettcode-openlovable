import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI;

// Check if MongoDB URI is properly configured
if (!uri || uri === 'your_mongodb_connection_string_here') {
  console.warn('⚠️  MongoDB URI not configured. Please add a valid MONGODB_URI to .env.local');
  console.warn('   Authentication and database features will not work until configured.');
}

const options = {};

let client: MongoClient | null = null;
let clientPromise: Promise<MongoClient> | null = null;

declare global {
  // eslint-disable-next-line no-var
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

// Helper function to get the database
export async function getDatabase(): Promise<Db> {
  if (!clientPromise) {
    throw new Error('MongoDB not initialized. Please configure MONGODB_URI in .env.local');
  }
  const client = await clientPromise;
  return client.db('mirrorsite_ai'); // Your database name
}
