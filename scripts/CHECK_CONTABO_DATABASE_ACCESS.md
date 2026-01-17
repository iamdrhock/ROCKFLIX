# Check Contabo Database Access from VPS

This guide helps you verify if your Contabo PostgreSQL database (`45.130.104.103`) allows connections from your VPS (`103.217.252.147`).

---

## Step 1: Test Network Connectivity (From VPS)

**SSH into your VPS and test if you can reach the Contabo database:**

```bash
# SSH into your VPS
ssh runcloud@103.217.252.147

# Test if port 5432 is reachable
nc -zv 45.130.104.103 5432

# Or use telnet
telnet 45.130.104.103 5432

# Or use timeout with netcat
timeout 5 bash -c "</dev/tcp/45.130.104.103/5432" && echo "Port 5432 is open" || echo "Port 5432 is closed"
```

**Expected Results:**
- ✅ **Connection succeeded** → Port is open, proceed to Step 2
- ❌ **Connection refused** → Port is closed, check firewall (Step 4)
- ❌ **Connection timed out** → Firewall blocking, check firewall (Step 4)

---

## Step 2: Check PostgreSQL Configuration (On Contabo Server)

**SSH into your Contabo server (`45.130.104.103`):**

```bash
# SSH into Contabo server
ssh root@45.130.104.103
# (or ssh user@45.130.104.103 - use your actual username)

# Find PostgreSQL configuration directory
sudo -u postgres psql -c "SHOW config_file;"

# Or find it manually
sudo find /etc -name postgresql.conf 2>/dev/null
sudo find /var/lib -name postgresql.conf 2>/dev/null

# Check PostgreSQL version
sudo -u postgres psql --version
```

**Once you find the config file, check `postgresql.conf`:**

```bash
# Edit postgresql.conf (path varies by installation)
sudo nano /etc/postgresql/*/main/postgresql.conf
# OR
sudo nano /var/lib/pgsql/*/data/postgresql.conf

# Look for this line:
# listen_addresses = 'localhost'

# Change it to:
listen_addresses = '*'

# Save and exit (Ctrl+X, Y, Enter)

# Restart PostgreSQL
sudo systemctl restart postgresql
# OR
sudo service postgresql restart
```

---

## Step 3: Check PostgreSQL Host-Based Authentication (pg_hba.conf)

**On your Contabo server, find and edit `pg_hba.conf`:**

```bash
# Find pg_hba.conf
sudo -u postgres psql -c "SHOW hba_file;"

# Or find it manually
sudo find /etc -name pg_hba.conf 2>/dev/null
sudo find /var/lib -name pg_hba.conf 2>/dev/null

# Edit pg_hba.conf
sudo nano /etc/postgresql/*/main/pg_hba.conf
# OR
sudo nano /var/lib/pgsql/*/data/pg_hba.conf
```

**Add this line to allow your VPS IP (add near the top, after local connections):**

```
# Allow VPS to connect
host    all             all             103.217.252.147/32       md5
# OR allow all IPs (less secure but works)
host    all             all             0.0.0.0/0                md5
```

**Save and exit, then reload PostgreSQL:**

```bash
# Reload PostgreSQL configuration (no restart needed)
sudo systemctl reload postgresql
# OR
sudo service postgresql reload

# OR restart if reload doesn't work
sudo systemctl restart postgresql
```

---

## Step 4: Check Firewall Rules (On Contabo Server)

**Check if a firewall is running:**

```bash
# Check UFW (Ubuntu/Debian)
sudo ufw status

# Check firewalld (CentOS/RHEL)
sudo firewall-cmd --list-all

# Check iptables
sudo iptables -L -n -v | grep 5432

# Check if PostgreSQL is in firewall rules
sudo ufw status | grep postgresql
```

**If firewall is active, allow PostgreSQL port:**

```bash
# UFW (Ubuntu/Debian)
sudo ufw allow from 103.217.252.147 to any port 5432
# OR allow from anywhere (less secure)
sudo ufw allow 5432/tcp

# firewalld (CentOS/RHEL)
sudo firewall-cmd --permanent --add-rich-rule='rule family="ipv4" source address="103.217.252.147" port port="5432" protocol="tcp" accept'
sudo firewall-cmd --reload
# OR allow from anywhere
sudo firewall-cmd --permanent --add-service=postgresql
sudo firewall-cmd --reload

# iptables (if using iptables directly)
sudo iptables -A INPUT -p tcp -s 103.217.252.147 --dport 5432 -j ACCEPT
sudo iptables-save > /etc/iptables/rules.v4
```

