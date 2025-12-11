#!/bin/bash

# Backup script before migration
# This creates a full dump of the visits collection

BACKUP_DIR="/Users/xtm888/magloire/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/visits_backup_${TIMESTAMP}.json"

echo "=== DATABASE BACKUP SCRIPT ==="
echo "Timestamp: ${TIMESTAMP}"
echo ""

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Backup visits collection
echo "Backing up visits collection..."
mongosh medflow --quiet --eval "
  const visits = db.visits.find({}).toArray();
  print(JSON.stringify(visits, null, 2));
" > "${BACKUP_FILE}"

# Check if backup succeeded
if [ -f "${BACKUP_FILE}" ]; then
  FILE_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
  VISIT_COUNT=$(mongosh medflow --quiet --eval "db.visits.countDocuments({})")

  echo "✅ Backup completed successfully!"
  echo "   File: ${BACKUP_FILE}"
  echo "   Size: ${FILE_SIZE}"
  echo "   Visits backed up: ${VISIT_COUNT}"
  echo ""
  echo "To restore from this backup:"
  echo "  mongoimport --db medflow --collection visits --drop --file ${BACKUP_FILE}"
else
  echo "❌ Backup failed!"
  exit 1
fi
