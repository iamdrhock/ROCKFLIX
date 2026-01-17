#!/bin/bash
# Script to find and replace NextResponse.json with native Response in all admin routes

find app/api/admin -name "*.ts" -type f | while read file; do
  # Skip files that already have jsonResponse helper
  if grep -q "function jsonResponse" "$file"; then
    echo "Skipping $file - already has jsonResponse helper"
    continue
  fi
  
  # Skip files that don't use NextResponse.json
  if ! grep -q "NextResponse.json" "$file"; then
    continue
  fi
  
  echo "Fixing $file..."
  
  # Add jsonResponse helper at the top after imports
  sed -i '/^import.*adminRoute/a\
\
// Use native Response to avoid NextResponse bundling issues\
function jsonResponse(data: any, status: number = 200) {\
  return new Response(JSON.stringify(data), {\
    status,\
    headers: { "Content-Type": "application/json" }\
  })\
}
' "$file"
  
  # Replace NextResponse.json calls
  sed -i 's/NextResponse\.json(\([^,]*\),\s*{ status: \([^}]*\) })/jsonResponse(\1, \2)/g' "$file"
  sed -i 's/NextResponse\.json(\([^)]*\))/jsonResponse(\1)/g' "$file"
  
  # Remove NextResponse import if not needed
  if ! grep -q "NextResponse" "$file" | grep -v "jsonResponse"; then
    sed -i '/^import.*NextResponse/d' "$file"
  fi
done

echo "Done fixing admin routes"

