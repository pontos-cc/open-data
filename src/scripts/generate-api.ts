import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { glob } from 'glob';

import { readJson, ensureDir, outputFile } from 'fs-extra/esm';

const SCHEMA_DIR = path.resolve('schemas');
const DATA_DIR = path.resolve('data');
const OUTPUT_DIR = path.resolve('api');

interface IndexEntry {
  lastUpdated: string;
  count: number;
  contentHash: string;
  url: string;
}

async function getFolders(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries.filter(e => e.isDirectory()).map(e => path.join(DATA_DIR, e.name) );
}

async function readJsonFiles(folder: string): Promise<any[]> {
  const pattern = path.join(folder, '*.json');
  const files = await glob(pattern);
  const data: any[] = [];
  for (const file of files) {
    if(file == path.join(folder, 'schema.json')) continue; // skip schema files
    const content = await readJson(file);
    data.push(content);
  }
  return data;
}

async function writeJson(filePath: string, data: any) {
  await outputFile(filePath, JSON.stringify(data, null, 2) + '\n');
}

async function loadFolderData(folderPath: string): Promise<{ data: any[], hash: string, count: number }> {
  const data = await readJsonFiles(folderPath);
  const rawArray = JSON.stringify(data);
  const hash = crypto.createHash('sha1').update(rawArray).digest('hex');
  return { data, hash, count: data.length };
}

async function generateUnitedJson(filename: string, folderData: { data: any[], hash: string, count: number }, lastUpdated: string): Promise<void> {
  const output = {
    lastUpdated,
    contentHash: folderData.hash,
    count: folderData.count,
    data: folderData.data
  };
  const outFile = path.join(OUTPUT_DIR, `${filename}.json`);
  await writeJson(outFile, output);
}

function generateIndexEntry(filename: string, lastUpdated: string, count: number, hash: string): IndexEntry {
  return {
    lastUpdated,
    count,
    contentHash: hash,
    url: `https://pontos-cc.github.io/open-data/api/${filename}.json`
  };
}

async function generate() {
  await ensureDir(OUTPUT_DIR);
  const folders = await getFolders(DATA_DIR);
  folders.push(SCHEMA_DIR);
  const index: Record<string, IndexEntry> = {};

  for (const folder of folders) {
    const folderData = await loadFolderData(folder);

    if (folderData.count === 0) continue; // skip empty

    const lastUpdated = new Date().toISOString();

    const filename = path.basename(folder);
    await generateUnitedJson(filename, folderData, lastUpdated);
    index[`${filename}.json`] = generateIndexEntry(filename, lastUpdated, folderData.count, folderData.hash);
  }

  await writeJson(path.join(OUTPUT_DIR, 'index.json'), index);
}

generate().catch(err => {
  console.error(err);
  process.exit(1);
});
