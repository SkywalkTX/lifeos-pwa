const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(root, name), 'utf8');

test('loads data and AI contracts before the app', () => {
  const html = read('index.html');
  const dataIndex = html.indexOf('src="data-model.js"');
  const aiIndex = html.indexOf('src="ai-provider.js"');
  const appIndex = html.indexOf('src="app.js"');
  assert.ok(dataIndex > 0);
  assert.ok(aiIndex > dataIndex);
  assert.ok(appIndex > aiIndex);
});

test('contains the interactive area-detail contracts', () => {
  const html = read('index.html');
  ['area-detail', 'item-form', 'item-list', 'log-form', 'recent-log-list', 'recent-days-list'].forEach((id) => {
    assert.match(html, new RegExp(`id="${id}"`));
  });
});

test('offline shell includes every runtime script', () => {
  const worker = read('service-worker.js');
  ['data-model.js', 'ai-provider.js', 'app.js', 'styles.css', 'manifest.webmanifest'].forEach((asset) => {
    assert.match(worker, new RegExp(asset.replace('.', '\\.')));
  });
});

test('published source contains no API secrets or private project paths', () => {
  const names = [
    'index.html', 'styles.css', 'app.js', 'data-model.js', 'ai-provider.js', 'service-worker.js', 'manifest.webmanifest',
    'gateway/contracts.mjs', 'gateway/prompts.mjs', 'gateway/providers.mjs', 'gateway/worker.mjs', 'gateway/wrangler.jsonc'
  ];
  const source = names.map(read).join('\n');
  assert.doesNotMatch(source, /sk-[A-Za-z0-9_-]{16,}/);
  assert.doesNotMatch(source, /(?:OPENAI|DEEPSEEK)_API_KEY\s*=\s*[^\s"']+/);
  assert.doesNotMatch(source, /LIFEOS_ACCESS_TOKEN\s*=\s*[^\s"']+/);
  assert.doesNotMatch(source, /firstVault|D:\\Document\\DataImmortality\\raw/i);
});
