/**
 * 我的 —— 最近播放、自建歌单、收藏歌单、听歌报告、设置入口，浅色清新风。
 */
import React, { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { usePlayer } from '../player/PlayerContext';
import { useLibrary } from '../library';
import type { LxMusicApi } from '../lx-api/index.js';
import type { Collection, LocalPlaylist, Song } from '../types';

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} 小时 ${m} 分`;
  return `${m} 分钟`;
}

function RecentsRow({ song, onPlay }: { song: Song; onPlay: () => void }) {
  return (
    <Pressable style={styles.recentRow} onPress={onPlay}>
      {song.pic ? (
        <Image source={{ uri: song.pic }} style={styles.recentThumb} />
      ) : (
        <View style={[styles.recentThumb, styles.recentThumbEmpty]}>
          <Text style={styles.recentThumbNote}>♪</Text>
        </View>
      )}
      <View style={styles.recentMain}>
        <Text style={styles.recentName} numberOfLines={1}>
          {song.name}
        </Text>
        <Text style={styles.recentSinger} numberOfLines={1}>
          {song.singer}
        </Text>
      </View>
      <View style={styles.recentPlay}>
        <Text style={styles.recentPlayIcon}>▶</Text>
      </View>
    </Pressable>
  );
}

export default function MineScreen({
  getApi,
  onOpenSettings,
  onOpenCollection,
  onOpenLocalPlaylist,
  onOpenReport,
}: {
  getApi: () => LxMusicApi | null;
  onOpenSettings: () => void;
  onOpenCollection: (c: Collection) => void;
  onOpenLocalPlaylist: (pl: LocalPlaylist) => void;
  onOpenReport: () => void;
}) {
  const { recents, playlists, favs, stats, createPlaylist } = useLibrary();
  const { play } = usePlayer();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const topSong = [...stats.songs].sort((a, b) => b.count - a.count)[0];

  const confirmCreate = () => {
    createPlaylist(newName);
    setNewName('');
    setCreating(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.top}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>♪</Text>
        </View>
        <View style={styles.topMain}>
          <Text style={styles.title}>我的音乐</Text>
          <Text style={styles.subtitle}>本地播放 · 数据保存在本机</Text>
        </View>
      </View>

      {/* 听歌报告入口 */}
      <Pressable style={styles.reportCard} onPress={onOpenReport}>
        <View style={styles.reportItem}>
          <Text style={styles.reportNum}>{stats.totalPlays}</Text>
          <Text style={styles.reportLabel}>播放次数</Text>
        </View>
        <View style={styles.reportDivider} />
        <View style={styles.reportItem}>
          <Text style={styles.reportNum}>{fmtDuration(stats.totalSeconds).split(' ')[0]}</Text>
          <Text style={styles.reportLabel}>累计时长</Text>
        </View>
        <View style={styles.reportDivider} />
        <View style={styles.reportItem}>
          <Text style={styles.reportNum} numberOfLines={1}>
            {topSong ? topSong.name.slice(0, 4) : '—'}
          </Text>
          <Text style={styles.reportLabel}>最爱单曲</Text>
        </View>
        <Text style={styles.reportGo}>›</Text>
      </Pressable>

      {/* 最近播放 */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>最近播放</Text>
      </View>
      {recents.length === 0 ? (
        <Text style={styles.sectionEmpty}>还没有播放记录，去搜索或音乐馆听听看</Text>
      ) : (
        recents.slice(0, 6).map(song => (
          <RecentsRow
            key={`${song.source}:${song.id}`}
            song={song}
            onPlay={() => play(song, getApi(), recents.slice(0, 20))}
          />
        ))
      )}

      {/* 我的歌单 */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>自建歌单</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hscroll}>
        <Pressable style={[styles.hCard, styles.createCard]} onPress={() => setCreating(true)}>
          <Text style={styles.createPlus}>＋</Text>
          <Text style={styles.createText}>新建歌单</Text>
        </Pressable>
        {playlists.map(pl => (
          <Pressable key={pl.id} style={styles.hCard} onPress={() => onOpenLocalPlaylist(pl)}>
            <View style={styles.hCover}>
              <Text style={styles.hCoverNote}>♪</Text>
              <Text style={styles.hCount}>{pl.songs.length} 首</Text>
            </View>
            <Text style={styles.hName} numberOfLines={1}>
              {pl.name}
            </Text>
          </Pressable>
        ))}
        {playlists.length === 0 ? <Text style={styles.hint}>点「新建歌单」，在搜索页点 ＋ 加歌</Text> : null}
      </ScrollView>

      {/* 收藏歌单 */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>收藏歌单</Text>
      </View>
      {favs.length === 0 ? (
        <Text style={styles.sectionEmpty}>在音乐馆 / 每日推荐的合集页点「收藏」即可保存</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hscroll}>
          {favs.map(f => (
            <Pressable
              key={f.id}
              style={styles.hCard}
              onPress={() =>
                onOpenCollection({ id: f.id, name: f.name, desc: f.desc, source: f.source, apiId: f.apiId, hue: f.hue })
              }
            >
              <View style={[styles.hCover, { backgroundColor: `hsl(${f.hue}, 70%, 90%)` }]}>
                <Text style={[styles.hCoverNote, { color: `hsl(${f.hue}, 55%, 40%)` }]}>♪</Text>
              </View>
              <Text style={styles.hName} numberOfLines={1}>
                {f.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      {/* 设置入口 */}
      <Pressable style={styles.settingsRow} onPress={onOpenSettings}>
        <View style={styles.settingsIcon}>
          <Text style={styles.settingsIconText}>⚙</Text>
        </View>
        <Text style={styles.settingsText}>设置 · 音源管理</Text>
        <Text style={styles.settingsGo}>›</Text>
      </Pressable>

      {/* 新建歌单弹窗 */}
      <Modal visible={creating} transparent animationType="fade" onRequestClose={() => setCreating(false)}>
        <Pressable style={styles.mask} onPress={() => setCreating(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>新建歌单</Text>
            <TextInput
              style={styles.sheetInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="歌单名称"
              placeholderTextColor="#B4B9C0"
              autoFocus
            />
            <Pressable style={styles.sheetBtn} onPress={confirmCreate}>
              <Text style={styles.sheetBtnText}>创建</Text>
            </Pressable>
            <Pressable style={styles.sheetCancel} onPress={() => setCreating(false)}>
              <Text style={styles.sheetCancelText}>取消</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#E6F7F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 24, color: '#00B578' },
  topMain: { paddingLeft: 12 },
  title: { fontSize: 22, fontWeight: '800', color: '#1F2329' },
  subtitle: { fontSize: 12, color: '#8A9099', marginTop: 3 },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    shadowColor: '#0A2540',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  reportItem: { flex: 1, alignItems: 'center', minWidth: 0 },
  reportNum: { fontSize: 17, fontWeight: '700', color: '#1F2329', maxWidth: '100%' },
  reportLabel: { fontSize: 11, color: '#B4B9C0', marginTop: 3 },
  reportDivider: { width: StyleSheet.hairlineWidth, height: 26, backgroundColor: '#EDEFF2' },
  reportGo: { fontSize: 22, color: '#C0C6CC', paddingLeft: 8 },
  sectionHeader: { marginTop: 22, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1F2329' },
  sectionEmpty: { fontSize: 13, color: '#B4B9C0', paddingVertical: 6 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    shadowColor: '#0A2540',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  recentThumb: { width: 42, height: 42, borderRadius: 9, backgroundColor: '#F0F2F5' },
  recentThumbEmpty: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#E6F7F0' },
  recentThumbNote: { fontSize: 18, color: '#00B578' },
  recentMain: { flex: 1, paddingHorizontal: 12 },
  recentName: { fontSize: 14, color: '#1F2329', fontWeight: '500' },
  recentSinger: { fontSize: 11, color: '#8A9099', marginTop: 3 },
  recentPlay: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E6F7F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentPlayIcon: { fontSize: 12, color: '#00B578', marginLeft: 1 },
  hscroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  hCard: { width: 108, marginRight: 12, alignItems: 'flex-start' },
  createCard: {
    width: 108,
    height: 108,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#C9D4CC',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBFCFC',
  },
  createPlus: { fontSize: 26, color: '#00B578', lineHeight: 30 },
  createText: { fontSize: 12, color: '#8A9099', marginTop: 4 },
  hCover: {
    width: 108,
    height: 108,
    borderRadius: 16,
    backgroundColor: '#E6F7F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A2540',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  hCoverNote: { fontSize: 34, color: '#00B578', opacity: 0.5 },
  hCount: { position: 'absolute', left: 8, bottom: 8, fontSize: 11, color: '#5B6066' },
  hName: { fontSize: 12, color: '#1F2329', fontWeight: '500', marginTop: 7, maxWidth: 108 },
  hint: { fontSize: 12, color: '#B4B9C0', alignSelf: 'center', paddingVertical: 20 },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 24,
    shadowColor: '#0A2540',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  settingsIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#F0F2F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIconText: { fontSize: 17, color: '#5B6066' },
  settingsText: { flex: 1, fontSize: 15, color: '#1F2329', fontWeight: '500', paddingLeft: 12 },
  settingsGo: { fontSize: 22, color: '#C0C6CC' },
  mask: { flex: 1, backgroundColor: 'rgba(20,24,28,0.4)', justifyContent: 'center', paddingHorizontal: 40 },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'stretch',
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#1F2329', textAlign: 'center', marginBottom: 14 },
  sheetInput: {
    borderWidth: 1,
    borderColor: '#EDEFF2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2329',
    backgroundColor: '#F7F8FA',
  },
  sheetBtn: {
    backgroundColor: '#00B578',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  sheetBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sheetCancel: { alignItems: 'center', marginTop: 12 },
  sheetCancelText: { color: '#8A9099', fontSize: 13 },
});
