import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface VibeParams {
  name: string;
  description: string;
  genres: string[];
  search_term: string;
  target_acousticness: number;
  target_danceability: number;
  target_energy: number;
  target_valence: number;
  target_instrumentalness: number;
  target_tempo: number;
}

export async function interpretMoodToVibe(mood: string): Promise<VibeParams> {
  const result = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Translate this human mood or music request into a Spotify Vibe Profile: "${mood}"
    
    1. Seed Genres: Choose 1-3 highly relevant seed genres from this list (ONLY pick from these):
    acoustic, afrobeat, alt-rock, ambient, anime, black-metal, bluegrass, blues, bossanova, brazil, breakbeat, british, cantopop, chicago-house, children, chill, classical, club, comedy, country, dance, dancehall, death-metal, deep-house, detroit-techno, disco, disney, drum-and-bass, dub, dubstep, edm, electro, electronic, emo, folk, forro, french, funk, garage, german, gospel, goth, grindcore, groove, grunge, guitar, happy, hard-rock, hardcore, hardstyle, heavy-metal, hip-hop, holidays, honky-tonk, house, idm, indian, indie, indie-pop, industrial, j-dance, j-idol, j-pop, j-rock, jazz, k-pop, kids, latin, latino, malay, mandopop, metal, metal-misc, metalcore, minimal-techno, movies, mpb, new-age, new-release, opera, pagode, party, philippines, pop, pop-film, post-dubstep, power-pop, progressive-house, psych-rock, punk, punk-rock, r-n-b, rainy-day, reggae, reggaeton, road-trip, rock, rock-n-roll, rockabilly, romance, sad, salsa, samba, sertanejo, show-tunes, singer-songwriter, ska, sleep, songwriter, soul, soundtracks, spanish, study, summer, swedish, synth-pop, tango, techno, trance, trip-hop, turkish, world-music.
    
    If it's a specific genre not in the list (like "Fuji"), pick the closest category (like "afrobeat" or "world-music").

    2. Search Term: Create a 2-3 word search query that would find songs for this mood on Spotify if the technical sliders fail (e.g. "fuji music hits", "sad acoustic ballads", "deep techno mix").`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: {
            type: Type.STRING,
            description: "A creative name for the playlist.",
          },
          description: {
            type: Type.STRING,
            description: "A short description of the vibe.",
          },
          genres: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "1-3 Spotify seed genres.",
          },
          search_term: {
            type: Type.STRING,
            description: "A search query fallback (e.g. 'Fuji music', 'Sad pop').",
          },
          target_acousticness: { type: Type.NUMBER },
          target_danceability: { type: Type.NUMBER },
          target_energy: { type: Type.NUMBER },
          target_valence: { type: Type.NUMBER },
          target_instrumentalness: { type: Type.NUMBER },
          target_tempo: { type: Type.NUMBER },
        },
        required: [
          "name", "description", "genres", "search_term", "target_acousticness", 
          "target_danceability", "target_energy", "target_valence", 
          "target_instrumentalness", "target_tempo"
        ],
      },
    },
  });

  return JSON.parse(result.text);
}
