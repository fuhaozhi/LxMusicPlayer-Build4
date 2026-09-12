/**
 * 主页 —— 网易云手机端风格：红色渐变头部 + 搜索框 + 每日推荐横滑大卡 + 推荐歌单宫格
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { HOME_COLLECTIONS } from '../discover';
import type { Collection } from '../types';

const RED = '#EC4141';
const RED_DEEP = '#C62F2F';

function Cover({ collection, size }: { collection: Collection; size: number }) {
  return (
    <View
      style={[
        styles.cover,
        { width: size, height: size, backgroundColor: `hsl(${collection.hue}, 70%, 92%)` },
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
  const [daily, ...grid] = HOME_COLLECTIONS;

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
        {/* 每日推荐：横滑大卡 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>每日推荐</Text>
          <Text style={styles.sectionMore}>为你精选 ›</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hscroll} contentContainerStyle={styles.hscrollContent}>
          <Pressable
            style={[styles.bigCard, { backgroundColor: `hsl(${daily.hue}, 55%, 82%)` }]}
            onPress={() => onOpenCollection(daily)}
          >
            <Text style={styles.bigNote}>♪</Text>
            <View style={styles.bigMain}>
              <Text style={styles.bigTitle} numberOfLines={1}>{daily.name}</Text>
              <Text style={styles.bigDesc} numberOfLines={2}>{daily.desc}</Text>
            </View>
            <Text style={styles.bigGo}>›</Text>
          </Pressable>
          {grid.slice(0, 2).map(c => (
            <Pressable
              key={c.id}
              style={[styles.bigCard, { backgroundColor: `hsl(${c.hue}, 55%, 82%)` }]}
              onPress={() => onOpenCollection(c)}
            >
              <Text style={styles.bigNote}>♪</Text>
              <View style={styles.bigMain}>
                <Text style={styles.bigTitle} numberOfLines={1}>{c.name}</Text>
                <Text style={styles.bigDesc} numberOfLines={2}>{c.desc}</Text>
              </View>
              <Text style={styles.bigGo}>›</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* 推荐歌单宫格 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>推荐歌单</Text>
          <Text style={styles.sectionMore}>更多 ›</Text>
        </View>
        <View style={styles.grid}>
          {grid.slice(2).map(c => (
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
            提示：歌曲播放失败会自动切换酷我官方音源，保证能听
          </Text>
        </View>
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
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 19, fontWeight: '800', color: '#1F2329' },
  sectionMore: { fontSize: 12, color: '#8A9099' },
  hscroll: { marginHorizontal: -16 },
  hscrollContent: { paddingHorizontal: 16, gap: 12 },
  bigCard: {
    width: 230,
    height: 118,
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#0A2540',
    shadowOpacity: 0.07,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  bigNote: { fontSize: 44, opacity: 0.35, marginRight: 4 },
  bigMain: { flex: 1, minWidth: 0 },
  bigTitle: { fontSize: 16, fontWeight: '800', color: '#1F2329' },
  bigDesc: { fontSize: 11, color: '#5B6066', marginTop: 5, lineHeight: 15 },
  bigGo: { fontSize: 24, color: 'rgba(0,0,0,0.25)', paddingLeft: 4 },
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
    marginTop: 6,
    backgroundColor: '#FDECEC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  tipText: { fontSize: 12, color: '#C62F2F', lineHeight: 17 },
});
