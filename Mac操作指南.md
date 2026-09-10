# LxMusicPlayer・Mac 操作指南（从零到装到 iPhone）

> 适用：你有一台 MacBook /iMac，想把 LxMusicPlayer 装到自己的 iPhone。
> 两条路任选：
>
> **方式 A 用 Xcode 直接签名运行**
>
> （最快，5 分钟）；
>
> **方式 B 打包 IPA 用小白签 PRO 签名安装**
>
> （你指定的方式，需多一步）。



***

## 新手入门：打开终端 & 把文件弄到 Mac

### 打开终端（二选一）

- **方法 1（最快）**：按键盘 `Cmd（⌘）+ 空格` → 弹出搜索框 → 输入「终端」→ 回车
- **方法 2**：打开「访达」（Dock 栏最左侧蓝白笑脸图标）→ 顶部菜单「前往」→「实用工具」→ 双击「终端」

打开后看到黑/白窗口，光标停在 `~ %` 或 `~ $` 后面，在这里粘贴命令、按回车执行。
（粘贴用 `Cmd + V`；命令输出不用管，只要**最后没出现红色报错**就是成功。）

### 把 zip 从 Windows 传到 Mac

> ⚠️ **AirDrop 只支持苹果设备之间**，Windows 电脑传 Mac 请用下面方式：

- **微信**：Windows 微信 → 文件传输助手 → 发送 `LxMusicPlayer.zip`；Mac 微信接收 → 右键保存到「下载」文件夹（Finder 侧边栏第一个"下载"）
- 或 **U 盘**：复制到 U 盘 → 插 Mac → 把 zip 拖到「下载」文件夹
- 或 **网盘**（百度网盘 / iCloud 云盘）：上传后 Mac 上下载到「下载」文件夹

**确认放对了**：打开「下载」文件夹能看到 `LxMusicPlayer.zip` 即可。以下所有命令默认 zip 在「下载」里。

### ⚠️ 装不了 Xcode（系统版本低）？→ 走云打包，不用装 Xcode

App Store 提示"需要 macOS 26.2 以上"= 你的 macOS 版本较低，装不了最新 Xcode。
**没关系，打包 IPA 可以完全在云端（GitHub 苹果服务器）完成，你的 Mac 什么都不用装。**

方案见下文 **「方式 C：云打包 IPA（无需 Xcode，推荐不装 Xcode 时使用）」**。
如果 Mac 硬件支持（系统设置 → 通用 → 软件更新 能看到新系统），想本地打包也可以先升级系统再装 Xcode。

***

## 方式 C：云打包 IPA（无需 Xcode，推荐不装 Xcode 时使用）

全程在 GitHub 云端编译，Mac 只需要「传文件 + 点按钮」。

### C.1 解压工程

```bash
cd ~/Downloads && unzip LxMusicPlayer.zip
```

### C.2 注册 GitHub 并创建仓库

1. 打开 https://github.com → 注册账号（免费，邮箱验证）
2. 登录后右上角 **+** → **New repository** → Repository name 填 `LxMusicPlayer` → 选 **Public**（免费）→ **Create repository**
3. 创建后页面会显示几条命令，先放着

### C.3 把工程推上去（终端执行）

```bash
cd ~/Downloads/LxMusicPlayer
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/你的用户名/LxMusicPlayer.git
git push -u origin main
```

> 若提示 `git: command not found`：先装命令行工具（几百 MB，比 Xcode 小得多）——
> 终端执行 `xcode-select --install` → 弹窗点「安装」→ 装完重跑上面命令。
> 首次 push 会弹窗/提示输入 GitHub 用户名和密码（密码填 **Personal access token**，见 C.2 创建仓库页面提示）。

### C.4 触发云端打包

1. 浏览器打开 `https://github.com/你的用户名/LxMusicPlayer`
2. 顶部标签点 **Actions** → 左侧 **Build Unsigned IPA** → 右侧 **Run workflow** → 绿色按钮
3. 等 10~20 分钟（点进任务可看进度；页面刷新后 **Artifacts** 出现 zip）

### C.5 下载 IPA 并用小白签安装

1. 运行页底部 **Artifacts** → 下载 `LxMusicPlayer-unsigned-ipa.zip` → 解压得到 `LxMusicPlayer-unsigned.ipa`
2. AirDrop 发到 iPhone（苹果设备之间可用）→ 小白签 Pro 导入 → 选签名方式 → 签名 → 安装
3. iPhone「设置 → 通用 → VPN 与设备管理」→ 信任描述文件 → 打开使用

> 以后每次改代码：`git add . && git commit -m "更新" && git push`，再回 Actions 页点一次 Run workflow 即可。

***

## 第 0 步：把工程传到 Mac

在 **Windows** 上把工程打包（排除 `node_modules`，到 Mac 后重新安装更快）：



