const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const crypto = require('node:crypto');
const { promisify } = require('node:util');
const express = require('express');
const cors = require('cors');
const { pool, verifyConnection } = require('./db');

const scrypt = promisify(crypto.scrypt);
const EMPLOYEE_COLUMNS = `tapanapong_Id_employ AS id,
  tapanapong_Name_employ AS name,
  tapanapong_Position_employ AS position,
  tapanapong_Status_employ AS status,
  tapanapong_Salary_employ AS salary`;

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

async function verifyPassword(password, encodedHash) {
  const parts = encodedHash.split('$');
  if (parts.length !== 4 || parts[1] !== 'scrypt' || !/^[a-f0-9]{32,128}$/i.test(parts[2]) || !/^[a-f0-9]{128}$/i.test(parts[3])) return false;
  const derived = await scrypt(password, Buffer.from(parts[2], 'hex'), 64);
  return safeEqual(derived.toString('hex'), parts[3].toLowerCase());
}

function signToken(username, secret, expiresInSeconds = 8 * 60 * 60) {
  const payload = Buffer.from(JSON.stringify({ sub: username, exp: Math.floor(Date.now() / 1000) + expiresInSeconds })).toString('base64url');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function validToken(token, secret) {
  if (typeof token !== 'string') return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  if (!safeEqual(signature, expected)) return false;
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof claims.sub === 'string' && Number.isInteger(claims.exp) && claims.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

function validateEmployee(body, allowStatus = true) {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const position = typeof body?.position === 'string' ? body.position.trim() : '';
  const salary = body?.salary;
  if (!name || !position) return { error: 'Name and position are required.' };
  if (salary === '' || salary === null || salary === undefined || !Number.isFinite(Number(salary)) || Number(salary) <= 0) {
    return { error: 'Salary must be a positive number.' };
  }
  const employee = { name, position, salary: Number(salary) };
  if (allowStatus && body.status !== undefined) {
    if (!['Active', 'On Leave'].includes(body.status)) return { error: 'Status must be Active or On Leave.' };
    employee.status = body.status;
  }
  return { employee };
}

function validId(value) {
  return /^\d+$/.test(value) && Number(value) > 0 && Number.isSafeInteger(Number(value));
}

function calculateSalaryClusters(records) {
  const salaries = records.map((record) => Number(record.salary)).filter(Number.isFinite).sort((a, b) => a - b);
  const k = 3;
  if (salaries.length === 0) return [];

  const distinct = [...new Set(salaries)];
  const centers = distinct.length < k
    ? [...distinct]
    : [distinct[0], distinct[Math.floor((distinct.length - 1) / 2)], distinct[distinct.length - 1]];

  for (let iteration = 0; iteration < 100; iteration += 1) {
    const sums = centers.map(() => 0);
    const counts = centers.map(() => 0);
    for (const salary of salaries) {
      let nearest = 0;
      for (let index = 1; index < centers.length; index += 1) {
        if (Math.abs(salary - centers[index]) < Math.abs(salary - centers[nearest])) nearest = index;
      }
      sums[nearest] += salary;
      counts[nearest] += 1;
    }
    const updated = centers.map((center, index) => counts[index] ? sums[index] / counts[index] : center);
    const converged = updated.every((center, index) => Math.abs(center - centers[index]) < 1e-8);
    centers.splice(0, centers.length, ...updated);
    if (converged) break;
  }

  const buckets = centers.map(() => ({ sum: 0, count: 0 }));
  for (const salary of salaries) {
    let nearest = 0;
    for (let index = 1; index < centers.length; index += 1) {
      if (Math.abs(salary - centers[index]) < Math.abs(salary - centers[nearest])) nearest = index;
    }
    buckets[nearest].sum += salary;
    buckets[nearest].count += 1;
  }

  const ordered = buckets
    .map((bucket) => ({ centroid: bucket.count ? bucket.sum / bucket.count : null, count: bucket.count }))
    .sort((left, right) => left.centroid === null ? (right.centroid === null ? 0 : 1) : right.centroid === null ? -1 : left.centroid - right.centroid);
  return Array.from({ length: k }, (_, index) => ({
    group: `Tier ${index + 1}`,
    centroid: ordered[index]?.centroid ?? null,
    count: ordered[index]?.count ?? 0,
  }));
}

function createApp({ database = pool, auth = {} } = {}) {
  const app = express();
  const authConfig = {
    username: auth.username ?? process.env.ADMIN_USERNAME,
    passwordHash: auth.passwordHash ?? process.env.ADMIN_PASSWORD_HASH,
    secret: auth.secret ?? process.env.JWT_SECRET,
  };

  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.get('/api', async (_req, res, next) => {
    try {
      await database.execute('SELECT 1');
      res.json({ success: true, message: 'HR API is running and the database is reachable.' });
    } catch (error) {
      next(error);
    }
  });
  app.get('/api/health', async (_req, res, next) => {
    try {
      await database.execute('SELECT 1');
      res.json({ success: true, message: 'HR API and database are available.' });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/login', async (req, res) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== 'string' || typeof password !== 'string' || !authConfig.username || !authConfig.passwordHash || !authConfig.secret) {
      return res.status(typeof username !== 'string' || typeof password !== 'string' ? 400 : 503)
        .json({ success: false, message: 'Login is unavailable or the credentials are invalid.' });
    }
    const usernameMatches = safeEqual(username, authConfig.username);
    const passwordMatches = await verifyPassword(password, authConfig.passwordHash);
    if (!usernameMatches || !passwordMatches) {
      return res.status(401).json({ success: false, message: 'Username or password is incorrect.' });
    }
    return res.status(200).json({ success: true, token: signToken(authConfig.username, authConfig.secret) });
  });

  function requireToken(req, res, next) {
    const authorization = req.get('authorization') || '';
    const match = /^Bearer\s+(.+)$/i.exec(authorization);
    if (!match || !authConfig.secret || !validToken(match[1], authConfig.secret)) {
      return res.status(401).json({ success: false, message: 'A valid Bearer token is required.' });
    }
    return next();
  }

  app.get('/api/employees', requireToken, async (req, res, next) => {
    try {
      const rawSearch = typeof req.query.q === 'string' ? req.query.q : req.query.search;
      const search = typeof rawSearch === 'string' ? rawSearch.trim() : '';
      const [rows] = await database.execute(
        `SELECT ${EMPLOYEE_COLUMNS} FROM Employees
         WHERE ? = '' OR CAST(tapanapong_Id_employ AS CHAR) LIKE ?
           OR LOWER(tapanapong_Name_employ) LIKE LOWER(?)
           OR LOWER(tapanapong_Position_employ) LIKE LOWER(?)
           OR LOWER(tapanapong_Status_employ) LIKE LOWER(?)
         ORDER BY tapanapong_Id_employ DESC`,
        [search, `%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`],
      );
      res.json({ success: true, employees: rows });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/employees', requireToken, async (req, res, next) => {
    const validated = validateEmployee(req.body);
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });
    const { name, position, salary, status = 'Active' } = validated.employee;
    try {
      const [result] = await database.execute(
        `INSERT INTO Employees (tapanapong_Name_employ, tapanapong_Position_employ, tapanapong_Status_employ, tapanapong_Salary_employ)
         VALUES (?, ?, ?, ?)`,
        [name, position, status, salary],
      );
      const [rows] = await database.execute(`SELECT ${EMPLOYEE_COLUMNS} FROM Employees WHERE tapanapong_Id_employ = ?`, [result.insertId]);
      return res.status(201).json({ success: true, employee: rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  app.put('/api/employees/:id', requireToken, async (req, res, next) => {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Employee ID must be a positive integer.' });
    const validated = validateEmployee(req.body);
    if (validated.error) return res.status(400).json({ success: false, message: validated.error });
    const { name, position, salary, status = 'Active' } = validated.employee;
    try {
      const [result] = await database.execute(
        `UPDATE Employees SET tapanapong_Name_employ = ?, tapanapong_Position_employ = ?,
          tapanapong_Status_employ = ?, tapanapong_Salary_employ = ? WHERE tapanapong_Id_employ = ?`,
        [name, position, status, salary, Number(req.params.id)],
      );
      if (!result.affectedRows) return res.status(404).json({ success: false, message: 'Employee not found.' });
      const [rows] = await database.execute(`SELECT ${EMPLOYEE_COLUMNS} FROM Employees WHERE tapanapong_Id_employ = ?`, [Number(req.params.id)]);
      return res.json({ success: true, employee: rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  app.put('/api/employees/:id/status', requireToken, async (req, res, next) => {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Employee ID must be a positive integer.' });
    const status = req.body?.status;
    if (status !== undefined && !['Active', 'On Leave'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be Active or On Leave.' });
    }
    try {
      const [rows] = await database.execute(`SELECT ${EMPLOYEE_COLUMNS} FROM Employees WHERE tapanapong_Id_employ = ?`, [Number(req.params.id)]);
      if (!rows.length) return res.status(404).json({ success: false, message: 'Employee not found.' });
      const nextStatus = status ?? (rows[0].status === 'Active' ? 'On Leave' : 'Active');
      await database.execute('UPDATE Employees SET tapanapong_Status_employ = ? WHERE tapanapong_Id_employ = ?', [nextStatus, Number(req.params.id)]);
      return res.json({ success: true, employee: { ...rows[0], status: nextStatus } });
    } catch (error) {
      return next(error);
    }
  });

  app.delete('/api/employees/:id', requireToken, async (req, res, next) => {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Employee ID must be a positive integer.' });
    try {
      const [rows] = await database.execute(`SELECT ${EMPLOYEE_COLUMNS} FROM Employees WHERE tapanapong_Id_employ = ?`, [Number(req.params.id)]);
      if (!rows.length) return res.status(404).json({ success: false, message: 'Employee not found.' });
      await database.execute('DELETE FROM Employees WHERE tapanapong_Id_employ = ?', [Number(req.params.id)]);
      return res.json({ success: true, employee: rows[0] });
    } catch (error) {
      return next(error);
    }
  });

  app.get('/api/employees/salary-clusters', requireToken, async (_req, res, next) => {
    try {
      const [rows] = await database.execute('SELECT tapanapong_Salary_employ AS salary FROM Employees');
      const clusters = calculateSalaryClusters(rows);
      return res.json({
        success: true,
        clusters,
        message: rows.length < 3 ? 'Insufficient employee data for three salary tiers.' : 'K-Means is unsupervised machine learning, not Generative AI.',
      });
    } catch (error) {
      return next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      return res.status(400).json({ success: false, message: 'Request body must be valid JSON.' });
    }
    console.error('API request failed:', error.code || error.message);
    return res.status(500).json({ success: false, message: 'The request could not be completed. Check the database connection and server configuration.' });
  });
  return app;
}

const app = createApp();

if (require.main === module) {
  const port = Number(process.env.PORT) || 3081;
  verifyConnection()
    .then((databaseName) => {
      console.log('MySQL connected successfully');
      console.log(`Database: ${databaseName}`);
      app.listen(port, '0.0.0.0', () => console.log(`HR API listening on http://0.0.0.0:${port}`));
    })
    .catch((error) => {
      console.error(`MySQL connection failed: ${error.message}`);
      console.error('Check DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, the database user permissions, and whether the Cloud server allows your client IP.');
      process.exitCode = 1;
    });
}

module.exports = { app, createApp, calculateSalaryClusters, verifyPassword };