#!/usr/bin/env bash
set -u

# Run from this script's folder so relative paths always resolve
cd "$(dirname "$0")" || exit 1

# --- Configuration ---------------------------------------------------
# Override any of these with environment variables, e.g.
#   DB_PASS=secret ./backup.sh
MYSQLDUMP="${MYSQLDUMP:-mysqldump}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_NAME="${DB_NAME:-pupbc_carelink}"
DB_USER="${DB_USER:-root}"
DB_PASS="${DB_PASS:-}"
BACKUP_DIR="${BACKUP_DIR:-../backend/storage/backups}"
# ---------------------------------------------------------------------

echo "============================================"
echo " PUPBC CareLink - MariaDB Backup"
echo "============================================"

DATE=$(date +"%Y-%m-%d_%H%M%S")

mkdir -p "$BACKUP_DIR"

FILE="$BACKUP_DIR/pupbc_carelink_$DATE.sql"

echo "[$DATE] Backing up \"$DB_NAME\"..."

AUTH=()
if [ -n "$DB_PASS" ]; then
    AUTH+=("-p$DB_PASS")
fi

"$MYSQLDUMP" -h "$DB_HOST" -u "$DB_USER" ${AUTH[@]+"${AUTH[@]}"} \
    --single-transaction --routines --triggers --events \
    "$DB_NAME" > "$FILE"

if [ $? -eq 0 ]; then
    echo "[OK] Backup saved: $FILE"
    echo "[OK] Size: $(du -h "$FILE" | cut -f1)"
else
    echo "[ERROR] Backup failed! Is MariaDB running?"
    rm -f "$FILE"
fi

echo "============================================"
echo " Done!"
echo "============================================"
