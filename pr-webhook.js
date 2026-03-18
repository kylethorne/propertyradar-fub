const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

const FUB_API_KEY = 'fka_0qYAxNeMjFWaQqLc2cCEezx0CNCosIowlV';
const FUB_BASE_URL = 'https://api.followupboss.com/v1';

async function createFUBLead(address, name, phone, email, notes) {
  const payload = {
    source: 'Property Radar',
    type: 'Registration',
    person: {
      name: name || 'Unknown Owner',
      phones: phone ? [{ value: phone, type: 'mobile' }] : [],
      emails: email ? [{ value: email, type: 'personal' }] : [],
      addresses: address ? [{ street: address, type: 'home' }] : [],
      tags: ['Foreclosure', 'Door Knock', 'WA Home Pro']
    },
    notes: notes || '',
    propertyStreet: address || ''
  };

  const response = await axios.post(`${FUB_BASE_URL}/events`, payload, {
    auth: { username: FUB_API_KEY, password: '' },
    headers: { 'Content-Type': 'application/json' }
  });
  return response.data;
}

app.post('/webhook', async (req, res) => {
  console.log('=== PropertyRadar Webhook Received ===');
  console.log(JSON.stringify(req.body, null, 2));

  const d = req.body || {};

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
  const notes     = `PropertyRadar | Equity: ${d.EquityPercent || 'N/A'}% | Stage: ${d.ForeclosureStage || 'N/A'} | AVM: $${d.AVM || 'N/A'} | List: ${d.ListName || 'N/A'}`;

  console.log(`→ FUB: ${fullAddress} | ${name} | ${phone} | ${email}`);

  try {
    const result = await createFUBLead(fullAddress, name, phone, email, notes);
    console.log('✓ FUB lead created:', result.id);
    res.json({ status: 'success' });
  } catch (err) {
    console.error('✗ FUB error:', err.response?.data || err.message);
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.get('/', (req, res) => res.send('PropertyRadar → FUB Webhook running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
