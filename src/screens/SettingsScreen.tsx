/**
 * 设置 —— 音源管理：查看已添加音源、加载切换、删除、添加（自定义 URL 或内置推荐）。
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AVAILABLE_SOURCES, isValidSourceUrl } from '../sourceManager';
import type { SourceManager } from '../sourceManager';
import { KEYS, load, remove } from '../storage';

export default function SettingsScreen({
  manager,
  onBack,
}: {
  manager: SourceManager;
  onBack: () => void;
}) {
  const { sources, currentId, loading, message, loadSource, addSource, removeSource } = manager;
  const [customUrl, setCustomUrl] = useState('');
  const [addError, setAddError] = useState<string | null>(null);
  const [cacheInfo, setCacheInfo] = useState('读取中…');
  const [cacheCleared, setCacheCleared] = useState(false);

  const refreshCacheInfo = useCallback(() => {
    try {
      const c = load<Record<string, unknown>>(KEYS.collectionCache, {});
      const v = load<Record<string, unknown>>(KEYS.coversCache, {});
      const count = Object.keys(c).length;
      const kb = (JSON.stringify(c).length + JSON.stringify(v).length) / 1024;
      setCacheInfo(count > 0 ? `已缓存 ${count} 个歌单 · 约 ${kb.toFixed(0)} KB` : '暂无缓存');
    } catch {
      setCacheInfo('暂无缓存');
    }
  }, []);

  useEffect(() => {
    refreshCacheInfo();
  }, [refreshCacheInfo]);

  const doClearCache = () => {
    remove(KEYS.collectionCache);
    remove(KEYS.coversCache);
    refreshCacheInfo();
    setCacheCleared(true);
    setTimeout(() => setCacheCleared(false), 2000);
  };

  const doAddCustom = () => {
    const res = addSource(customUrl);
    if (res.ok) {
      setCustomUrl('');
      setAddError(null);
    } else {
      setAddError(res.error ?? '添加失败');
    }
  };

  const doAddPreset = (url: string, name: string) => {
    const res = addSource(url, name);
    if (!res.ok && res.error && !res.error.includes('已添加')) setAddError(res.error);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backBtn} hitSlop={8}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>设置</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>音源管理</Text>
        <Text style={styles.sectionDesc}>
          播放地址、歌词、封面由音源脚本提供。点按音源卡片加载并切换，未加载音源时无法播放。
        </Text>

        {message ? (
          <View style={styles.messageBox}>
            <Text style={styles.messageText} numberOfLines={3}>
              {message}
            </Text>
          </View>
        ) : null}

        {sources.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyNote}>♪</Text>
            <Text style={styles.emptyText}>还没有音源，从下方添加一个</Text>
          </View>
        ) : (
          sources.map(item => {
            const active = item.id === currentId;
            const initial = item.name.replace(/^\s+/, '').slice(0, 1).toUpperCase() || '♪';
            return (
              <Pressable
                key={item.id}
                style={[styles.srcCard, active && styles.srcCardActive, item.state === 'loading' && styles.srcCardLoading]}
                onPress={() => loadSource(item.id)}
                disabled={loading}
              >
                <View style={[styles.srcIcon, active && styles.srcIconActive]}>
                  <Text style={[styles.srcIconText, active && styles.srcIconTextActive]}>{initial}</Text>
                </View>
                <View style={styles.srcMain}>
                  <View style={styles.srcNameRow}>
                    <Text style={[styles.srcName, active && styles.srcNameActive]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    {active ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>使用中</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.srcUrl} numberOfLines={1}>
                    {item.url}
                  </Text>
                  {item.state === 'error' ? (
                    <Text style={styles.srcError} numberOfLines={2}>
                      {item.message}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.srcRight}>
                  {item.state === 'loading' ? (
                    <ActivityIndicator size="small" color="#EC4141" />
                  ) : (
                    <Text
                      style={[
                        styles.srcState,
                        item.state === 'error' && styles.srcStateError,
                        item.state === 'ready' && styles.srcStateReady,
                      ]}
                    >
                      {item.state === 'ready' ? '已就绪' : item.state === 'error' ? '失败' : '加载'}
                    </Text>
                  )}
                  <Pressable style={styles.removeBtn} onPress={() => removeSource(item.id)} hitSlop={8}>
                    <Text style={styles.removeText}>✕</Text>
                  </Pressable>
                </View>
              </Pressable>
            );
          })
        )}

        <Text style={styles.sectionTitle}>添加音源</Text>

        {/* 自定义 URL */}
        <View style={styles.customBox}>
          <Text style={styles.customLabel}>自定义脚本地址</Text>
          <View style={styles.customRow}>
            <TextInput
              style={styles.customInput}
              value={customUrl}
              onChangeText={setCustomUrl}
              placeholder="https://…/latest.js"
              placeholderTextColor="#B4B9C0"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable style={[styles.addBtn, !isValidSourceUrl(customUrl) && styles.addBtnDisabled]} onPress={doAddCustom}>
              <Text style={styles.addBtnText}>添加</Text>
            </Pressable>
          </View>
          {addError ? <Text style={styles.addError}>{addError}</Text> : null}
          <Text style={styles.customHint}>
            填写音源脚本直链（awaw.cc 页面里每个脚本的链接），加载失败会自动尝试国内加速前缀
          </Text>
        </View>

        {/* 内置推荐 */}
        <Text style={styles.presetTitle}>内置推荐（点按添加）</Text>
        {AVAILABLE_SOURCES.map(item => {
          const added = sources.some(s => s.url === item.url);
          return (
            <View key={item.id} style={styles.presetRow}>
              <View style={styles.presetMain}>
                <Text style={styles.presetName} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={styles.presetUrl} numberOfLines={1}>
                  {item.url}
                </Text>
              </View>
              <Pressable
                style={[styles.presetBtn, added && styles.presetBtnAdded]}
                onPress={() => doAddPreset(item.url, item.name)}
                disabled={added}
              >
                <Text style={[styles.presetBtnText, added && styles.presetBtnTextAdded]}>
                  {added ? '已添加' : '添加'}
                </Text>
              </Pressable>
            </View>
          );
        })}

        {/* 缓存管理 */}
        <Text style={styles.sectionTitle}>缓存管理</Text>
        <View style={styles.cacheBox}>
          <View style={styles.cacheMain}>
            <Text style={styles.cacheLabel}>歌单与封面缓存</Text>
            <Text style={styles.cacheDesc}>{cacheCleared ? '已清理 ✓' : cacheInfo}</Text>
          </View>
          <Pressable style={styles.clearCacheBtn} onPress={doClearCache}>
            <Text style={styles.clearCacheText}>清理缓存</Text>
          </Pressable>
        </View>

        <Text style={styles.about}>LxMusicPlayer · 自签 iOS 音乐播放器</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4 },
  backBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', marginRight: 2 },
  backText: { fontSize: 34, color: '#1F2329', lineHeight: 34, marginTop: -4 },
  title: { fontSize: 24, fontWeight: '700', color: '#1F2329' },
  content: { paddingHorizontal: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1F2329', marginTop: 20 },
  sectionDesc: { fontSize: 12, color: '#8A9099', lineHeight: 18, marginTop: 5, marginBottom: 12 },
  messageBox: {
    backgroundColor: '#FDECEC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 10,
  },
  messageText: { fontSize: 12, color: '#C62F2F', lineHeight: 17 },
  emptyBox: { alignItems: 'center', paddingVertical: 26, backgroundColor: '#FFFFFF', borderRadius: 16 },
  emptyNote: { fontSize: 34, color: '#DDE3E9' },
  emptyText: { fontSize: 13, color: '#B4B9C0', marginTop: 6 },
  srcCard: {
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
  srcCardActive: { borderColor: '#EC4141' },
  srcCardLoading: { opacity: 0.6 },
  srcIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F0F2F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  srcIconActive: { backgroundColor: '#FDECEC' },
  srcIconText: { fontSize: 17, color: '#8A9099', fontWeight: '600' },
  srcIconTextActive: { color: '#EC4141' },
  srcMain: { flex: 1, paddingHorizontal: 12, minWidth: 0 },
  srcNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  srcName: { fontSize: 15, color: '#1F2329', fontWeight: '600', flexShrink: 1 },
  srcNameActive: { color: '#EC4141' },
  badge: { backgroundColor: '#FDECEC', borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { fontSize: 10, color: '#EC4141', fontWeight: '600' },
  srcUrl: { fontSize: 11, color: '#B4B9C0', marginTop: 3 },
  srcError: { fontSize: 11, color: '#F53F3F', marginTop: 4, lineHeight: 15 },
  srcRight: { alignItems: 'flex-end', justifyContent: 'center', gap: 8 },
  srcState: { fontSize: 12, color: '#B4B9C0' },
  srcStateReady: { color: '#EC4141', fontWeight: '600' },
  srcStateError: { color: '#F53F3F' },
  removeBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFF1F0', alignItems: 'center', justifyContent: 'center' },
  removeText: { fontSize: 11, color: '#F53F3F', lineHeight: 13 },
  customBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    marginTop: 10,
    shadowColor: '#0A2540',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  customLabel: { fontSize: 13, color: '#1F2329', fontWeight: '600', marginBottom: 8 },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  customInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#EDEFF2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1F2329',
    backgroundColor: '#F7F8FA',
  },
  addBtn: { backgroundColor: '#EC4141', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11 },
  addBtnDisabled: { opacity: 0.4 },
  addBtnText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  addError: { fontSize: 12, color: '#F53F3F', marginTop: 8 },
  customHint: { fontSize: 11, color: '#B4B9C0', lineHeight: 16, marginTop: 8 },
  presetTitle: { fontSize: 13, color: '#8A9099', fontWeight: '600', marginTop: 18, marginBottom: 8 },
  presetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    shadowColor: '#0A2540',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  presetMain: { flex: 1, minWidth: 0, paddingRight: 10 },
  presetName: { fontSize: 14, color: '#1F2329', fontWeight: '500' },
  presetUrl: { fontSize: 10, color: '#B4B9C0', marginTop: 3 },
  presetBtn: { backgroundColor: '#FDECEC', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 7 },
  presetBtnAdded: { backgroundColor: '#F0F2F5' },
  presetBtnText: { fontSize: 12, color: '#EC4141', fontWeight: '600' },
  presetBtnTextAdded: { color: '#B4B9C0' },
  about: { textAlign: 'center', fontSize: 11, color: '#C0C6CC', marginTop: 26 },
  cacheBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },
  cacheMain: { flex: 1 },
  cacheLabel: { fontSize: 14, fontWeight: '600', color: '#1F2329' },
  cacheDesc: { fontSize: 11, color: '#8A9099', marginTop: 3 },
  clearCacheBtn: {
    backgroundColor: '#FFF1F0',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  clearCacheText: { fontSize: 12, color: '#EC4141', fontWeight: '600' },
});
