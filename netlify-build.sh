#!/usr/bin/env bash
set -euo pipefail

# Netlify build-time version bump
# - Updates app-version.json every deploy
# - Updates FALLBACK_VERSION inside all *.html so the very first paint also uses the latest version

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

UTC_TS="$(date -u +%Y%m%d%H%M%S)"
SHORT_SHA=""

# Netlify provides COMMIT_REF; fall back to git if available.
if [[ -n "${COMMIT_REF:-}" ]]; then
  SHORT_SHA="${COMMIT_REF:0:7}"
elif command -v git >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  SHORT_SHA="$(git rev-parse --short HEAD 2>/dev/null || true)"
fi

if [[ -n "$SHORT_SHA" ]]; then
  VERSION="${UTC_TS}-${SHORT_SHA}"
else
  VERSION="${UTC_TS}"
fi

printf '{\n  "version": "%s"\n}\n' "$VERSION" > app-version.json

# Update fallback version in every HTML file that has the version bootstrap.
for f in *.html; do
  [[ -f "$f" ]] || continue
  if grep -q 'const FALLBACK_VERSION' "$f"; then
    # Replace only the value between quotes.
    # IMPORTANT: use ${1}/${2} to avoid Perl interpreting "$1<digits>" as "$12" etc.
    perl -0777 -i -pe 's/(const\s+FALLBACK_VERSION\s*=\s*")[^"]*(";)/${1}'"$VERSION"'${2}/g' "$f"
  fi
done

echo "[netlify-build] bumped version => $VERSION"
