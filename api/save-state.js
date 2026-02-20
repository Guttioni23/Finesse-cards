// Vercel Serverless Function — /api/save-state.js
// Writes shared app state to Vercel KV (Redis)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    return res.status(500).json({ error: 'KV store not configured' });
  }

  try {
    const { state } = req.body;

    if (!state) {
      return res.status(400).json({ error: 'No state provided' });
    }

    const payload = typeof state === 'string' ? state : JSON.stringify(state);

    const response = await fetch(`${kvUrl}/set/app_state`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${kvToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('SAVE state error:', err);
    return res.status(500).json({ error: 'Failed to save state' });
  }
}
