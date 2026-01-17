#!/bin/bash
# Script to uncomment NextAuth code after packages are installed

cd /home/runcloud/webapps/rockflix/current || exit 1

# Uncomment nextauth-config.ts
sed -i 's|^// TODO: Uncomment these imports|// Uncommented|' lib/auth/nextauth-config.ts
sed -i 's|^/\*$|// |' lib/auth/nextauth-config.ts
sed -i 's|^\*/$|// |' lib/auth/nextauth-config.ts
sed -i '/^export const nextAuthConfig = {} as any/d' lib/auth/nextauth-config.ts

# Uncomment route.ts
sed -i 's|^// TODO: Uncomment after installing next-auth|// Uncommented|' app/api/auth/\[...nextauth\]/route.ts
sed -i 's|^/\*$|// |' app/api/auth/\[...nextauth\]/route.ts
sed -i 's|^\*/$|// |' app/api/auth/\[...nextauth\]/route.ts
sed -i '/^export async function GET() {/,/^}$/d' app/api/auth/\[...nextauth\]/route.ts
sed -i '/^export async function POST() {/,/^}$/d' app/api/auth/\[...nextauth\]/route.ts

echo "NextAuth code uncommented successfully!"

