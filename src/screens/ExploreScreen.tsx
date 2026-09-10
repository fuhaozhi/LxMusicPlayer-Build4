/**
 * 音乐馆 —— 热门音乐合集，浅色清新风。
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { EXPLORE_COLLECTIONS } from '../discover';
import type { Collection } from '../types';

export default function ExploreScreen({
  onOpenCollection,
}: {
  onOpenCollection: (c: Collection) => void;
}) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.top}>
        <Text style={styles.title}>音乐馆</Text>
        <Text style={styles.subtitle}>热门合集，一次听个够</Text>
      </View>

      <View style={styles.grid}>
        {EXPLORE_COLLECTIONS.map(c => (
          <Pressable key={c.id} style={styles.card} onPress={() => onOpenCollection(c)}>
            <View
              style={[
                styles.cover,
                { backgroundColor: `hsl(${c.hue}, 70%, 90%)` },
              ]}
            >
              <Text style={[styles.coverNote, { color: `hsl(${c.hue}, 55%, 40%)` }]}>♪</Text>
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 },
  top: { marginBottom: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#1F2329' },
  subtitle: { fontSize: 13, color: '#8A9099', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  card: { width: '48.5%', marginBottom: 16 },
  cover: {
    height: 160,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A2540',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  coverNote: { fontSize: 56, opacity: 0.45 },
  cardTitle: { fontSize: 14, color: '#1F2329', fontWeight: '600', marginTop: 8 },
  cardDesc: { fontSize: 11, color: '#B4B9C0', marginTop: 3 },
});
