# AGENTS.md

## 版本号规范（用户明确要求）

- **每次发布新版本（推送代码给用户构建）前，必须递增版本号**，禁止连续两次推送相同版本。
- 版本号同步更新三处，保持 iOS 展示版本一致：
  1. `ios/LxMusicPlayer.xcodeproj/project.pbxproj`：`MARKETING_VERSION`（展示版本，如 1.1 → 1.2）与 `CURRENT_PROJECT_VERSION`（构建号，整数递增，如 2 → 3）
  2. `package.json`：`version`（与 MARKETING_VERSION 一致，如 1.1.0 → 1.2.0）
  3. `android/app/build.gradle`：`versionName`（同 MARKETING_VERSION）与 `versionCode`（同构建号）
- 递增幅度：普通修复/小改 → 次版本 +1（1.1 → 1.2）；大版本重构 → 主版本 +1。
