#!/bin/bash

# MedFlow - Server Setup Script for Ubuntu/Debian
# Run this script on a fresh server to install all dependencies

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║            MedFlow Server Setup Script (Ubuntu/Debian)         ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo -e "${RED}Please don't run this script as root. Use a regular user with sudo.${NC}"
    exit 1
fi

# Update system
echo -e "${YELLOW}[1/8] Updating system packages...${NC}"
sudo apt update && sudo apt upgrade -y
echo -e "  ${GREEN}✓${NC} System updated"

# Install essential tools
echo ""
echo -e "${YELLOW}[2/8] Installing essential tools...${NC}"
sudo apt install -y build-essential git curl wget unzip software-properties-common
echo -e "  ${GREEN}✓${NC} Essential tools installed"

# Install Node.js 20.x
echo ""
echo -e "${YELLOW}[3/8] Installing Node.js 20.x...${NC}"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
echo -e "  Node.js version: $(node -v)"
echo -e "  npm version: $(npm -v)"
echo -e "  ${GREEN}✓${NC} Node.js installed"

# Install Python 3.11
echo ""
echo -e "${YELLOW}[4/8] Installing Python 3.11 and face_recognition dependencies...${NC}"
sudo apt install -y python3.11 python3.11-venv python3.11-dev python3-pip
sudo apt install -y cmake libopenblas-dev liblapack-dev libx11-dev libgtk-3-dev libboost-python-dev
echo -e "  Python version: $(python3.11 --version)"
echo -e "  ${GREEN}✓${NC} Python installed"

# Install MongoDB 7.0
echo ""
echo -e "${YELLOW}[5/8] Installing MongoDB 7.0...${NC}"
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
  sudo gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor 2>/dev/null || true
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
  https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | \
  sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl enable mongod
sudo systemctl start mongod
echo -e "  ${GREEN}✓${NC} MongoDB installed"

# Configure MongoDB Replica Set
echo ""
echo -e "${YELLOW}[6/8] Configuring MongoDB Replica Set...${NC}"
sudo tee -a /etc/mongod.conf > /dev/null << 'MONGO_CONF'

replication:
  replSetName: "rs0"
MONGO_CONF
sudo systemctl restart mongod
sleep 3
mongosh --quiet --eval "rs.initiate()" 2>/dev/null || echo "  (Replica set may already be initialized)"
echo -e "  ${GREEN}✓${NC} MongoDB replica set configured"

# Install Redis (optional but recommended)
echo ""
echo -e "${YELLOW}[7/8] Installing Redis...${NC}"
sudo apt install -y redis-server
sudo systemctl enable redis-server
sudo systemctl start redis-server
echo -e "  ${GREEN}✓${NC} Redis installed"

# Install PM2 for process management
echo ""
echo -e "${YELLOW}[8/8] Installing PM2 process manager...${NC}"
sudo npm install -g pm2
echo -e "  ${GREEN}✓${NC} PM2 installed"

# Summary
echo ""
echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                    Server Setup Complete!                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Installed:${NC}"
echo -e "  • Node.js $(node -v)"
echo -e "  • Python $(python3.11 --version | awk '{print $2}')"
echo -e "  • MongoDB 7.0 (with replica set)"
echo -e "  • Redis"
echo -e "  • PM2 process manager"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Clone your repository to /opt/medflow"
echo -e "  2. Copy .env files to backend/ and frontend/"
echo -e "  3. Run: cd /opt/medflow/backend && npm install"
echo -e "  4. Run: cd /opt/medflow/frontend && npm install && npm run build"
echo -e "  5. Setup face service: cd /opt/medflow/face-service"
echo -e "     python3.11 -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
echo -e "  6. Create admin: cd /opt/medflow/backend && node scripts/createAdminUser.js"
echo -e "  7. Seed data: npm run seed"
echo -e "  8. Start with PM2: pm2 start ecosystem.config.js"
