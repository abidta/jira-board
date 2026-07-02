#!/bin/bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm use 22

cd /home/sainulabid/Desktop/projects/vibe
npm run build && npm run preview -- --open
