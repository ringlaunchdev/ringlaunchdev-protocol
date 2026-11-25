# Ringlaunch

**A loop that rewards the ones who stay.**

[![Live site](https://img.shields.io/badge/live-ringlaunch.dev-00b9ff)](https://ringlaunch.dev)
![Chain](https://img.shields.io/badge/chain-Solana-0d2b6b)

Contract address (CA): `TBA — not announced yet`

## Overview

Ringlaunch is a Solana launchpad with one idea: a token debuts, trading feeds a reward stream, and whoever keeps their tokens gets served first. This repository holds the public site plus its live market desk.

## Features

- Always-visible contract address slot with click-to-copy (inert before announcement)
- Live Solana market desk: top boosted tokens, polled each minute, paused while hidden
- Pinned first row for RING, fed by DexScreener and pump.fun side by side once the CA exists
- Scrolling price ticker built from identical live data
- Reduced-motion fallback for all animation

## Links

- Site: https://ringlaunch.dev
- X: https://x.com/ringlaunchdev
- Whitepaper: [docs/whitepaper.md](docs/whitepaper.md)

## Build

```
npm install
npm run assets   # regenerate logo sizes and favicon from brand/
npm run build    # output in dist/
npm run verify   # gate checks against dist/
```
