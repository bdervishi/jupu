#!/usr/bin/env bash
#
# lift-out.sh — extrahiert advoos-mvp/ aus dem SwissBrokerOS-Repo in ein eigenes
# Repo (bdervishi/advoos) MIT Git-Historie (git subtree split) und pusht es.
#
# LOKAL beim Nutzer ausführen (diese Session darf nicht nach bdervishi/advoos pushen).
#
# Voraussetzung: leeres Repo bdervishi/advoos existiert bereits auf GitHub.
#
# Nutzung:
#   1) Aus einem SwissBrokerOS-Checkout heraus ausführen:
#        bash advoos-mvp/scripts/lift-out.sh
#   2) Ziel-URL/Branch ggf. per Env überschreiben:
#        ADVOOS_REMOTE=git@github.com:bdervishi/advoos.git bash advoos-mvp/scripts/lift-out.sh
#
set -euo pipefail

PREFIX="advoos-mvp"
REMOTE="${ADVOOS_REMOTE:-https://github.com/bdervishi/advoos.git}"
TARGET_BRANCH="${ADVOOS_BRANCH:-main}"
SPLIT_BRANCH="advoos-split-$$"

# In den Repo-Wurzelordner wechseln (Script kann von überall aufgerufen werden).
REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

if [ ! -d "$PREFIX" ]; then
  echo "FEHLER: Ordner '$PREFIX' nicht gefunden. Bitte im SwissBrokerOS-Repo ausführen." >&2
  exit 1
fi

echo "→ Erzeuge Historien-Split von '$PREFIX/' ..."
git subtree split --prefix="$PREFIX" -b "$SPLIT_BRANCH"

echo "→ Pushe nach $REMOTE ($TARGET_BRANCH) ..."
git push "$REMOTE" "$SPLIT_BRANCH:$TARGET_BRANCH"

echo "→ Aufräumen ..."
git branch -D "$SPLIT_BRANCH"

echo ""
echo "✓ Fertig. advoos-mvp/ liegt jetzt als Wurzel in: $REMOTE ($TARGET_BRANCH)"
echo "  Nächster Schritt: auf vercel.com das Repo bdervishi/advoos importieren"
echo "  (Root Directory = '.', Framework = Vite). Details: advoos-mvp/DEPLOY.md"
