#!/bin/bash

echo "=========================================="
echo "MongoDB Replica Set Setup for CareVision"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}This script will configure MongoDB as a replica set to enable transactions${NC}"
echo ""

# Step 1: Check if MongoDB is installed
if ! command -v mongod &> /dev/null; then
    echo -e "${RED}MongoDB is not installed. Please install it first.${NC}"
    echo "Run: brew install mongodb-community"
    exit 1
fi

# Step 2: Stop any running MongoDB instances
echo "1. Stopping any running MongoDB instances..."
brew services stop mongodb-community 2>/dev/null || true
pkill -f mongod 2>/dev/null || true
sleep 2

# Step 3: Create data directory if it doesn't exist
MONGODB_PATH="/usr/local/var/mongodb-rs"
echo "2. Creating MongoDB replica set data directory at $MONGODB_PATH..."
mkdir -p $MONGODB_PATH

# Step 4: Start MongoDB as a replica set
echo "3. Starting MongoDB as replica set 'rs0'..."
mongod --replSet rs0 --dbpath $MONGODB_PATH --port 27017 --bind_ip localhost --fork --logpath $MONGODB_PATH/mongod.log

# Give MongoDB time to start
echo "   Waiting for MongoDB to start..."
sleep 5

# Step 5: Initialize the replica set
echo "4. Initializing replica set..."
mongosh --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: 'localhost:27017'}]})" 2>/dev/null

# Check if initialization was successful
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Replica set initialized successfully!${NC}"
else
    echo -e "${YELLOW}⚠️  Replica set might already be initialized${NC}"
fi

# Step 6: Wait for replica set to become primary
echo "5. Waiting for replica set to elect primary..."
sleep 5

# Verify replica set status
echo "6. Verifying replica set status..."
mongosh --eval "rs.status().members[0].stateStr" 2>/dev/null

echo ""
echo -e "${GREEN}=========================================="
echo "✅ MongoDB Replica Set Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "MongoDB is now running as a replica set on port 27017"
echo "Your application can now use transactions!"
echo ""
echo "To connect via mongosh: mongosh mongodb://localhost:27017/?replicaSet=rs0"
echo ""
echo -e "${YELLOW}Note: Your data directory is now at: $MONGODB_PATH${NC}"
echo -e "${YELLOW}Logs are at: $MONGODB_PATH/mongod.log${NC}"
echo ""
echo "To stop MongoDB replica set later:"
echo "  pkill -f 'mongod.*--replSet'"
echo ""
echo "To restart MongoDB replica set:"
echo "  mongod --replSet rs0 --dbpath $MONGODB_PATH --port 27017 --bind_ip localhost --fork --logpath $MONGODB_PATH/mongod.log"