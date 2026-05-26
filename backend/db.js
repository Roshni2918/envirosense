// db.js
const mysql = require("mysql2");
require("dotenv").config();

// Create MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "2918",
  database: process.env.DB_NAME || "envirosense_system",
  ssl: false
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