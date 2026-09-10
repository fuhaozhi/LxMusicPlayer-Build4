/** 搜索页：内置搜索源（酷我/腾讯/网易/咪咕）→ 点击播放（走当前音源脚本取链） */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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

export default function SearchScreen({ getApi }: { getApi: () => LxMusicApi | null }) {
  const [keyword, setKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [groups, setGroups] = useState<{ source: string; label: string; songs: Song[] }[]>([]);
  const { play } = usePlayer();

  const doSearch = async () => {
    const kw = keyword.trim();
    if (!kw || searching) return;
    setSearching(true);
    try {
      const results = await searchAll(kw);
      setGroups(results);
    } finally {
      setSearching(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.input}
          value={keyword}
          onChangeText={setKeyword}
          placeholder="输入歌曲名 / 歌手搜索"
          placeholderTextColor="#8e8e93"
          returnKeyType="search"
          onSubmitEditing={doSearch}
          autoCorrect={false}
          autoCapitalize="none"
        />
        <Pressable style={[styles.button, searching && styles.buttonDisabled]} onPress={doSearch} disabled={searching}>
          {searching ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>搜索</Text>}
        </Pressable>
      </View>

      <FlatList
        data={groups}
        keyExtractor={g => g.source}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item: group }) => (
          <View>
            <View style={styles.groupHeader}>
              <Text style={styles.groupLabel}>来源：{group.label}（{group.songs.length}）</Text>
            </View>
            {group.songs.length === 0 ? (
              <Text style={styles.empty}>该源无结果</Text>
            ) : (
              group.songs.map(song => (
                <Pressable key={`${group.source}-${song.id}`} style={styles.row} onPress={() => play(song, getApi(), group.songs)}>
                  <View style={styles.rowMain}>
                    <Text style={styles.title} numberOfLines={1}>{song.name}</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>
                      {song.singer}
                      {song.album ? ` · ${song.album}` : ''}
                    </Text>
                  </View>
                  <View style={styles.tag}>
                    <Text style={styles.tagText}>{group.label}</Text>
                  </View>
                </Pressable>
              ))
            )}
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.hint}>
            {searching ? '' : '输入关键词搜索，结果按来源分组展示。播放需先在「音源」页加载音源脚本。'}
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  searchBar: { flexDirection: 'row', padding: 12, gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d1d6',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#000',
  },
  button: { backgroundColor: '#007aff', borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  groupHeader: { backgroundColor: '#f2f2f7', paddingHorizontal: 12, paddingVertical: 6 },
  groupLabel: { fontSize: 12, color: '#6e6e73', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea' },
  rowMain: { flex: 1, paddingRight: 8 },
  title: { fontSize: 16, color: '#000' },
  subtitle: { fontSize: 13, color: '#8e8e93', marginTop: 2 },
  tag: { backgroundColor: '#e8f0fe', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  tagText: { fontSize: 11, color: '#007aff' },
  empty: { padding: 12, color: '#8e8e93', fontSize: 13 },
  hint: { padding: 16, color: '#8e8e93', fontSize: 13, textAlign: 'center' },
});
