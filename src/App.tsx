import { useState, FormEvent, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Music, Send, Loader2, RefreshCw, Copy, Check, Play, Pause, ExternalLink, PlusCircle, Sparkles } from 'lucide-react';
import { interpretMoodToVibe } from './services/geminiService';
import { fetchSongDetails } from './services/musicService';
import { Playlist, Song } from './types';
import { createSpotifyPlaylist, searchSpotifyTrack, SpotifyTokens, getRecommendations } from './services/spotifyService';

export default function App() {
  const [mood, setMood] = useState('');
  const [loading, setLoading] = useState(false);
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const [currentPlaying, setCurrentPlaying] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [spotifyTokens, setSpotifyTokens] = useState<SpotifyTokens | null>(() => {
    const saved = localStorage.getItem('spotify_tokens');
    return saved ? JSON.parse(saved) : null;
  });
  const [savingToSpotify, setSavingToSpotify] = useState(false);
  const [spotifySuccessUrl, setSpotifySuccessUrl] = useState<string | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SPOTIFY_AUTH_SUCCESS') {
        const tokens = event.data.tokens;
        setSpotifyTokens(tokens);
        localStorage.setItem('spotify_tokens', JSON.stringify(tokens));
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const connectSpotify = async () => {
    try {
      console.log('Initiating Spotify connection...');
      const response = await fetch('/api/auth/spotify/url', { cache: 'no-store' });
      const contentType = response.headers.get('content-type');
      
      if (!response.ok || !contentType?.includes('application/json')) {
        const text = await response.text();
        if (text.includes('Active preview')) {
          setError('The backend is still warming up. Please wait 10 seconds and try again.');
          return;
        }
        throw new Error('Unexpected response from server: ' + text.substring(0, 100));
      }
      
      const data = await response.json();
      if (!data.url) throw new Error('No auth URL returned');
      
      window.open(data.url, 'spotify_popup', 'width=600,height=700');
    } catch (err: any) {
      console.error('Failed to get Spotify auth URL:', err);
      setError('Could not connect: ' + (err.message || 'Server error'));
    }
  };

  const saveToSpotify = async () => {
    if (!playlist || !spotifyTokens) return;
    
    setSavingToSpotify(true);
    setSpotifySuccessUrl(null);
    try {
      // Use spotifyId if available, otherwise search
      const trackIds = await Promise.all(
        playlist.songs.map(async (song: any) => {
          if (song.spotifyId) return song.spotifyId;
          return await searchSpotifyTrack(song.title, song.artist, spotifyTokens.access_token);
        })
      );
      
      const validIds = trackIds.filter((id): id is string => id !== null);
      
      if (validIds.length === 0) {
        throw new Error('No songs could be found on Spotify.');
      }

      const playlistUrl = await createSpotifyPlaylist(playlist.name, validIds, spotifyTokens.access_token);
      if (playlistUrl) {
        setSpotifySuccessUrl(playlistUrl);
      } else {
        throw new Error('Failed to create Spotify playlist.');
      }
    } catch (err: any) {
      console.error(err);
      if (err.message.includes('token') || err.message.includes('401')) {
        setError('Your Spotify session has expired. Please reconnect.');
        setSpotifyTokens(null);
        localStorage.removeItem('spotify_tokens');
      } else {
        setError(err.message || 'Failed to save to Spotify.');
      }
    } finally {
      setSavingToSpotify(false);
    }
  };

  const handleGenerate = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!mood.trim()) return;

    if (!spotifyTokens) {
      setError('Please connect Spotify first to unlock Hybrid generation.');
      return;
    }

    setLoading(true);
    setError(null);
    setPlaylist(null);
    setCurrentPlaying(null);
    setSpotifySuccessUrl(null);
    
    try {
      // 1. AI Interprets mood into specific musical parameters
      const vibe = await interpretMoodToVibe(mood);
      
      // 2. Spotify Recommendations API finds the best matching tracks
      const recommendations = await getRecommendations(vibe, spotifyTokens.access_token);
      
      setPlaylist({ 
        name: vibe.name, 
        genre: vibe.description, 
        songs: recommendations 
      });
    } catch (err: any) {
      console.error(err);
      if (err.message.includes('401')) {
        setSpotifyTokens(null);
        setError('Spotify session expired. Please reconnect.');
      } else {
        setError(err.message || 'Failed to discover music. Try a different mood!');
      }
    } finally {
      setLoading(false);
    }
  };

  const togglePlay = (url: string) => {
    if (currentPlaying === url) {
      audioRef.current?.pause();
      setCurrentPlaying(null);
    } else {
      if (audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.play();
        setCurrentPlaying(url);
      }
    }
  };

  const copyToClipboard = () => {
    if (!playlist) return;
    const text = `Playlist: ${playlist.name}\nVibe: ${playlist.genre}\n\nSongs:\n${playlist.songs.map(s => `- ${s.title} by ${s.artist}`).join('\n')}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAudioEnded = () => {
    setCurrentPlaying(null);
  };

  return (
    <div className="min-h-screen relative font-sans selection:bg-orange-500/30">
      <div className="atmosphere" />
      <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />
      
      <div className="max-w-[1200px] mx-auto grid grid-cols-1 md:grid-cols-[320px_1fr] min-h-screen p-6 md:p-10 gap-10">
        {/* Sidebar */}
        <aside className="flex flex-col justify-between py-5">
          <div>
            <motion.div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="font-serif text-2xl italic tracking-tight text-[#FF4E00] mb-16 flex items-center gap-2"
            >
              <Music className="w-6 h-6" />
              daddymood
            </motion.div>

            <div className="space-y-8">
              {!spotifyTokens ? (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 rounded-2xl bg-[#1DB954]/10 border border-[#1DB954]/20 space-y-4"
                >
                  <div className="flex items-center gap-3 text-[#1DB954]">
                    <Music className="w-5 h-5 fill-current" />
                    <span className="text-xs font-bold uppercase tracking-wider">Step 1: Get Connected</span>
                  </div>
                  <p className="text-sm text-white/60 leading-relaxed">
                    Connect your Spotify to unlock Hybrid AI generation and save playlists directly to your account.
                  </p>
                  <button
                    onClick={connectSpotify}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1DB954] hover:bg-[#1ed760] text-black text-sm font-bold transition-all transform hover:scale-[1.02] active:scale-[0.98]"
                  >
                    Connect Spotify
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-white/60">Spotify Connected</span>
                  </div>
                  <button 
                    onClick={() => {
                      setSpotifyTokens(null);
                      localStorage.removeItem('spotify_tokens');
                    }}
                    className="text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                  >
                    Disconnect
                  </button>
                </motion.div>
              )}

              <div className={!spotifyTokens ? 'opacity-20 pointer-events-none' : ''}>
                <motion.h2 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="text-3xl font-light leading-tight mb-8"
                >
                  {spotifyTokens ? 'Tell me how you feel.' : 'Unlock the magic.'}
                </motion.h2>

                <motion.form 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  onSubmit={handleGenerate} 
                  className="space-y-4"
                >
                  <div className="input-container">
                    <textarea
                      value={mood}
                      onChange={(e) => setMood(e.target.value)}
                      placeholder={spotifyTokens ? "e.g. Energetic morning after coffee..." : "Connect Spotify to start..."}
                      disabled={loading || !spotifyTokens}
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading || !mood.trim() || !spotifyTokens}
                    className="btn-primary w-full flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        Craft My Soundscape
                        <Send className="w-4 h-4" />
                      </>
                    )}
                  </button>
                </motion.form>
              </div>
            </div>
          </div>

          <div className="flex justify-between text-[10px] uppercase tracking-widest opacity-40 mt-10">
            <span>v1.2.0 Spotify Integration</span>
            <span>AI: daddymood AI</span>
          </div>
        </aside>

        {/* Main Content */}
        <main className="relative">
          <AnimatePresence mode="wait">
            {playlist && !loading ? (
              <motion.div
                key={playlist.name}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="glass-panel p-8 md:p-12 min-h-full flex flex-col"
              >
                <div className="mb-12">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                    <div className="text-[12px] uppercase tracking-[0.2em] text-white/60">
                      Generated Playlist • 8 Real Tracks
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-3">
                        {spotifySuccessUrl ? (
                          <a
                            href={spotifySuccessUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[#1DB954]/20 border border-[#1DB954]/50 text-[#1DB954] text-xs font-bold hover:bg-[#1DB954]/30 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                            Open in Spotify
                          </a>
                        ) : (
                          <button
                            onClick={saveToSpotify}
                            disabled={savingToSpotify}
                            className="flex items-center gap-2 px-4 py-2 rounded-full border border-white/20 hover:bg-white/10 text-xs font-bold transition-all disabled:opacity-50"
                          >
                            {savingToSpotify ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <PlusCircle className="w-4 h-4" />
                            )}
                            Save to Spotify
                          </button>
                        )}
                        <button 
                          onClick={() => {
                            setSpotifyTokens(null);
                            localStorage.removeItem('spotify_tokens');
                          }}
                          className="text-[10px] uppercase tracking-widest opacity-40 hover:opacity-100 transition-opacity"
                        >
                          Disconnect
                        </button>
                      </div>
                      <div className="w-[1px] h-4 bg-white/20 mx-1" />
                      <button
                        onClick={copyToClipboard}
                        className="p-2 rounded-full glass hover:bg-white/10 transition-colors"
                        title="Copy to clipboard"
                      >
                        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleGenerate()}
                        className="p-2 rounded-full glass hover:bg-white/10 transition-colors"
                        title="Regenerate"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  
                  <h1 className="text-5xl md:text-7xl font-serif font-bold tracking-tight mb-4 leading-none text-white">
                    {playlist.name}
                  </h1>
                  
                  <p className="text-[#FF4E00] text-sm uppercase tracking-widest font-bold mb-8">
                    {playlist.genre}
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6">
                  {playlist.songs.map((song, index) => (
                    <motion.div
                      key={`${song.title}-${index}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="group flex flex-col md:flex-row md:items-center justify-between p-4 rounded-2xl hover:bg-white/[0.03] transition-colors gap-4 border border-transparent hover:border-white/10"
                    >
                      <div className="flex items-center gap-4 flex-1">
                        <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-white/5">
                          {song.thumbnail ? (
                            <img 
                              src={song.thumbnail} 
                              alt={song.title} 
                              className="w-full h-full object-cover"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Music className="w-6 h-6 opacity-20" />
                            </div>
                          )}
                          
                          {song.previewUrl && (
                            <button 
                              onClick={() => togglePlay(song.previewUrl!)}
                              className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              {currentPlaying === song.previewUrl ? (
                                <Pause className="w-6 h-6 fill-current" />
                              ) : (
                                <Play className="w-6 h-6 fill-current" />
                              )}
                            </button>
                          )}
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="text-lg font-medium leading-none">{song.title}</h4>
                            {currentPlaying === song.previewUrl && (
                              <div className="flex items-center gap-0.5 h-4 px-1">
                                <div className="playing-bar" />
                                <div className="playing-bar" />
                                <div className="playing-bar" />
                              </div>
                            )}
                          </div>
                          <p className="text-sm text-[#FF4E00] mb-2">{song.artist}</p>
                          <p className="text-xs text-white/40 leading-snug max-w-lg">
                            {song.description}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 md:pl-4">
                        {song.previewUrl && (
                          <button
                            onClick={() => togglePlay(song.previewUrl!)}
                            className={`p-3 rounded-full border transition-all ${
                              currentPlaying === song.previewUrl 
                                ? 'bg-[#FF4E00] border-[#FF4E00] text-black' 
                                : 'border-white/10 hover:border-white/30 text-white/60'
                            }`}
                          >
                            {currentPlaying === song.previewUrl ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          </button>
                        )}
                        {song.externalUrl && (
                          <a
                            href={song.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-3 rounded-full border border-white/10 hover:border-white/30 text-white/60 transition-all"
                            title="Listen on Apple Music"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ) : loading ? (
              <div className="glass-panel p-12 min-h-full flex flex-col items-center justify-center text-center">
                <div className="relative mb-8">
                  <Loader2 className="w-16 h-16 text-[#FF4E00] animate-spin" />
                  <div className="absolute inset-0 blur-2xl bg-[#FF4E00]/20 animate-pulse" />
                </div>
                <h3 className="text-2xl font-serif italic opacity-60">Scouring the sonic libraries...</h3>
                <p className="mt-4 text-white/40 max-w-xs font-light">
                  Gemini is refining your vibe while we search Spotify for the perfect tracks.
                </p>
              </div>
            ) : (
              <div className="glass-panel p-12 min-h-full flex flex-col items-center justify-center text-center">
                {!spotifyTokens ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="max-w-sm space-y-6"
                  >
                    <div className="relative inline-block">
                      <Music className="w-20 h-20 mb-2 stroke-[1px] opacity-20" />
                      <Sparkles className="absolute -top-2 -right-2 w-6 h-6 text-[#1DB954] animate-pulse" />
                    </div>
                    <h3 className="text-2xl font-serif italic text-white/80">Welcome to daddymood</h3>
                    <p className="text-sm text-white/40 leading-relaxed font-light italic">
                      "Music is the wine that fills the cup of silence."
                    </p>
                    <div className="pt-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-[#1DB954] font-bold mb-4">
                        Step 1: Connect your Spotify in the sidebar
                      </p>
                      <div className="w-12 h-[1px] bg-white/10 mx-auto" />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 0.3 }}
                    className="flex flex-col items-center"
                  >
                    <Music className="w-20 h-20 mb-6 stroke-[1px]" />
                    <p className="text-xl font-light tracking-widest uppercase">Waiting for your mood</p>
                  </motion.div>
                )}
              </div>
            )}
          </AnimatePresence>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-6 left-6 right-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center"
            >
              {error}
            </motion.div>
          )}
        </main>
      </div>
    </div>
  );
}

