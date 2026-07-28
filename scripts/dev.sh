#!/usr/bin/env bash
# 개발 서버 실행 헬퍼. Expo Go 앱으로 QR 스캔해서 접속한다(이 프로젝트는 dev build 없이도 동작).
#   ./scripts/dev.sh          # LAN 모드 — 폰과 PC가 같은 와이파이일 때
#   ./scripts/dev.sh tunnel   # 터널 모드 — LTE/다른 네트워크에서 접속(ngrok, 이미 설치됨)
#   ./scripts/dev.sh -c       # 캐시 비우고 시작 (--clear)
set -euo pipefail
cd "$(dirname "$0")/.."

# 1) .env 존재/채움 확인 — 없으면 supabase.ts가 앱 시작 시 throw 한다.
if [ ! -f .env ]; then
  echo "❌ .env 가 없습니다.  cp .env.example .env  후 값을 채우세요."
  exit 1
fi
if grep -q "여기에_anon\|xxxxxxxx\|<project-ref>" .env; then
  echo "❌ .env 의 ANON_KEY 가 아직 플레이스홀더입니다."
  echo "   Supabase 대시보드 → Settings → API → anon(publishable) 키로 교체하세요."
  exit 1
fi

# 2) 의존성 확인
if [ ! -d node_modules ]; then
  echo "📦 node_modules 없음 → npm install 먼저 실행합니다."
  npm install
fi

# 3) 모드 선택
MODE="lan"
EXTRA=()
for arg in "$@"; do
  case "$arg" in
    tunnel) MODE="tunnel" ;;
    -c|--clear) EXTRA+=("--clear") ;;
  esac
done

if [ "$MODE" = "tunnel" ]; then
  echo "🌐 터널 모드 (LTE/외부망) — Expo Go 로 QR 스캔"
  exec npx expo start --tunnel ${EXTRA[@]+"${EXTRA[@]}"}
else
  echo "📶 LAN 모드 (같은 와이파이) — Expo Go 로 QR 스캔"
  exec npx expo start ${EXTRA[@]+"${EXTRA[@]}"}
fi
