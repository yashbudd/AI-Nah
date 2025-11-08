import { MongoClient, Db } from 'mongodb';

let client: MongoClient | null = null;

export async function getDb(): Promise<Db> {
  if (!client) {
    client = new MongoClient(process.env.MONGO_URI || 'mongodb://localhost:27017');
    await client.connect();
  }
  return client.db('your-database-name'); // Replace with your database name
}