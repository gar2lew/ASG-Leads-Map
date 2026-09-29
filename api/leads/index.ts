import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createSign } from 'node:crypto'

const SHEETS = {
  perth: '15bh3bkAMpwIhi3MJ2-INA8njG3spgUW8CGVb_ckJ26I',
  brisbane: '1AO6VZzJXr6btECVZrWFTKFXPBNMkjmuDsKiCisrjcrM',
} as const
const LEAD_TABS = ['LEADS', 'NO ANSWER', 'BOOKED', 'REVISIT', 'NOT INTERESTED', 'WRONG NUMBER'] as const

function encodeBase64Url(value: string) { return Buffer.from(value).toString('base64url') }

async function getSheetsAccessToken() {
  const email = process.env.FIREBASE_ADMIN_CLIENT_EMAIL
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
  const encodedKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY_BASE64
  if (encodedKey) privateKey = Buffer.from(encodedKey, 'base64').toString('utf8')
  if (!email || !privateKey) throw new Error('Google Sheets server credentials are missing.')
  privateKey = privateKey.trim().replace(/^['"]|['"]$/g, '').replace(/\\n/g, '\n')

  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${encodeBase64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${encodeBase64Url(JSON.stringify({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }))}`
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  const assertion = `${unsigned}.${signer.sign(privateKey, 'base64url')}`
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
  })
  if (!response.ok) throw new Error('Unable to authorize the Google Sheets service account.')
  const result = await response.json() as { access_token?: string }
  if (!result.access_token) throw new Error('Google did not return a Sheets access token.')
  return { accessToken: result.access_token, serviceAccountEmail: email }
}

async function importOfficeSheet(req: VercelRequest, res: VercelResponse, office: 'perth' | 'brisbane') {
  const authorization = req.headers.authorization
  if (!authorization?.startsWith('Bearer ')) return res.status(401).json({ error: 'Sign in to import a register.' })

  try {
    const { getAdminAuth, getAdminDb } = await import('../_lib/admin.js')
    const decoded = await (await getAdminAuth()).verifyIdToken(authorization.slice(7).trim())
    const profile = await (await getAdminDb()).collection('users').doc(decoded.uid).get()
    const role = String(profile.data()?.role)
    if (!profile.exists || profile.data()?.active === false || !['super_admin', 'manager', 'rep'].includes(role)) {
      return res.status(403).json({ error: 'Your account is not allowed to read lead registers.' })
    }

    const { accessToken, serviceAccountEmail } = await getSheetsAccessToken()
    const params = new URLSearchParams({ valueRenderOption: 'FORMATTED_VALUE', majorDimension: 'ROWS' })
    LEAD_TABS.forEach((tab) => params.append('ranges', `'${tab}'!A1:M10000`))
    const response = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEETS[office]}/values:batchGet?${params}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (response.status === 403 || response.status === 404) {
      return res.status(424).json({ error: `Share this office register with ${serviceAccountEmail} as a Viewer, then retry.` })
    }
    if (!response.ok) return res.status(502).json({ error: 'Google Sheets could not return the lead register. Try again shortly.' })
    const data = await response.json() as { valueRanges?: Array<{ values?: string[][] }> }
    const values: string[][] = []
    for (const range of data.valueRanges ?? []) {
      const rows = range.values ?? []
      if (!rows.length) continue
      if (!values.length) values.push(rows[0] ?? [])
      values.push(...rows.slice(1))
    }
    return res.status(200).json({ office, values })
  } catch (error) {
    console.error('Google Sheets register import failed:', error instanceof Error ? error.message : 'unknown error')
    const message = error instanceof Error && error.message.includes('credentials')
      ? 'Google Sheets server credentials are missing. Check the Firebase Admin service account settings in Vercel.'
      : 'Unable to connect to Google Sheets. Check the server credentials and try again.'
    return res.status(500).json({ error: message })
  }
}

export default async function handler(
  request: VercelRequest,
  response: VercelResponse
) {
  response.setHeader('Access-Control-Allow-Credentials', 'true')
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT')
  response.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  )

  if (request.method === 'OPTIONS') {
    return response.status(200).end()
  }

  const office = typeof request.query.office === 'string' ? request.query.office : ''
  if (request.method === 'GET' && (office === 'perth' || office === 'brisbane')) {
    return importOfficeSheet(request, response, office)
  }
  return response.status(200).json({ message: 'Leads endpoint - provide an office to import its live register.' })
}
