# Fix Contabo Database Connection - Step by Step

Your connection is being **refused**. This means PostgreSQL needs to be configured to accept remote connections.

---

## Step 1: Check PostgreSQL Status (On Contabo Server)

**SSH into your Contabo server (`45.130.104.103`):**

```bash
ssh root@45.130.104.103
# (or use your actual username)

# Check if PostgreSQL is running
sudo systemctl status postgresql

# Check PostgreSQL version
sudo -u postgres psql --version

# Test local connection (should work)
sudo -u postgres psql -c "SELECT version();"
```

---

## Step 2: Find PostgreSQL Configuration Files

```bash
# Find postgresql.conf location
sudo -u postgres psql -c "SHOW config_file;"

# Find pg_hba.conf location
sudo -u postgres psql -c "SHOW hba_file;"

# Check current listen_addresses setting
sudo -u postgres psql -c "SHOW listen_addresses;"

# Check current port
sudo -u postgres psql -c "SHOW port;"
```

---

## Step 3: Enable Remote Connections (Fix postgresql.conf)

**Edit `postgresql.conf` to listen on all interfaces:**

```bash
# Get config file path
CONFIG_FILE=$(sudo -u postgres psql -t -c "SHOW config_file;" | xargs)
echo "Config file: $CONFIG_FILE"

# Backup config file
sudo cp "$CONFIG_FILE" "$CONFIG_FILE.backup"

# Edit config file
sudo nano "$CONFIG_FILE"
```

**Find and change this line:**
```
# listen_addresses = 'localhost'     # what IP address(es) to listen on;
```

**Change to:**
```
listen_addresses = '*'               # what IP address(es) to listen on;
```

**OR, if the line doesn't exist, add it:**
```
listen_addresses = '*'
```

**Save and exit:** `Ctrl+X`, `Y`, `Enter`

---

## Step 4: Allow VPS IP in pg_hba.conf

**Edit `pg_hba.conf` to allow your VPS IP:**

```bash
# Get pg_hba.conf file path
HBA_FILE=$(sudo -u postgres psql -t -c "SHOW hba_file;" | xargs)
echo "HBA file: $HBA_FILE"

# Backup HBA file
sudo cp "$HBA_FILE" "$HBA_FILE.backup"

# View current entries
sudo cat "$HBA_FILE" | grep -v "^#" | grep -v "^$"

# Edit HBA file
sudo nano "$HBA_FILE"
```

**Add this line AFTER the localhost entries (usually near the top):**
```
# Allow VPS to connect
host    all             all             103.217.252.147/32       md5
```

**OR, to allow all IPs (less secure but easier):**
```
# Allow all IPs
host    all             all             0.0.0.0/0                md5
```

**Save and exit:** `Ctrl+X`, `Y`, `Enter`

---

## Step 5: Restart PostgreSQL

```bash
# Restart PostgreSQL to apply changes
sudo systemctl restart postgresql

# OR if that doesn't work:
sudo service postgresql restart

# Verify it's running
sudo systemctl status postgresql

# Check it's listening on all interfaces
sudo netstat -tlnp | grep 5432
# OR
sudo ss -tlnp | grep 5432
```

**Expected output should show:**
```
tcp  0  0  0.0.0.0:5432  0.0.0.0:*  LISTEN  ...
```

NOT just:
```
tcp  0  0  127.0.0.1:5432  0.0.0.0:*  LISTEN  ...
```

---

## Step 6: Check Firewall (If Still Blocked)

```bash
# Check UFW status
sudo ufw status

# If UFW is active, allow PostgreSQL port
sudo ufw allow from 103.217.252.147 to any port 5432
# OR allow from anywhere (less secure)
sudo ufw allow 5432/tcp

# Check firewalld (if using CentOS/RHEL)
sudo firewall-cmd --list-all

# If using firewalld, allow PostgreSQL
sudo firewall-cmd --permanent --add-service=postgresql
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="103.217.252.147" port port="5432" protocol="tcp" accept'
sudo firewall-cmd --reload

# Check iptables
sudo iptables -L INPUT -n -v | grep 5432

# If using iptables, allow port
sudo iptables -A INPUT -p tcp -s 103.217.252.147 --dport 5432 -j ACCEPT
sudo iptables-save > /etc/iptables/rules.v4
```

---

## Step 7: Test Connection (From VPS)

