# 用小白签 PRO 签名安装 LxMusicPlayer

小白签 PRO 是 iOS 重签名工具：拿到本工程的 **IPA 文件**后，用它（或其他重签名工具）签名并安装到自己的 iPhone / iPad，无需 Xcode、无需开发者证书。

## 第一步：获取 IPA（二选一）

### 方式 A：有 Mac —— 本地一键打包

```bash
cd LxMusicPlayer
./scripts/build-ipa.sh
```

产物：`build/ipa/LxMusicPlayer-unsigned.ipa`（未签名 IPA，专供重签名工具使用）。
前置：Xcode（含 Command Line Tools）、CocoaPods。脚本会自动 `npm install` + `pod install` + 打包。

### 方式 B：不用 Mac / 不想装 Xcode —— GitHub 云构建（推荐）

云构建在 GitHub 的 macOS 服务器上完成编译，**你的电脑（Windows 或 Mac 都行）什么都不用装**，只需浏览器 + 一个免费 GitHub 账号。

**B.1 注册 GitHub 账号**

打开 https://github.com → 注册（免费，需邮箱验证）→ 登录。

**B.2 安装 GitHub Desktop（Windows/Mac 通用图形工具，自带 git）**

1. 浏览器打开 https://desktop.github.com → 下载 → 安装 → 打开
2. 首次打开选 **Sign in to GitHub.com** → 用刚注册的账号登录

**B.3 把工程添加进去并发布**

1. GitHub Desktop → 菜单 **File → Add local repository**
2. 选工程目录（Windows 默认：`C:\Users\33343\Downloads\LxMusicPlayer`）
3. 若提示"不是 Git 仓库，是否创建"→ 点 **Create a repository**（或 Continue）
4. 点顶部 **Publish repository** → 名字 `LxMusicPlayer` → 勾选 **Public** → **Publish repository**
5. 等右侧"Publishing"转完 → 点 **View on GitHub**（浏览器打开仓库页）

> 没有 GitHub Desktop 也可以用命令行推（需另装 Git for Windows）：`git init` + `git add .` + `git commit` + `git push`，步骤同 Mac 指南。

**B.4 触发云端打包**

1. 仓库页顶部标签点 **Actions**
2. 左侧 **Build Unsigned IPA** → 右侧 **Run workflow** → 绿色 **Run workflow** 按钮
3. 点进任务看进度，等 10~20 分钟
4. 完成后回到任务页底部 **Artifacts** → 下载 `LxMusicPlayer-unsigned-ipa.zip`
5. 解压得到 `LxMusicPlayer-unsigned.ipa`

**B.5 把 IPA 传到 iPhone（Windows 没有 AirDrop）**

- **微信**（最简单）：Windows 微信 → 文件传输助手 → 发送 `LxMusicPlayer-unsigned.ipa` → iPhone 微信接收 → 点开 → 右上角「…」→ **用「文件」App 打开** → 存到"文件"
- 或 **数据线**：iPhone 插电脑 → 信任此电脑 → 把 IPA 拖到"iPhone 文件"App
- 或 **网盘**：上传 iCloud 云盘 / 百度网盘 → iPhone 下载

> 云构建只在 macOS 服务器上执行，你的 Windows 电脑不需要 Xcode、不需要 git 命令。

## 第二步：小白签 PRO 签名安装

> 小白签各版本界面略有差异，以下为通用流程，以实际版本为准。

1. **安装小白签 Pro**（App Store 或官网）并登录
2. 进入「**签名**」或「**工具箱**」→ 选择「**导入/添加 IPA**」→ 选中 `LxMusicPlayer-unsigned.ipa`
3. 选择**签名方式**：

| 签名方式 | 说明 | 有效期 |
|---|---|---|
| **Apple ID 免费签名** | 输入你的 Apple ID（可多个账号轮流） | 7 天，到期需重签 |
| **小白签证书（企业签/超级签）** | 购买其证书服务，更稳定 | 按套餐，一般 1 年 |

4. 点击「**签名**」→ 签名完成后点击「**安装**」（保持手机与电脑/同一网络）
5. 手机上完成安装后：

> **重要**：打开「设置 → 通用 → VPN 与设备管理（描述文件）→ 对应证书 → 信任」

6. 回到桌面打开 **LxMusicPlayer** 即可使用

## 第三步：使用

- 「音源」页点选一个音源脚本（如 LX / Huibq）→ 显示「使用中」
- 「搜索」页输入歌名 → 点结果播放
- 「播放」页看歌词与控制

## 常见问题

| 问题 | 处理 |
|---|---|
| 安装后提示“未受信任的开发者” | 按第二步第 5 点去「设置 → 通用 → VPN 与设备管理」信任描述文件 |
| 免费签名到期打不开（闪退/提示已过期） | 重新导入 IPA 再签一次即可（无需重打包，用同一个 IPA 文件） |
| 签名失败提示 Bundle ID 冲突 | 用小白签的「重签名」功能修改 Bundle ID（如 `com.你的名字.lxmusicplayer`）后再签 |
| 下载 IPA 后提示已损坏 | 检查是否解压完整（zip 需完整解压出 `.ipa` 文件）；macOS 上右键打开 |
| 播放失败/取链失败 | 音源脚本依赖第三方服务，可能失效；换其他音源脚本重试 |
| 想去掉 7 天限制 | 使用小白签的付费证书服务，或考虑开发者账号（$99/年） |

## 原理简述

- 本工程用 `CODE_SIGNING_ALLOWED=NO` 打包出**未签名 IPA**（App 结构与资源完整，仅不含签名）。
- 小白签 PRO 用自己的证书/Apple ID 对 IPA **重新签名**后安装，设备信任其描述文件即可运行。
- 免费 Apple ID 签名受 Apple 限制为 7 天；证书服务无此限制（由小白签承担签名资质）。
