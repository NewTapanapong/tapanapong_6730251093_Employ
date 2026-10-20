const mysql = require('mysql2/promise');

const requiredVariables = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  decimalNumbers: true,
});

async function verifyConnection() {
  const missingVariables = requiredVariables.filter((key) => !process.env[key]);
  if (missingVariables.length) throw new Error(`Missing environment variables: ${missingVariables.join(', ')}`);
  const connection = await pool.getConnection();
  try {
    await connection.query('SELECT 1');
    return process.env.DB_NAME;
  } finally {
    connection.release();
  }
}

module.exports = { pool, verifyConnection };