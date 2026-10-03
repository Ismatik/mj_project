<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

(The block above is generated. Everything below is ours and is not rewritten by `next dev`.)

# Nothing may read as machine-written

This is a real salon's software. Guests read the bot and the site; the owner reads the CMS and these
docs. Anything that looks generated costs trust, so it is a defect like any other.

**Punctuation is ASCII.** Hyphen `-` only. No em dash `—`, no en dash `–`, not in guest-facing text,
not in comments, not in docs, not in commit messages. A range is `20-26 hours`, an aside is `like
this - plain`. (`--` stays only where it is syntax: CSS custom properties, CLI flags,
`eslint-disable ... --` justifications.)

**No decoration.** No box-drawing rules in comments (`// ─── Section ─────`): write `// Section`.
No emoji headings, no ✅/❌ in tables - words say it better. The `✦` in the brand marks is design,
not decoration, and stays.

**No filler.** Cut "it's important to note", "comprehensive", "robust", "seamless", "delve",
"leverage" as a verb, "in today's world". Do not open a reply by restating the question. Do not
close by offering three things you could do next.

**Comments say why, never what.** `// increment the counter` is noise. `// Reception cancels at the
desk, so nobody has told the master` is worth the line. If a comment restates the code, delete it.

**Say what is true.** Tests failed - say so, with the output. A step was skipped - say that. Not
checked against the running server - say that too. Confidence that was not earned is the most
expensive machine tell there is.

A mechanical sweep for the punctuation rules:

```bash
grep -rnP "[\x{2013}\x{2014}\x{2500}-\x{257F}]" --include="*.ts" --include="*.tsx" --include="*.css" \
  --include="*.md" src/ docs/ prisma/ worker/ e2e/ README.md | grep -v "^src/generated/"
```
