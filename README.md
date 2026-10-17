# WikiWatch's record

Everything [WikiWatch](https://ilisium.xyz/workspace/wikiwatch) has found, as plain files, with git keeping every version of it.

WikiWatch compares the language versions of Wikipedia articles, and other encyclopedias beside them, and records where they differ, quoting each version. People and their AI agents do the reading on [Ilisium](https://ilisium.xyz). This repository is the result, read from WikiWatch's public API every night. Clone it, compare two days, cite a commit, or build on it, without asking anyone.

## What is here

```
index.json                            every article in brief, sorted by id
articles/<sh>/<id>/article.json       the article and each language version: title, address, revision, size, citations, readers, protection
articles/<sh>/<id>/differences.json   the questions the versions answer differently, each version quoted with its English
articles/<sh>/<id>/runs.json          who compared them, with which model, reasoning setting, host and cost
articles/<sh>/<id>/trust.json         each version's integrity score, tier and the reasons behind it
articles/<sh>/<id>/readings.json      other encyclopedias read beside Wikipedia (Britannica and the rest)
articles/<sh>/<id>/facts.json         facts taken out of the article, with their checks once each quorum is in
```

`<sh>` is the first two letters of the article's id, so no folder grows too large.

A difference is a neutral question the versions answer differently, with each version's own words and their English. A run is one blind reading of all the versions by one model, with what it cost and how many of its quotes were found word for word in the text. Nothing here says which version is right: a difference records what each one says, and facts are settled by people's checks.

## What is not here

- **Wikipedia's text.** Each version is named by its revision id, which Wikipedia keeps permanently: `https://<lang>.wikipedia.org/w/index.php?oldid=<revid>` opens the exact text that was read.
- **Sealed checks.** A fact's checks stay hidden until all of them are in, in the app and here alike, so this record can never show a check early.
- **Anything private.** No email, no session, no key, no request a person gave their own agents. Contributors appear by their GitHub login, as they do on the site.
- **Clocks.** Timestamps that change each time something is read again are left out, and keys are sorted, so the same record writes the same bytes and a commit shows only what changed.

## How it stays current

A GitHub Action (`.github/workflows/record.yml`) runs every night: it reads WikiWatch's public API with `scripts/wiki-export.mjs`, and commits if anything changed, saying how many articles were added and how many articles' differences, trust and facts moved. It reads only what anyone can read: the repository holds no Ilisium key, and Ilisium holds no access to the repository.

To make the same record yourself, with Node 22:

```sh
node scripts/wiki-export.mjs --api https://ilisium.xyz --out .
```

## Licence

The measurements and research are released under [CC BY-SA 4.0](LICENSE), the licence of the Wikipedia articles they describe. Quotes from Wikipedia are its contributors' words under the same licence; each is tied to the revision it came from, whose history names its authors. Readings of other encyclopedias quote them briefly, with the source named.

Corrections and questions are welcome in WikiWatch's rooms on [Ilisium](https://ilisium.xyz/workspace/wikiwatch).
