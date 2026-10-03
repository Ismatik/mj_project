# Running on a laptop or home computer (Arch Linux)

The whole platform runs in Docker, so a laptop at home can host it. The only thing a home connection
can't do is **accept incoming connections**: most home lines share one public IP between many customers,
the IP changes, or ports 80/443 are closed. Guests' phones, Telegram and WhatsApp must reach the site, so we use a
**Cloudflare Tunnel**: the laptop opens an *outgoing* connection to Cloudflare and visitors reach the site through it.
No open ports, no static IP, HTTPS certificate by Cloudflare. Free.

```
guest / Telegram / WhatsApp  HTTPS ▶ Cloudflare ◀  tunnel (outgoing)   laptop: cloudflared → web:3000
```

In this mode the `cloudflared` container replaces Caddy (`docker-compose.tunnel.yml`).
On a VPS or a line with a static IP you don't need any of this - see "Run on a server" in the README.

## 1. Domain in Cloudflare

1. Create a free account at dash.cloudflare.com → **Add a site** → enter the domain (e.g. `mavzunaijovid.tj`) → **Free** plan.
2. Cloudflare shows two nameservers. At the domain registrar, replace the domain's nameservers with those two.
   It takes from minutes to a day; Cloudflare emails when the domain is active.
   (No domain yet? Cloudflare Registrar sells `.com` at cost; for `.tj` use a Tajik registrar and point it to Cloudflare as above.)
3. SSL/TLS → Edge Certificates → turn on **Always Use HTTPS**.

## 2. The tunnel

1. dash.cloudflare.com → **Zero Trust** → Networks → **Tunnels** → **Create a tunnel** → *Cloudflared* → name it `mj-laptop`.
2. On "Install and run a connector" choose **Docker**. The command shown ends with `--token eyJhIjoi…` - copy only that long token.
3. **Next** → *Public hostname*:
   - Subdomain: empty · Domain: `mavzunaijovid.tj`
   - Service: type **HTTP**, URL **`web:3000`**
   - Save. Add a second hostname `www` with the same service if you want `www.` to work too.

## 3. The laptop

```bash
sudo pacman -Syu docker docker-compose git
sudo usermod -aG docker $USER
sudo reboot                            # see the note below - do not skip this
```

`pacman -Syu` upgrades the whole system, kernel included. When it does, the running kernel can no
longer load modules (they were replaced on disk), so `docker.service` fails to start until you
reboot - it cannot load `overlay` and `br_netfilter`. The reboot also applies the `docker` group.
`uname -r` disagreeing with `pacman -Q linux` is the tell.

```bash
sudo systemctl enable --now docker
systemctl status docker --no-pager     # "active (running)"
docker ps                              # must work without sudo
git clone https://github.com/Ismatik/mj_project && cd mj_project
cp .env.example .env
```

In `.env` set:

```ini
POSTGRES_PASSWORD=<long random password>
SEED_OWNER_PASSWORD=<owner's first password>
SITE_DOMAIN=mavzunaijovid.tj
COMPOSE_FILE=docker-compose.yml:docker-compose.tunnel.yml
CLOUDFLARE_TUNNEL_TOKEN=<token from step 2>
```

Start everything (database, migrations, website, worker, daily backups, tunnel):

```bash
docker compose up -d --build
docker compose ps                      # all "running"; migrate "exited (0)"
docker compose logs cloudflared | tail # "Registered tunnel connection" ×4
```

In the Cloudflare tunnel page the status turns **Healthy**. Open `https://mavzunaijovid.tj` - the website;
`/login` - the CMS (login `mavzuna`, the password from `SEED_OWNER_PASSWORD`; change it after the first sign-in).

The first time only, load the starting data - it creates the sign-in accounts (owner, reception, content manager,
a master), the service menu, website texts and settings, **plus demo guests, bookings and sales** for trying things out:

```bash
docker compose run --rm migrate npx prisma db seed
```

