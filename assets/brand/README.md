# Brand marks for the Telegram bot

What BotFather is holding, kept here so it can be found and regenerated rather than guessed at.

| File | Where it goes | Size |
|---|---|---|
| `bot-avatar.png` | BotFather `/setuserpic` | 512x512 |
| `bot-description.png` | BotFather, Edit Bot - Description Picture | 640x360 |

Both are drawn from the same tokens as the site - ink `#26221d`, gold `#b8a06a`, cream `#f2ede3` -
so the bot does not look like a different business from the website.

To change them, edit the script and run it; neither needs a design tool. Each draws several
variants into the scratch folder `run-output/avatar/`, which is gitignored - pick one and copy it
here under the name above:

```bash
node assets/brand/make-avatar.mjs        # a-dark, b-cream, b-dark-clean, c-cream, c-gold, d-gold
node assets/brand/make-description.mjs   # welcome-a, welcome-b
cp run-output/avatar/b-dark-clean.png assets/brand/bot-avatar.png
cp run-output/avatar/welcome-a.png     assets/brand/bot-description.png
```

`b-dark-clean` is the one in use: dark, no wordmark. Telegram renders the avatar at about 40px in a
chat list, and at that size any lettering turns to mud - `make-avatar.mjs` ends by writing
`z-tiny.png`, a contact sheet of all six at 40px, which is the only honest way to choose.
