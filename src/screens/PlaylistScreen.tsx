/**
 * 歌单 / 合集详情页 —— 在线合集（榜单）或本地自建歌单的歌曲列表与播放。
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { fetchCollectionSongs } from '../discover';
import { usePlayer } from '../player/PlayerContext';
import { useLibrary } from '../library';
import SongArt from '../components/SongArt';
import type { LxMusicApi } from '../lx-api/index.js';
import type { Collection, LocalPlaylist, Song } from '../types';

function Row({ song, onPlay }: { song: Song; onPlay: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPlay}>
      <SongArt song={song} size={46} radius={10} />
      <View style={styles.rowMain}>
        <Text style={styles.rowName} numberOfLines={1}>
          {song.name}
        </Text>
        <Text style={styles.rowSinger} numberOfLines={1}>
          {song.singer}
        </Text>
      </View>
      <View style={styles.playBtn}>
        <Text style={styles.playBtnIcon}>▶</Text>
      </View>
    </Pressable>
  );
}

export default function PlaylistScreen({
  title,
  desc,
  mode,
  collection,
  local,
  getApi,
  onBack,
  onDeleteLocal,
}: {
  title: string;
  desc?: string;
  mode: 'collection' | 'local';
  collection?: Collection;
  local?: LocalPlaylist;
  getApi: () => LxMusicApi | null;
  onBack: () => void;
  onDeleteLocal?: () => void;
}) {
  const { play } = usePlayer();
  const { toggleFav, isFav } = useLibrary();
  const [songs, setSongs] = useState<Song[]>(mode === 'local' ? local?.songs ?? [] : []);
  const [loading, setLoading] = useState(mode === 'collection');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!collection || mode !== 'collection') return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchCollectionSongs(collection);
      setSongs(list);
    } catch (e: any) {
      setError(`加载失败：${e?.message ?? e}（接口可能失效，可重试）`);
    } finally {
      setLoading(false);
    }
  }, [collection, mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const fav = collection ? isFav(collection.id) : false;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        {collection ? (
          <Pressable style={styles.favBtn} onPress={() => toggleFav(collection)} hitSlop={8}>
            <Text style={[styles.favText, fav && styles.favTextActive]}>{fav ? '♥' : '♡'}</Text>
          </Pressable>
        ) : (
          <View style={styles.favPlaceholder} />
        )}
      </View>

      {desc ? <Text style={styles.desc} numberOfLines={2}>{desc}</Text> : null}

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator color="#00B578" />
          <Text style={styles.centerHint}>正在加载歌曲…</Text>
        </View>
      ) : error ? (
        <View style={styles.centerBox}>
          <Text style={styles.centerError} numberOfLines={3}>
            {error}
          </Text>
          <Pressable style={styles.retryBtn} onPress={() => void load()}>
            <Text style={styles.retryText}>重试</Text>
          </Pressable>
        </View>
      ) : songs.length === 0 ? (
        <View style={styles.centerBox}>
          <Text style={styles.centerHint}>这个歌单还是空的</Text>
        </View>
      ) : (
        <FlatList
          data={songs}
          keyExtractor={s => `${s.source}:${s.id}`}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => (
            <Row song={item} onPlay={() => play(item, getApi(), songs)} />
          )}
        />
      )}

      {mode === 'local' && onDeleteLocal ? (
        <Pressable style={styles.deleteBtn} onPress={onDeleteLocal}>
          <Text style={styles.deleteText}>删除此歌单</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  backText: { fontSize: 34, color: '#1F2329', lineHeight: 34, marginTop: -4 },
  headerTitle: { flex: 1, fontSize: 22, fontWeight: '700', color: '#1F2329' },
  favBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  favPlaceholder: { width: 36, height: 36 },
  favText: { fontSize: 24, color: '#C0C6CC' },
  favTextActive: { color: '#F53F3F' },
  desc: { fontSize: 12, color: '#8A9099', paddingHorizontal: 18, paddingBottom: 10 },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  centerHint: { fontSize: 13, color: '#B4B9C0', marginTop: 10 },
  centerError: { fontSize: 13, color: '#F53F3F', textAlign: 'center', lineHeight: 19 },
  retryBtn: {
    marginTop: 14,
    backgroundColor: '#E6F7F0',
    borderRadius: 12,
    paddingHorizontal: 22,
    paddingVertical: 9,
  },
  retryText: { fontSize: 13, color: '#00B578', fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingBottom: 20 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    shadowColor: '#0A2540',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  rowMain: { flex: 1, paddingHorizontal: 12 },
  rowName: { fontSize: 14, color: '#1F2329', fontWeight: '500' },
  rowSinger: { fontSize: 11, color: '#8A9099', marginTop: 3 },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E6F7F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnIcon: { fontSize: 12, color: '#00B578', marginLeft: 1 },
  deleteBtn: {
    marginHorizontal: 16,
    marginBottom: 24,
    backgroundColor: '#FFF1F0',
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: 'center',
  },
  deleteText: { fontSize: 14, color: '#F53F3F', fontWeight: '600' },
});
