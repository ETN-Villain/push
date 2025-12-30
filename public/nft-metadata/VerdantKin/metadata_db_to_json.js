const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

const db = new sqlite3.Database('./verdantkin_metadata.db');

db.all('SELECT * FROM nfts', (err, rows) => {
  if (err) throw err;
  fs.writeFileSync('verdantkin_metadata.json', JSON.stringify(rows, null, 2));
  console.log('Exported to verdantkin_metadata.json');
  db.close();
});
