// api/execute.ts on core — simple bridge proxy, no Gemini logic
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
      headers: {
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({ sql }),
      signal: AbortSignal.timeout(55000)
    })

    const text = await response.text()

    let data
    try {
      data = JSON.parse(text)
    } catch {
      console.error('Non-JSON response from bridge:', text)
      return res.status(502).json({ error: 'Bridge returned invalid JSON', raw: text })
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: data })
    }

    return res.status(200).json(data)

  } catch (e: any) {
    console.error('Bridge connection error:', e)
    console.error('Cause:', e?.cause)
    return res.status(500).json({ error: e.message })
  }
}