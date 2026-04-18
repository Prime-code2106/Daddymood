export interface Song {
  title: string;
  artist: string;
  description: string;
  previewUrl?: string;
  thumbnail?: string;
  externalUrl?: string;
}

export interface Playlist {
  name: string;
  genre: string;
  songs: Song[];
}
