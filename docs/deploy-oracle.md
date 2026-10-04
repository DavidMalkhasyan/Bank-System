# Deploying to a server (Oracle Cloud Always Free)

Ledgerly runs on one small server that is always on: PostgreSQL, the app and Caddy (automatic HTTPS), all in Docker. The same steps work on Hetzner or DigitalOcean; skip the Oracle console part there.

## 1. Create the server (Oracle Cloud console)

1. **Compute → Instances → Create instance**, name it `ledgerly`.
2. **Image:** *Change image* → **Canonical Ubuntu 24.04**.
3. **Shape:** *Change shape* → **Ampere** → `VM.Standard.A1.Flex`, **1 OCPU, 6 GB memory**.
   The Always Free allowance is **2 OCPUs and 12 GB in total** across all Ampere servers. With one other 1 OCPU / 6 GB server you are exactly at the limit; on a Pay As You Go account anything above it is billed.
   If Oracle says there is no capacity, try another *availability domain* on the same page, or try again later.
4. **Networking:** choose your **existing virtual cloud network and its public subnet** (if another server already uses them, ports 80 and 443 are probably open there), and make sure **Assign a public IPv4 address** is on.
   With a new network, open the web ports: instance page → **Subnet** → **Security Lists** → *Default Security List* → **Add Ingress Rules** for source `0.0.0.0/0`, TCP, destination ports `80` and `443`.
5. **SSH keys:** upload the public key (`.pub`) you already use for your other server, or *Generate a key pair for me* and **download both keys** (they cannot be downloaded later).
6. Create, wait until it is *Running*, and copy the **Public IP address**.

> On a Free Tier account (not Pay As You Go), Oracle may reclaim servers that stay almost idle for 7 days. Upgrading to Pay As You Go avoids that, and Always Free resources stay free.

## 2. A name for the site (free)

HTTPS needs a name, not a bare IP address. Sign in at https://www.duckdns.org with Google or GitHub, create a subdomain such as `ledgerly` and enter the server's IP. The site becomes `https://ledgerly.duckdns.org`.

## 3. Install

From Windows Terminal (PowerShell), with your SSH key:

```powershell
ssh -i C:\path\to\ssh-key.key ubuntu@<PUBLIC_IP>
```

If Windows complains that the key's permissions are too open:
`icacls C:\path\to\ssh-key.key /inheritance:r /grant:r "$($env:USERNAME):(R)"`

On the server (use your own DuckDNS name):

```sh
git clone https://github.com/DavidMalkhasyan/Bank-System.git ledgerly
cd ledgerly
bash deploy/install.sh ledgerly.duckdns.org
```

The script installs Docker, opens the firewall, adds swap memory, turns on automatic security updates, creates `.env` with random passwords, then builds and starts everything. The first build takes about 5–10 minutes.

Then open `https://ledgerly.duckdns.org`. The HTTPS certificate is issued on the first visit, so the very first load can take 10–20 seconds. The demo accounts are loaded automatically (password `password123` for `alex@example.com` and `admin@example.com`), and the demo data resets every 24 hours.

Log out and back in once, so `docker compose` works without `sudo`.

## 4. Everyday commands

| Task | Command (in `~/ledgerly`) |
| --- | --- |
| Update to the latest code | `git pull && docker compose up -d --build` |
| See what is running | `docker compose ps` |
| Logs of one part | `docker compose logs -f app` (or `db`, `caddy`) |
| Restart everything | `docker compose restart` |
| Reload the demo data now | `docker compose exec app node backend/dist/db/seed.js --reset` |
| Stop / start | `docker compose down` / `docker compose up -d` |

Settings live in `.env` (`DEMO_RESET_HOURS=0` turns the daily reset off); run `docker compose up -d` after changing them. `docker compose down` keeps the database (it is in a Docker volume). **Never** run `docker compose down -v`: it deletes it.

## 5. Later: a real domain

At your domain registrar, create an **A record** pointing to the server's IP, then put the domain in `.env` (`SITE_ADDRESS=bank.example.com`) and run `docker compose up -d`. Caddy gets the new certificate on its own.
