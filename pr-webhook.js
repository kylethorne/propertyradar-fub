const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const FUB_API_KEY = 'fka_0qYAxNeMjFWaQqLc2cCEezx0CNCosIowlV';
const FUB_BASE_URL = 'https://api.followupboss.com/v1';

const fubClient = axios.create({
  baseURL: FUB_BASE_URL,
  auth: { username: FUB_API_KEY, password: '' },
  headers: { 'Content-Type': 'application/json' }
});

async function createFUBLead(address, name, phone, email, notes) {
  const payload = {
    source: 'Property Radar',
    type: 'Registration',
    person: {
      name: name || 'Unknown Owner',
      phones: phone ? [{ value: phone, type: 'mobile' }] : [],
      emails: email ? [{ value: email, type: 'personal' }] : [],
      addresses: address ? [{ street: address, type: 'home' }] : [],
      tags: ['Foreclosure', 'Door Knock', 'WA Home Pro'],
      assignedUserId: null
    },
    notes: notes || '',
    propertyStreet: address || ''
  };
  const response = await fubClient.post('/events', payload);
  return response.data;
}

async function findFUBPerson(address, email, phone) {
  // Try email first
  if (email) {
    const res = await fubClient.get('/people', { params: { email } });
    if (res.data?.people?.length > 0) return res.data.people[0];
  }
  // Try phone
  if (phone) {
    const res = await fubClient.get('/people', { params: { phone } });
    if (res.data?.people?.length > 0) return res.data.people[0];
  }
  return null;
}

async function addFUBNote(personId, note) {
  const response = await fubClient.post('/notes', { personId, body: note });
  return response.data;
}

app.post('/webhook', async (req, res) => {
  console.log('=== PropertyRadar Webhook Received ===');
  console.log(JSON.stringify(req.body, null, 2));

  const d = req.body || {};
  const triggerType = d.TriggerType || 'Export';

  const street = d.Address || '';
  const city   = d.City || '';
  const state  = d.State || '';
  const zip    = d.ZipFive || d.Zip || '';
  const fullAddress = [street, city, state, zip].filter(Boolean).join(', ');

  const firstName = d.PrimaryContactFirst || d.PrimaryFirstName || '';
  const lastName  = d.PrimaryContactLast  || d.PrimaryLastName  || '';
  const name      = firstName && lastName ? `${firstName} ${lastName}` : d.Owner || 'Unknown Owner';
  const phone     = d.PrimaryContactPhone || d.PrimaryPhone1 || '';
  const email     = d.PrimaryContactEmail || d.PrimaryEmail1 || '';

  console.log(`→ Trigger: ${triggerType} | ${fullAddress} | ${name}`);
  try {
    // Status change — find existing contact and add a note
    if (triggerType === 'Change' || triggerType === 'New Record') {
      const changes = [d.Change1, d.Change2, d.Change3].filter(Boolean).join(' | ');
      const newRecord = d.NewRecordType ? `${d.NewRecordType}: ${d.NewAttribute || ''}` : '';
      const noteText = `PropertyRadar Update | ${fullAddress}\nTrigger: ${triggerType}\n${changes || newRecord}\nStage: ${d.ForeclosureStage || 'N/A'} | Equity: ${d.EquityPercent || 'N/A'}%`;

      const person = await findFUBPerson(fullAddress, email, phone);
      if (person) {
        await addFUBNote(person.id, noteText);
        console.log(`✓ Note added to existing FUB contact: ${person.id}`);
      } else {
        // Contact not found — create it
        const notes = `PropertyRadar Update | Equity: ${d.EquityPercent || 'N/A'}% | Stage: ${d.ForeclosureStage || 'N/A'} | ${changes}`;
        const result = await createFUBLead(fullAddress, name, phone, email, notes);
        console.log('✓ FUB lead created (new):', result.id);
      }
    } else {
      // New match or export — create lead
      const notes = `PropertyRadar | Equity: ${d.EquityPercent || 'N/A'}% | Stage: ${d.ForeclosureStage || 'N/A'} | AVM: $${d.AVM || 'N/A'} | List: ${d.ListName || 'N/A'}`;
      const result = await createFUBLead(fullAddress, name, phone, email, notes);
      console.log('✓ FUB lead created:', result.id);
    }

    res.json({ status: 'success' });
  } catch (err) {
    console.error('✗ FUB error:', err.response?.data || err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/', (req, res) => res.send('PropertyRadar → FUB Webhook running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
