#!/usr/bin/env bash
# Back up a folder to a dated archive and keep only the newest few.
set -euo pipefail

SOURCE="${1:-$HOME/Documents}"
DEST="${BACKUP_DIR:-/mnt/backup}"
KEEP=7
STAMP=$(date +%Y-%m-%d)

log() {
  echo "[$(date +%H:%M:%S)] $*" >&2
}

check_space() {
  local free
  free=$(df --output=avail "$DEST" | tail -n 1)
  if [ "$free" -lt 1048576 ]; then
    log "Less than 1 GB free on $DEST"
    return 1
  fi
}

prune() {
  local count=0
  for archive in $(ls -1t "$DEST"/backup-*.tar.gz); do
    count=$((count + 1))
    if [ "$count" -gt "$KEEP" ]; then
      log "Removing $archive"
      rm -f "$archive"
    fi
  done
}

if [ ! -d "$SOURCE" ]; then
  log "No such folder: $SOURCE"
  exit 1
fi

mkdir -p "$DEST"
check_space || exit 2

ARCHIVE="$DEST/backup-$STAMP.tar.gz"
log "Backing up $SOURCE to $ARCHIVE"
tar -czf "$ARCHIVE" -C "$(dirname "$SOURCE")" "$(basename "$SOURCE")"
du -h "$ARCHIVE" | cut -f1 | xargs -I{} echo "Archive size: {}"

prune
case "${2:-}" in
  --verify) tar -tzf "$ARCHIVE" > /dev/null && log "Archive checked" ;;
  *) log "Done" ;;
esac
