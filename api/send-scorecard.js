const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { to, weekNumber, csvContent } = req.body;

    if (!to || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({ error: 'No recipients provided' });
    }

    if (!csvContent) {
      return res.status(400).json({ error: 'No CSV content provided' });
    }

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

    return res.json({ success: true, data });
  } catch (err) {
    console.error('Server error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};