import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { chromium } from '@playwright/test';

const names = readdirSync('public/audio').filter((name) => /\.(?:mp3|m4a|wav)$/i.test(name)).sort();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('http://localhost:4173/?mock=1', { waitUntil: 'domcontentloaded' });
const results = await page.evaluate(async (files) => {
  const context = new AudioContext();
  const rows = [];
  for (const name of files) {
    try {
      const response = await fetch(`audio/${name}`);
      const bytes = await response.arrayBuffer();
      const buffer = await context.decodeAudioData(bytes);
      let sum = 0;
      let peak = 0;
      let samples = 0;
      for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const data = buffer.getChannelData(channel);
        for (const value of data) {
          sum += value * value;
          peak = Math.max(peak, Math.abs(value));
          samples += 1;
        }
      }
      const rms = Math.sqrt(sum / Math.max(1, samples));
      rows.push({ name, ok: true, duration: Number(buffer.duration.toFixed(3)), channels: buffer.numberOfChannels, peakDb: Number((20 * Math.log10(Math.max(peak, 1e-9))).toFixed(1)), rmsDb: Number((20 * Math.log10(Math.max(rms, 1e-9))).toFixed(1)) });
    } catch (error) {
      rows.push({ name, ok: false, error: String(error) });
    }
  }
  await context.close();
  return rows;
}, names);
await browser.close();
mkdirSync('test-results', { recursive: true });
writeFileSync('test-results/audio-analysis.json', `${JSON.stringify(results, null, 2)}\n`);
const failed = results.filter((row) => !row.ok);
const silent = results.filter((row) => row.ok && row.rmsDb <= -80);
console.log(JSON.stringify({ files: results.length, failed, silent, victory: results.find((row) => row.name === 'victory_drive.wav') }, null, 2));
if (failed.length || silent.length) process.exitCode = 1;
