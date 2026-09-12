/**
 * 主页 —— 网易云 App 首页风格：
 * 红色渐变头部 + 搜索框 + 每日推荐/心动模式/漫游 三入口卡
 * +「根据你喜爱的歌曲推荐」横滑卡 +「猜你喜欢的华语好歌」列表
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchCollectionSongs, HOME_COLLECTIONS } from '../discover';
import { useLibrary } from '../library';
import { usePlayer } from '../player/PlayerContext';
import SongArt from '../components/SongArt';
import type { LxMusicApi } from '../lx-api/index.js';
import type { Collection, Song } from '../types';

const RED = '#EC4141';
const RED_DEEP = '#C62F2F';

export default function HomeScreen({
  getApi,
  onSearch,
  onOpenCollection,
}: {
  getApi: () => LxMusicApi | null;
  onSearch: () => void;
  onOpenCollection: (c: Collection) => void;
}) {
  const { recents } = useLibrary();
  const { play } = usePlayer();
  const [goodSongs, setGoodSongs] = useState<Song[]>([]);
  const [goodLoading, setGoodLoading] = useState(false);

  const daily = HOME_COLLECTIONS[0]; // 每日推荐·飙升榜
  const heart = HOME_COLLECTIONS[1]; // 热歌榜
  const roam = HOME_COLLECTIONS[2]; // 新歌榜

  // 华语好歌：异步拉第一个推荐合集前 8 首
  useEffect(() => {
    let cancelled = false;
    setGoodLoading(true);
    fetchCollectionSongs(daily)
      .then(list => {
        if (!cancelled) setGoodSongs(list.slice(0, 8));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setGoodLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loveSongs = recents.slice(0, 6);

  return (
    <View style={styles.container}>
      {/* 红色渐变头部 */}
      <View style={styles.header}>
        <View style={styles.headerDecoA} />
        <View style={styles.headerDecoB} />
        <Text style={styles.greeting}>洛雪音乐</Text>
        <Text style={styles.subGreeting}>每天更新 · 好歌不重样</Text>
        <Pressable style={styles.searchBar} onPress={onSearch}>
          <Text style={styles.searchIcon}>⌕</Text>
          <Text style={styles.searchPlaceholder}>搜索歌曲、歌手</Text>
          <View style={styles.searchPill}>
            <Text style={styles.searchPillText}>搜索</Text>
          </View>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 三入口卡 */}
        <View style={styles.entryRow}>
          <Pressable style={styles.entryCard} onPress={() => onOpenCollection(daily)}>
            <View style={[styles.entryIcon, { backgroundColor: '#FDECEC' }]}>
              <Text style={styles.entryIconText}>♪</Text>
            </View>
            <Text style={styles.entryTitle}>每日推荐</Text>
            <Text style={styles.entryDesc}>今日限定好歌</Text>
          </Pressable>
          <Pressable style={styles.entryCard} onPress={() => onOpenCollection(heart)}>
            <View style={[styles.entryIcon, { backgroundColor: '#FFF3E6' }]}>
              <Text style={[styles.entryIconText, { color: '#F5A623' }]}>♥</Text>
            </View>
            <Text style={styles.entryTitle}>心动模式</Text>
            <Text style={styles.entryDesc}>红心歌曲和相似推荐</Text>
          </Pressable>
          <Pressable style={styles.entryCard} onPress={() => onOpenCollection(roam)}>
            <View style={[styles.entryIcon, { backgroundColor: '#E8F1FF' }]}>
              <Text style={[styles.entryIconText, { color: '#3B7DD8' }]}>☁</Text>
            </View>
            <Text style={styles.entryTitle}>漫游</Text>
            <Text style={styles.entryDesc}>多样频道无限</Text>
          </Pressable>
        </View>

        {/* 根据你喜爱的歌曲推荐 */}
        {loveSongs.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>根据你喜爱的歌曲推荐</Text>
              <Text style={styles.sectionMore}>更多 ›</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hscroll} contentContainerStyle={styles.hscrollContent}>
              {loveSongs.map(song => (
                <Pressable key={`${song.source}:${song.id}`} style={styles.songCard} onPress={() => play(song, getApi(), loveSongs)}>
                  <SongArt song={song} size={104} radius={12} />
                  <Text style={styles.songCardName} numberOfLines={1}>
                    {song.name}
                  </Text>
                  <Text style={styles.songCardSinger} numberOfLines={1}>
                    {song.singer}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}

        {/* 猜你喜欢的华语好歌 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>猜你喜欢的「华语」好歌</Text>
          <Text style={styles.sectionMore}>更多 ›</Text>
        </View>
        {goodLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={RED} />
            <Text style={styles.loadingText}>正在为你推荐…</Text>
          </View>
        ) : (
          goodSongs.map((song, i) => (
            <Pressable key={`${song.source}:${song.id}`} style={styles.songRow} onPress={() => play(song, getApi(), goodSongs)}>
              <Text style={styles.songIndex}>{i + 1}</Text>
              <SongArt song={song} size={46} radius={8} />
              <View style={styles.songMain}>
                <Text style={styles.songName} numberOfLines={1}>
                  {song.name}
                </Text>
                <Text style={styles.songSinger} numberOfLines={1}>
                  {song.singer}
                </Text>
              </View>
              <View style={styles.rowPlay}>
                <Text style={styles.rowPlayIcon}>▶</Text>
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  header: {
    backgroundColor: RED_DEEP,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 18,
    overflow: 'hidden',
  },
  headerDecoA: {
    position: 'absolute',
    top: -60,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerDecoB: {
    position: 'absolute',
    bottom: -70,
    left: -40,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  greeting: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  subGreeting: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 20,
    paddingLeft: 14,
    paddingRight: 5,
    paddingVertical: 5,
    marginTop: 14,
  },
  searchIcon: { fontSize: 18, color: '#B4B9C0', marginRight: 8 },
  searchPlaceholder: { flex: 1, fontSize: 14, color: '#9AA0A8' },
  searchPill: { backgroundColor: RED, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 8 },
  searchPillText: { fontSize: 13, color: '#fff', fontWeight: '600' },
  content: { paddingHorizontal: 16, paddingBottom: 28 },
  entryRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  entryCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#0A2540',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  entryIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  entryIconText: { fontSize: 18, color: RED },
  entryTitle: { fontSize: 14, fontWeight: '700', color: '#1F2329', marginTop: 8 },
  entryDesc: { fontSize: 10, color: '#B4B9C0', marginTop: 3 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 22,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1F2329' },
  sectionMore: { fontSize: 12, color: '#8A9099' },
  hscroll: { marginHorizontal: -16 },
  hscrollContent: { paddingHorizontal: 16, gap: 12 },
  songCard: { width: 104, alignItems: 'flex-start' },
  songCardName: { fontSize: 12, color: '#1F2329', fontWeight: '600', marginTop: 7, maxWidth: 104 },
  songCardSinger: { fontSize: 10, color: '#8A9099', marginTop: 2, maxWidth: 104 },
  loadingBox: { alignItems: 'center', paddingVertical: 30 },
  loadingText: { fontSize: 12, color: '#B4B9C0', marginTop: 10 },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 9,
    marginBottom: 8,
    shadowColor: '#0A2540',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  songIndex: { width: 26, fontSize: 14, color: '#C0C6CC', textAlign: 'center', fontWeight: '600' },
  songMain: { flex: 1, paddingHorizontal: 10, minWidth: 0 },
  songName: { fontSize: 14, color: '#1F2329', fontWeight: '500' },
  songSinger: { fontSize: 11, color: '#8A9099', marginTop: 3 },
  rowPlay: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FDECEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowPlayIcon: { fontSize: 11, color: RED, marginLeft: 1 },
});
