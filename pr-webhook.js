const express = require('express');
const app = express();

app.use(express.json());

app.post('/webhook', (req, res) => {
  console.log("PropertyRadar sent:", JSON.stringify(req.body, null, 2));
  res.json({status: "received"});
});

app.get('/', (req, res) => res.send("Webhook is running"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Running on port ${PORT}`));
