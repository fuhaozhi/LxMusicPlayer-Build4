/**
 * 音乐馆 —— 网易云风格：红色渐变头部 + 热门音乐合集 2 列宫格
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EXPLORE_COLLECTIONS } from '../discover';
import type { Collection } from '../types';

const RED_DEEP = '#C62F2F';

export default function ExploreScreen({
  onOpenCollection,
}: {
  onOpenCollection: (c: Collection) => void;
}) {
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
          {EXPLORE_COLLECTIONS.map(c => (
            <Pressable key={c.id} style={styles.card} onPress={() => onOpenCollection(c)}>
              <View
                style={[
                  styles.cover,
                  { backgroundColor: `hsl(${c.hue}, 70%, 92%)` },
                ]}
              >
                <Text style={[styles.coverNote, { color: `hsl(${c.hue}, 55%, 40%)` }]}>♪</Text>
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
          ))}
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
  cover: {
    height: 160,
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
