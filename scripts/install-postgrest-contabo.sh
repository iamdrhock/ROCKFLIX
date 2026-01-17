#!/bin/bash
# Install PostgREST on Contabo PostgreSQL Server

set -e

echo "🚀 Installing PostgREST on Contabo..."

# Install PostgREST
cd /tmp
wget https://github.com/PostgREST/postgrest/releases/download/v12.2.2/postgrest-v12.2.2-linux-static-x64.tar.xz
tar xf postgrest-v12.2.2-linux-static-x64.tar.xz
mv postgrest /usr/local/bin/
chmod +x /usr/local/bin/postgrest

# Verify installation
postgrest --version

echo "✅ PostgREST installed successfully"

# Create PostgREST config file
cat > /etc/postgrest.conf << 'EOF'
db-uri = "postgresql://postgres:x70wIAAISfu4pqmo@localhost:5432/postgres"
db-schema = "public"
db-anon-role = "postgres"
db-pool = 10
server-port = 3000
server-host = "0.0.0.0"
# JWT secret (you can generate a secure one: openssl rand -base64 32)
jwt-secret = "your-super-secret-jwt-token-change-this-to-at-least-32-characters-long-string"
EOF

echo "✅ PostgREST config created"

# Create systemd service
cat > /etc/systemd/system/postgrest.service << 'EOF'
[Unit]
Description=PostgREST API Server
After=postgresql.service
Requires=postgresql.service

[Service]
ExecStart=/usr/local/bin/postgrest /etc/postgrest.conf
Restart=always
RestartSec=5
User=postgres
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "✅ Systemd service created"

# Reload systemd
systemctl daemon-reload

# Enable PostgREST
systemctl enable postgrest

# Start PostgREST
systemctl start postgrest

# Check status
sleep 2
systemctl status postgrest --no-pager

# Open firewall port
ufw allow 3000/tcp

echo ""
echo "✅ PostgREST installation complete!"
echo ""
echo "📋 Next steps:"
echo "1. Test PostgREST: curl http://localhost:3000/"
echo "2. Update environment variables on VPS"
echo "3. Rebuild and restart the application"
echo ""
echo "⚠️  IMPORTANT: Update JWT secret in /etc/postgrest.conf before production use!"

