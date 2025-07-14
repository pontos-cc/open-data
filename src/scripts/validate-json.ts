import fs from 'fs/promises';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const ajv = new Ajv({ allErrors: true, strict: false });
const root = process.cwd();
const dataRoot = path.join(root, 'data');
const schemaRoot = path.join(root, 'schemas');

async function getDataFolders() {
  const entries = await fs.readdir(dataRoot, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function loadSchema(folder: string): Promise<any | null> {
  try {
    const schemaPath = path.join(schemaRoot, `${folder}.json`);
    const raw = await fs.readFile(schemaPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    console.warn(`⚠️  Schema not found for ${folder}, skipping`);
    return null;
  }
}

async function loadJsonFiles(folder: string): Promise<{ file: string; data: any[] }[]> {
  const dataDir = path.join(dataRoot, folder);
  try {
    const files = await fs.readdir(dataDir);
    const jsonFiles = files.filter((f) => f.endsWith('.json') && f !== 'schema.json');
    const result: { file: string; data: any[] }[] = [];
    for (const file of jsonFiles) {
      const filePath = path.join(dataDir, file);
      try {
        const raw = await fs.readFile(filePath, 'utf8');
        const data = JSON.parse(raw);
        result.push({ file, data: Array.isArray(data) ? data : [data] });
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`\n❌ Failed to process data/${folder}/${file}: ${errorMessage}`);
      }
    }
    console.log(`✔️  Validated ${result.length} JSON files from data/${folder}`);
    return result;
  } catch {
    console.warn(`⚠️  No data directory for ${folder}, skipping`);
    return [];
  }
}

async function validate() {
  const folders = await getDataFolders();
  addFormats(ajv);

  let hasErrors = false;

  for (const folder of folders) {
    const schema = await loadSchema(folder);
    if (!schema) continue;

    const validateFn = ajv.compile(schema);
    const filesData = await loadJsonFiles(folder);

    for (const { file, data } of filesData) {
      for (const item of data) {
        const valid = validateFn(item);
        if (!valid) {
          hasErrors = true;
          console.error(`\n❌  Validation errors in data/${folder}/${file}:`);
          for (const err of validateFn.errors || []) {
            console.error(`  - ${err.instancePath} ${err.message}`);
          }
        }
      }
    }
  }

  if (hasErrors) {
    process.exit(1);
  } else {
    console.log('✅ JSON files validation completed successfully.');
  }
}

validate().catch((err) => {
  console.error(err);
  process.exit(1);
});
