/** 音源页：awaw.cc 的 8 个自定义音源脚本，点击加载并设为当前取链音源 */
import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSourceManager } from '../sourceManager';

export default function SourceScreen({ manager }: { manager: ReturnType<typeof useSourceManager> }) {
  const { sources, currentId, loading, message, loadSource } = manager;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>自定义音源脚本（来自 awaw.cc）</Text>
      <Text style={styles.subheader}>
        播放地址/歌词/封面由所选音源脚本提供。部分脚本依赖第三方服务，可能失效，可换源重试。
      </Text>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <FlatList
        data={sources}
        keyExtractor={s => s.id}
        renderItem={({ item }) => {
          const active = item.id === currentId;
          return (
            <Pressable
              style={[styles.row, active && styles.rowActive, item.state === 'loading' && styles.rowLoading]}
              onPress={() => loadSource(item.id)}
              disabled={loading}
            >
              <View style={styles.rowMain}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, active && styles.nameActive]}>{item.name}</Text>
                  {active ? <Text style={styles.activeTag}>使用中</Text> : null}
                </View>
                <Text style={styles.url} numberOfLines={1}>{item.url}</Text>
                {item.state === 'ready' && item.capabilities ? (
                  <Text style={styles.cap} numberOfLines={2}>
                    支持：{item.capabilities.map(c => `${c.source}[${c.actions.join('/')}]`).join('  ')}
                  </Text>
                ) : null}
                {item.state === 'error' ? <Text style={styles.error} numberOfLines={2}>{item.message}</Text> : null}
              </View>
              <Text style={styles.stateText}>
                {item.state === 'loading' ? '加载中…' : item.state === 'ready' ? '✓' : item.state === 'error' ? '失败' : '点击加载'}
              </Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { fontSize: 17, fontWeight: '700', color: '#000', paddingHorizontal: 12, paddingTop: 12 },
  subheader: { fontSize: 12, color: '#8e8e93', paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 },
  message: { fontSize: 12, color: '#d70015', paddingHorizontal: 12, paddingBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#e5e5ea' },
  rowActive: { backgroundColor: '#f0f7ff' },
  rowLoading: { opacity: 0.6 },
  rowMain: { flex: 1, paddingRight: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 16, color: '#000', fontWeight: '600' },
  nameActive: { color: '#007aff' },
  activeTag: { fontSize: 11, color: '#007aff', backgroundColor: '#e8f0fe', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
  url: { fontSize: 11, color: '#8e8e93', marginTop: 2 },
  cap: { fontSize: 11, color: '#48484a', marginTop: 4 },
  error: { fontSize: 11, color: '#d70015', marginTop: 4 },
  stateText: { fontSize: 12, color: '#8e8e93', width: 60, textAlign: 'right' },
});
