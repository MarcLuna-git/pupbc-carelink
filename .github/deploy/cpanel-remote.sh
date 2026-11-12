#!/usr/bin/env bash
# Runs on the cPanel server, piped over SSH by .github/workflows/deploy-cpanel.yml.
# Installs ~/deploy/release.tgz (backend/ + site/) into the web root.
#
#   bash -s            install the uploaded release
#   bash -s rollback   put back the copy the last install replaced
#
# Never touched: carelink.env, backend/storage (avatars, logs), and the web
# root's own .htaccess and index.php.
set -Eeuo pipefail

ROOT="$HOME/${DEPLOY_ROOT:-public_html}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-0}"
WORK="$HOME/deploy"
NEW="$WORK/release"
OLD="$WORK/previous"
BACKEND="$ROOT/backend"
# Replaced whole, so files deleted from the repo also disappear on the server.
CODE_DIRS="app bootstrap config database public resources routes scripts vendor"
STORAGE_DIRS="logs framework/cache/data framework/sessions framework/views app/public"

restore_previous() {
    for dir in $CODE_DIRS; do
        if [ -e "$OLD/$dir" ]; then
            rm -rf "${BACKEND:?}/$dir"
            mv "$OLD/$dir" "$BACKEND/$dir"
        fi
    done
    if [ -d "$OLD/_files" ]; then cp -p "$OLD/_files/." "$BACKEND/" -R; fi
    if [ -f "$OLD/index.html" ]; then cp -p "$OLD/index.html" "$ROOT/index.html"; fi
}

if [ "${1:-}" = "rollback" ]; then
    [ -d "$OLD" ] || { echo "No previous copy to restore."; exit 1; }
    restore_previous
    echo "Restored the previous backend and index.html."
    exit 0
fi

# 1. Unpack next to the live site and prove the new backend boots on this
#    server's PHP before anything live is touched.
rm -rf "$NEW" "$OLD"
mkdir -p "$NEW" "$OLD/_files" "$BACKEND"
tar -xzf "$WORK/release.tgz" -C "$NEW" --no-same-owner
if [ ! -f "$NEW/backend/vendor/autoload.php" ] || [ ! -f "$NEW/site/index.html" ]; then
    echo "The release is incomplete."
    exit 1
fi
for dir in $STORAGE_DIRS; do mkdir -p "$NEW/backend/storage/$dir"; done
(cd "$NEW/backend" && php artisan package:discover --ansi && php artisan --version)
rm -rf "$NEW/backend/storage"

# 2. Swap the backend in. On any failure from here, the previous copy goes back.
trap 'echo "Deploy failed; restoring the previous backend."; restore_previous' ERR

for dir in $STORAGE_DIRS; do mkdir -p "$BACKEND/storage/$dir"; done
find "$BACKEND" -maxdepth 1 -type f -exec cp -p {} "$OLD/_files/" \;
if [ -f "$ROOT/index.html" ]; then cp -p "$ROOT/index.html" "$OLD/index.html"; fi

for dir in $CODE_DIRS; do
    [ -e "$NEW/backend/$dir" ] || continue
    if [ -e "$BACKEND/$dir" ]; then mv "$BACKEND/$dir" "$OLD/$dir"; fi
    mv "$NEW/backend/$dir" "$BACKEND/$dir"
done
find "$NEW/backend" -maxdepth 1 -type f -exec cp {} "$BACKEND/" \;

cd "$BACKEND"
php artisan view:clear
if [ "$RUN_MIGRATIONS" = "1" ]; then
    php artisan migrate --force
fi

# 3. Frontend. Old hashed files in /assets stay for 30 days so a page that is
#    already open keeps working; index.html goes last and switches the site over.
SITE="$NEW/site"
rm -f "$SITE/.htaccess" "$SITE/index.php"
for entry in "$SITE"/* "$SITE"/.[!.]*; do
    [ -e "$entry" ] || continue
    [ "$(basename "$entry")" = "index.html" ] && continue
    cp -R "$entry" "$ROOT/"
done
find "$ROOT/assets" -type f -mtime +30 ! -name .htaccess -delete
cp "$SITE/index.html" "$ROOT/index.html.new"
mv "$ROOT/index.html.new" "$ROOT/index.html"

trap - ERR
rm -rf "$NEW" "$WORK/release.tgz"
echo "Deployed to $ROOT (previous copy kept in $OLD)."
