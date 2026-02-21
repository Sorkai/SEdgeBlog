import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const outputPath = path.resolve(process.cwd(), 'apps/web/src/data/base-stats.json');
const apiBase = process.env.BRAIN_API_BASE_URL;
const apiKey = process.env.SERVER_API_KEY;

async function writeDefaultFile(reason) {
    const fallback = {
        generated_at: new Date().toISOString(),
        source: 'fallback',
        reason,
        items: []
    };
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(fallback, null, 2)}\n`, 'utf-8');
}

async function run() {
    if (!apiBase) {
        await writeDefaultFile('BRAIN_API_BASE_URL 未配置，写入空 Base 数据。');
        console.log('[fetch-base-data] skip: no BRAIN_API_BASE_URL');
        return;
    }

    const url = `${apiBase.replace(/\/$/, '')}/api/v1/base-stats`;
    const headers = {};
    if (apiKey) {
        headers['x-api-key'] = apiKey;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
        throw new Error(`请求失败 ${response.status} ${response.statusText}`);
    }

    const payload = await response.json();
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf-8');
    console.log(`[fetch-base-data] ok: ${url}`);
}

run().catch(async (error) => {
    console.warn(`[fetch-base-data] failed: ${error.message}`);
    await writeDefaultFile(error.message);
});
