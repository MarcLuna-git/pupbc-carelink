#!/bin/bash

echo "============================================"
echo " PUPBC CareLink - Database Backup"
echo "============================================"

DATE=$(date +"%Y-%m-%d_%H%M%S")
BACKUP_DIR="../backend/storage/backups"

mkdir -p $BACKUP_DIR

FILE="$BACKUP_DIR/pupbc_backup_$DATE.sql"

echo "[$DATE] Starting backup..."
mysqldump -u root pupbc_carelink_v3 > "$FILE"

if [ $? -eq 0 ]; then
    echo "[OK] Backup saved: $FILE"
    echo "[OK] Size: $(du -h "$FILE" | cut -f1)"
else
    echo "[ERROR] Backup failed!"
fi

echo "============================================"
echo " Done!"
echo "============================================"