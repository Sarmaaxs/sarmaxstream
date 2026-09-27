// src/lib/useMusicLibrary.jsx — REPLACES the Base44 version entirely.
// Same return shape as before (isAuthenticated, saved, savedIds, isSaved,
// playlists, loading, toggleSave, createPlaylist, addToPlaylist,
// removeFromPlaylist, deletePlaylist, reload) so nothing else in your app
// (TrackGrid, PlayerBar, AddToPlaylistMenu, Library.jsx, PlaylistView.jsx)
// needs to change — this is a drop-in swap.
//
// Requires: src/api/supabaseClient.js and the tables from supabase-schema.sql.
// Requires: an AuthContext that exposes `user` (Supabase auth user) instead
// of Base44's redirectToLogin — see the note at the bottom of this file.

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/api/supabaseClient';
import { useAuth } from '@/lib/AuthContext';

export function useMusicLibrary() {
  const { isAuthenticated, user, navigateToLogin } = useAuth();
  const [saved, setSaved] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(false);

  const reload = useCallback(async () => {
    if (!isAuthenticated || !user) { setSaved([]); setPlaylists([]); return; }
    setLoading(true);
    try {
      const [{ data: s, error: sErr }, { data: pl, error: plErr }] = await Promise.all([
        supabase
          .from('saved_tracks')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('playlists')
          .select('*, playlist_tracks(*)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
      ]);
      if (sErr) throw sErr;
      if (plErr) throw plErr;

      setSaved((s || []).map((r) => ({
        id: r.id, videoId: r.video_id, title: r.title, artist: r.artist, thumbnail: r.thumbnail,
      })));

      setPlaylists((pl || []).map((p) => ({
        id: p.id,
        name: p.name,
        tracks: (p.playlist_tracks || [])
          .sort((a, b) => a.position - b.position)
          .map((t) => ({ videoId: t.video_id, title: t.title, artist: t.artist, thumbnail: t.thumbnail })),
      })));
    } catch (e) {
      console.error('library load failed', e);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user]);

  useEffect(() => { reload(); }, [reload]);

  const savedIds = new Set(saved.map((t) => t.videoId));
  const isSaved = useCallback((videoId) => savedIds.has(videoId), [saved]);

  const requireAuth = () => {
    if (!isAuthenticated) { navigateToLogin?.(window.location.href); return false; }
    return true;
  };

  const toggleSave = useCallback(async (track) => {
    if (!requireAuth()) return;
    const existing = saved.find((t) => t.videoId === track.videoId);
    try {
      if (existing) {
        await supabase.from('saved_tracks').delete().eq('id', existing.id);
      } else {
        await supabase.from('saved_tracks').insert({
          user_id: user.id,
          video_id: track.videoId,
          title: track.title,
          artist: track.artist,
          thumbnail: track.thumbnail,
        });
      }
      await reload();
    } catch (e) {
      console.error('toggleSave failed', e);
    }
  }, [isAuthenticated, saved, user, reload]);

  const createPlaylist = useCallback(async (name) => {
    if (!requireAuth() || !name?.trim()) return null;
    try {
      const { data, error } = await supabase
        .from('playlists')
        .insert({ user_id: user.id, name: name.trim() })
        .select()
        .single();
      if (error) throw error;
      await reload();
      return data;
    } catch (e) {
      console.error('createPlaylist failed', e);
      return null;
    }
  }, [isAuthenticated, user, reload]);

  const addToPlaylist = useCallback(async (playlistId, track) => {
    if (!requireAuth()) return;
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    if (pl.tracks.some((t) => t.videoId === track.videoId)) return;
    try {
      await supabase.from('playlist_tracks').insert({
        playlist_id: playlistId,
        video_id: track.videoId,
        title: track.title,
        artist: track.artist,
        thumbnail: track.thumbnail,
        position: pl.tracks.length,
      });
      await reload();
    } catch (e) {
      console.error('addToPlaylist failed', e);
    }
  }, [isAuthenticated, playlists, reload]);

  const removeFromPlaylist = useCallback(async (playlistId, videoId) => {
    try {
      await supabase.from('playlist_tracks').delete().eq('playlist_id', playlistId).eq('video_id', videoId);
      await reload();
    } catch (e) {
      console.error('removeFromPlaylist failed', e);
    }
  }, [reload]);

  const deletePlaylist = useCallback(async (playlistId) => {
    try {
      await supabase.from('playlists').delete().eq('id', playlistId);
      await reload();
    } catch (e) {
      console.error('deletePlaylist failed', e);
    }
  }, [reload]);

  return {
    isAuthenticated, saved, savedIds, isSaved, playlists, loading,
    toggleSave, createPlaylist, addToPlaylist, removeFromPlaylist, deletePlaylist, reload,
  };
}

// NOTE on AuthContext: your Base44 AuthContext.jsx exposed
// `base44.auth.redirectToLogin(...)`. Reuse sarmaxstream's AuthContext.jsx
// as-is (it's already Supabase-based) — it exposes `user` and a login
// redirect helper, which is exactly what this file expects. Don't write a
// third auth system; one Supabase auth context for both apps.
