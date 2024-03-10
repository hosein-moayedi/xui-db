#!/bin/bash
FILE_PATH="/root/dedicated-vpn-bot/src/"
GITHUB_BRANCH="main"
COMMIT_MESSAGE="♻️ Update bot database ♻️"
PRO_DB_FILE_NAME="db-pro.json"
DEV_DB_FILE_NAME="db-dev.json"

cd $FILE_PATH
git add "$PRO_DB_FILE_NAME"
git add "$DEV_DB_FILE_NAME"
git commit -m "$COMMIT_MESSAGE"
git push