**Back on your VPS (`103.217.252.147`):**

```bash
# Test connectivity again
nc -zv 45.130.104.103 5432

# If that works, test PostgreSQL connection
psql "postgresql://postgres:x70wIAAISfu4pqmo@45.130.104.103:5432/postgres" -c "SELECT version();"
```

**Expected result:**
```
Connection to 45.130.104.103 5432 port [tcp/postgresql] succeeded!
```

---

## Quick All-in-One Script (For Contabo Server)

**Run this script on your Contabo server to fix everything:**

```bash
#!/bin/bash
echo "=== Fixing PostgreSQL Remote Connection ==="

# Get file paths
CONFIG_FILE=$(sudo -u postgres psql -t -c "SHOW config_file;" | xargs)
HBA_FILE=$(sudo -u postgres psql -t -c "SHOW hba_file;" | xargs)

echo "Config file: $CONFIG_FILE"
echo "HBA file: $HBA_FILE"

# Backup files
sudo cp "$CONFIG_FILE" "$CONFIG_FILE.backup.$(date +%Y%m%d)"
sudo cp "$HBA_FILE" "$HBA_FILE.backup.$(date +%Y%m%d)"

# Fix listen_addresses
echo "=== Fixing listen_addresses ==="
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/g" "$CONFIG_FILE"
sudo sed -i "s/^listen_addresses = 'localhost'/listen_addresses = '*'/g" "$CONFIG_FILE"

# Check if already set
if ! grep -q "^listen_addresses = '\*'" "$CONFIG_FILE"; then
    echo "listen_addresses = '*'" | sudo tee -a "$CONFIG_FILE"
fi

# Add VPS IP to pg_hba.conf
echo "=== Adding VPS IP to pg_hba.conf ==="
if ! grep -q "103.217.252.147" "$HBA_FILE"; then
    echo "host    all             all             103.217.252.147/32       md5" | sudo tee -a "$HBA_FILE"
fi

# Reload PostgreSQL
echo "=== Reloading PostgreSQL ==="
sudo systemctl reload postgresql

# Check firewall
echo "=== Checking Firewall ==="
if command -v ufw &> /dev/null; then
    sudo ufw allow from 103.217.252.147 to any port 5432
    sudo ufw status | grep 5432
fi

# Verify
echo "=== Verifying Configuration ==="
echo "Listen addresses:"
sudo -u postgres psql -c "SHOW listen_addresses;"
echo ""
echo "Port status:"
sudo ss -tlnp | grep 5432

echo ""
echo "=== Done! Test from VPS with: ==="
echo "nc -zv 45.130.104.103 5432"
```

---

## Troubleshooting

### Issue: PostgreSQL won't start after changes
**Solution:**
```bash
# Check logs
sudo tail -50 /var/log/postgresql/postgresql-*-main.log

# Restore backup
sudo cp "$CONFIG_FILE.backup" "$CONFIG_FILE"
sudo cp "$HBA_FILE.backup" "$HBA_FILE"
sudo systemctl restart postgresql
```

### Issue: Still connection refused
**Solution:**
1. Check PostgreSQL is running: `sudo systemctl status postgresql`
2. Check listen_addresses: `sudo -u postgres psql -c "SHOW listen_addresses;"`
3. Check port is listening: `sudo ss -tlnp | grep 5432`
4. Check firewall: `sudo ufw status`
5. Check pg_hba.conf has your IP: `sudo grep "103.217.252.147" "$HBA_FILE"`

### Issue: Password authentication failed
**Solution:**
- Verify password: `x70wIAAISfu4pqmo`
- Test locally: `sudo -u postgres psql -c "SELECT 1;"`
- Make sure `pg_hba.conf` uses `md5` or `scram-sha-256`

---

## Verification Checklist

After running the fixes, verify:

- [ ] PostgreSQL is running: `sudo systemctl status postgresql`
- [ ] Listen on all: `sudo -u postgres psql -c "SHOW listen_addresses;"` shows `*`
- [ ] Port listening: `sudo ss -tlnp | grep 5432` shows `0.0.0.0:5432`
- [ ] pg_hba.conf updated: `sudo grep "103.217.252.147" "$HBA_FILE"`
- [ ] Firewall allows: `sudo ufw status | grep 5432`
- [ ] Test from VPS: `nc -zv 45.130.104.103 5432` succeeds

Once all checks pass, try the migration again!

