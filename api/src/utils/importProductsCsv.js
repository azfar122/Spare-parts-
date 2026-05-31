import 'dotenv/config';
import fs from 'fs';
import csv from 'csv-parser';
import Product from '../models/Product.js';
import { connectDb } from './db.js';

const path = process.env.CSV_PATH;
if (!path) throw new Error('Set CSV_PATH=/path/to/file.csv');
await connectDb();

const cleanNum = v => Number(String(v || '0').replace(/,/g, '').trim()) || 0;
const rows = [];

fs.createReadStream(path)
  .pipe(csv())
  .on('data', row => rows.push(row))
  .on('end', async () => {
    for (const row of rows) {
      const partName = row['Part Name'] || row.partName || row['part name'];
      const partCode = row['Part Code'] || row.partCode || row['part code'];
      if (!partName || !partCode) continue;
      await Product.updateOne(
        { partCode: String(partCode).trim() },
        { $set: {
          partName: String(partName).trim(),
          model: String(row.Model || row.model || 'COMMON').trim(),
          bookingPrice: cleanNum(row['Booking Price'] || row.bookingPrice),
          mrp: cleanNum(row.MRP || row.mrp),
          minOrderQty: cleanNum(row['Min Order Qty'] || row.minOrderQty || 1),
          quantity: cleanNum(row.Quantity || row.quantity || 0),
          active: true
        }},
        { upsert: true }
      );
    }
    console.log(`Imported/updated ${rows.length} products`);
    process.exit(0);
  });
