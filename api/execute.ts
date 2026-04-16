// api/execute.ts on core
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { analyzeQuery } from './_services/geminiService'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { prompt } = req.body

  if (!prompt) {
    return res.status(400).json({ error: 'Missing prompt in request body' })
  }

  try {
    console.log('=== execute.ts hit ===')
    console.log('Prompt received:', prompt)

    // analyzeQuery handles everything:
    // 1. Converts prompt → SQL via Gemini
    // 2. Executes SQL on main.py via BRIDGE_URL
    // 3. Generates insights via Gemini
    // 4. Returns full result to forecaster
    const result = await analyzeQuery(prompt)

    console.log('Pipeline complete. Engine used:', result.engine)
    return res.status(200).json(result)

  } catch (e: any) {
    console.error('Execute pipeline error:', e)
    return res.status(500).json({ error: e.message })
  }
}