---

## Step 5: Test Database Connection (From VPS)

**Back on your VPS (`103.217.252.147`), test the connection:**

```bash
# Test connection with psql
psql "postgresql://postgres:x70wIAAISfu4pqmo@45.130.104.103:5432/postgres"

# Or if psql is not installed
PGPASSWORD='x70wIAAISfu4pqmo' psql -h 45.130.104.103 -p 5432 -U postgres -d postgres

# If connection succeeds, you'll see:
# postgres=#

# Test a simple query
SELECT version();

# Exit
\q
```

**Or test with Node.js script:**

```bash
# Create test script
cat > /tmp/test-contabo-connection.js << 'EOF'
const { Pool } = require('pg');

const pool = new Pool({
  user: 'postgres',
  password: 'x70wIAAISfu4pqmo',
  host: '45.130.104.103',
  port: 5432,
  database: 'postgres',
  ssl: false, // Try with false first
});

pool.query('SELECT version()', (err, res) => {
  if (err) {
    console.error('Connection error:', err.message);
    process.exit(1);
  } else {
    console.log('✅ Connection successful!');
    console.log('PostgreSQL version:', res.rows[0].version);
    pool.end();
  }
});
EOF

# Run test
cd /home/runcloud/webapps/rockflix/current
node /tmp/test-contabo-connection.js
```

---

## Step 6: Quick Diagnostic Commands (All-in-One)

**On Contabo Server - Run all checks at once:**

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Check PostgreSQL is listening on all interfaces
sudo netstat -tlnp | grep 5432
# OR
sudo ss -tlnp | grep 5432

# Check listen_addresses setting
sudo -u postgres psql -c "SHOW listen_addresses;"

# Check pg_hba.conf entries
sudo cat $(sudo -u postgres psql -t -c "SHOW hba_file;") | grep -v "^#" | grep -v "^$"

# Check firewall
sudo ufw status numbered
sudo iptables -L INPUT -n -v | grep 5432

# Test local connection
sudo -u postgres psql -c "SELECT version();"
```

---

## Step 7: Common Issues and Solutions

### Issue 1: "Connection refused"
**Solution:** 
- PostgreSQL not listening on external IP (fix `listen_addresses` in Step 2)
- Firewall blocking (fix in Step 4)

### Issue 2: "Password authentication failed"
**Solution:**
- Check password in connection string
- Check `pg_hba.conf` uses `md5` or `scram-sha-256` authentication

### Issue 3: "No route to host" / "Connection timed out"
**Solution:**
- Firewall blocking (fix in Step 4)
- Network routing issue (check with ISP/Contabo support)

### Issue 4: PostgreSQL not installed/running
**Solution:**
```bash
# Install PostgreSQL (if not installed)
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

---

## Quick Reference Commands

**From VPS (`103.217.252.147`):**
```bash
# Test connectivity
nc -zv 45.130.104.103 5432

# Test connection
psql "postgresql://postgres:x70wIAAISfu4pqmo@45.130.104.103:5432/postgres"
```

**From Contabo Server (`45.130.104.103`):**
```bash
# Check PostgreSQL config
sudo -u postgres psql -c "SHOW listen_addresses;"
sudo -u postgres psql -c "SHOW hba_file;"

# Reload PostgreSQL
sudo systemctl reload postgresql

# Check firewall
sudo ufw status
```

---

## Verification Checklist

- [ ] Step 1: Network connectivity test passes (port 5432 reachable)
- [ ] Step 2: `listen_addresses = '*'` in `postgresql.conf`
- [ ] Step 3: VPS IP added to `pg_hba.conf`
- [ ] Step 4: Firewall allows port 5432 from VPS IP
- [ ] Step 5: Connection test from VPS succeeds
- [ ] Step 6: PostgreSQL restarted/reloaded after changes

Once all checks pass, you can proceed with the database migration!

