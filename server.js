const express = require('express');
const cors = require('cors');
const { Resend } = require('resend');
const path = require('path');

// Load .env from the same directory as this file
require('dotenv').config({ path: path.resolve(__dirname, '.env') });

// Debug: check if key loaded
const apiKey = process.env.RESEND_API_KEY;
if (!apiKey) {
  console.error('\n❌ RESEND_API_KEY not found in .env file!');
  console.error('Make sure your .env file is in:', __dirname);
  console.error('And contains: RESEND_API_KEY=re_your_key_here\n');
  process.exit(1);
}
console.log('✅ API key loaded:', apiKey.substring(0, 6) + '...');

const resend = new Resend(apiKey);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

app.post('/api/send-scorecard', async (req, res) => {
  try {
    const { to, weekNumber, csvContent } = req.body;

    if (!to || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({ error: 'No recipients provided' });
    }

    if (!csvContent) {
      return res.status(400).json({ error: 'No CSV content provided' });
    }

    console.log(`Sending Week ${weekNumber} scorecard to:`, to);

    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Weekly Scorer <onboarding@resend.dev>',
      to,
      subject: `Week ${weekNumber} Scorecard`,
      text: `Hi everyone,\n\nAttached is the scorecard for Week ${weekNumber}.\n\nRegards,\nWeekly Team Scorer`,
      attachments: [
        {
          filename: `Week_${weekNumber}_Scorecard.csv`,
          content: Buffer.from(csvContent).toString('base64'),
        },
      ],
    });

    if (error) {
      console.error('Resend error:', error);
      return res.status(400).json({ error: error.message || 'Failed to send email' });
    }

    console.log('✅ Email sent successfully!', data);
    return res.json({ success: true, data });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log('\n📧 Email server running on http://localhost:' + PORT + '\n');
});
