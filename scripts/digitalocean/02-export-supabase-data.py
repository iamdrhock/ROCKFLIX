"""
Export data from Supabase to SQL INSERT statements
Run this script to export all your current data
"""

import os
import json
from datetime import datetime

# Supabase connection details (from environment)
SUPABASE_URL = os.getenv('SUPABASE_POSTGRES_URL_NON_POOLING')

print("=" * 60)
print("SUPABASE TO DIGITALOCEAN DATA EXPORT SCRIPT")
print("=" * 60)
print()

# Instructions for the user
print("INSTRUCTIONS:")
print("1. This script will connect to your Supabase database")
print("2. Export all data as SQL INSERT statements")
print("3. Save to scripts/digitalocean/03-import-data.sql")
print()
print("IMPORTANT: You need to install psycopg2 to run this script")
print("Run: pip install psycopg2-binary")
print()

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    
    print("[v0] Connecting to Supabase database...")
    conn = psycopg2.connect(SUPABASE_URL)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Tables to export in order (respecting foreign keys)
    tables_order = [
        'actors',
        'countries',
        'genres',
        'movies',
        'seasons',
        'episodes',
        'movie_genres',
        'movie_countries',
        'movie_actors',
        'profiles',
        'favorites',
        'watchlist',
        'comments',
        'reactions',
        'admin_users',
        'admin_sessions',
        'admin_users_backup',
        'advertisements',
        'blog_posts',
        'custom_pages',
        'site_settings',
        'rate_limits'
    ]
    
    output_file = 'scripts/digitalocean/03-import-data.sql'
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("-- RockFlix Data Import\n")
        f.write(f"-- Exported from Supabase on {datetime.now()}\n")
        f.write("-- Import this file to DigitalOcean PostgreSQL\n\n")
        
        for table in tables_order:
            print(f"[v0] Exporting {table}...")
            
            # Get all columns for this table
            cursor.execute(f"""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = '{table}' 
                AND table_schema = 'public'
                ORDER BY ordinal_position
            """)
            columns_info = cursor.fetchall()
            column_names = [col['column_name'] for col in columns_info]
            
            # Get all data
            cursor.execute(f'SELECT * FROM {table}')
            rows = cursor.fetchall()
            
            if rows:
                f.write(f"\n-- Importing {table} ({len(rows)} rows)\n")
                
                for row in rows:
                    values = []
                    for col in column_names:
                        val = row[col]
                        if val is None:
                            values.append('NULL')
                        elif isinstance(val, (dict, list)):
                            values.append(f"'{json.dumps(val)}'::jsonb")
                        elif isinstance(val, str):
                            # Escape single quotes
                            escaped = val.replace("'", "''")
                            values.append(f"'{escaped}'")
                        elif isinstance(val, datetime):
                            values.append(f"'{val.isoformat()}'")
                        elif isinstance(val, bool):
                            values.append('true' if val else 'false')
                        else:
                            values.append(str(val))
                    
                    columns_str = ', '.join(column_names)
                    values_str = ', '.join(values)
                    f.write(f"INSERT INTO {table} ({columns_str}) VALUES ({values_str}) ON CONFLICT DO NOTHING;\n")
                
                print(f"[v0] ✓ Exported {len(rows)} rows from {table}")
            else:
                print(f"[v0] ⚠ No data in {table}")
        
        # Reset sequences
        f.write("\n-- Reset sequences\n")
        for table in tables_order:
            f.write(f"SELECT setval(pg_get_serial_sequence('{table}', 'id'), COALESCE(MAX(id), 1)) FROM {table};\n")
    
    print()
    print(f"[v0] ✓ Export complete! Saved to {output_file}")
    print()
    print("NEXT STEPS:")
    print("1. Review the generated SQL file")
    print("2. Run 01-create-schema.sql on DigitalOcean first")
    print("3. Then run 03-import-data.sql to import all data")
    
    cursor.close()
    conn.close()
    
except ImportError:
    print("[v0] ERROR: psycopg2 not installed")
    print("Please run: pip install psycopg2-binary")
except Exception as e:
    print(f"[v0] ERROR: {str(e)}")
    import traceback
    traceback.print_exc()
