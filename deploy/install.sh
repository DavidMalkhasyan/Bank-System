#!/usr/bin/env bash
# Installs and starts Ledgerly on a fresh Ubuntu 22.04/24.04 server
# (Oracle Cloud, Hetzner, DigitalOcean). Run from the cloned repository:
#
#   bash deploy/install.sh ledgerly.duckdns.org
#
# It installs Docker, opens ports 80/443, adds swap, turns on automatic
# security updates, writes .env with random secrets (first run only), then
# builds and starts the database, the app and Caddy (HTTPS).
set -euo pipefail

cd "$(dirname "$0")/.."

# Accept "https://name/..." as well as a bare name.
SITE_ADDRESS="${1:-}"
SITE_ADDRESS="${SITE_ADDRESS#http://}"
SITE_ADDRESS="${SITE_ADDRESS#https://}"
SITE_ADDRESS="${SITE_ADDRESS%%/*}"

if [ ! -f .env ] && [ -z "$SITE_ADDRESS" ]; then
  echo "Usage: bash deploy/install.sh <site address, e.g. ledgerly.duckdns.org>" >&2
  exit 1
fi

echo "== Docker"
if ! command -v docker >/dev/null; then
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER"
fi

echo "== Web ports 80 and 443"
# Oracle's Ubuntu images reject everything except SSH in iptables, even when
# the cloud firewall (security list) allows it.
if sudo iptables -S INPUT | grep -q "REJECT"; then
  for port in 443 80; do
    sudo iptables -C INPUT -p tcp --dport "$port" -m state --state NEW -j ACCEPT 2>/dev/null ||
      sudo iptables -I INPUT 5 -p tcp --dport "$port" -m state --state NEW -j ACCEPT
  done
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq netfilter-persistent iptables-persistent
  sudo netfilter-persistent save
fi

echo "== Swap (helps the first build on small servers)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo "/swapfile none swap sw 0 0" | sudo tee -a /etc/fstab >/dev/null
fi

echo "== Automatic security updates"
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq unattended-upgrades
sudo dpkg-reconfigure -f noninteractive unattended-upgrades

echo "== Settings (.env)"
if [ ! -f .env ]; then
  (
    umask 077
    cat > .env <<EOF
# Created by deploy/install.sh. Keep this file private.
COMPOSE_FILE=compose.prod.yaml
SITE_ADDRESS=$SITE_ADDRESS
POSTGRES_PASSWORD=$(openssl rand -hex 24)
JWT_ACCESS_SECRET=$(openssl rand -hex 48)
SEED_DEMO_DATA=true
# Wipe and reload the demo data every N hours (0 = never).
DEMO_RESET_HOURS=24
EOF
  )
  echo "Created .env with new random secrets."
elif [ -n "$SITE_ADDRESS" ]; then
  sed -i "s|^SITE_ADDRESS=.*|SITE_ADDRESS=$SITE_ADDRESS|" .env
  echo "Updated SITE_ADDRESS in .env."
fi

echo "== Build and start (the first build takes several minutes)"
sudo docker compose up -d --build
sudo docker compose ps

SITE="$(grep '^SITE_ADDRESS=' .env | cut -d= -f2)"
echo
echo "Done. Open https://$SITE"
echo "The HTTPS certificate is issued on the first visit, so the first load can take 10-20 seconds."
echo "Log out and back in once, so 'docker compose' works without sudo."
