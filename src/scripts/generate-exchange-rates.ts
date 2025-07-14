import { promises as fs } from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

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
const OUT_DIR = path.resolve('data', 'exchange-rates');

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

async function fetchRates(base: string): Promise<ExchangeRateResponse> {
  const url = `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/${base}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${base}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

async function saveRates(base: string, data: ExchangeRateResponse): Promise<void> {
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
