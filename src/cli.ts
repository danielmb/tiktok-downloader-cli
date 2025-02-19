#!/usr/bin/env node
import fs from 'fs';
import puppeteer from 'puppeteer-extra';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import got from 'got';
import { createWriteStream } from 'fs';
import cliProgress from 'cli-progress';
import ora from 'ora';
import puppeteerExtraPluginStealth from 'puppeteer-extra-plugin-stealth';
puppeteer.use(puppeteerExtraPluginStealth());

const regex = /@(?<username>[^/]+)\/video\/(?<id>\d+)/;

/**
 * Downloads a file using a streaming request via got while displaying a progress bar.
 * Passes custom headers to mimic the Puppeteer session.
 */
async function downloadFileWithProgress(
  url: string,
  outputPath: string,
  headers: Record<string, string>,
) {
  // Try to get the file size via a HEAD request
  let totalBytes = 0;
  try {
    const headResponse = await got.head(url, { headers });
    const cl = headResponse.headers['content-length'];
    if (cl) {
      totalBytes = parseInt(cl, 10);
    }
  } catch (err) {
    console.error('Could not retrieve file size:', err);
  }

  // Initialize the progress bar
  const progressBar = new cliProgress.SingleBar({
    format: 'Downloading [{bar}] {percentage}% | {value}/{total} bytes',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });
  if (totalBytes) {
    progressBar.start(totalBytes, 0);
  } else {
    // If unknown, start with a dummy total value
    progressBar.start(1, 0);
  }

  // Start the download stream with custom headers
  const downloadStream = got.stream(url, { headers });
  const fileWriterStream = createWriteStream(outputPath);

  let downloadedBytes = 0;
  downloadStream.on('data', (chunk: Buffer) => {
    downloadedBytes += chunk.length;
    if (totalBytes) {
      progressBar.update(downloadedBytes);
    }
  });

  downloadStream.pipe(fileWriterStream);

  return new Promise<void>((resolve, reject) => {
    fileWriterStream.on('finish', () => {
      progressBar.stop();
      resolve();
    });
    fileWriterStream.on('error', (error) => {
      progressBar.stop();
      reject(error);
    });
  });
}

/**
 * Uses Puppeteer to extract the video source URL and session headers,
 * then downloads the video file using those headers.
 */
async function downloadVideo(url: string, outputPath?: string) {
  const spinner = ora();

  spinner.start('Extracting video info from URL...');
  const match = url.match(regex);
  if (!match?.groups) {
    spinner.fail('Invalid URL');
    process.exit(1);
  }
  const { username, id } = match.groups;
  if (!username || !id) {
    spinner.fail('Invalid URL');
    process.exit(1);
  }
  spinner.succeed('Video info extracted.');

  spinner.start('Launching browser...');
  const browser = await puppeteer.launch({ headless: true });
  spinner.succeed('Browser launched.');

  spinner.start('Opening video page...');
  const page = await browser.newPage();
  await page.goto(url);
  spinner.succeed('Video page opened.');

  spinner.start('Waiting for video element...');
  await page.waitForSelector('video');
  spinner.succeed('Video element detected.');

  spinner.start('Extracting video source URL...');
  const videoSrc = await page.evaluate(() => {
    const video = document.querySelector('video > source');
    return video?.getAttribute('src');
  });
  if (!videoSrc) {
    spinner.fail('No video found');
    await browser.close();
    process.exit(1);
  }
  spinner.succeed('Video source URL extracted.');

  spinner.start('Extracting session data...');
  const userAgent = await page.evaluate(() => navigator.userAgent);
  const cookies = await page.cookies();
  const cookieString = cookies
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
  spinner.succeed('Session data extracted.');

  // Prepare headers to simulate the same session when downloading the video
  const headers: Record<string, string> = {
    'User-Agent': userAgent,
    Cookie: cookieString,
    Referer: url,
  };

  // Determine the output file name
  const filePath = outputPath || `${username}_${id}.mp4`;
  spinner.info(`Downloading video from ${videoSrc} to ${filePath}`);

  spinner.start('Closing browser...');
  await browser.close();
  spinner.succeed('Browser closed.');

  // Stop the spinner before starting the download progress bar
  spinner.stop();

  try {
    await downloadFileWithProgress(videoSrc, filePath, headers);
    console.log(`Video saved as ${filePath}`);
  } catch (err) {
    console.error('Error downloading video:', err);
    process.exit(1);
  }
}

// CLI setup using yargs
yargs(hideBin(process.argv))
  .command(
    'download <url>',
    'Download a TikTok video',
    (yargs) => {
      return yargs
        .positional('url', {
          describe: 'The URL of the TikTok video',
          type: 'string',
        })
        .option('output', {
          alias: 'o',
          describe: 'Output file path',
          type: 'string',
        });
    },
    async (argv) => {
      const url = argv.url as string;
      const output = argv.output as string | undefined;
      try {
        await downloadVideo(url, output);
      } catch (error) {
        console.error('Error downloading video:', error);
        process.exit(1);
      }
    },
  )
  .demandCommand(1, 'You need to specify a command')
  .help().argv;
