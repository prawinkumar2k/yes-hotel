#!/usr/bin/env bash
# One-time server setup for the SEO work. Run as root on the VPS:   bash /opt/yeshotels/seo-agent/deploy/server-install.sh
# Does two things, each with a backup and an automatic rollback if it does not validate:
#   1) www.yeshotels.in -> https://yeshotels.in (301, path and query kept), in /etc/nginx/sites-enabled/yeshotels
#   2) installs the daily 09:00 India-time SEO audit (systemd timer), then runs it once to prove it works
# Touches nothing else: no other site's config, no app container, no database.
set -u
STAMP=$(date +%F)
F=/etc/nginx/sites-enabled/yeshotels
B=/root/yeshotels.nginx.$STAMP.bak
REPO=/opt/yeshotels

echo "=== 1/2 nginx: www -> apex ==="
if grep -q "www -> apex (added" "$F"; then
  echo "already applied, skipping"
else
  cp -p "$F" "$B" && echo "backup: $B"
  python3 - <<'PY'
p='/etc/nginx/sites-enabled/yeshotels'
s=open(p).read()
assert s.count('server_name yeshotels.in www.yeshotels.in;')==2, "unexpected nginx file layout, nothing changed"
s=s.replace('server_name yeshotels.in www.yeshotels.in;','server_name yeshotels.in;',1)
old='''    if ($host = www.yeshotels.in) {
        return 301 https://$host$request_uri;
    }
'''
assert old in s, "unexpected port-80 block, nothing changed"
s=s.replace(old,'''    if ($host = www.yeshotels.in) {
        return 301 https://yeshotels.in$request_uri;
    }
''',1)
s=s.rstrip('\n')+'''

# www -> apex (added for SEO; rollback: cp the .bak back over this file, nginx -t, systemctl reload nginx)
server {
    listen 443 ssl;
    server_name www.yeshotels.in;
    ssl_certificate /etc/letsencrypt/live/yeshotels.in/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yeshotels.in/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    return 301 https://yeshotels.in$request_uri;
}
'''
open(p,'w').write(s)
PY
  if [ $? -eq 0 ] && nginx -t; then
    systemctl reload nginx && echo "nginx reloaded"
    for u in http://www.yeshotels.in/rooms https://www.yeshotels.in/rooms?x=1 http://yeshotels.in/rooms https://yeshotels.in/rooms; do
      printf "%-42s -> " "$u"; curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "$u"
    done
    echo "--- certbot renewal dry run ---"; certbot renew --dry-run 2>&1 | tail -4
  else
    cp -p "$B" "$F"; nginx -t && systemctl reload nginx; echo "ROLLED BACK nginx to the backup"
  fi
fi

echo "=== 2/2 daily SEO audit (systemd timer) ==="
cd "$REPO" || exit 1
install -m 644 seo-agent/deploy/yeshotels-seo.service /etc/systemd/system/yeshotels-seo.service
install -m 644 seo-agent/deploy/yeshotels-seo.timer   /etc/systemd/system/yeshotels-seo.timer
chmod +x seo-agent/deploy/run-in-docker.sh
systemd-analyze verify /etc/systemd/system/yeshotels-seo.service /etc/systemd/system/yeshotels-seo.timer && echo "unit files valid"
systemctl daemon-reload
systemctl enable --now yeshotels-seo.timer
echo "--- first run now (takes a minute or two) ---"
systemctl start yeshotels-seo.service; echo "service exit: $(systemctl show -p Result --value yeshotels-seo.service)"
ls -la /var/lib/yeshotels-seo /var/lib/yeshotels-seo/reports/daily 2>/dev/null | tail -8
echo "--- next scheduled run ---"; systemctl list-timers yeshotels-seo.timer --no-pager
echo "--- app health ---"; curl -s -o /dev/null -w "api/health %{http_code}\n" https://yeshotels.in/api/health
