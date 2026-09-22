/**
 * 我的 —— 网易云风格：红色渐变头部 + 听歌统计 + 最近播放 / 自建歌单 / 收藏歌单 / 设置
 */
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { parseShareInput, fetchWyPlaylist, fetchTxPlaylist, fetchKgPlaylist, parseTextSongs } from '../importPlaylist';
import { searchNetease, BAD_VERSION } from '../searchSources';
import { usePlayer } from '../player/PlayerContext';
import { useLibrary } from '../library';
import SongArt from '../components/SongArt';
import type { LxMusicApi } from '../lx-api/index.js';
import type { Collection, LocalPlaylist, Song } from '../types';

const RED = '#EC4141';
const RED_DEEP = '#C62F2F';

function fmtDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} 小时 ${m} 分`;
  return `${m} 分钟`;
}

function RecentsRow({ song, onPlay }: { song: Song; onPlay: () => void }) {
  return (
    <Pressable style={styles.recentRow} onPress={onPlay}>
      <SongArt song={song} size={46} radius={10} />
      <View style={styles.recentMain}>
        <Text style={styles.recentName} numberOfLines={1}>
          {song.name}
        </Text>
        <Text style={styles.recentSinger} numberOfLines={1}>
          {song.singer}
        </Text>
      </View>
      <View style={styles.recentPlay}>
        <Text style={styles.recentPlayIcon}>▶</Text>
      </View>
    </Pressable>
  );
}

export default function MineScreen({
  getApi,
  onOpenSettings,
  onOpenCollection,
  onOpenLocalPlaylist,
  onOpenReport,
}: {
  getApi: () => LxMusicApi | null;
  onOpenSettings: () => void;
  onOpenCollection: (c: Collection) => void;
  onOpenLocalPlaylist: (pl: LocalPlaylist) => void;
  onOpenReport: () => void;
}) {
  const { recents, playlists, favs, stats, createPlaylist, importPlaylist } = useLibrary();
  const { play } = usePlayer();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');

  const topSong = [...stats.songs].sort((a, b) => b.count - a.count)[0];

  const confirmCreate = () => {
    createPlaylist(newName);
    setNewName('');
    setCreating(false);
  };

  // —— 导入歌单 ——
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importPlatform, setImportPlatform] = useState<'auto' | 'wy' | 'tx' | 'kg'>('auto');
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState('');
  const [importResult, setImportResult] = useState<{ name: string; count: number; songs: Song[] } | null>(null);

  const fetchByPlatform = async (pl: 'wy' | 'tx' | 'kg', id: string) =>
    pl === 'wy' ? fetchWyPlaylist(id) : pl === 'tx' ? fetchTxPlaylist(id) : fetchKgPlaylist(id);

  const doImport = async () => {
    if (importBusy) return;
    setImportBusy(true);
    setImportError('');
    try {
      const parsed = parseShareInput(importText);
      let result: { name: string; count: number; songs: Song[] };
      if (parsed.kind === 'link' && parsed.platform && parsed.id) {
        const r = await fetchByPlatform(parsed.platform, parsed.id);
        result = { name: r.name, count: r.songs.length, songs: r.songs };
      } else if (parsed.kind === 'link' && parsed.shortUrl) {
        // 短链：跟随跳转拿最终地址再解析
        const resp = await fetch(parsed.shortUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15' },
        });
        const re = parseShareInput(resp.url || '');
        if (!re.platform || !re.id) throw new Error('短链无法识别歌单，请打开后复制完整链接');
        const r = await fetchByPlatform(re.platform, re.id);
        result = { name: r.name, count: r.songs.length, songs: r.songs };
      } else if (parsed.kind === 'id') {
        if (importPlatform === 'auto') throw new Error('检测到歌单 ID，请选择平台');
        const r = await fetchByPlatform(importPlatform, parsed.id!);
        result = { name: r.name, count: r.songs.length, songs: r.songs };
      } else {
        // 文本导入：多行「歌名 歌手」，按网易云匹配
        const lines = parseTextSongs(importText);
        if (!lines.length) throw new Error('没有可识别的歌曲，请检查输入');
        const songs: Song[] = [];
        let failed = 0;
        for (const ln of lines.slice(0, 100)) {
          try {
            const kw = ln.singer ? `${ln.name} ${ln.singer}` : ln.name;
            const res = await searchNetease(kw);
            const hit = res.find(s => !BAD_VERSION.test(s.name));
            if (hit) songs.push(hit);
            else failed++;
          } catch {
            failed++;
          }
        }
        if (!songs.length) throw new Error('未能匹配到任何歌曲（文本按网易云匹配）');
        result = { name: `文本导入（成功 ${songs.length}/${lines.length}）`, count: songs.length, songs };
      }
      setImportResult(result);
    } catch (e: any) {
      setImportError(String(e?.message ?? e));
    } finally {
      setImportBusy(false);
    }
  };

  const confirmSaveImport = () => {
    if (!importResult) return;
    importPlaylist(importResult.name, importResult.songs);
    setImportOpen(false);
    setImportResult(null);
    setImportText('');
    setImportPlatform('auto');
    setImportError('');
  };

  const closeImport = () => {
    if (importBusy) return;
    setImportOpen(false);
    setImportResult(null);
    setImportText('');
    setImportPlatform('auto');
    setImportError('');
  };

  return (
    <View style={styles.container}>
      {/* 红色渐变头部 */}
      <View style={styles.header}>
        <View style={styles.headerDecoA} />
        <View style={styles.headerDecoB} />
        <View style={styles.top}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>♪</Text>
          </View>
          <View style={styles.topMain}>
            <Text style={styles.title}>我的音乐</Text>
            <Text style={styles.subtitle}>本地播放 · 数据保存在本机</Text>
          </View>
        </View>
        {/* 听歌报告入口 */}
        <Pressable style={styles.reportCard} onPress={onOpenReport}>
          <View style={styles.reportItem}>
            <Text style={styles.reportNum}>{stats.totalPlays}</Text>
            <Text style={styles.reportLabel}>播放次数</Text>
          </View>
          <View style={styles.reportDivider} />
          <View style={styles.reportItem}>
            <Text style={styles.reportNum}>{fmtDuration(stats.totalSeconds).split(' ')[0]}</Text>
            <Text style={styles.reportLabel}>累计时长</Text>
          </View>
          <View style={styles.reportDivider} />
          <View style={styles.reportItem}>
            <Text style={styles.reportNum} numberOfLines={1}>
              {topSong ? topSong.name.slice(0, 4) : '—'}
            </Text>
            <Text style={styles.reportLabel}>最爱单曲</Text>
          </View>
          <Text style={styles.reportGo}>›</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 最近播放 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>最近播放</Text>
        </View>
        {recents.length === 0 ? (
          <Text style={styles.sectionEmpty}>还没有播放记录，去搜索或音乐馆听听看</Text>
        ) : (
          recents.slice(0, 6).map(song => (
            <RecentsRow
              key={`${song.source}:${song.id}`}
              song={song}
              onPlay={() => play(song, getApi(), recents.slice(0, 20))}
            />
          ))
        )}

        {/* 我的歌单 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>自建歌单</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hscroll}>
          <Pressable style={[styles.hCard, styles.createCard]} onPress={() => setCreating(true)}>
            <Text style={styles.createPlus}>＋</Text>
            <Text style={styles.createText}>新建歌单</Text>
          </Pressable>
          <Pressable
            style={[styles.hCard, styles.createCard]}
            onPress={() => {
              setImportOpen(true);
              setImportResult(null);
              setImportText('');
              setImportError('');
            }}
          >
            <Text style={styles.createPlus}>⇣</Text>
            <Text style={styles.createText}>导入歌单</Text>
          </Pressable>
          {playlists.map(pl => (
            <Pressable key={pl.id} style={styles.hCard} onPress={() => onOpenLocalPlaylist(pl)}>
              <View style={styles.hCover}>
                <Text style={styles.hCoverNote}>♪</Text>
                <Text style={styles.hCount}>{pl.songs.length} 首</Text>
              </View>
              <Text style={styles.hName} numberOfLines={1}>
                {pl.name}
              </Text>
            </Pressable>
          ))}
          {playlists.length === 0 ? <Text style={styles.hint}>点「新建歌单」，在搜索页点 ＋ 加歌</Text> : null}
        </ScrollView>

        {/* 收藏歌单 */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>收藏歌单</Text>
        </View>
        {favs.length === 0 ? (
          <Text style={styles.sectionEmpty}>在音乐馆 / 每日推荐的合集页点「收藏」即可保存</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.hscroll}>
            {favs.map(f => (
              <Pressable
                key={f.id}
                style={styles.hCard}
                onPress={() =>
                  onOpenCollection({ id: f.id, name: f.name, desc: f.desc, source: f.source, apiId: f.apiId, hue: f.hue })
                }
              >
                <View style={[styles.hCover, { backgroundColor: `hsl(${f.hue}, 70%, 92%)` }]}>
                  <Text style={[styles.hCoverNote, { color: `hsl(${f.hue}, 55%, 40%)` }]}>♪</Text>
                </View>
                <Text style={styles.hName} numberOfLines={1}>
                  {f.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {/* 设置入口 */}
        <Pressable style={styles.settingsRow} onPress={onOpenSettings}>
          <View style={styles.settingsIcon}>
            <Text style={styles.settingsIconText}>⚙</Text>
          </View>
          <Text style={styles.settingsText}>设置 · 音源管理</Text>
          <Text style={styles.settingsGo}>›</Text>
        </Pressable>
      </ScrollView>

      {/* 新建歌单弹窗 */}
      <Modal visible={creating} transparent animationType="fade" onRequestClose={() => setCreating(false)}>
        <Pressable style={styles.mask} onPress={() => setCreating(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>新建歌单</Text>
            <TextInput
              style={styles.sheetInput}
              value={newName}
              onChangeText={setNewName}
              placeholder="歌单名称"
              placeholderTextColor="#B4B9C0"
              autoFocus
            />
            <Pressable style={styles.sheetBtn} onPress={confirmCreate}>
              <Text style={styles.sheetBtnText}>创建</Text>
            </Pressable>
            <Pressable style={styles.sheetCancel} onPress={() => setCreating(false)}>
              <Text style={styles.sheetCancelText}>取消</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* 导入歌单弹窗 */}
      <Modal visible={importOpen} transparent animationType="fade" onRequestClose={closeImport}>
        <Pressable style={styles.mask} onPress={closeImport}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <Text style={styles.sheetTitle}>导入歌单</Text>
            {importResult ? (
              <>
                <Text style={styles.importInfo}>
                  已获取歌单「{importResult.name}」，共 {importResult.count} 首
                </Text>
                <Pressable style={styles.sheetBtn} onPress={confirmSaveImport}>
                  <Text style={styles.sheetBtnText}>保存到我的歌单</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.importHint}>
                  支持网易云 / QQ音乐 / 酷狗的歌单分享链接或 ID；也可粘贴多行「歌名 歌手」文本自动匹配。
                </Text>
                <TextInput
                  style={[styles.sheetInput, styles.importInput]}
                  value={importText}
                  onChangeText={setImportText}
                  placeholder="粘贴歌单链接 / ID，或输入多行歌曲文本"
                  placeholderTextColor="#B4B9C0"
                  multiline
                />
                <View style={styles.importChips}>
                  {(
                    [
                      ['auto', '自动识别'],
                      ['wy', '网易云'],
                      ['tx', 'QQ音乐'],
                      ['kg', '酷狗'],
                    ] as const
                  ).map(([v, label]) => (
                    <Pressable
                      key={v}
                      style={[styles.importChip, importPlatform === v && styles.importChipOn]}
                      onPress={() => setImportPlatform(v)}
                    >
                      <Text style={[styles.importChipText, importPlatform === v && styles.importChipTextOn]}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                {importError ? <Text style={styles.importError}>{importError}</Text> : null}
                {importBusy ? (
                  <View style={styles.importBusy}>
                    <ActivityIndicator color={RED} />
                    <Text style={styles.importBusyText}>导入中…</Text>
                  </View>
                ) : (
                  <Pressable style={styles.sheetBtn} onPress={doImport}>
                    <Text style={styles.sheetBtnText}>导入</Text>
                  </Pressable>
                )}
              </>
            )}
            <Pressable style={styles.sheetCancel} onPress={closeImport}>
              <Text style={styles.sheetCancelText}>取消</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F7' },
  header: {
    backgroundColor: RED_DEEP,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 0,
    overflow: 'hidden',
  },
  headerDecoA: {
    position: 'absolute',
    top: -70,
    right: -30,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  headerDecoB: {
    position: 'absolute',
    bottom: -80,
    left: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  top: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 25, color: '#FFFFFF' },
  topMain: { paddingLeft: 12 },
  title: { fontSize: 21, fontWeight: '800', color: '#FFFFFF' },
  subtitle: { fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 3 },
  reportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  reportItem: { flex: 1, alignItems: 'center', minWidth: 0 },
  reportNum: { fontSize: 16, fontWeight: '800', color: '#FFFFFF', maxWidth: '100%' },
  reportLabel: { fontSize: 10, color: 'rgba(255,255,255,0.72)', marginTop: 3 },
  reportDivider: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: 'rgba(255,255,255,0.25)' },
  reportGo: { fontSize: 20, color: 'rgba(255,255,255,0.7)', paddingLeft: 8 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 },
  sectionHeader: { marginTop: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1F2329' },
  sectionEmpty: { fontSize: 13, color: '#B4B9C0', paddingVertical: 6 },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 10,
    marginBottom: 8,
    shadowColor: '#0A2540',
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  recentMain: { flex: 1, paddingHorizontal: 12 },
  recentName: { fontSize: 14, color: '#1F2329', fontWeight: '500' },
  recentSinger: { fontSize: 11, color: '#8A9099', marginTop: 3 },
  recentPlay: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FDECEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recentPlayIcon: { fontSize: 12, color: RED, marginLeft: 1 },
  hscroll: { marginHorizontal: -16, paddingHorizontal: 16 },
  hCard: { width: 108, marginRight: 12, alignItems: 'flex-start' },
  createCard: {
    width: 108,
    height: 108,
    borderRadius: 16,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: '#E5B4B4',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FBFCFC',
  },
  createPlus: { fontSize: 26, color: RED, lineHeight: 30 },
  createText: { fontSize: 12, color: '#8A9099', marginTop: 4 },
  hCover: {
    width: 108,
    height: 108,
    borderRadius: 16,
    backgroundColor: '#FDECEC',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A2540',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  hCoverNote: { fontSize: 34, color: RED, opacity: 0.5 },
  hCount: { position: 'absolute', left: 8, bottom: 8, fontSize: 11, color: '#5B6066' },
  hName: { fontSize: 12, color: '#1F2329', fontWeight: '500', marginTop: 7, maxWidth: 108 },
  hint: { fontSize: 12, color: '#B4B9C0', alignSelf: 'center', paddingVertical: 20 },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 24,
    shadowColor: '#0A2540',
    shadowOpacity: 0.05,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  settingsIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: '#FDECEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIconText: { fontSize: 17, color: RED },
  settingsText: { flex: 1, fontSize: 15, color: '#1F2329', fontWeight: '500', paddingLeft: 12 },
  settingsGo: { fontSize: 22, color: '#C0C6CC' },
  mask: { flex: 1, backgroundColor: 'rgba(20,24,28,0.4)', justifyContent: 'center', paddingHorizontal: 40 },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    alignItems: 'stretch',
  },
  sheetTitle: { fontSize: 17, fontWeight: '700', color: '#1F2329', textAlign: 'center', marginBottom: 14 },
  sheetInput: {
    borderWidth: 1,
    borderColor: '#EDEFF2',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1F2329',
    backgroundColor: '#F7F8FA',
  },
  sheetBtn: {
    backgroundColor: RED,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 14,
  },
  sheetBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sheetCancel: { alignItems: 'center', marginTop: 12 },
  sheetCancelText: { color: '#8A9099', fontSize: 13 },
  importInput: { height: 96, textAlignVertical: 'top', marginTop: 4 },
  importHint: { fontSize: 12, color: '#8A9099', marginBottom: 10, lineHeight: 18 },
  importChips: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  importChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E3E6EA',
    backgroundColor: '#F7F8FA',
    marginRight: 8,
    marginBottom: 8,
  },
  importChipOn: { borderColor: RED, backgroundColor: '#FDECEC' },
  importChipText: { fontSize: 12, color: '#5B6066' },
  importChipTextOn: { color: RED, fontWeight: '600' },
  importError: { fontSize: 12, color: '#E54040', marginTop: 8 },
  importBusy: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14 },
  importBusyText: { fontSize: 13, color: '#8A9099', marginLeft: 8 },
  importInfo: { fontSize: 14, color: '#1F2329', textAlign: 'center', paddingVertical: 10, lineHeight: 20 },
});
