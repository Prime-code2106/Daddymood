import express from 'express';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const app = express();
app.use(express.json());

// --- API Routes ---

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', server: 'daddymood-backend' });
});

// Spotify Auth Endpoint
app.get('/api/auth/spotify/url', (req, res) => {
  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const app_url = process.env.URL || process.env.APP_URL; 
  const redirect_uri = app_url ? `${app_url}/auth/spotify/callback` : '';
  
  if (!client_id || !redirect_uri) {
    return res.status(500).json({ 
      error: 'Spotify configuration missing',
      details: 'SPOTIFY_CLIENT_ID or APP_URL (URL) is not set.'
    });
  }

  const scope = 'playlist-modify-public playlist-modify-private user-read-private user-read-email';
  const params = new URLSearchParams({
    client_id,
    response_type: 'code',
    redirect_uri,
    scope,
    show_dialog: 'true'
  });

  res.json({ url: `https://accounts.spotify.com/authorize?${params.toString()}` });
});

// Spotify Callback Endpoint
app.get(['/auth/spotify/callback', '/auth/spotify/callback/'], async (req, res) => {
  const { code } = req.query;
  const app_url = process.env.URL || process.env.APP_URL;
  
  if (!code) return res.send('No code provided');

  try {
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code as string,
        redirect_uri: `${app_url}/auth/spotify/callback`
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error_description || data.error);

    res.send(`
      <html>
        <body style="background: #070504; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh;">
          <script>
            if (window.opener) {
              window.opener.postMessage({ type: 'SPOTIFY_AUTH_SUCCESS', tokens: ${JSON.stringify(data)} }, '*');
              window.close();
            } else {
              window.location.href = '/';
            }
          </script>
          <div style="text-align: center;">
            <h3>Authentication successful</h3>
            <p>Closing window...</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error('Spotify Callback Error:', error);
    res.status(500).send('Authentication failed.');
  }
});

export default app;
