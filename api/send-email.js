// Vercel Serverless Function — /api/send-email
// Place this file at: <project-root>/api/send-email.js
//
// Required Vercel Environment Variable:
//   RESEND_API_KEY = re_xxxxx  (set in Vercel dashboard → Settings → Environment Variables)

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'RESEND_API_KEY is not configured on the server.' });
  }

  try {
    const { to, subject, text, attachments } = req.body;

    // Basic validation
    if (!to || !Array.isArray(to) || to.length === 0) {
      return res.status(400).json({ error: 'At least one recipient is required.' });
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'Weekly Scorer <scorecards@finessecards.com>',
        to,
        subject,
        text,
        attachments,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json(data);
  } catch (err) {
    console.error('Send email error:', err);
    return res.status(500).json({ error: 'Internal server error sending email.' });
  }
}
