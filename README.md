# TikTok Downloader CLI

## Prerequisites

* Node.js

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/danielmb/tiktok-downloader-cli.git
cd tiktok-downloader-cli
```

### 2. Setup the project

```bash
npm run setup
```

## Usage

```bash
tiktok download <url>
```

## How it works

To avoid TikTok's anti-bot protection, the CLI uses a headless browser to fetch the video URL.
It uses [puppeteer](<https://github.com/puppeteer/puppeteer/>),
[puppeteer-extra](<https://github.com/berstend/puppeteer-extra>),
[puppeteer-extra-plugin-stealth](<https://github.com/berstend/puppeteer-extra>).
