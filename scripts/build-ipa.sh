#!/usr/bin/env bash
# ============================================================
# LxMusicPlayer 一键打包脚本 —— 产出「未签名 IPA」
# 用途：供小白签 PRO / 爱思助手等签名工具重签名安装到 iPhone/iPad
# 环境：macOS + Xcode（含 Command Line Tools）+ CocoaPods
# 用法：在工程根目录执行  ./scripts/build-ipa.sh
# 产物：build/ipa/LxMusicPlayer-unsigned.ipa
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> [1/4] 安装 Node 依赖"
npm install

echo "==> [2/4] 安装 iOS 原生依赖 (CocoaPods)"
cd ios
if command -v bundle >/dev/null 2>&1 && [ -f ../Gemfile ]; then
  bundle install
  bundle exec pod install
else
  pod install
fi
cd ..

OUT="build/ipa"
ARCHIVE="build/LxMusicPlayer.xcarchive"
rm -rf build
mkdir -p "$OUT"

echo "==> [3/4] xcodebuild archive（跳过代码签名）"
xcodebuild archive \
  -workspace ios/LxMusicPlayer.xcworkspace \
  -scheme LxMusicPlayer \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath "$ARCHIVE" \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  -quiet

APP_DIR="$ARCHIVE/Products/Applications/LxMusicPlayer.app"
if [ ! -d "$APP_DIR" ]; then
  echo "错误：未找到已构建的 App（$APP_DIR），请检查 xcodebuild 输出"
  exit 1
fi

echo "==> [4/4] 构造 IPA（Payload/LxMusicPlayer.app）"
PAYLOAD="$OUT/Payload"
rm -rf "$PAYLOAD"
mkdir -p "$PAYLOAD"
cp -R "$APP_DIR" "$PAYLOAD/"
cd "$OUT"
zip -qr "LxMusicPlayer-unsigned.ipa" Payload
cd ../..

echo ""
echo "======================================================"
echo " 打包完成：build/ipa/LxMusicPlayer-unsigned.ipa"
echo " 该 IPA 未签名，请用小白签 PRO 导入后签名安装："
echo "   小白签 Pro → 签名 → 导入本 IPA → 选择签名方式 → 安装"
echo "======================================================"
