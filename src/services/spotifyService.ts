import { Song } from "../types";
import { VibeParams } from "./geminiService";

export interface SpotifyTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function getRecommendations(vibe: VibeParams, token: string): Promise<Song[]> {
  const params = new URLSearchParams({
    seed_genres: (vibe.genres && vibe.genres.length > 0) ? vibe.genres.join(',') : 'pop',
    target_acousticness: vibe.target_acousticness.toString(),
    target_danceability: vibe.target_danceability.toString(),
    target_energy: vibe.target_energy.toString(),
    target_valence: vibe.target_valence.toString(),
    target_instrumentalness: vibe.target_instrumentalness.toString(),
    target_tempo: vibe.target_tempo.toString(),
    limit: '8'
  });

  try {
    const response = await fetch(`https://api.spotify.com/v1/recommendations?${params.toString()}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.status === 401) throw new Error('Spotify session expired');
    
    const data = await response.json();
    
    // If recommendations API fails or returns no tracks, fallback to pure search
    if (response.status !== 200 || !data.tracks || data.tracks.length === 0) {
      console.warn('Recommendations failed, falling back to search for:', vibe.search_term);
      return await searchTracksFallback(vibe.search_term, token, vibe.description);
    }
    
    return data.tracks.map((track: any) => ({
      title: track.name,
      artist: track.artists[0].name,
      description: `A ${vibe.genres[0] || 'matching'} track matching your vibe.`,
      thumbnail: track.album.images[0]?.url,
      previewUrl: track.preview_url,
      externalUrl: track.external_urls.spotify,
      spotifyId: track.id
    }));
  } catch (error) {
    console.error('Spotify Recommendations Error, trying fallback:', error);
    return await searchTracksFallback(vibe.search_term, token, vibe.description);
  }
}

async function searchTracksFallback(query: string, token: string, vibeDesc: string): Promise<Song[]> {
  const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=8`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  
  if (!data.tracks || !data.tracks.items) {
    throw new Error('No songs found matching that vibe.');
  }

  return data.tracks.items.map((track: any) => ({
    title: track.name,
    artist: track.artists[0].name,
    description: `Found via vibe search: ${vibeDesc}`,
    thumbnail: track.album.images[0]?.url,
    previewUrl: track.preview_url,
    externalUrl: track.external_urls.spotify,
    spotifyId: track.id
  }));
}

export async function searchSpotifyTrack(title: string, artist: string, token: string): Promise<string | null> {
  const query = encodeURIComponent(`track:${title} artist:${artist}`);
  try {
    const response = await fetch(`https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await response.json();
    return data.tracks?.items?.[0]?.id || null;
  } catch (error) {
    console.error('Spotify Search Error:', error);
    return null;
  }
}

export async function createSpotifyPlaylist(name: string, trackIds: string[], token: string): Promise<string | null> {
  try {
    const profileRes = await fetch('https://api.spotify.com/v1/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const profile = await profileRes.json();
    const userId = profile.id;

    const createRes = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: `${name} (daddymood AI)`,
        description: `Your custom mood-based playlist curated by daddymood AI.`,
        public: true
      })
    });
    const playlist = await createRes.json();
    const playlistId = playlist.id;

    const uris = trackIds.map(id => `spotify:track:${id}`);
    await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris })
    });

    return playlist.external_urls.spotify;
  } catch (error) {
    console.error('Spotify Playlist Creation Error:', error);
    return null;
  }
}
