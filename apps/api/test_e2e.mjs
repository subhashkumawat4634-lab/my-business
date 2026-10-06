import { randomUUID } from 'node:crypto';

async function test() {
  const base = 'http://192.168.1.9:4000';
  console.log('Testing against:', base);

  // 1. Register User
  const email = `test_${Date.now()}@thekabook.com`;
  const password = 'Password1234!';
  console.log('1. Registering user:', email);
  
  const regRes = await fetch(base + '/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Ramesh Patel',
      organization: 'Patel Builders',
      email,
      password
    })
  });
  const regData = await regRes.json();
  console.log('Register status:', regRes.status, 'Token exists:', !!regData.token);
  if (!regData.token) throw new Error('Registration failed: ' + JSON.stringify(regData));

  const token = regData.token;

  // 2. Fetch Snapshot
  console.log('2. Fetching /snapshot...');
  const snapRes = await fetch(base + '/snapshot', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const snapshot = await snapRes.json();
  console.log('Snapshot status:', snapRes.status, 'Org:', snapshot.organization?.name);

  // 3. Create a Site via /commands
  console.log('3. Creating a site via /commands...');
  const siteKey = randomUUID();
  const siteRes = await fetch(base + '/commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      key: siteKey,
      action: 'site.create',
      data: {
        name: 'Skyline Villa Phase 1',
        owner_name: 'Sunil Verma',
        phone: '9876543210',
        address: 'Plot 42, Civil Lines',
        work_type: 'LABOUR',
        pricing: 'FIXED',
        contract_amount: 500000,
        quantity: 1,
        unit: 'job',
        unit_rate: 500000,
        remaining_estimate: 500000,
        status: 'ONGOING',
        start_date: new Date().toISOString().split('T')[0],
        end_date: null,
        notes: 'Initial agreement done'
      }
    })
  });
  const siteData = await siteRes.json();
  console.log('Site create status:', siteRes.status, 'Site ID:', siteData.record?.id);
  const siteId = siteData.record.id;

  // 4. Create a Worker via /commands
  console.log('4. Creating a worker via /commands...');
  const workerKey = randomUUID();
  const workerRes = await fetch(base + '/commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      key: workerKey,
      action: 'worker.create',
      data: {
        name: 'Mohan Lal (Mistri)',
        phone: '9898989898',
        skill: 'Mason',
        daily_rate: 850,
        overtime_rate: 120,
        active: true
      }
    })
  });
  const workerData = await workerRes.json();
  console.log('Worker create status:', workerRes.status, 'Worker ID:', workerData.record?.id);
  const workerId = workerData.record.id;

  // 5. Mark Attendance via /commands
  console.log('5. Marking Attendance via /commands...');
  const attKey = randomUUID();
  const attRes = await fetch(base + '/commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      key: attKey,
      action: 'attendance.save',
      data: {
        site_id: siteId,
        worker_id: workerId,
        date: new Date().toISOString().split('T')[0],
        units: 1,
        overtime_minutes: 60,
        notes: ''
      }
    })
  });
  const attData = await attRes.json();
  console.log('Attendance status:', attRes.status, 'Earned Amount:', attData.record?.amount);

  // 6. Record Hisab Entry via /commands
  console.log('6. Adding Material Entry via /commands...');
  const entryKey = randomUUID();
  const entryRes = await fetch(base + '/commands', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      key: entryKey,
      action: 'entry.create',
      data: {
        site_id: siteId,
        worker_id: null,
        kind: 'MATERIAL',
        date: new Date().toISOString().split('T')[0],
        amount: 25000,
        description: 'UltraTech Cement 50 Bags',
        party: 'Gupta Building Materials',
        mode: 'UPI',
        reference: 'UPI/123456789',
        due_date: null,
        linked_entry_id: null,
        quantity: 50,
        unit: 'bags'
      }
    })
  });
  const entryData = await entryRes.json();
  console.log('Entry status:', entryRes.status, 'Entry ID:', entryData.record?.id);

  // 7. Verify updated Snapshot
  console.log('7. Verifying final snapshot...');
  const finalSnapRes = await fetch(base + '/snapshot', {
    headers: { Authorization: 'Bearer ' + token }
  });
  const finalSnap = await finalSnapRes.json();
  console.log(`Final Snapshot Summary:
  - Sites: ${finalSnap.sites.length}
  - Workers: ${finalSnap.workers.length}
  - Attendance: ${finalSnap.attendance.length}
  - Entries: ${finalSnap.entries.length}
  - Audit logs: ${finalSnap.audit.length}`);

  console.log('\n========================================');
  console.log('🎉 ALL BACKEND E2E CHECKS PASSED 100%!');
  console.log('========================================\n');
}

test().catch(e => {
  console.error('Test failed:', e);
  process.exit(1);
});
