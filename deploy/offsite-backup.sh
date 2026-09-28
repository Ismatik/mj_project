#!/usr/bin/env bash
# Copies database dumps and uploaded photos off this machine (a dead disk must not take the salon's data with it).
# Needs rclone with a remote configured once:  rclone config   (e.g. Google Drive named "gdrive")
# Usage: deploy/offsite-backup.sh gdrive:mj-backups
set -euo pipefail
cd "$(dirname "$0")/.."
dest="${1:?usage: deploy/offsite-backup.sh <rclone-remote:folder>}"

# Uploaded photos (website, portfolio, private guest photos) out of the Docker volume
rm -rf backups/media && docker compose cp web:/app/media backups/media

# Database dumps are written daily by the "backup" service into ./backups
rclone copy backups "$dest" --transfers 4
echo "Off-site backup done: $(date '+%F %T') → $dest"