The seed wipes the database, so run it only on a fresh install, never once the salon is using the system.

Then connect the bot and WhatsApp as usual (CMS → Интеграции; `docs/whatsapp-setup.md`, `docs/instagram-setup.md`).
The webhook addresses are on your domain, so they work through the tunnel.

## 4. Keep the laptop awake and running

The salon's site, till and reminders stop whenever the laptop sleeps or is off.

```bash
# Closing the lid must not suspend
sudo sed -i 's/^#\?HandleLidSwitch=.*/HandleLidSwitch=ignore/; s/^#\?HandleLidSwitchExternalPower=.*/HandleLidSwitchExternalPower=ignore/; s/^#\?HandleLidSwitchDocked=.*/HandleLidSwitchDocked=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind
# No sleep at all
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
# Correct clock (bookings and reminders depend on it)
sudo timedatectl set-ntp true
```

If you use a desktop environment (GNOME, KDE), also turn off "Automatic suspend" in its power settings.
Keep the laptop plugged in - its battery covers short power cuts; a small UPS for the **router** keeps the internet up too.
After a reboot Docker starts by itself and brings all containers back (`restart: unless-stopped`); nobody needs to log in.

No inbound ports are needed, so a firewall can block everything incoming (`sudo pacman -S ufw && sudo ufw default deny incoming && sudo ufw enable`).
The database listens only on the laptop itself (127.0.0.1).

## 5. Backups off the laptop

Dumps are written daily to `./backups` - on the same disk. Copy them, and the uploaded photos, elsewhere:

```bash
sudo pacman -S rclone
rclone config                          # once: add a remote, e.g. Google Drive named "gdrive"
deploy/offsite-backup.sh gdrive:mj-backups
```

Run it every night with a user timer:

```bash
mkdir -p ~/.config/systemd/user
cat > ~/.config/systemd/user/mj-backup.service <<UNIT
[Service]
Type=oneshot
WorkingDirectory=%h/mj_project
ExecStart=%h/mj_project/deploy/offsite-backup.sh gdrive:mj-backups
UNIT
cat > ~/.config/systemd/user/mj-backup.timer <<UNIT
[Timer]
OnCalendar=*-*-* 22:30
Persistent=true
[Install]
WantedBy=timers.target
UNIT
systemctl --user enable --now mj-backup.timer
sudo loginctl enable-linger $USER      # run user timers without being logged in
```

Restore on any machine (fresh, empty database):

```bash
gunzip -c backups/last/mj-latest.sql.gz | docker compose exec -T postgres psql -U mj mj
docker compose cp backups/media/. web:/app/media
```

## 6. Updates

On Mondays (the salon is closed):

```bash
cd ~/mj_project
git pull
docker compose up -d --build           # migrations run automatically
sudo pacman -Syu                       # system updates; reboot if the kernel was updated
```

## Moving to a VPS later

1. On the VPS: install Docker, clone the repository, copy `.env` **without** the `COMPOSE_FILE` and `CLOUDFLARE_TUNNEL_TOKEN` lines
   (Caddy then serves HTTPS itself).
2. Restore the latest dump and `backups/media` (section 5).
3. In Cloudflare DNS, point the domain to the VPS IP (an `A` record, *DNS only*), and delete the tunnel.
4. Stop the laptop: `docker compose down`.

## When something goes wrong

| Symptom | Check |
|---|---|
| Site doesn't open, Cloudflare error 1033 | The tunnel is down: laptop off/asleep or no internet. `docker compose logs cloudflared`. |
| Cloudflare error 502 | Tunnel up but the app isn't: `docker compose ps`, `docker compose logs web`. Check the hostname service is `web:3000`, type HTTP. |
| `CLOUDFLARE_TUNNEL_TOKEN` error on start | The token is missing in `.env`. |
| Telegram bot silent | CMS → Интеграции → «Подключить webhook» again after the domain started working. |
