#!/bin/bash

# Script to batch update all remaining admin API routes to use JWT auth
# This saves time by applying the same pattern to multiple files

echo "🔧 Updating remaining admin API routes to JWT auth..."

# The pattern we need to replace:
# FROM: import { authService } from '@/lib/auth';
#       await authService.requireAdminAuth(req);
# 
# TO:   import { requireAuth } from '@/middleware/auth';
#       const auth = requireAuth(req);
#       if (!auth.authenticated || !auth.user) return auth.response!;
#       const userId = auth.user.user_id;

# List of files that still need updating
FILES=(
  "src/app/api/admin/reject/[id]/route.ts"
  "src/app/api/admin/delete/[id]/route.ts"
  "src/app/api/admin/queue/details/route.ts"
  "src/app/api/admin/playback/pause/route.ts"
  "src/app/api/admin/playback/resume/route.ts"
  "src/app/api/admin/playback/skip/route.ts"
)

echo "Files to update: ${#FILES[@]}"

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ Would update: $file"
  else
    echo "❌ Not found: $file"
  fi
done

echo "✨ Manual update recommended via editor for accuracy"

