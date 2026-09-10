/**
 * 迷你播放条 —— 底部 Tab 上方常驻，展示当前播放歌曲，点击进入全屏播放页。
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePlayer } from './PlayerContext';
import SongArt from '../components/SongArt';

export default function PlayerBar({ onOpen }: { onOpen: () => void }) {
  const { state, toggle } = usePlayer();
  const song = state.song;
  if (!song) return null;

  return (
    <Pressable style={styles.bar} onPress={onOpen}>
      <SongArt song={song} size={40} radius={10} />
      <View style={styles.main}>
        <Text style={styles.name} numberOfLines={1}>
          {song.name}
        </Text>
        <Text style={styles.singer} numberOfLines={1}>
          {song.singer}
        </Text>
      </View>
      <Pressable
        style={styles.toggleBtn}
        hitSlop={8}
        onPress={e => {
          e.stopPropagation();
          toggle();
        }}
      >
        <Text style={styles.toggleIcon}>{state.buffering ? '…' : state.paused ? '▶' : '❚❚'}</Text>
      </Pressable>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    marginHorizontal: 12,
    marginBottom: 6,
    padding: 8,
    shadowColor: '#0A2540',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  thumb: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#F0F2F5' },
  main: { flex: 1, paddingHorizontal: 10, minWidth: 0 },
  name: { fontSize: 14, color: '#1F2329', fontWeight: '600' },
  singer: { fontSize: 11, color: '#8A9099', marginTop: 2 },
  toggleBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E6F7F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  toggleIcon: { fontSize: 12, color: '#00B578', marginLeft: 1 },
  chevron: { fontSize: 20, color: '#C0C6CC', paddingRight: 4 },
});
