#!/bin/bash

echo "=========================================="
echo "Quick MongoDB Replica Set Setup"
echo "=========================================="
echo ""

# Use a directory in user home
MONGODB_PATH="$HOME/mongodb-replica"
echo "Creating MongoDB data directory at $MONGODB_PATH..."
mkdir -p $MONGODB_PATH

# Kill any existing MongoDB
echo "Stopping any existing MongoDB..."
pkill -f mongod || true
sleep 2

# Start MongoDB as replica set (without forking for now)
echo "Starting MongoDB as replica set..."
echo ""
echo "Run this in a new terminal:"
echo "----------------------------------------"
echo "mongod --replSet rs0 --dbpath $MONGODB_PATH --port 27017"
echo "----------------------------------------"
echo ""
echo "Then in another terminal, run:"
echo "----------------------------------------"
echo "mongosh"
echo "rs.initiate()"
echo "----------------------------------------"
echo ""
echo "After that, update your .env file to use:"
echo "MONGODB_URI=mongodb://localhost:27017/medflow?replicaSet=rs0"
echo ""