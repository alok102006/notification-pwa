import dotenv from 'dotenv';
import cronHandler from '../netlify/functions/cron-scheduler.js';

dotenv.config();

console.log('Triggering local scheduler run...');
try {
  const req = new Request('http://localhost/.netlify/functions/cron-scheduler');
  const response = await cronHandler(req, {});
  const data = await response.json();
  console.log('\n--- Scheduler Run Result ---');
  console.log(JSON.stringify(data, null, 2));
} catch (err) {
  console.error('Local scheduler run failed:', err);
}
