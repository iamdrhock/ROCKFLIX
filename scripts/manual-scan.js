const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Helper to manually load .env files without extra dependencies
function loadEnv(filePath) {
    console.log(`Loading env from: ${filePath}`);
    try {
        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            console.log(`  - Found ${lines.length} lines.`);

            lines.forEach(line => {
                // Remove 'export ' prefix if present
                let cleanLine = line.trim().replace(/^export\s+/, '');

                // Skip comments and empty lines
                if (!cleanLine || cleanLine.startsWith('#')) return;

                const match = cleanLine.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    let value = match[2].trim();
                    // Remove quotes if present
                    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                        value = value.slice(1, -1);
                    }
                    if (!process.env[key]) {
                        process.env[key] = value;
                        // console.log(`  - Loaded key: ${key}`); // Uncomment for verbose key logging
                    }
                }
            });
        }
    } catch (e) {
        console.warn(`Warning: Failed to load ${filePath}`, e.message);
    }
}

// Load env files (mimicking Next.js priority)
const possiblePaths = [
    path.join(__dirname, '../.env.production'),
    path.join(__dirname, '../.env'),
    path.join(__dirname, '../../.env'), // Outside current
    path.join(__dirname, '../../shared/.env'), // Shared folder
    path.join(__dirname, '../../../.env') // Further up
];

console.log("Searching for .env files...");
possiblePaths.forEach(p => {
    if (fs.existsSync(p)) {
        loadEnv(p);
    } else {
        // console.log(`Not found: ${p}`);
    }
});

// Debug: Print loaded DB keys
const dbKeys = Object.keys(process.env).filter(k => k.includes('DB') || k.includes('URL') || k.includes('POSTGRES'));
console.log("Environment keys with 'DB', 'URL', or 'POSTGRES':", dbKeys);

async function scan() {
    console.log("Starting malware scan...");

    const databaseUrl = process.env.CONTABO_DATABASE_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL;

    if (!databaseUrl) {
        console.error("Error: No DATABASE_URL found in environment variables.");
        console.error("Available env keys:", Object.keys(process.env));
        process.exit(1);
    }

    // Mask the password in logs
    const maskedUrl = databaseUrl.replace(/:([^@]+)@/, ':****@');
    console.log(`Using Database URL: ${maskedUrl}`);

    // Clean connection string like in the app
    let cleanUrl = databaseUrl.split('?')[0];
    const pool = new Pool({
        connectionString: cleanUrl,
        ssl: { rejectUnauthorized: false } // Relax SSL strictness for potential self-signed certs or minor mismatches
    });

    const SEARCH_TERM = '%99fkw4w8%';
    let found = false;

    try {
        console.log("Connected to DB. Running queries...");

        // 1. Advertisements
        const ads = await pool.query(
            `SELECT id, position, content, is_active FROM advertisements WHERE content ILIKE $1`,
            [SEARCH_TERM]
        );
        if (ads.rows.length > 0) {
            console.log("\n[MALWARE FOUND] Table: advertisements");
            ads.rows.forEach(r => {
                console.log(`- ID: ${r.id}, Position: ${r.position}, Active: ${r.is_active}`);
                console.log(`  Content Snippet: ${r.content.substring(0, 100)}...`);
            });
            found = true;
        }

        // 2. Site Settings (Expanded)
        const settings = await pool.query(
            `SELECT id, site_title, header_custom_code, footer_custom_code, watch_page_custom_html 
             FROM site_settings 
             WHERE footer_text ILIKE $1 
                OR site_title ILIKE $1
                OR header_custom_code ILIKE $1
                OR footer_custom_code ILIKE $1
                OR watch_page_custom_html ILIKE $1
                OR watch_page_middle_custom_html ILIKE $1`,
            [SEARCH_TERM]
        );
        if (settings.rows.length > 0) {
            console.log("\n[MALWARE FOUND] Table: site_settings");
            console.log(JSON.stringify(settings.rows, null, 2));
            found = true;
        }

        // 3. Posts
        const posts = await pool.query(
            `SELECT id, content FROM posts WHERE content ILIKE $1 LIMIT 5`,
            [SEARCH_TERM]
        );
        if (posts.rows.length > 0) {
            console.log("\n[MALWARE FOUND] Table: posts");
            console.log(JSON.stringify(posts.rows, null, 2));
            found = true;
        }

        // 4. Comments
        const comments = await pool.query(
            `SELECT id, comment_text as content FROM comments WHERE comment_text ILIKE $1 LIMIT 5`,
            [SEARCH_TERM]
        );
        if (comments.rows.length > 0) {
            console.log("\n[MALWARE FOUND] Table: comments");
            console.log(JSON.stringify(comments.rows, null, 2));
            found = true;
        }

        if (!found) {
            console.log("\n[CLEAN] No matches found for '99fkw4w8' in checked tables.");
        }

    } catch (err) {
        console.error("Database error:", err);
    } finally {
        await pool.end();
    }
}

scan();
