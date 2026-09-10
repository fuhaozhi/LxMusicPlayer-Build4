/**
 * 主页 —— 每日推荐歌单（合集/榜单），浅色清新风。
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HOME_COLLECTIONS } from '../discover';
import type { Collection } from '../types';

function Cover({ collection, size }: { collection: Collection; size: number }) {
  return (
    <View
      style={[
        styles.cover,
        { width: size, height: size, backgroundColor: `hsl(${collection.hue}, 70%, 90%)` },
      ]}
    >
      <Text style={[styles.coverNote, { color: `hsl(${collection.hue}, 55%, 40%)` }]}>♪</Text>
      <Text style={[styles.coverTag, { color: `hsl(${collection.hue}, 55%, 40%)` }]} numberOfLines={1}>
        {collection.name}
      </Text>
    </View>
  );
}

export default function HomeScreen({
  onSearch,
  onOpenCollection,
}: {
  onSearch: () => void;
  onOpenCollection: (c: Collection) => void;
}) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.top}>
        <Text style={styles.greeting}>洛雪音乐</Text>
        <Text style={styles.subGreeting}>每天更新 · 好歌不重样</Text>
      </View>

      <Pressable style={styles.searchBar} onPress={onSearch}>
        <Text style={styles.searchIcon}>⌕</Text>
        <Text style={styles.searchPlaceholder}>搜索歌曲、歌手</Text>
        <View style={styles.searchPill}>
          <Text style={styles.searchPillText}>搜索</Text>
        </View>
      </Pressable>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>每日推荐</Text>
        <Text style={styles.sectionMore}>为你精选</Text>
      </View>

      <View style={styles.grid}>
        {HOME_COLLECTIONS.map(c => (
          <Pressable key={c.id} style={styles.card} onPress={() => onOpenCollection(c)}>
            <Cover collection={c} size={160} />
            <Text style={styles.cardTitle} numberOfLines={1}>
              {c.name}
            </Text>
            <Text style={styles.cardDesc} numberOfLines={1}>
              {c.desc}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.tipBox}>
        <Text style={styles.tipText}>
          提示：播放歌曲前，请到「我的 → 设置 → 音源管理」加载一个音源脚本
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 },
  top: { marginBottom: 14 },
  greeting: { fontSize: 28, fontWeight: '800', color: '#1F2329' },
  subGreeting: { fontSize: 13, color: '#8A9099', marginTop: 4 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
    shadowColor: '#0A2540',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  searchIcon: { fontSize: 20, color: '#B4B9C0', marginRight: 8 },
  searchPlaceholder: { flex: 1, fontSize: 15, color: '#B4B9C0' },
  searchPill: { backgroundColor: '#E6F7F0', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  searchPillText: { fontSize: 13, color: '#00B578', fontWeight: '600' },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: '#1F2329' },
  sectionMore: { fontSize: 12, color: '#B4B9C0' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48.5%', marginBottom: 16 },
  cover: {
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#0A2540',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  coverNote: { fontSize: 52, opacity: 0.45 },
  coverTag: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    right: 8,
    fontSize: 12,
    fontWeight: '700',
    opacity: 0.9,
  },
  cardTitle: { fontSize: 14, color: '#1F2329', fontWeight: '600', marginTop: 8 },
  cardDesc: { fontSize: 11, color: '#B4B9C0', marginTop: 3 },
  tipBox: {
    marginTop: 8,
    backgroundColor: '#FFF4E6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  tipText: { fontSize: 12, color: '#B76E00', lineHeight: 17 },
});
