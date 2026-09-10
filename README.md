# LxMusicPlayer —— 可自签的 iOS 音乐播放器（自定义音源版）

洛雪音乐自定义音源脚本的 iOS 应用封装：**搜索（内置公开源）→ 音源脚本取链（awaw.cc 8 源）→ 播放**。
使用个人 Apple ID 免费账号即可自签安装到自己的 iPhone / iPad，无需开发者证书、无需上架。

## 功能

- 🔍 **搜索**：内置酷我 / 腾讯 / 网易 / 咪咕四个公开搜索接口，结果按来源分组
- 📡 **音源**：awaw.cc 页面全部 8 个自定义音源脚本（SixYin / Huibq / Flower / LX / ikun / Grass / JuheApi / QDY），点选即用；播放地址 / 歌词 / 封面均由音源脚本提供
- ▶ **播放**：后台播放、锁屏继续、歌词逐行高亮、上下曲切换
- 🔓 **自签**：Xcode 选择个人 Team 即可签名安装

## 技术栈

- React Native 0.87（新架构），React 19
- `src/lx-api/`：lx-ios-api 纯 JS 运行时（音源脚本沙箱 + 统一 API），**零原生模块**
- `react-native-video`：唯一额外原生依赖（播放）

## 一、准备工作（首次）

需要一台 **macOS + Xcode**（Windows 只能开发 JS 层，无法构建 iOS）。

```bash
# 1. 安装 Node 依赖（任何系统均可）
npm install

# 2. 安装 iOS 原生依赖（在 Mac 上执行）
cd ios
pod install
cd ..
```

> 若 `pod install` 因网络慢失败，可先 `pod repo update` 或设置镜像源。

## 二、自签安装（3 步）

1. **打开工程**：双击 `ios/LxMusicPlayer.xcworkspace`（务必用 xcworkspace，不是 xcodeproj）
2. **选择签名**：Xcode → 左侧工程 LxMusicPlayer → TARGETS → LxMusicPlayer →
   Signing & Capabilities → 勾选 Automatically manage signing →
   Team 选择自己的 **Apple ID（个人免费账号即可）**
   - 没有 Apple ID 账号：Xcode → Settings → Accounts → 添加 Apple ID
3. **真机运行**：iPhone 用数据线连 Mac → 设备列表选自己的手机 → Cmd+R 运行
   - 首次安装后到「设置 → 通用 → VPN 与设备管理 → 开发者 App」信任你的开发者证书
   - 免费账号签名有效期 7 天，到期后重新运行一次即可续期

> 提示：`PRODUCT_BUNDLE_IDENTIFIER` 默认为 `org.reactjs.native.example.LxMusicPlayer`，
> 多人共用一个 Apple ID 时建议改成唯一值（如 `com.你的名字.lxmusicplayer`）。

## 二·补：用小白签 PRO 签名安装（无需 Xcode）

不想用 Xcode 的话，可以直接用 **小白签 PRO** 重签名安装：

1. 拿到 IPA：有 Mac 跑 `./scripts/build-ipa.sh`；没 Mac 用仓库里的 GitHub Actions（`Build Unsigned IPA`）云构建，下载产物
2. 小白签 Pro → 导入 `LxMusicPlayer-unsigned.ipa` → 选签名方式（免费 Apple ID 7 天 / 证书服务更久）→ 签名 → 安装
3. 手机「设置 → 通用 → VPN 与设备管理」信任描述文件

完整步骤见 **`小白签PRO签名安装.md`**。

## 三、使用

1. 打开 App → 「音源」页 → 点一个音源（如 LX / Huibq）加载，显示「使用中」
2. 切到「搜索」页 → 输入歌曲名 → 搜索 → 点结果播放
3. 「播放」页显示封面、逐行歌词与播放控制

### 常见问题

| 现象 | 原因 / 处理 |
|---|---|
| 搜索无结果 | 公开搜索接口偶发限流，换关键词或稍后重试；也可在 `src/searchSources.ts` 增删搜索源 |
| 播放失败 | 音源脚本依赖的第三方取链服务失效（如 Huibq 的 onrender 已停运）。换其他音源脚本重试 |
| 某音源加载失败 | 脚本自带版本校验或外部服务器不可达（如 SixYin）。换源即可，不影响其他源 |
| GitHub 拉脚本失败 | 已在代码中自动回退加速前缀（ghproxy.net 等），仍失败则稍后重试 |
| 歌词空白 | 所选音源脚本的 local 源才支持 lyric；或该源歌词接口失效 |

## 四、自定义

- **增删搜索源**：编辑 `src/searchSources.ts`（统一返回 `Song[]` 即可接入新源）
- **音源注册表**：编辑 `src/lx-api/sources.js`（id / name / 下载 URL）
- **界面**：三个页面在 `src/screens/`，播放逻辑在 `src/player/PlayerContext.tsx`

## 五、验证

```bash
npm run lint        # ESLint
npx tsc --noEmit    # 类型检查
# JS 打包自检（验证全部模块可被 Metro 解析打包）：
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output /tmp/main.jsbundle
```

> iOS 编译/签名需在 Mac 上完成；本工程已在 Windows 侧完成类型检查与打包自检。

## 免责声明

本项目仅供个人学习与技术研究。音源脚本与搜索接口来自第三方公开资源，可能随时失效；
请尊重版权，仅用于个人合法试听，勿批量下载、勿商用传播。
