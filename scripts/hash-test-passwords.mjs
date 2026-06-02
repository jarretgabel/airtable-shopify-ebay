import { pbkdf2Sync, randomBytes } from 'node:crypto';

const PASSWORD_FIELD_PAYLOAD_PREFIX = '__LCC_PASSWORD__:';
const PASSWORD_HASH_SCHEME = 'pbkdf2-sha256';
const PASSWORD_HASH_ITERATIONS = 210000;
const PASSWORD_HASH_KEY_LENGTH = 32;

function encodeBase64(value) {
  return Buffer.from(value, 'utf8').toString('base64');
}

function buildPasswordHash(password, salt, iterations) {
  return pbkdf2Sync(password, salt, iterations, PASSWORD_HASH_KEY_LENGTH, 'sha256').toString('base64');
}

function serializePasswordField(password, mustChangePassword = false) {
  const salt = randomBytes(16).toString('base64');
  const hash = buildPasswordHash(password, salt, PASSWORD_HASH_ITERATIONS);

  return encodeBase64(`${PASSWORD_FIELD_PAYLOAD_PREFIX}${JSON.stringify({
    scheme: PASSWORD_HASH_SCHEME,
    iterations: PASSWORD_HASH_ITERATIONS,
    salt,
    hash,
    mustChangePassword,
  })}`);
}

// Test accounts
const testAccounts = [
  { email: 'admin@example.com', password: 'Admin123!', role: 'admin', name: 'Admin User' },
  { email: 'owner@example.com', password: 'Owner123!', role: 'owner', name: 'Olivia Owner' },
  { email: 'developer@example.com', password: 'Developer123!', role: 'developer', name: 'Devon Developer' },
  { email: 'processor@example.com', password: 'Processor123!', role: 'processor', name: 'Parker Processor' },
  { email: 'tester@example.com', password: 'Tester123!', role: 'tester', name: 'Taylor Tester' },
  { email: 'photographer@example.com', password: 'Photographer123!', role: 'photographer', name: 'Phoebe Photographer' },
];

console.log('Generated password hashes for test accounts:\n');
console.log('Copy these into your Airtable Password field:\n');

testAccounts.forEach(({ email, password, role, name }) => {
  const hashed = serializePasswordField(password);
  console.log(`Email: ${email}`);
  console.log(`Role: ${role}`);
  console.log(`Plaintext: ${password}`);
  console.log(`Hashed (copy to Airtable):`);
  console.log(`${hashed}`);
  console.log('---');
});
