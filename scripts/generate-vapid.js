import webpush from 'web-push';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const vapidKeys = webpush.generateVAPIDKeys();

console.log('\n========================================');
console.log('       NEW VAPID KEYS GENERATED        ');
console.log('========================================\n');
console.log('VAPID_PUBLIC_KEY:');
console.log(vapidKeys.publicKey);
console.log('\nVAPID_PRIVATE_KEY:');
console.log(vapidKeys.privateKey);
console.log('\nVAPID_SUBJECT:');
console.log('mailto:notifications@example.com');
console.log('\n========================================\n');

// Automatically write/update .env file for local testing if not already present
const envPath = path.resolve(__dirname, '../.env');
const envContent = `# VAPID Keys for Web Push
VAPID_PUBLIC_KEY=${vapidKeys.publicKey}
VAPID_PRIVATE_KEY=${vapidKeys.privateKey}
VAPID_SUBJECT=mailto:notifications@example.com
`;

if (!fs.existsSync(envPath)) {
  fs.writeFileSync(envPath, envContent, 'utf-8');
  console.log('✅ Created .env file automatically with these keys for local development.\n');
} else {
  console.log('ℹ️  .env file already exists. Copy keys above to your .env or Netlify Dashboard as needed.\n');
}
