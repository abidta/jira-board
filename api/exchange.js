export default async function handler(req, res) {
  // We only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { code, clientId, redirectUri, codeVerifier } = req.body;

  if (!code || !clientId || !redirectUri) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const requestBody = {
      grant_type: 'authorization_code',
      client_id: clientId,
      // This secret will be securely pulled from Vercel's Environment Variables
      client_secret: process.env.JIRA_CLIENT_SECRET, 
      code: code,
      redirect_uri: redirectUri
    };
    // Add PKCE code verifier if present
    if (codeVerifier) {
       requestBody.code_verifier = codeVerifier;
    }

    const response = await fetch('https://auth.atlassian.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Atlassian returned error:", data);
      return res.status(response.status).json(data);
    }

    // Success! Return the token data to the frontend
    return res.status(200).json(data);
  } catch (error) {
    console.error("Token exchange error:", error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
}
