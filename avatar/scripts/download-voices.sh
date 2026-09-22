#!/usr/bin/env bash
# Lädt Piper-Stimmen für DE/FR/IT nach $PIPER_VOICES_DIR (Standard: ./voices).
#
#   ./scripts/download-voices.sh            # medium-Qualität von Hugging Face (rhasspy/piper-voices)
#   ./scripts/download-voices.sh --github   # Fallback: ältere "low"-Stimmen aus GitHub-Releases
#                                           #   (wenn huggingface.co nicht erreichbar ist)
#
# Beide Quellen sind frei lizenziert (siehe MODEL_CARD je Stimme). Die Dateinamen
# werden von server/tts.py per Präfix (de*/fr*/it*.onnx) gefunden.
set -euo pipefail
DIR="${PIPER_VOICES_DIR:-$(dirname "$0")/../voices}"
mkdir -p "$DIR"

if [[ "${1:-}" == "--github" ]]; then
  BASE="https://github.com/rhasspy/piper/releases/download/v0.0.2"
  for v in voice-de-thorsten-low voice-fr-siwis-low voice-it-riccardo_fasol-x-low; do
    echo "→ $v"
    curl -fsSL "$BASE/$v.tar.gz" | tar xz -C "$DIR"
  done
else
  BASE="https://huggingface.co/rhasspy/piper-voices/resolve/main"
  fetch() { echo "→ $2"; curl -fsSL -o "$DIR/$2.onnx" "$BASE/$1/$2.onnx"; curl -fsSL -o "$DIR/$2.onnx.json" "$BASE/$1/$2.onnx.json"; }
  fetch de/de_DE/thorsten/medium de_DE-thorsten-medium
  fetch fr/fr_FR/siwis/medium    fr_FR-siwis-medium
  fetch it/it_IT/riccardo/x_low  it_IT-riccardo-x_low
fi
echo "Stimmen in $DIR:"; ls -1 "$DIR"/*.onnx
