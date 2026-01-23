# DigitalOcean to Contabo Migration Instructions

Because your current environment cannot reach the DigitalOcean database (DNS/Network issue), you must perform the migration manually from a machine that has access (e.g., your local machine with proper VPN/DNS or the Contabo VPS itself if it allows outbound connections).

## Prerequisites

1.  **Node.js** installed.
2.  **DigitalOcean Database Credentials** (Password).
3.  **Contabo Access** (SSH).

## Step 1: Export Data from DigitalOcean

Run this on a machine that can connect to DigitalOcean:

1.  Open your terminal in the `ROCKFLIX` directory.
2.  Set the `DO_PASSWORD` environment variable (the script defaults to "masked_password" if not set).
    *   **Windows (PowerShell):** `$env:DO_PASSWORD="your-real-password"`
    *   **Mac/Linux:** `export DO_PASSWORD="your-real-password"`
3.  Run the export script:
    ```bash
    node scripts/export-from-digitalocean.js
    ```
4.  This will create `scripts/digitalocean-export.json`.

## Step 2: Transfer Data to Contabo (Destination)

If you are running the export locally, upload the file to your Contabo VPS:

```bash
scp scripts/digitalocean-export.json runcloud@103.217.252.147:/home/runcloud/webapps/rockflix/current/
```

## Step 3: Import to Contabo

1.  SSH into your Contabo VPS:
    ```bash
    ssh runcloud@103.217.252.147
    cd /home/runcloud/webapps/rockflix/current/
    ```
2.  Run the auto-migration script:
    ```bash
    # This script will find 'digitalocean-export.json' automatically
    bash scripts/auto-migrate-to-contabo.sh
    ```
    *(Note: This uses the default Contabo password `x70wIAAISfu4pqmo`. If changed, set `CONTABO_DATABASE_URL` env var first).*

## Troubleshooting

-   **Connection Failed (Export):** If `node scripts/export-from-digitalocean.js` fails with `ENOTFOUND`, ensure your DNS can resolve `rockflix-db-do-user-28778450-0.j.db.ondigitalocean.com`.
-   **Connection Failed (Import):** If the import script cannot connect to `localhost:5432`, ensure PostgreSQL is running on the Contabo server (`sudo systemctl status postgresql`).

## Step 4: Switch Application to Contabo

Once the import is complete and verified:

1.  **Update Environment Variables:**
    *   Set `DATABASE_URL` to your Contabo connection string:
        `postgresql://postgres:x70wIAAISfu4pqmo@45.130.104.103:5432/postgres`
    *   Set `USE_CONTABO_DB=true` to enable the custom query logic.

2.  **Deploy/Restart:**
    *   Redeploy your application or restart the server to pick up the changes.
    *   The application will now read/write from the Contabo VPS database instead of Supabase/DigitalOcean.
