#!/usr/bin/env bash
# Cria uma release no GitHub anexando o APK como asset (como no CoMentor).
# Uso: ./scripts/release.sh <versao> <caminho-do-apk> [<notas>]
#   ./scripts/release.sh 1.0.0 ./builds/aspis-1.0.0.apk "Primeira versão"

set -euo pipefail

VERSION="${1:-}"
APK_PATH="${2:-}"
NOTES="${3:-Veja o histórico de commits para detalhes.}"

if [[ -z "$VERSION" || -z "$APK_PATH" ]]; then
  echo "Uso: $0 <versao> <caminho-do-apk> [<notas>]"
  exit 1
fi

if [[ ! -f "$APK_PATH" ]]; then
  echo "Erro: APK não encontrado em $APK_PATH"
  exit 1
fi

TAG="v${VERSION#v}"

APP_JSON_VERSION=$(grep '"version"' app.json | head -1 | sed 's/.*"version": *"\([^"]*\)".*/\1/')
if [[ "$APP_JSON_VERSION" != "${VERSION#v}" ]]; then
  echo "Aviso: app.json tem versão '$APP_JSON_VERSION', mas você está releasando '${VERSION#v}'."
  read -p "Continuar mesmo assim? [y/N] " -n 1 -r
  echo
  [[ $REPLY =~ ^[Yy]$ ]] || exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag $TAG já existe."
else
  git tag -a "$TAG" -m "Release $TAG"
  git -c http.sslCAInfo=/etc/ssl/cert.pem push origin "$TAG"
fi

gh release create "$TAG" \
  --title "Aspis $TAG" \
  --notes "$NOTES" \
  "$APK_PATH#aspis-${VERSION#v}.apk"

echo
echo "✓ Release $TAG publicada com APK anexado."