```
\# Windows PowerShell，在 LxMusicPlayer 的上一级目录执行

tar -a -c -f LxMusicPlayer.zip --exclude=node\_modules --exclude=build LxMusicPlayer
```

把 `LxMusicPlayer.zip` 传到 Mac（**AirDrop**、微信文件传输、iCloud 云盘、U 盘都行），然后：



```
\# Mac 终端（访达 → 应用程序 → 实用工具 → 终端）

cd \~/Downloads

unzip LxMusicPlayer.zip -d LxMusicPlayer

cd LxMusicPlayer
```

## 第 1 步：检查环境（只做一次）



```
\# 1. Xcode（必须完整版，命令行工具不够）

xcode-select -p

\# 若报错：去 App Store 安装 Xcode（体积大，首次启动等它初始化完）

\# 2. 首次使用 Xcode 命令行，接受许可（首次）

sudo xcodebuild -license accept

\# 3. Node（打包 JS 必需）

node -v

\# 若没有：brew install node，或去 nodejs.org 下载 LTS 版 pkg 安装

\# 4. CocoaPods（iOS 依赖管理）

pod --version

\# 若没有：sudo gem install cocoapods
```

> 国内网络可先加速：
>
> `npm config set registry https://registry.npmmirror.com`

## 第 2 步：安装依赖（首次，约几分钟）



```
cd \~/Downloads/LxMusicPlayer

npm install

cd ios

bundle install && bundle exec pod install

cd ..
```

> 若 
>
> `bundle`
>
>  不存在：直接 
>
> `pod install`
>
> 。若 pod 拉取慢，把 Podfile 第一行
> `source 'https://cdn.cocoapods.org/'`
>
>  换成 
>
> `source 'https://mirrors.tuna.tsinghua.edu.cn/git/CocoaPods/Specs.git'`
>
> 。



***

## 方式 A：Xcode 直接签名运行（最快，推荐）



1. 双击打开 `ios/LxMusicPlayer.xcworkspace`（注意是 **xcworkspace**）

2. Xcode 左侧点蓝色工程图标 → TARGETS → **LxMusicPlayer** → **Signing & Capabilities**

* 勾选 **Automatically manage signing**

* **Team** 选你自己的 Apple ID（Xcode → Settings → Accounts 先添加）

1. 顶部设备选择你的 iPhone（数据线连接，iPhone 上点「信任此电脑」）

2. 按 **Cmd + R** 编译运行

3. 首次安装后：iPhone「**设置 → 通用 → VPN 与设备管理**」→ 你的开发者证书 → **信任**

> 免费 Apple ID 签名 7 天有效，到期后重新插上电脑 Cmd+R 一次即续期。



***

## 方式 B：打包 IPA → 小白签 PRO 签名安装（你指定的方式）

### 3.1 在 Mac 上打包未签名 IPA



```
cd \~/Downloads/LxMusicPlayer

./scripts/build-ipa.sh
```

产物：`build/ipa/LxMusicPlayer-unsigned.ipa`（脚本会自动 npm install + pod install + 打包，前面第 2 步可跳过）。

### 3.2 传到 iPhone 并签名安装



1. 把 `LxMusicPlayer-unsigned.ipa` 传到 iPhone（**AirDrop** 或微信发送给自己）

2. iPhone 上用「文件」App 找到该文件 → 共享 → 用**小白签 Pro** 打开（或小白签 App 内「导入 IPA」）

3. 小白签里选择**签名方式**：

* **Apple ID 免费签名**：输入你的 Apple ID（可加多个账号轮流），7 天有效

* **小白签证书服务**（付费）：更稳定，一般 1 年

1. 点「**签名**」→ 签名完成点「**安装**」

2. 安装后：iPhone「**设置 → 通用 → VPN 与设备管理**」→ 信任对应描述文件

3. 桌面打开 **LxMusicPlayer** 使用

> 7 天到期：重开小白签 → 重新导入同一个 IPA → 再签一次即可，无需重新打包。



***

## 常见问题



| 问题                                     | 处理                                             |
| -------------------------------------- | ---------------------------------------------- |
| `xcode-select -p` 报错                   | App Store 装完整 Xcode；只装 Command Line Tools 不够打包 |
| `pod install` 报错 / 极慢                  | 换清华镜像源（见第 2 步）；或 `pod repo update` 后重试         |
| 报错 `React/RCTBridgeModule.h not found` | 没有先 `pod install`，回到第 2 步                      |
| Cmd+R 报签名错误                            | Team 没选或 Apple ID 未在 Xcode 添加；确认第 1 步          |
| iPhone 提示未受信任开发者                       | 「设置 → 通用 → VPN 与设备管理」信任证书                      |
| 免费签名到期打不开                              | 重签一次（方式 A：连电脑 Cmd+R；方式 B：小白签重签）                |
| App 内音源加载失败                            | 音源脚本依赖第三方服务可能失效，换其他音源（SixYin 需联网校验，属脚本行为）      |