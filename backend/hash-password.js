const crypto = require('node:crypto');
const { promisify } = require('node:util');
const readline = require('node:readline/promises');

const scrypt = promisify(crypto.scrypt);

async function main() {
  const terminal = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const password = await terminal.question('Enter the admin password (input is visible): ');
    if (!password) throw new Error('Password cannot be empty.');
    const salt = crypto.randomBytes(16);
    const hash = await scrypt(password, salt, 64);
    console.log(`ADMIN_PASSWORD_HASH=$scrypt$${salt.toString('hex')}$${hash.toString('hex')}`);
  } finally {
    terminal.close();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});