#!/bin/zsh
set -eu
cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
node scripts/admin-link.mjs
