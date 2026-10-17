import 'dotenv/config';
import { captureDailyOpening } from './dailyStock.js';
import fs from 'fs';
import csv from 'csv-parser';
import Product from '../models/Product.js';
import { connectDb } from './db.js';

const path = process.env.CSV_PATH;
if (!path) throw new Error('Set CSV_PATH=/path/to/file.csv');
await connectDb();

const cleanNum = v => Number(String(v || '0').replace(/,/g, '').trim()) || 0;
const firstValue = (row, keys, fallback = '') => {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== '') return row[key];
  }
  return fallback;
};
const rows = [];

fs.createReadStream(path)
  .pipe(csv())
  .on('data', row => rows.push(row))
  .on('end', async () => {
    for (const row of rows) {
      const partName = firstValue(row, ['Product name', 'Product Name', 'Part Name', 'partName', 'part name']);
      const partCode = firstValue(row, ['PartNo', 'partNo', 'Part No', 'Part No.', 'Part Number', 'Part Code', 'partCode', 'part code']);
      if (!partName || !partCode) continue;
      const existing = await Product.findOne({ partCode: String(partCode).trim() }).lean();
      if (existing) await captureDailyOpening(existing);
      await Product.updateOne(
        { partCode: String(partCode).trim() },
        { $set: {
          partName: String(partName).trim(),
          PartNo: String(partCode).trim(),
          'Part No': String(partCode).trim(),
          brand: String(firstValue(row, ['Brand', 'brand'])).trim(),
          bookingPrice: cleanNum(firstValue(row, ['Customer price (cc)', 'Customer Price (CC)', 'Customer Price', 'CC', 'Booking Price', 'bookingPrice'])),
          mrp: cleanNum(firstValue(row, ['Retail Price(RP)', 'Retail Price (RP)', 'Retail Price', 'RP', 'MRP', 'mrp'])),
          minOrderQty: cleanNum(row['Min Order Qty'] || row.minOrderQty || 1),
          minimumQuantity: cleanNum(firstValue(row, ['Minimum Quantity', 'minimumQuantity', 'minimumQty', 'minQuantity'], 0)),
          quantity: cleanNum(row.Quantity || row.quantity || 0),
          active: true
        }},
        { upsert: true }
      );
    }
    console.log(`Imported/updated ${rows.length} products`);
    process.exit(0);
  });
