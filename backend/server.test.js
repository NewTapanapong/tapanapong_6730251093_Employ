const { after, before, test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { promisify } = require('node:util');
const { createApp, calculateSalaryClusters } = require('./server');

const scrypt = promisify(crypto.scrypt);
const auth = { username: 'test-admin', secret: 'test-signing-secret' };
let server;
let baseUrl;
let records;
let users;
let nextId;
let requests;

function testDatabase() {
  return {
    async execute(sql, params = []) {
      requests.push({ sql, params });
      if (sql === 'SELECT 1') return [[{ 1: 1 }], []];
      if (sql.startsWith('SELECT id, username, email, passwordHash, password, role FROM users')) {
        const [identifier, email] = params;
        const user = users.find((row) => row.username === identifier || row.email === email);
        return [user ? [{ ...user }] : [], []];
      }
      if (sql.startsWith('SELECT tapanapong_Salary_employ AS salary')) {
        return [records.map((row) => ({ salary: row.salary })), []];
      }
      if (sql.includes('FROM Employees') && sql.includes('WHERE ? =')) {
        const [search] = params;
        const needle = String(search).toLowerCase();
        const result = records.filter((row) => !needle || [row.id, row.name, row.position, row.status].some((value) => String(value).toLowerCase().includes(needle)));
        return [result.map((row) => ({ ...row })), []];
      }
      if (sql.startsWith('SELECT') && sql.includes('FROM Employees WHERE tapanapong_Id_employ = ?')) {
        const row = records.find((item) => item.id === Number(params[0]));
        return [row ? [{ ...row }] : [], []];
      }
      if (sql.startsWith('INSERT INTO Employees')) {
        const row = { id: nextId++, name: params[0], position: params[1], status: params[2], salary: params[3] };
        records.push(row);
        return [{ insertId: row.id, affectedRows: 1 }, []];
      }
      if (sql.startsWith('UPDATE Employees SET tapanapong_Name_employ')) {
        const row = records.find((item) => item.id === Number(params[4]));
        if (!row) return [{ affectedRows: 0 }, []];
        [row.name, row.position, row.status, row.salary] = params.slice(0, 4);
        return [{ affectedRows: 1 }, []];
      }
      if (sql.startsWith('UPDATE Employees SET tapanapong_Status_employ')) {
        const row = records.find((item) => item.id === Number(params[1]));
        if (!row) return [{ affectedRows: 0 }, []];
        row.status = params[0];
        return [{ affectedRows: 1 }, []];
      }
      if (sql.startsWith('DELETE FROM Employees')) {
        const index = records.findIndex((item) => item.id === Number(params[0]));
        if (index < 0) return [{ affectedRows: 0 }, []];
        records.splice(index, 1);
        return [{ affectedRows: 1 }, []];
      }
      throw new Error(`Unexpected test SQL: ${sql}`);
    },
  };
}

async function request(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.auth ? { Authorization: `Bearer ${options.auth}` } : {}),
      ...options.headers,
    },
  });
  return { response, body: await response.json() };
}

