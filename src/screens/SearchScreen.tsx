/**
 * 搜索页：内置搜索源（酷我/腾讯/网易/咪咕）→ 点击播放（走当前音源脚本取链）
 * 浅色清新风：卡片式结果列表
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { searchAll } from '../searchSources';
import { usePlayer } from '../player/PlayerContext';
import type { LxMusicApi } from '../lx-api/index.js';
import type { Song } from '../types';

function SongCard({ song, onPlay }: { song: Song; onPlay: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPlay}>
      {song.pic ? (
        <Image source={{ uri: song.pic }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbEmpty]}>
          <Text style={styles.thumbNote}>♪</Text>
        </View>
      )}
      <View style={styles.cardMain}>
        <Text style={styles.cardTitle} numberOfLines={1}>
          {song.name}
        </Text>
        <Text style={styles.cardSubtitle} numberOfLines={1}>
          {song.singer}
          {song.album ? ` · ${song.album}` : ''}
        </Text>
      </View>
      <View style={styles.playBtn}>
        <Text style={styles.playBtnIcon}>▶</Text>
      </View>
    </Pressable>
  );
}

export default function SearchScreen({ getApi }: { getApi: () => LxMusicApi | null }) {
  const [keyword, setKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [groups, setGroups] = useState<{ source: string; label: string; songs: Song[] }[]>([]);
  const { play } = usePlayer();

  const doSearch = async () => {
    const kw = keyword.trim();
    if (!kw || searching) return;
    setSearching(true);
    setSearched(true);
    try {
      const results = await searchAll(kw);
      setGroups(results);
    } finally {
      setSearching(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>搜索</Text>
        <View style={styles.searchBar}>
          <TextInput
            style={styles.input}
            value={keyword}
            onChangeText={setKeyword}
            placeholder="搜索歌曲、歌手"
            placeholderTextColor="#B4B9C0"
            returnKeyType="search"
            onSubmitEditing={doSearch}
            autoCorrect={false}
            autoCapitalize="none"
          />
          <Pressable
            style={[styles.searchBtn, searching && styles.searchBtnDisabled]}
            onPress={doSearch}
            disabled={searching}
          >
            {searching ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.searchBtnText}>搜索</Text>
            )}
          </Pressable>
        </View>
      </View>

      <FlatList
        data={groups}
        keyExtractor={g => g.source}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        renderItem={({ item: group }) => (
          <View style={styles.group}>
            <View style={styles.groupHeader}>
              <View style={styles.groupDot} />
              <Text style={styles.groupLabel}>{group.label}</Text>
              <Text style={styles.groupCount}>{group.songs.length} 首</Text>
            </View>
            {group.songs.length === 0 ? (
              <Text style={styles.groupEmpty}>该源暂无结果</Text>
            ) : (
              group.songs.map(song => (
                <SongCard
                  key={`${group.source}-${song.id}`}
                  song={song}
                  onPlay={() => play(song, getApi(), group.songs)}
                />
              ))
            )}
          </View>
        )}
        ListEmptyComponent={
          searching ? (
            <View style={styles.emptyWrap}>
              <ActivityIndicator color="#00B578" />
              <Text style={styles.emptyHint}>正在搜索「{keyword.trim()}」…</Text>
            </View>
          ) : (
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyNote}>♪</Text>
              <Text style={styles.emptyTitle}>{searched ? '没有找到结果' : '搜你想听的歌'}</Text>
              <Text style={styles.emptyHint}>
                {searched ? '换个关键词试试' : '播放需先在「音源」页加载音源脚本'}
              </Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 4 },
  title: { fontSize: 30, fontWeight: '700', color: '#1F2329', marginBottom: 14 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 5,
    shadowColor: '#0A2540',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  input: { flex: 1, fontSize: 15, color: '#1F2329', paddingVertical: 8 },
  searchBtn: {
    backgroundColor: '#00B578',
    borderRadius: 11,
    paddingHorizontal: 18,
    paddingVertical: 9,
    justifyContent: 'center',
  },
  searchBtnDisabled: { opacity: 0.6 },
  searchBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  group: { marginTop: 18 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 6 },
  groupDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#00B578' },
  groupLabel: { fontSize: 14, color: '#1F2329', fontWeight: '600' },
  groupCount: { fontSize: 12, color: '#B4B9C0' },
  groupEmpty: { fontSize: 13, color: '#8A9099', paddingVertical: 12, paddingLeft: 12 },
  card: {
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
  thumb: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#F0F2F5' },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F7F0' },
  thumbNote: { fontSize: 20, color: '#00B578' },
  cardMain: { flex: 1, paddingHorizontal: 12 },
  cardTitle: { fontSize: 15, color: '#1F2329', fontWeight: '500' },
  cardSubtitle: { fontSize: 12, color: '#8A9099', marginTop: 3 },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E6F7F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtnIcon: { fontSize: 13, color: '#00B578', marginLeft: 1 },
  emptyWrap: { alignItems: 'center', paddingTop: 90 },
  emptyNote: { fontSize: 52, color: '#DDE3E9' },
  emptyTitle: { fontSize: 17, color: '#5B6066', fontWeight: '600', marginTop: 10 },
  emptyHint: { fontSize: 13, color: '#B4B9C0', marginTop: 6 },
});
