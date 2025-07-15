import { promises as fs } from 'fs';
import path from 'path';
import dotenvx from '@dotenvx/dotenvx';
dotenvx.config();

const API_KEY = process.env.EXCHANGE_API_KEY;
const BASE_CURRENCIES = process.env.BASE_CURRENCIES;

if (!API_KEY) {
  console.error('EXCHANGE_API_KEY is not set');
  process.exit(1);
}
if (!BASE_CURRENCIES) {
  console.error('BASE_CURRENCIES is not set');
  process.exit(1);
}

const BASES: string[] = BASE_CURRENCIES.split(',').map(s => s.trim()).filter(Boolean);
const OUT_DIR = path.resolve('data', 'exchange-rate');

interface ExchangeRateResponse {
  result: string;
  documentation: string;
  terms_of_use: string;
  time_last_update_unix: number;
  time_last_update_utc: string;
  time_next_update_unix: number;
  time_next_update_utc: string;
  base_code: string;
  conversion_rates: Record<string, number>;
}
interface ExchangeRateJson {
  baseCode: string;
  conversionRates: Record<string, number>;
  timeLastUpdateUnix: number;
  timeLastUpdateUtc: string;
  timeNextUpdateUnix: number;
  timeNextUpdateUtc: string;
}

async function fetchRates(base: string): Promise<ExchangeRateJson> {
  const url = `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${base}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${base}: ${res.status} ${res.statusText}`);
  }

  return formatExchangeRateJson(await res.json());
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

export function formatExchangeRateJson(input: Record<string, any>): ExchangeRateJson {
  const excludedKeys = ['result', 'documentation', 'terms_of_use'];
  const formattedInput: ExchangeRateJson = {} as ExchangeRateJson;
  for (const key in input) {
    if (excludedKeys.includes(key)) continue;

    const camelKey = toCamelCase(key);
    if (
      camelKey === 'baseCode' ||
      camelKey === 'conversionRates' ||
      camelKey === 'timeLastUpdateUnix' ||
      camelKey === 'timeLastUpdateUtc' ||
      camelKey === 'timeNextUpdateUnix' ||
      camelKey === 'timeNextUpdateUtc'
    ) {
      (formattedInput as any)[camelKey] = input[key];
    }
  }
  return formattedInput;
}

async function saveRates(base: string, data: ExchangeRateJson): Promise<void> {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const file = path.join(OUT_DIR, `${base}.json`);
  await fs.writeFile(file, JSON.stringify(data, null, 2) + '\n');
}

async function main(): Promise<void> {
  for (const base of BASES) {
    const data = await fetchRates(base);
    await saveRates(base, data);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
