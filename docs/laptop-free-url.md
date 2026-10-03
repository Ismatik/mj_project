# Running on a laptop with no domain (Arch Linux)

Everything runs in Docker on the laptop; the site is published to the internet through
**Tailscale Funnel**, which hands out a free, permanent HTTPS address like
`https://mj.tail1234.ts.net`. No domain to buy, no static IP, no open ports, no monthly bill.

```
guest / Telegram / WhatsApp ──HTTPS──▶ Tailscale ══ outgoing connection ══ laptop → web:3000
```

The laptop only ever connects *out*, so this works behind any home router, mobile hotspot or
shared public IP. If you later buy a domain, switch to `docs/home-server.md` (Cloudflare Tunnel)
or a VPS — nothing in the app changes, only `SITE_DOMAIN`.

**Read "Honest limits" at the bottom before putting real guests on this.**

## 1. Packages

```bash
sudo pacman -Syu docker docker-compose git tailscale
sudo usermod -aG docker $USER
```

**Now reboot, before starting anything.** `pacman -Syu` upgrades the whole system, kernel included.
When it does, the running kernel's modules are gone from disk and the new ones are not in use yet —
so `docker.service` fails to start with nothing obviously wrong, because it cannot load `overlay`
and `br_netfilter`. The reboot also applies the `docker` group to your user. If you skip it and
`systemctl enable --now docker` fails, this is why; `uname -r` disagreeing with `pacman -Q linux`
confirms it.

```bash
sudo reboot
```

After it comes back:

```bash
sudo systemctl enable --now docker tailscaled
systemctl status docker --no-pager      # "active (running)"
docker ps                               # must work without sudo
```

## 2. The project

```bash
git clone https://github.com/Ismatik/mj_project && cd mj_project
cp .env.example .env
```

In `.env` set these. Leave `SITE_DOMAIN` alone for now — you don't know the address yet:

```ini
POSTGRES_PASSWORD=<long random password>
SEED_OWNER_PASSWORD=<the owner's first password>
COMPOSE_FILE=docker-compose.yml:docker-compose.laptop.yml
```

`COMPOSE_FILE` is what makes plain `docker compose …` pick up the laptop overrides: the app is
published on `127.0.0.1:3000` for Funnel to reach, and Caddy stays off (it wants ports 80/443 and
a real domain, and Funnel already terminates HTTPS).

Generate a password rather than inventing one:

```bash
openssl rand -base64 24
```

## 3. Start it

```bash
docker compose up -d --build       # first build takes a few minutes
docker compose ps                  # all "running"; migrate "exited (0)"
```

Load the starting data — accounts, service menu, website texts, **plus demo guests and bookings**:

```bash
docker compose run --rm migrate npx prisma db seed
```

> The seed **wipes the database**. Run it on a fresh install only, never once the salon has real
> bookings in it.

It should answer locally now:

```bash
curl -I http://127.0.0.1:3000          # HTTP/1.1 200 OK
```

## 4. The public address

```bash
sudo tailscale up                      # opens a browser link to sign in (Google/GitHub/email)
```

Funnel needs two things switched on once, in the Tailscale admin console:

- **DNS → MagicDNS** — on (gives the machine its `.ts.net` name)
- **DNS → HTTPS Certificates** — on

Then publish:

```bash
tailscale funnel --bg 3000
tailscale funnel status
```

The first run may refuse and print a link to enable Funnel for this machine — open it, approve, run
it again. `funnel status` prints the address:

```
https://mj.tail1234.ts.net (Funnel on)
|-- / proxy http://127.0.0.1:3000
```

Put that hostname — **without** `https://` — into `.env` and restart so links in messages and the
webhook addresses use it:

```ini
SITE_DOMAIN=mj.tail1234.ts.net
```

```bash
docker compose up -d
```

Open the address from your phone on mobile data (not home wifi — that would prove nothing).
`/login` is the CMS: `mavzuna` and the `SEED_OWNER_PASSWORD` you chose. **Change it after the first
sign-in.**

Funnel survives reboots once set with `--bg`; Docker brings the containers back by itself
(`restart: unless-stopped`).

## 5. Keep the laptop awake

**Do this one before anyone relies on the salon being online.** Until you do, closing the lid
suspends the laptop and the whole salon goes offline: the website stops answering, the till is
unreachable, reminders are not sent. Nothing is lost — it is a pause, not a crash — but guests see
nothing at all while it lasts.

