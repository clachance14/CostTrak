#!/bin/bash

echo "Running code quality checks..."
echo ""

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Track if any check fails
FAILED=0

# Type checking
echo "1. Running TypeScript type checking..."
if pnpm type-check; then
    echo -e "${GREEN}✓ Type checking passed${NC}"
else
    echo -e "${RED}✗ Type checking failed${NC}"
    FAILED=1
fi
echo ""

# Linting
echo "2. Running ESLint..."
if pnpm lint; then
    echo -e "${GREEN}✓ Linting passed${NC}"
else
    echo -e "${RED}✗ Linting failed${NC}"
    FAILED=1
fi
echo ""

# Check for console.logs in production code
echo "3. Checking for console.log statements..."
CONSOLE_LOGS=$(grep -r "console\.log" \
    --include="*.ts" \
    --include="*.tsx" \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=scripts \
    --exclude-dir=tests \
    . 2>/dev/null | grep -v "// eslint-ignore" | grep -v "// OK" | wc -l)

if [ "$CONSOLE_LOGS" -eq 0 ]; then
    echo -e "${GREEN}✓ No console.log statements found${NC}"
else
    echo -e "${YELLOW}⚠ Found $CONSOLE_LOGS console.log statements${NC}"
    echo "  Consider using proper logging or removing them"
    grep -r "console\.log" \
        --include="*.ts" \
        --include="*.tsx" \
        --exclude-dir=node_modules \
        --exclude-dir=.next \
        --exclude-dir=scripts \
        --exclude-dir=tests \
        . 2>/dev/null | grep -v "// eslint-ignore" | grep -v "// OK" | head -5
    echo "  ..."
fi
echo ""

# Check for any TODO comments
echo "4. Checking for TODO comments..."
TODOS=$(grep -r "TODO\|FIXME\|XXX" \
    --include="*.ts" \
    --include="*.tsx" \
    --include="*.js" \
    --include="*.jsx" \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    . 2>/dev/null | wc -l)

if [ "$TODOS" -eq 0 ]; then
    echo -e "${GREEN}✓ No TODO/FIXME comments found${NC}"
else
    echo -e "${YELLOW}ℹ Found $TODOS TODO/FIXME comments${NC}"
    echo "  Review these before deployment:"
    grep -r "TODO\|FIXME\|XXX" \
        --include="*.ts" \
        --include="*.tsx" \
        --include="*.js" \
        --include="*.jsx" \
        --exclude-dir=node_modules \
        --exclude-dir=.next \
        . 2>/dev/null | head -5
    echo "  ..."
fi
echo ""

# Check for duplicate dependencies
echo "5. Checking package.json for issues..."
DUPLICATE_DEPS=$(jq -r '.dependencies | keys' package.json 2>/dev/null | sort | uniq -d | wc -l)
if [ "$DUPLICATE_DEPS" -eq 0 ]; then
    echo -e "${GREEN}✓ No duplicate dependencies${NC}"
else
    echo -e "${RED}✗ Found duplicate dependencies${NC}"
    FAILED=1
fi
echo ""

# Summary
echo "================================"
if [ "$FAILED" -eq 0 ]; then
    echo -e "${GREEN}All critical checks passed!${NC}"
    exit 0
else
    echo -e "${RED}Some checks failed. Please fix the issues above.${NC}"
    exit 1
fi