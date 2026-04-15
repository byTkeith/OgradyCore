// CREATE THIS FILE AT: api/execute.ts
// PURPOSE: Receives { prompt } from forecaster (Vercel), uses Gemini to generate SQL, forwards to main.py via ngrok, and returns data

import type { VercelRequest, VercelResponse } from '@vercel/node'
import { analyzeQuery } from '../services/geminiService'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { prompt } = req.body

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt in request body' })
  }

  const bridgeUrl = process.env.BRIDGE_URL

  if (!bridgeUrl) {
    return res.status(500).json({ error: 'BRIDGE_URL environment variable not set' })
  }

  try {
    console.log(`Analyzing prompt and forwarding to bridge: ${bridgeUrl}`)

    // analyzeQuery handles generating the SQL, executing it on the bridge, and generating insights
    const result = await analyzeQuery(prompt)

    return res.status(200).json(result)

  } catch (e: any) {
    console.error('Pipeline error:', e)
    return res.status(500).json({ error: e.message })
  }
}
