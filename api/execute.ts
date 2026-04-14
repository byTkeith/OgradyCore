// CREATE THIS FILE AT: api/execute.ts
// PURPOSE: Receives { sql } from forecaster (Vercel), forwards to main.py via ngrok

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { sql } = req.body

  if (!sql) {
    return res.status(400).json({ error: 'Missing sql in request body' })
  }

  const bridgeUrl = process.env.BRIDGE_URL

  if (!bridgeUrl) {
    return res.status(500).json({ error: 'BRIDGE_URL environment variable not set' })
  }

  try {
    console.log(`Forwarding SQL to bridge: ${bridgeUrl}/api/execute`)

    const response = await fetch(`${bridgeUrl}/api/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({ error: data })
    }

    return res.status(200).json(data)

  } catch (e: any) {
    console.error('Bridge connection error:', e)
    return res.status(500).json({ error: e.message })
  }
}
