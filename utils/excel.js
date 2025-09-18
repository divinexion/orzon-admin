const ExcelJS = require('exceljs');
const fs = require('fs');
const path = require('path');

async function ensureWorkbook(filePath, sheetName) {
  const workbook = new ExcelJS.Workbook();
  if (fs.existsSync(filePath)) {
    await workbook.xlsx.readFile(filePath);
  } else {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
  let sheet = workbook.getWorksheet(sheetName);
  if (!sheet) {
    sheet = workbook.addWorksheet(sheetName);
    sheet.columns = [
      { header: 'Timestamp', key: 'timestamp', width: 22 },
      { header: 'Action', key: 'action', width: 10 },
      { header: 'ProductId', key: 'productId', width: 24 },
      { header: 'Serial', key: 'serialNumber', width: 20 },
      { header: 'Name', key: 'name', width: 24 },
      { header: 'ProductType', key: 'productType', width: 12 },
      { header: 'TypeCapacity', key: 'typeCapacity', width: 12 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'AddDate', key: 'addDate', width: 14 },
      { header: 'BuyerName', key: 'buyerName', width: 20 },
      { header: 'BuyerPhone', key: 'buyerPhone', width: 18 },
      { header: 'BuyerEmail', key: 'buyerEmail', width: 24 },
      { header: 'BuyerAddress', key: 'buyerAddress', width: 30 },
      { header: 'BuyerPaymentMethod', key: 'buyerPaymentMethod', width: 22 },
      { header: 'SoldDate', key: 'soldDate', width: 14 },
    ];
  }
  return { workbook, sheet };
}

async function appendRow(filePath, sheetName, row) {
  const { workbook, sheet } = await ensureWorkbook(filePath, sheetName);
  sheet.addRow(row);
  await workbook.xlsx.writeFile(filePath);
}

module.exports = { appendRow };
