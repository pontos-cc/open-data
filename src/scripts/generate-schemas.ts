import fs from 'fs/promises';
import path from 'path';
import { quicktype, InputData, JSONInput, JSONSchemaInput, jsonInputForTargetLanguage } from 'quicktype-core';

const root = process.cwd();
const dataRoot = path.join(root, 'data');
const schemaRoot = path.join(root, 'schemas');

async function getDataFolders(): Promise<string[]> {
  const entries = await fs.readdir(dataRoot, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function readAllJsonFiles(dir: string): Promise<object[]> {
  let all: object[] = [];
  const files = await fs.readdir(dir);
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const content = await fs.readFile(path.join(dir, file), 'utf-8');
    try {
      const json = JSON.parse(content);
      if (Array.isArray(json)) {
        all.push(...json);
      } else if (json && typeof json === 'object') {
        all.push(json);
      }
    } catch (err) {
      console.warn(`⚠️ Skipping invalid JSON file: ${file}`);
    }
  }
  return all;
}

async function generateSchema(name: string, samples: object[]): Promise<string> {
  const jsonInput = jsonInputForTargetLanguage('schema');

  await jsonInput.addSource({
    name,
    samples: samples.map((s) => JSON.stringify(s)),
  });

  const inputData = new InputData();
  inputData.addInput(jsonInput);

  const result = await quicktype({
    inputData,
    lang: 'schema',
  });

  return result.lines.join('\n');
}

function formatSchemaForValidation(rawSchema: string): string {
  const schemaObj = JSON.parse(rawSchema);
  schemaObj.$schema = 'http://json-schema.org/draft-07/schema#';

  // If the schema uses definitions, extract the first one as root
  if (schemaObj.definitions && typeof schemaObj.definitions === 'object') {
    const keys = Object.keys(schemaObj.definitions);
    if (keys.length === 1) {
      const def = schemaObj.definitions[keys[0]];
      def.$schema = 'http://json-schema.org/draft-07/schema#';
    }
  }
  return JSON.stringify(schemaObj, null, 2);
}
async function generateSchemasForAllFolders() {
  const folders = await getDataFolders();

  for (const folder of folders) {
    const dataDir = path.join(dataRoot, folder);
    const outputFile = path.join(schemaRoot, `${folder}.json`);

    const items = await readAllJsonFiles(dataDir);
    if (items.length === 0) {
      console.log(`⚠️  Skipping ${folder}: no JSON data found.`);
      continue;
    }
    const rawSchema = await generateSchema(folder, items);
    try {
      let schemaObj = await formatSchemaForValidation(rawSchema);
      await fs.writeFile(outputFile, schemaObj + '\n');
      console.log(`✅ Generated schema: schemas/${folder}.schema.json (unwrapped from definitions)`);
      continue;
    } catch {
      await fs.writeFile(outputFile, rawSchema + '\n');
      console.warn(`⚠️  Could not parse schema as JSON for ${folder}, wrote raw string.`);
    }
  }
}

generateSchemasForAllFolders().catch((err) => {
  console.error('❌ Schema generation failed:', err);
  process.exit(1);
});
