#!/bin/bash

# Check if MongoDB is installed
if ! command -v mongod &> /dev/null; then
    echo "❌ MongoDB is not installed"
    exit 1
fi

echo "🚀 Starting MongoDB..."

# Create data directory if it doesn't exist
mkdir -p /opt/homebrew/var/mongodb

# Start MongoDB as a service
brew services start mongodb-community@7.0

# Wait for MongoDB to be ready
echo "⏳ Waiting for MongoDB to be ready..."
for i in {1..30}; do
    if mongosh --eval "db.adminCommand('ping')" &> /dev/null; then
        echo "✅ MongoDB is running and ready!"
        echo "📊 MongoDB status:"
        brew services list | grep mongodb
        exit 0
    fi
    echo -n "."
    sleep 1
done

echo ""
echo "❌ MongoDB failed to start within 30 seconds"
exit 1