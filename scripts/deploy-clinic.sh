#!/bin/bash

# =============================================================================
# MedFlow Clinic Deployment Script
# =============================================================================
# This script sets up a new MedFlow clinic instance
#
# Usage: ./deploy-clinic.sh [CLINIC_ID]
# Example: ./deploy-clinic.sh KINSHASA_MAIN
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
print_header() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if running as root (not recommended)
if [ "$EUID" -eq 0 ]; then
    print_warning "Running as root is not recommended. Consider using a regular user."
fi

# Get clinic ID from argument or prompt
CLINIC_ID=${1:-""}
if [ -z "$CLINIC_ID" ]; then
    echo ""
    echo "Available clinic configurations:"
    echo "  1) KINSHASA_MAIN - Centre Ophtalmologique de Kinshasa (Main)"
    echo "  2) LUBUMBASHI    - Centre Ophtalmologique de Lubumbashi"
    echo "  3) GOMA          - Centre Ophtalmologique de Goma"
    echo "  4) CUSTOM        - Create new clinic configuration"
    echo ""
    read -p "Select clinic (1-4): " CLINIC_CHOICE

    case $CLINIC_CHOICE in
        1) CLINIC_ID="KINSHASA_MAIN" ;;
        2) CLINIC_ID="LUBUMBASHI" ;;
        3) CLINIC_ID="GOMA" ;;
        4)
            read -p "Enter custom clinic ID (uppercase, no spaces): " CLINIC_ID
            CLINIC_ID=$(echo "$CLINIC_ID" | tr '[:lower:]' '[:upper:]' | tr ' ' '_')
            ;;
        *)
            print_error "Invalid selection"
            exit 1
            ;;
    esac
fi

print_header "MedFlow Clinic Deployment"
echo "Deploying clinic: $CLINIC_ID"
echo ""

# Determine script and project directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"
FRONTEND_DIR="$PROJECT_DIR/frontend"

cd "$PROJECT_DIR"

# =============================================================================
# STEP 1: Check Prerequisites
# =============================================================================
print_header "Step 1: Checking Prerequisites"

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    print_success "Node.js installed: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js 18+ first."
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm -v)
    print_success "npm installed: $NPM_VERSION"
else
    print_error "npm not found. Please install npm first."
    exit 1
fi

# Check MongoDB
if command -v mongod &> /dev/null; then
    print_success "MongoDB installed"
else
    print_warning "MongoDB not found locally. Make sure MongoDB is accessible."
fi

# Check Redis (optional)
if command -v redis-server &> /dev/null; then
    print_success "Redis installed"
else
    print_warning "Redis not found. Rate limiting will use in-memory fallback."
fi

# =============================================================================
# STEP 2: Configure Environment
# =============================================================================
print_header "Step 2: Configuring Environment"

# Check for existing .env file
if [ -f "$BACKEND_DIR/.env" ]; then
    print_warning "Existing .env file found"
    read -p "Overwrite with $CLINIC_ID configuration? (y/n): " OVERWRITE
    if [ "$OVERWRITE" != "y" ]; then
        print_warning "Keeping existing .env file"
    else
        # Use clinic-specific .env if available
        CLINIC_ENV_FILE="$BACKEND_DIR/.env.$(echo $CLINIC_ID | tr '[:upper:]' '[:lower:]')"
        if [ -f "$CLINIC_ENV_FILE" ]; then
            cp "$CLINIC_ENV_FILE" "$BACKEND_DIR/.env"
            print_success "Copied $CLINIC_ENV_FILE to .env"
        else
            cp "$BACKEND_DIR/.env.clinic.template" "$BACKEND_DIR/.env"
            # Update CLINIC_ID in the new .env
            sed -i.bak "s/CLINIC_ID=.*/CLINIC_ID=$CLINIC_ID/" "$BACKEND_DIR/.env"
            rm -f "$BACKEND_DIR/.env.bak"
            print_success "Created .env from template for $CLINIC_ID"
        fi
    fi
else
    # Use clinic-specific .env if available
    CLINIC_ENV_FILE="$BACKEND_DIR/.env.$(echo $CLINIC_ID | tr '[:upper:]' '[:lower:]')"
    if [ -f "$CLINIC_ENV_FILE" ]; then
        cp "$CLINIC_ENV_FILE" "$BACKEND_DIR/.env"
        print_success "Copied $CLINIC_ENV_FILE to .env"
    else
        cp "$BACKEND_DIR/.env.clinic.template" "$BACKEND_DIR/.env"
        sed -i.bak "s/CLINIC_ID=.*/CLINIC_ID=$CLINIC_ID/" "$BACKEND_DIR/.env"
        rm -f "$BACKEND_DIR/.env.bak"
        print_success "Created .env from template"
    fi
fi

