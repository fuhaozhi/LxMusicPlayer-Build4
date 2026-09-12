/**
 * 音源页：awaw.cc 的 8 个自定义音源脚本，点击加载并设为当前取链音源
 * 浅色清新风：卡片式音源管理
 */
import React from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSourceManager } from '../sourceManager';

export default function SourceScreen({ manager }: { manager: ReturnType<typeof useSourceManager> }) {
  const { sources, currentId, loading, message, loadSource } = manager;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>音源</Text>
        <Text style={styles.subtitle}>播放地址、歌词、封面由所选音源脚本提供，点按卡片加载并切换</Text>
      </View>

      {message ? (
        <View style={styles.messageBox}>
          <Text style={styles.messageText} numberOfLines={3}>
            {message}
          </Text>
        </View>
      ) : null}

      <FlatList
        data={sources}
        keyExtractor={s => s.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => {
          const active = item.id === currentId;
          const initial = item.name.replace(/^\s+/, '').slice(0, 1).toUpperCase() || '♪';
          return (
            <Pressable
              style={[styles.card, active && styles.cardActive, item.state === 'loading' && styles.cardLoading]}
              onPress={() => loadSource(item.id)}
              disabled={loading}
            >
              <View style={[styles.iconCircle, active && styles.iconCircleActive]}>
                <Text style={[styles.iconText, active && styles.iconTextActive]}>{initial}</Text>
              </View>
              <View style={styles.cardMain}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, active && styles.nameActive]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {active ? (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>使用中</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.url} numberOfLines={1}>
                  {item.url}
                </Text>
                {item.state === 'ready' && item.capabilities ? (
                  <Text style={styles.cap} numberOfLines={1}>
                    支持：{item.capabilities.map(c => c.source).join(' / ')}
                  </Text>
                ) : null}
                {item.state === 'error' ? (
                  <Text style={styles.error} numberOfLines={2}>
                    {item.message}
                  </Text>
                ) : null}
              </View>
              <View style={styles.stateArea}>
                {item.state === 'loading' ? (
                  <ActivityIndicator size="small" color="#EC4141" />
                ) : (
                  <Text
                    style={[
                      styles.stateText,
                      item.state === 'error' && styles.stateError,
                      item.state === 'ready' && styles.stateReady,
                    ]}
                  >
                    {item.state === 'ready' ? '已就绪' : item.state === 'error' ? '失败' : '点按加载'}
                  </Text>
                )}
              </View>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  header: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  title: { fontSize: 30, fontWeight: '700', color: '#1F2329', marginBottom: 6 },
  subtitle: { fontSize: 13, color: '#8A9099', lineHeight: 19 },
  messageBox: {
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: '#FDECEC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  messageText: { fontSize: 12, color: '#C62F2F', lineHeight: 17 },
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: 'transparent',
    shadowColor: '#0A2540',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardActive: { borderColor: '#EC4141' },
  cardLoading: { opacity: 0.6 },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F2F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleActive: { backgroundColor: '#FDECEC' },
  iconText: { fontSize: 18, color: '#8A9099', fontWeight: '600' },
  iconTextActive: { color: '#EC4141' },
  cardMain: { flex: 1, paddingHorizontal: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 16, color: '#1F2329', fontWeight: '600', flexShrink: 1 },
  nameActive: { color: '#EC4141' },
  badge: {
    backgroundColor: '#FDECEC',
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  badgeText: { fontSize: 10, color: '#EC4141', fontWeight: '600' },
  url: { fontSize: 11, color: '#B4B9C0', marginTop: 3 },
  cap: { fontSize: 11, color: '#5B6066', marginTop: 4 },
  error: { fontSize: 11, color: '#F53F3F', marginTop: 4, lineHeight: 15 },
  stateArea: { alignItems: 'flex-end', alignSelf: 'stretch', justifyContent: 'center', minWidth: 54 },
  stateText: { fontSize: 12, color: '#B4B9C0' },
  stateReady: { color: '#EC4141', fontWeight: '600' },
  stateError: { color: '#F53F3F' },
});
