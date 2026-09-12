/**
 * 音乐馆 —— 网易云风格：红色渐变头部 + 热门音乐合集 2 列宫格
 * 每个榜单卡片自动加载该榜单排名第一首歌的封面，加载失败回退彩色音符。
 */
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { EXPLORE_COLLECTIONS, fetchCollectionSongs } from '../discover';
import type { Collection } from '../types';

const RED_DEEP = '#C62F2F';

export default function ExploreScreen({
  onOpenCollection,
}: {
  onOpenCollection: (c: Collection) => void;
}) {
  const [covers, setCovers] = useState<Record<string, string>>({});
  const [coverState, setCoverState] = useState<Record<string, 'ok' | 'fail'>>({});

  useEffect(() => {
    let alive = true;
    (async () => {
      const result: Record<string, string> = {};
      const states: Record<string, 'ok' | 'fail'> = {};
      await Promise.allSettled(
        EXPLORE_COLLECTIONS.map(async c => {
          try {
            const songs = await fetchCollectionSongs(c);
            const pic = songs[0]?.pic;
            if (alive && pic) {
              result[c.id] = pic;
              states[c.id] = 'ok';
            } else if (alive) {
              states[c.id] = 'fail';
            }
          } catch {
            if (alive) states[c.id] = 'fail';
          }
        }),
      );
      if (alive) {
        setCovers(result);
        setCoverState(states);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <View style={styles.container}>
      {/* 红色渐变头部 */}
      <View style={styles.header}>
        <View style={styles.headerDeco} />
        <Text style={styles.title}>音乐馆</Text>
        <Text style={styles.subtitle}>热门合集 · 一次听个够</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {EXPLORE_COLLECTIONS.map(c => {
            const pic = covers[c.id];
            const loading = pic === undefined && coverState[c.id] === undefined;
            return (
              <Pressable key={c.id} style={styles.card} onPress={() => onOpenCollection(c)}>
                <View style={styles.coverWrap}>
                  {pic ? (
                    <Image source={{ uri: pic }} style={styles.coverImg} resizeMode="cover" />
                  ) : (
                    <View
                      style={[
                        styles.coverImg,
                        { backgroundColor: `hsl(${c.hue}, 70%, 92%)` },
                      ]}
                    >
                      {loading ? (
                        <ActivityIndicator color={`hsl(${c.hue}, 55%, 40%)`} size="small" />
                      ) : (
                        <Text style={[styles.coverNote, { color: `hsl(${c.hue}, 55%, 40%)` }]}>♪</Text>
                      )}
                    </View>
                  )}
                  <View style={styles.coverMask}>
                    <Text style={styles.coverTag} numberOfLines={1}>{c.name}</Text>
                  </View>
                </View>
                <Text style={styles.cardTitle} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={styles.cardDesc} numberOfLines={1}>
                  {c.desc}
                </Text>
              </Pressable>
            );
          })}
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
  headerDeco: {
    position: 'absolute',
    top: -70,
    right: -20,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  title: { fontSize: 26, fontWeight: '800', color: '#FFFFFF' },
  subtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  content: { paddingHorizontal: 16, paddingTop: 18, paddingBottom: 28 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48.5%', marginBottom: 16 },
  coverWrap: {
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#0A2540',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  coverImg: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverNote: { fontSize: 56, opacity: 0.45 },
  coverMask: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: 'rgba(0,0,0,0.16)',
  },
  coverTag: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  cardTitle: { fontSize: 14, color: '#1F2329', fontWeight: '600', marginTop: 8 },
  cardDesc: { fontSize: 11, color: '#B4B9C0', marginTop: 3 },
});
