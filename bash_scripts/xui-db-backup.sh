#!/bin/bash
FILE_PATH="/etc/x-ui/"
GITHUB_BRANCH="main"
COMMIT_MESSAGE="Update file"
FILE_NAME="x-ui.db"

cd $FILE_PATH || exit
git add "$FILE_NAME"
git commit -m "$COMMIT_MESSAGE"
git push
