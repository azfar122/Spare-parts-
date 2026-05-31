import mongoose from 'mongoose';

let connectionPromise;

export function getDbReadyState() {
  return mongoose.connection.readyState;
}

export async function connectDb() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required');

  connectionPromise = mongoose.connect(uri, {
    serverSelectionTimeoutMS: 8000
  }).then(() => {
    console.log('MongoDB connected');
    return mongoose.connection;
  }).catch(error => {
    connectionPromise = undefined;
    throw error;
  });

  return connectionPromise;
}
