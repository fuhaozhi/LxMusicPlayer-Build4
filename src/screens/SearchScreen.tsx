/**
 * 搜索页：内置搜索源（酷我/腾讯/网易/咪咕）→ 点击播放（走当前音源脚本取链）
 * 浅色清新风：卡片式结果列表，支持加入自建歌单
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { searchAll } from '../searchSources';
import { usePlayer } from '../player/PlayerContext';
import { useLibrary } from '../library';
import type { LxMusicApi } from '../lx-api/index.js';
import type { Song } from '../types';

function SongCard({
  song,
  onPlay,
  onAdd,
}: {
  song: Song;
  onPlay: () => void;
  onAdd: () => void;
}) {
  return (
    <View style={styles.card}>
      <Pressable style={styles.cardMainPress} onPress={onPlay}>
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
      </Pressable>
      <Pressable style={styles.addBtn} onPress={onAdd} hitSlop={6}>
        <Text style={styles.addBtnText}>＋</Text>
      </Pressable>
      <Pressable style={styles.playBtn} onPress={onPlay} hitSlop={6}>
        <Text style={styles.playBtnIcon}>▶</Text>
      </Pressable>
    </View>
  );
}

export default function SearchScreen({
  getApi,
  onBack,
}: {
  getApi: () => LxMusicApi | null;
  onBack: () => void;
}) {
  const [keyword, setKeyword] = useState('');
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [groups, setGroups] = useState<{ source: string; label: string; songs: Song[] }[]>([]);
  const [addTarget, setAddTarget] = useState<Song | null>(null);
  const [newName, setNewName] = useState('');
  const { play } = usePlayer();
  const { playlists, createPlaylist, addSongToPlaylist } = useLibrary();

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

  const confirmAdd = (playlistId: string) => {
    if (addTarget) addSongToPlaylist(playlistId, addTarget);
    setAddTarget(null);
  };

  const confirmCreate = () => {
    const pl = createPlaylist(newName);
    if (pl && addTarget) {
      addSongToPlaylist(pl.id, addTarget);
    }
    setNewName('');
    setAddTarget(null);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>搜索</Text>
      </View>
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
                  onAdd={() => setAddTarget(song)}
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
                {searched ? '换个关键词试试' : '点右侧 ＋ 可加入自建歌单'}
              </Text>
            </View>
          )
        }
      />

      {/* 加入歌单弹窗 */}
      <Modal visible={!!addTarget} transparent animationType="fade" onRequestClose={() => setAddTarget(null)}>
        <Pressable style={styles.mask} onPress={() => setAddTarget(null)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>加入歌单</Text>
            {addTarget ? <Text style={styles.sheetSong} numberOfLines={1}>{addTarget.name}</Text> : null}
            {playlists.length === 0 ? (
              <Text style={styles.sheetEmpty}>还没有歌单，先创建一个吧</Text>
            ) : (
              playlists.map(pl => (
                <Pressable key={pl.id} style={styles.sheetRow} onPress={() => confirmAdd(pl.id)}>
                  <View style={styles.sheetRowIcon}>
                    <Text style={styles.sheetRowIconText}>♪</Text>
                  </View>
                  <View style={styles.sheetRowMain}>
                    <Text style={styles.sheetRowName} numberOfLines={1}>{pl.name}</Text>
                    <Text style={styles.sheetRowCount}>{pl.songs.length} 首</Text>
                  </View>
                  <Text style={styles.sheetRowGo}>加入</Text>
                </Pressable>
              ))
            )}
            <View style={styles.newRow}>
              <TextInput
                style={styles.newInput}
                value={newName}
                onChangeText={setNewName}
                placeholder="新建歌单名称"
                placeholderTextColor="#B4B9C0"
              />
              <Pressable style={styles.newBtn} onPress={confirmCreate}>
                <Text style={styles.newBtnText}>新建并加入</Text>
              </Pressable>
            </View>
            <Pressable style={styles.sheetCancel} onPress={() => setAddTarget(null)}>
              <Text style={styles.sheetCancelText}>取消</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  backText: { fontSize: 34, color: '#1F2329', lineHeight: 34, marginTop: -4 },
  title: { fontSize: 24, fontWeight: '700', color: '#1F2329' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
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
  group: { marginTop: 16 },
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
  cardMainPress: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  thumb: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#F0F2F5' },
  thumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F7F0' },
  thumbNote: { fontSize: 20, color: '#00B578' },
  cardMain: { flex: 1, paddingHorizontal: 12 },
  cardTitle: { fontSize: 15, color: '#1F2329', fontWeight: '500' },
  cardSubtitle: { fontSize: 12, color: '#8A9099', marginTop: 3 },
  addBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#F0F2F5', alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  addBtnText: { fontSize: 15, color: '#8A9099', lineHeight: 18 },
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
  mask: { flex: 1, backgroundColor: 'rgba(20,24,28,0.4)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 30,
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#1F2329', textAlign: 'center' },
  sheetSong: { fontSize: 12, color: '#8A9099', textAlign: 'center', marginTop: 4 },
  sheetEmpty: { fontSize: 13, color: '#B4B9C0', textAlign: 'center', paddingVertical: 20 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#F0F2F5',
  },
  sheetRowIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#E6F7F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRowIconText: { fontSize: 16, color: '#00B578' },
  sheetRowMain: { flex: 1, paddingHorizontal: 10 },
  sheetRowName: { fontSize: 14, color: '#1F2329', fontWeight: '500' },
  sheetRowCount: { fontSize: 11, color: '#B4B9C0', marginTop: 2 },
  sheetRowGo: { fontSize: 13, color: '#00B578', fontWeight: '600' },
  newRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 },
  newInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#EDEFF2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: '#1F2329',
    backgroundColor: '#F7F8FA',
  },
  newBtn: { backgroundColor: '#00B578', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
  newBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  sheetCancel: { alignItems: 'center', marginTop: 14 },
  sheetCancelText: { color: '#8A9099', fontSize: 14 },
});
