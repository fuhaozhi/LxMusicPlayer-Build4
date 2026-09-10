/**
 * 听歌报告 —— 本机播放统计：次数、时长、最爱单曲。
 */
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLibrary } from '../library';

export default function ReportScreen({ onBack }: { onBack: () => void }) {
  const { stats } = useLibrary();
  const h = Math.floor(stats.totalSeconds / 3600);
  const m = Math.floor((stats.totalSeconds % 3600) / 60);
  const top = [...stats.songs].sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>听歌报告</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroNote}>♪</Text>
          <Text style={styles.heroTitle}>你的音乐足迹</Text>
          <Text style={styles.heroSub}>数据保存在本机，只属于你</Text>
        </View>

        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>{stats.totalPlays}</Text>
            <Text style={styles.statLabel}>累计播放次数</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNum}>
              {h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ''}` : `${m}m`}
            </Text>
            <Text style={styles.statLabel}>累计收听时长</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>最爱单曲 TOP5</Text>
        {top.length === 0 ? (
          <Text style={styles.empty}>还没有播放记录，去听几首歌再来看看</Text>
        ) : (
          top.map((s, i) => (
            <View key={s.key} style={styles.songRow}>
              <Text style={[styles.rank, i < 3 && styles.rankTop]}>{i + 1}</Text>
              <View style={styles.songMain}>
                <Text style={styles.songName} numberOfLines={1}>
                  {s.name}
                </Text>
                <Text style={styles.songSinger} numberOfLines={1}>
                  {s.singer}
                </Text>
              </View>
              <Text style={styles.songCount}>{s.count} 次</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F6F8' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  backText: { fontSize: 34, color: '#1F2329', lineHeight: 34, marginTop: -4 },
  headerTitle: { fontSize: 24, fontWeight: '700', color: '#1F2329' },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  hero: { alignItems: 'center', paddingVertical: 26 },
  heroNote: { fontSize: 44, color: '#DDE3E9' },
  heroTitle: { fontSize: 20, fontWeight: '800', color: '#1F2329', marginTop: 8 },
  heroSub: { fontSize: 12, color: '#B4B9C0', marginTop: 5 },
  statRow: { flexDirection: 'row', gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    shadowColor: '#0A2540',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  statNum: { fontSize: 26, fontWeight: '800', color: '#00B578' },
  statLabel: { fontSize: 11, color: '#8A9099', marginTop: 6 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1F2329', marginTop: 24, marginBottom: 10 },
  empty: { fontSize: 13, color: '#B4B9C0', paddingVertical: 8 },
  songRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
    shadowColor: '#0A2540',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  rank: { width: 26, fontSize: 15, fontWeight: '700', color: '#B4B9C0', textAlign: 'center' },
  rankTop: { color: '#00B578' },
  songMain: { flex: 1, paddingHorizontal: 10, minWidth: 0 },
  songName: { fontSize: 14, color: '#1F2329', fontWeight: '500' },
  songSinger: { fontSize: 11, color: '#8A9099', marginTop: 2 },
  songCount: { fontSize: 12, color: '#B4B9C0' },
});
