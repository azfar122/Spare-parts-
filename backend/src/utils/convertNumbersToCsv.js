import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const inputFile = './csv/atlas_parts_all.numbers';
const outputFile = './csv/atlas_parts_all.csv';

try {
  // Read the workbook
  const workbook = XLSX.readFile(inputFile);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  
  // Convert to CSV
  const csv = XLSX.utils.sheet_to_csv(sheet);
  
  // Write to file
  fs.writeFileSync(outputFile, csv);
  console.log(`✓ Successfully converted ${inputFile} to ${outputFile}`);
} catch (error) {
  console.error('Error converting file:', error.message);
  process.exit(1);
}