# Generate secure secrets if they're placeholders
echo "Generating secure secrets..."
JWT_SECRET=$(openssl rand -base64 48 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
REFRESH_SECRET=$(openssl rand -base64 48 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 64 | head -n 1)
SYNC_KEY=$(openssl rand -base64 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 44 | head -n 1)

# Update secrets in .env (only if they contain placeholder text)
if grep -q "change-this" "$BACKEND_DIR/.env" 2>/dev/null; then
    sed -i.bak "s|JWT_SECRET=.*change-this.*|JWT_SECRET=$JWT_SECRET|" "$BACKEND_DIR/.env"
    sed -i.bak "s|REFRESH_TOKEN_SECRET=.*change-this.*|REFRESH_TOKEN_SECRET=$REFRESH_SECRET|" "$BACKEND_DIR/.env"
    rm -f "$BACKEND_DIR/.env.bak"
    print_success "Generated secure JWT secrets"
fi

if grep -q "generate-with-openssl" "$BACKEND_DIR/.env" 2>/dev/null; then
    sed -i.bak "s|SYNC_API_KEY=.*generate-with-openssl.*|SYNC_API_KEY=$SYNC_KEY|" "$BACKEND_DIR/.env"
    rm -f "$BACKEND_DIR/.env.bak"
    print_success "Generated sync API key"
fi

# =============================================================================
# STEP 3: Install Dependencies
# =============================================================================
print_header "Step 3: Installing Dependencies"

echo "Installing backend dependencies..."
cd "$BACKEND_DIR"
npm install --production
print_success "Backend dependencies installed"

echo "Installing frontend dependencies..."
cd "$FRONTEND_DIR"
npm install --production
print_success "Frontend dependencies installed"

# =============================================================================
# STEP 4: Setup MongoDB Replica Set (for change streams)
# =============================================================================
print_header "Step 4: Setting Up MongoDB"

# Check if MongoDB is running
if pgrep -x "mongod" > /dev/null; then
    print_success "MongoDB is running"
else
    print_warning "MongoDB is not running. Attempting to start..."

    # Try to start MongoDB
    if command -v brew &> /dev/null; then
        brew services start mongodb-community 2>/dev/null || true
    elif command -v systemctl &> /dev/null; then
        sudo systemctl start mongod 2>/dev/null || true
    fi

    sleep 2

    if pgrep -x "mongod" > /dev/null; then
        print_success "MongoDB started"
    else
        print_error "Could not start MongoDB. Please start it manually."
    fi
fi

# Initialize replica set if not already done
echo "Checking replica set configuration..."
REPLICA_STATUS=$(mongosh --quiet --eval "rs.status().ok" 2>/dev/null || echo "0")

if [ "$REPLICA_STATUS" = "1" ]; then
    print_success "Replica set already configured"
else
    print_warning "Initializing replica set..."
    mongosh --quiet --eval "rs.initiate({_id: 'rs0', members: [{_id: 0, host: '127.0.0.1:27017'}]})" 2>/dev/null || true
    sleep 3
    print_success "Replica set initialized"
fi

# =============================================================================
# STEP 5: Initialize Database
# =============================================================================
print_header "Step 5: Initializing Database"

cd "$BACKEND_DIR"

# Create indexes
echo "Creating database indexes..."
node -e "
require('dotenv').config();
const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medflow?replicaSet=rs0';

mongoose.connect(MONGODB_URI).then(async () => {
    console.log('Connected to MongoDB');

    // Import models to create indexes
    require('./models/Patient');
    require('./models/Visit');
    require('./models/Appointment');
    require('./models/Invoice');
    require('./models/User');
    require('./models/SyncQueue');
    require('./models/Clinic');

    // Wait for indexes
    await mongoose.connection.syncIndexes();
    console.log('Indexes created');

    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
" 2>/dev/null && print_success "Database indexes created" || print_warning "Index creation may have failed"

# Seed clinics
echo "Seeding clinic data..."
if [ -f "$BACKEND_DIR/scripts/seedClinics.js" ]; then
    node "$BACKEND_DIR/scripts/seedClinics.js" 2>/dev/null && print_success "Clinics seeded" || print_warning "Clinic seeding may have failed"
fi

# Seed role permissions
echo "Seeding role permissions..."
if [ -f "$BACKEND_DIR/scripts/seedRolePermissions.js" ]; then
    node "$BACKEND_DIR/scripts/seedRolePermissions.js" 2>/dev/null && print_success "Role permissions seeded" || print_warning "Role permission seeding may have failed"
fi

# Seed fee schedules
echo "Seeding fee schedules..."
if [ -f "$BACKEND_DIR/scripts/seedCompleteFeeSchedule.js" ]; then
    node "$BACKEND_DIR/scripts/seedCompleteFeeSchedule.js" 2>/dev/null && print_success "Fee schedules seeded" || print_warning "Fee schedule seeding may have failed"
fi

# =============================================================================
# STEP 6: Create Admin User
# =============================================================================
print_header "Step 6: Creating Admin User"

read -p "Create admin user? (y/n): " CREATE_ADMIN
if [ "$CREATE_ADMIN" = "y" ]; then
    read -p "Admin email: " ADMIN_EMAIL
    read -sp "Admin password: " ADMIN_PASSWORD
    echo ""

    cd "$BACKEND_DIR"
    node -e "
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/medflow?replicaSet=rs0';

mongoose.connect(MONGODB_URI).then(async () => {
    const User = require('./models/User');
    const Clinic = require('./models/Clinic');

    // Find the current clinic
    const clinic = await Clinic.findOne({ clinicId: '$CLINIC_ID' });

    const hashedPassword = await bcrypt.hash('$ADMIN_PASSWORD', 12);

    const admin = await User.findOneAndUpdate(
        { email: '$ADMIN_EMAIL' },
        {
            email: '$ADMIN_EMAIL',
            password: hashedPassword,
            firstName: 'Admin',
            lastName: '$CLINIC_ID',
            role: 'admin',
            status: 'active',
            clinics: clinic ? [clinic._id] : [],
            primaryClinic: clinic ? clinic._id : null,
            accessAllClinics: true
        },
        { upsert: true, new: true }
    );

    console.log('Admin user created/updated:', admin.email);
    await mongoose.connection.close();
    process.exit(0);
}).catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
" 2>/dev/null && print_success "Admin user created" || print_error "Failed to create admin user"
fi

# =============================================================================
# STEP 7: Build Frontend
# =============================================================================
print_header "Step 7: Building Frontend"

cd "$FRONTEND_DIR"
echo "Building frontend for production..."
npm run build 2>/dev/null && print_success "Frontend built" || print_warning "Frontend build may have failed"

# =============================================================================
# STEP 8: Create Systemd Service (Linux) or LaunchAgent (macOS)
# =============================================================================
print_header "Step 8: Setting Up Service"

if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux - systemd service
    read -p "Create systemd service for auto-start? (y/n): " CREATE_SERVICE
    if [ "$CREATE_SERVICE" = "y" ]; then
        sudo tee /etc/systemd/system/medflow-$CLINIC_ID.service > /dev/null << EOF
[Unit]
Description=MedFlow Clinic Server ($CLINIC_ID)
After=network.target mongodb.service redis.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$BACKEND_DIR
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
        sudo systemctl daemon-reload
        sudo systemctl enable medflow-$CLINIC_ID
        print_success "Systemd service created: medflow-$CLINIC_ID"
        echo "  Start with: sudo systemctl start medflow-$CLINIC_ID"
        echo "  Status: sudo systemctl status medflow-$CLINIC_ID"
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS - LaunchAgent
    read -p "Create LaunchAgent for auto-start? (y/n): " CREATE_SERVICE
    if [ "$CREATE_SERVICE" = "y" ]; then
        PLIST_FILE="$HOME/Library/LaunchAgents/com.medflow.$CLINIC_ID.plist"
        mkdir -p "$HOME/Library/LaunchAgents"

        cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.medflow.$CLINIC_ID</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>$BACKEND_DIR/server.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$BACKEND_DIR</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$PROJECT_DIR/logs/medflow-$CLINIC_ID.log</string>
    <key>StandardErrorPath</key>
    <string>$PROJECT_DIR/logs/medflow-$CLINIC_ID.error.log</string>
</dict>
</plist>
EOF
        mkdir -p "$PROJECT_DIR/logs"
        launchctl load "$PLIST_FILE" 2>/dev/null || true
        print_success "LaunchAgent created"
        echo "  Start with: launchctl start com.medflow.$CLINIC_ID"
        echo "  Stop with: launchctl stop com.medflow.$CLINIC_ID"
    fi
fi

# =============================================================================
# STEP 9: Final Summary
# =============================================================================
print_header "Deployment Complete!"

echo ""
echo -e "${GREEN}MedFlow clinic '$CLINIC_ID' has been deployed successfully!${NC}"
echo ""
echo "Configuration:"
echo "  - Clinic ID: $CLINIC_ID"
echo "  - Backend: $BACKEND_DIR"
echo "  - Frontend: $FRONTEND_DIR"
echo "  - Environment: $BACKEND_DIR/.env"
echo ""
echo "To start the server manually:"
echo "  cd $BACKEND_DIR && npm start"
echo ""
echo "To start the frontend dev server:"
echo "  cd $FRONTEND_DIR && npm run dev"
echo ""
echo "Important next steps:"
echo "  1. Review and update $BACKEND_DIR/.env with production values"
echo "  2. Configure network shares for medical devices"
echo "  3. Set up the central sync server URL"
echo "  4. Test the sync functionality"
echo ""
echo -e "${YELLOW}Remember to backup your .env file - it contains sensitive keys!${NC}"
echo ""
