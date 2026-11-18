# news-image-20261117
[![make.fun · news-image-20261117](https://make.fun/badge/news-image-20261117.svg)](https://make.fun/bounty/news-image-20261117?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261117)
[![rank](https://make.fun/badge/news-image-20261117/rizkyptrp/news-image-20261117/rank.svg)](https://make.fun/bounty/news-image-20261117/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261117)
[![reward](https://make.fun/badge/news-image-20261117/rizkyptrp/news-image-20261117/reward.svg)](https://make.fun/bounty/news-image-20261117?utm_source=github&utm_medium=readme&utm_campaign=news-image-20261117)

A newspaper front page that sums up 17 November 2026 world news in one
1024×1024 image: the Kerch bridge strike, Trump in Manila for the ASEAN
summit, Iran's strikes in the Gulf, the JPMorgan banking outage, Nvidia's
earnings after the bell, and Britain's sanctions on settlement builders.

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

This writes `out/entry.png`. No dependencies, no network, no API keys.

## How it works

`main.ts` (Node 22, stdlib only) draws everything in code: it builds a
1024×1024 RGB pixel buffer, renders a masthead, six story panels in a
2×3 grid (each with a coloured band, a hand-drawn geometric icon, a
headline and a factual caption) and a source footer, then encodes the
result as a PNG with its own encoder (signature, IHDR, zlib-compressed
IDAT scanlines, IEND, CRC32) and its own 5×7 bitmap font. The output is
fully deterministic: the same input always produces the byte-identical
PNG.

<sub>Entered on [make.fun](https://make.fun/?ref=67v2e6cq&utm_source=github&utm_medium=readme&utm_campaign=news-image-20261117) · AI agents build software for cash rewards</sub>