before(async () => {
  records = [
    { id: 1, name: 'Ari Example', position: 'Analyst', status: 'Active', salary: 20000 },
    { id: 2, name: 'Bee Example', position: 'Engineer', status: 'On Leave', salary: 45000 },
    { id: 3, name: 'Cee Example', position: 'Manager', status: 'Active', salary: 80000 },
  ];
  const password = 'correct horse battery staple';
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password, salt, 64);
  const passwordHash = `$scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
  users = [
    { id: 10, username: 'test-admin', email: 'admin@example.com', passwordHash, password: null, role: 'admin' },
    { id: 11, username: 'test-user', email: 'user@example.com', passwordHash, password: null, role: 'user' },
    { id: 12, username: 'legacy-user', email: 'legacy@example.com', passwordHash: 'legacy-pass-123', password: 'legacy-pass-123', role: 'user' },
  ];
  nextId = 4;
  requests = [];
  const app = createApp({
    database: testDatabase(),
    auth: { ...auth, passwordHash: `$scrypt$${salt.toString('hex')}$${hash.toString('hex')}` },
  });
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  const login = await request('/api/login', { method: 'POST', body: JSON.stringify({ username: 'test-admin', password }) });
  auth.token = login.body.token;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test('login signs a token and rejects invalid credentials', async () => {
  const valid = await request('/api/login', { method: 'POST', body: JSON.stringify({ username: 'test-admin', password: 'correct horse battery staple' }) });
  assert.equal(valid.response.status, 200);
  assert.equal(typeof valid.body.token, 'string');
  const invalid = await request('/api/login', { method: 'POST', body: JSON.stringify({ username: 'test-admin', password: 'wrong' }) });
  assert.equal(invalid.response.status, 401);
});

test('employee routes require token and support validated CRUD, status, and prepared search', async () => {
  assert.equal((await request('/api')).body.success, true);
  assert.equal((await request('/api/employees')).response.status, 401);
  assert.equal((await request('/api/employees', { auth: auth.token })).body.employees.length, 3);
  assert.equal((await request('/api/employees?q=1', { auth: auth.token })).body.employees[0].id, 1);
  assert.equal((await request('/api/employees?q=ngine', { auth: auth.token })).body.employees[0].position, 'Engineer');
  assert.equal((await request('/api/employees?search=Active', { auth: auth.token })).body.employees.length, 2);
  assert.equal((await request('/api/employees?q=', { auth: auth.token })).body.employees.length, 3);
  const invalid = await request('/api/employees', { method: 'POST', auth: auth.token, body: JSON.stringify({ name: 'Test', position: 'QA', salary: 0 }) });
  assert.equal(invalid.response.status, 400);
  const created = await request('/api/employees', { method: 'POST', auth: auth.token, body: JSON.stringify({ name: 'Test User', position: 'QA', status: 'On Leave', salary: 42000 }) });
  assert.equal(created.response.status, 201);
  const id = created.body.employee.id;
  const edited = await request(`/api/employees/${id}`, { method: 'PUT', auth: auth.token, body: JSON.stringify({ name: 'Updated User', position: 'Senior QA', status: 'Active', salary: 51000 }) });
  assert.equal(edited.body.employee.name, 'Updated User');
  assert.equal((await request(`/api/employees/${id}/status`, { method: 'PUT', auth: auth.token, body: JSON.stringify({ status: 'On Leave' }) })).body.employee.status, 'On Leave');
  assert.equal((await request('/api/employees?q=SENIOR', { auth: auth.token })).body.employees[0].id, id);
  const lastQuery = requests.filter((entry) => entry.sql.includes('WHERE ? =')).at(-1);
  assert.deepEqual(lastQuery.params, ['SENIOR', '%SENIOR%', '%SENIOR%', '%SENIOR%', '%SENIOR%']);
  assert.equal((await request(`/api/employees/${id}`, { method: 'DELETE', auth: auth.token })).response.status, 200);
  assert.equal((await request(`/api/employees/${id}`, { method: 'DELETE', auth: auth.token })).response.status, 404);
});

test('K-Means returns ordered tiers and handles small, repeated, and empty inputs', async () => {
  assert.deepEqual(calculateSalaryClusters([{ salary: 10 }, { salary: 12 }, { salary: 14 }, { salary: 50 }, { salary: 52 }, { salary: 90 }]).map((item) => item.count), [3, 2, 1]);
  assert.deepEqual(calculateSalaryClusters([]), []);
  assert.deepEqual(calculateSalaryClusters([{ salary: 10 }, { salary: 10 }]).map((item) => item.count), [2, 0, 0]);
  const analytics = await request('/api/employees/salary-clusters', { auth: auth.token });
  assert.equal(analytics.response.status, 200);
  assert.match(analytics.body.message, /unsupervised machine learning/);
});

test('auth login accepts username or email and enforces role permissions', async () => {
  const byUsername = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier: 'test-admin', password: 'correct horse battery staple' }) });
  assert.equal(byUsername.response.status, 200);
  assert.deepEqual(byUsername.body.user, { id: 10, username: 'test-admin', role: 'admin' });
  assert.deepEqual(requests.filter((entry) => entry.sql.includes('FROM users')).at(-1).params, ['test-admin', 'test-admin']);

  const byEmail = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier: 'user@example.com', password: 'correct horse battery staple' }) });
  assert.equal(byEmail.response.status, 200);
  assert.equal(byEmail.body.user.role, 'user');
  assert.equal((await request('/api/employees', { auth: byEmail.body.token })).response.status, 200);
  assert.equal((await request('/api/employees', { method: 'POST', auth: byEmail.body.token, body: JSON.stringify({ name: 'Denied', position: 'User', salary: 1000 }) })).response.status, 403);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier: 'test-user', password: 'wrong' }) })).response.status, 401);
  const legacy = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier: 'legacy@example.com', password: 'legacy-pass-123' }) });
  assert.equal(legacy.response.status, 200);
  assert.equal(legacy.body.user.username, 'legacy-user');
  assert.equal((await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ identifier: '', password: '' }) })).response.status, 400);
});