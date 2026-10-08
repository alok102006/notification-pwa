import assert from 'assert';
import { isInsideActiveWindow, timeToMinutes, isNotificationDue } from '../netlify/functions/lib/time.js';
import { Storage } from '../netlify/functions/lib/storage.js';

console.log('Running test suite for Personal Scheduled Notification PWA...\n');

// Test 1: Time parsing
console.log('Test: timeToMinutes parsing');
assert.strictEqual(timeToMinutes('00:00', false), 0);
assert.strictEqual(timeToMinutes('00:00', true), 1440); // midnight as end of day
assert.strictEqual(timeToMinutes('08:30', false), 510);
assert.strictEqual(timeToMinutes('22:00', false), 1320);
console.log('✅ Passed time parsing');

// Test 2: Standard Daytime Active Window (08:00 -> 20:00)
console.log('Test: Standard daytime active window (08:00 -> 20:00)');
assert.strictEqual(isInsideActiveWindow('08:00', '20:00', 480), true, '08:00 exactly should be inside');
assert.strictEqual(isInsideActiveWindow('08:00', '20:00', 720), true, '12:00 should be inside');
assert.strictEqual(isInsideActiveWindow('08:00', '20:00', 1199), true, '19:59 should be inside');
assert.strictEqual(isInsideActiveWindow('08:00', '20:00', 1200), false, '20:00 should be outside');
assert.strictEqual(isInsideActiveWindow('08:00', '20:00', 479), false, '07:59 should be outside');
console.log('✅ Passed daytime active window tests');

// Test 3: Midnight Active Window (08:00 -> 00:00)
console.log('Test: Day active until midnight (08:00 -> 00:00)');
assert.strictEqual(isInsideActiveWindow('08:00', '00:00', 480), true, '08:00 should be inside');
assert.strictEqual(isInsideActiveWindow('08:00', '00:00', 1439), true, '23:59 should be inside');
assert.strictEqual(isInsideActiveWindow('08:00', '00:00', 300), false, '05:00 should be outside');
console.log('✅ Passed midnight window tests');

// Test 4: Overnight Active Window Crossing Midnight (22:00 -> 08:00)
console.log('Test: Overnight active window crossing midnight (22:00 -> 08:00)');
assert.strictEqual(isInsideActiveWindow('22:00', '08:00', 1320), true, '22:00 should be inside');
assert.strictEqual(isInsideActiveWindow('22:00', '08:00', 1439), true, '23:59 should be inside');
assert.strictEqual(isInsideActiveWindow('22:00', '08:00', 0), true, '00:00 should be inside');
assert.strictEqual(isInsideActiveWindow('22:00', '08:00', 479), true, '07:59 should be inside');
assert.strictEqual(isInsideActiveWindow('22:00', '08:00', 480), false, '08:00 should be outside');
assert.strictEqual(isInsideActiveWindow('22:00', '08:00', 720), false, '12:00 noon should be outside');
assert.strictEqual(isInsideActiveWindow('22:00', '08:00', 1319), false, '21:59 should be outside');
console.log('✅ Passed overnight midnight crossing tests');

// Test 5: Disabled notifications check
console.log('Test: Disabled notifications evaluation');
const disabledSchedule = {
  enabled: false,
  intervalMinutes: 5,
  startTime: '00:00',
  endTime: '23:59',
  timezone: 'UTC'
};
const evalDisabled = isNotificationDue(disabledSchedule);
assert.strictEqual(evalDisabled.due, false, 'Disabled schedule must not trigger notifications');
console.log('✅ Passed disabled notification test');

// Test 6: Interval elapsed check
console.log('Test: Interval elapsed calculations');
const activeSchedule = {
  id: 'test',
  enabled: true,
  intervalMinutes: 5,
  startTime: '00:00',
  endTime: '00:00', // 24h
  timezone: 'UTC',
  lastSentAt: new Date(Date.now() - 6 * 60 * 1000).toISOString() // 6 min ago
};
const evalActive = isNotificationDue(activeSchedule);
assert.strictEqual(evalActive.due, true, 'Should be due when 6 min have elapsed for 5 min interval');

const notDueSchedule = {
  ...activeSchedule,
  lastSentAt: new Date(Date.now() - 2 * 60 * 1000).toISOString() // only 2 min ago
};
const evalNotDue = isNotificationDue(notDueSchedule);
assert.strictEqual(evalNotDue.due, false, 'Should NOT be due when only 2 min have elapsed for 5 min interval');
console.log('✅ Passed interval elapsed tests');

// Test 7: Storage CRUD test
console.log('Test: Storage layer save and retrieve');
async function testStorage() {
  const saved = await Storage.saveSchedule({
    id: 'unit_test',
    message: 'Hello World Test',
    intervalMinutes: 15,
    startTime: '09:00',
    endTime: '18:00',
    timezone: 'Asia/Kolkata',
    enabled: true
  });
  assert.strictEqual(saved.message, 'Hello World Test');
  assert.strictEqual(saved.intervalMinutes, 15);

  const retrieved = await Storage.getSchedule('unit_test');
  assert.strictEqual(retrieved.id, 'unit_test');
  assert.strictEqual(retrieved.timezone, 'Asia/Kolkata');
  console.log('✅ Passed storage tests');
}

testStorage().then(() => {
  console.log('\n========================================');
  console.log('🎉 ALL SCHEDULER TESTS PASSED SUCCESSFULLY');
  console.log('========================================\n');
}).catch(err => {
  console.error('Test failure:', err);
  process.exit(1);
});
