// Vercel Serverless Function — /api/get-state.js
// Reads shared app state from Vercel KV (Redis)

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const kvUrl = process.env.KV_REST_API_URL;
  const kvToken = process.env.KV_REST_API_TOKEN;

  if (!kvUrl || !kvToken) {
    return res.status(500).json({ error: 'KV store not configured' });
  }

  try {
    const response = await fetch(`${kvUrl}/get/app_state`, {
      headers: { Authorization: `Bearer ${kvToken}` },
    });

    const data = await response.json();

    if (data.result === null || data.result === undefined) {
      return res.status(200).json({ state: null });
    }

    // Vercel KV returns the value as a string in data.result
    const state = typeof data.result === 'string' ? JSON.parse(data.result) : data.result;
    return res.status(200).json({ state });
  } catch (err) {
    console.error('GET state error:', err);
    return res.status(500).json({ error: 'Failed to read state' });
  }
}
