import 'dotenv/config';
import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Warehouse from '../models/Warehouse.js';
import WarehouseStock from '../models/WarehouseStock.js';
import { connectDb } from './db.js';

const warehouseNames = ['gudam 1', 'gudam 2'];

await connectDb();

try {
  const warehouses = [];

  for (const name of warehouseNames) {
    const warehouse = await Warehouse.findOneAndUpdate(
      { name: new RegExp(`^${name}$`, 'i') },
      { $setOnInsert: { name, active: true } },
      { upsert: true, returnDocument: 'after' }
    );
    warehouses.push(warehouse);
  }

  const products = await Product.find({}, '_id partCode partName').lean();

  if (!products.length) {
    console.log('No products found. Warehouses are ready, but no warehouse stock rows were created.');
    process.exit(0);
  }

  const operations = warehouses.flatMap(warehouse =>
    products.map(product => ({
      updateOne: {
        filter: { warehouse: warehouse._id, product: product._id },
        update: {
          $setOnInsert: {
            warehouse: warehouse._id,
            product: product._id,
            quantity: 0
          }
        },
        upsert: true
      }
    }))
  );

  const result = await WarehouseStock.bulkWrite(operations, { ordered: false });

  console.log('Warehouse stock sync complete');
  console.log(`Warehouses ready: ${warehouses.map(warehouse => warehouse.name).join(', ')}`);
  console.log(`Products scanned: ${products.length}`);
  console.log(`Warehouse stock rows inserted: ${result.upsertedCount || 0}`);
  console.log(`Existing rows left unchanged: ${operations.length - (result.upsertedCount || 0)}`);
} catch (error) {
  console.error('Warehouse stock sync failed:', error);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