```bash
# Closing the lid must not suspend
sudo sed -i 's/^#\?HandleLidSwitch=.*/HandleLidSwitch=ignore/; s/^#\?HandleLidSwitchExternalPower=.*/HandleLidSwitchExternalPower=ignore/; s/^#\?HandleLidSwitchDocked=.*/HandleLidSwitchDocked=ignore/' /etc/systemd/logind.conf
sudo systemctl restart systemd-logind
# No sleep at all
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
# Correct clock — bookings and reminders depend on it
sudo timedatectl set-ntp true
```

On GNOME or KDE also turn off "Automatic suspend" in the power settings. Keep it plugged in; a small
UPS for the **router** matters as much as one for the laptop.

No inbound ports are needed, so block everything incoming:

```bash
sudo pacman -S ufw && sudo ufw default deny incoming && sudo ufw enable
```

### If it did go to sleep (or was switched off)

Nothing has to be set up again. Open the lid, or press the power button, and sign in — Docker
starts with the machine and brings every container back (`restart: unless-stopped`), and Funnel
comes back with `tailscaled` because it was published with `--bg`. The site answers again on its
own, usually within a minute.

Check it really did, rather than assuming:

```bash
cd ~/mj_project
docker compose ps                  # postgres, web, worker, backup: "running"
tailscale funnel status            # "(Funnel on)" and the proxy line
curl -I http://127.0.0.1:3000      # HTTP/1.1 200 OK
```

Each line has one thing that fixes it, and only one:

| What is wrong | What to run |
|---|---|
| Containers are missing or `exited` | `docker compose up -d` |
| `docker ps` says the daemon is not running | `sudo systemctl start docker`, then `docker compose up -d` |
| `funnel status` is empty or says Funnel off | `sudo systemctl start tailscaled && tailscale funnel --bg 3000` |
| All three are fine but the phone cannot open the site | The laptop's internet is down, not the salon's software |

Nothing in the database is lost by a sleep, and messages already sitting in the outbox go out
within a minute of the worker coming back. Two things do not survive it, though:

- **Guests could not reach the salon** for as long as it lasted. A booking nobody could make is not
  queued anywhere; the guest saw a site that did not answer and went elsewhere.
- **Reminders whose moment passed are skipped, not sent late.** They are not queued in advance:
  every 10 minutes the worker looks for visits starting in 20–26 hours and in 1–3 hours
  (`src/lib/reminders.ts:8`). Sleep through the whole of one of those windows and that guest simply
  never gets reminded — a three-hour nap is enough to lose the "2 hours before" message for
  everyone due that afternoon.

Which is the real argument for the commands above: it is not about uptime as a number, it is that a
closed lid quietly drops reminders nobody will notice are missing.

## 6. Backups off the laptop

Daily dumps land in `./backups` — the same disk that will fail. Copy them, and the uploaded photos,
somewhere else. Setup and the nightly timer are in `docs/home-server.md` section 5; it is the same
here.

## Honest limits

This is free and it works, but know what you are choosing:

- **The address looks like `mj.tail1234.ts.net`.** Fine for the salon's own use and for a bot, odd on
  a business card. A `.tj` domain plus `docs/home-server.md` fixes that whenever you want.
- **Rate limits are weaker.** `src/server/client-ip.ts` trusts the first `X-Forwarded-For` entry
  unless `TRUST_CLOUDFLARE=1`. Behind Caddy or Cloudflare that header is rewritten and cannot be
  forged; it is not verified that Funnel does the same. Assume the per-address limit on the booking
  and callback forms can be bypassed by someone who tries. It still stops accidents, not attackers.
- **One laptop is one point of failure.** Closed lid, power cut, spilled tea — the salon's bookings
  are offline. The off-site backup is what makes that survivable rather than fatal.
- **Tailscale is a third party on the critical path.** Free personal use, but their account and their
  uptime now matter to the salon.
- **Not for heavy traffic.** Funnel is meant for personal services. A salon site is well within that;
  a viral Instagram post might not be.

A $5/month VPS plus a domain removes every line above. This is the right setup for trying the whole
thing end to end, for a soft launch, and for a salon that would rather not pay yet.

## Alternative: a throwaway address in two minutes

For a demo, with no account anywhere and nothing to configure:

```bash
docker run --rm --network host cloudflare/cloudflared:latest \
  tunnel --url http://127.0.0.1:3000
```

It prints a `https://something-random.trycloudflare.com` address that works immediately from
anywhere. **The address changes every time you restart it**, which breaks `SITE_DOMAIN`, the links
inside messages and any registered Telegram webhook — so it is for showing the product, not for
running it.
