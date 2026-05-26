// db.js
const mysql = require("mysql2");

// Create MySQL connection
const db = mysql.createConnection({
  host: "localhost",            // Localhost cha host
  user: "root",                 // Tujha MySQL username
  password: "2918",             // Tujha MySQL password
  database: "envirosense_system", // Database name
  ssl: false                    // <-- SSL disable kela
});

// Connect to MySQL
db.connect((err) => {
  if (err) {
    console.log("MySQL Connection Error:", err);
  } else {
    console.log("MySQL Connected ✅");
  }
});

module.exports = db;