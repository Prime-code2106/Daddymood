import { Song } from "../types";

export async function fetchSongDetails(title: string, artist: string): Promise<Partial<Song>> {
  try {
    const query = encodeURIComponent(`${title} ${artist}`);
    const response = await fetch(`https://itunes.apple.com/search?term=${query}&entity=song&limit=1`);
    const data = await response.json();

    if (data.results && data.results.length > 0) {
      const track = data.results[0];
      return {
        previewUrl: track.previewUrl,
        thumbnail: track.artworkUrl100?.replace('100x100', '400x400'),
        externalUrl: track.trackViewUrl,
      };
    }
  } catch (error) {
    console.error(`Error fetching details for ${title} by ${artist}:`, error);
  }
  return {};
}
