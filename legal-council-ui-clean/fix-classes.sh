#!/bin/bash

# Replace all problematic custom classes with standard Tailwind classes

echo "Fixing class names in all files..."

# Function to replace in file
fix_file() {
  local file="$1"
  
  # Replace text classes
  sed -i 's/text-muted-foreground/text-gray-500/g' "$file"
  sed -i 's/text-primary/text-blue-900/g' "$file"
  sed -i 's/text-card-foreground/text-slate-900/g' "$file"
  
  # Replace background classes
  sed -i 's/bg-card/bg-white/g' "$file"
  sed -i 's/bg-background-subtle/bg-gray-50/g' "$file"
  sed -i 's/bg-background/bg-white/g' "$file"
  
  # Replace border classes  
  sed -i 's/border-border/border-gray-200/g' "$file"
  
  # Replace primary button classes
  sed -i 's/bg-primary/bg-blue-900/g' "$file"
  sed -i 's/text-primary-foreground/text-white/g' "$file"
  
  echo "Fixed: $file"
}

# Find and fix all TSX/TS files
find src -name "*.tsx" -o -name "*.ts" | while read file; do
  if [ -f "$file" ]; then
    fix_file "$file"
  fi
done

echo "Done!"
