import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relPath) {
  return readFileSync(path.join(root, relPath), 'utf8');
}

function fail(message) {
  console.error(`[security] ${message}`);
  process.exitCode = 1;
}

function ok(message) {
  console.log(`[security] ${message}`);
}

function assertIncludes(file, text, fragment) {
  if (!text.includes(fragment)) {
    fail(`${file} missing required fragment: ${fragment}`);
  }
}

function assertExcludes(file, text, fragment) {
  if (text.includes(fragment)) {
    fail(`${file} contains forbidden fragment: ${fragment}`);
  }
}

function assertNoRemoteScriptSrc(file, text) {
  const remoteScripts = [...text.matchAll(/<script\b[^>]*\bsrc=["']https?:\/\//gi)];
  if (remoteScripts.length) {
    fail(`${file} contains remote script src tags`);
  }
}

function assertBlankLinksAreIsolated(file, text) {
  const blankLinks = [...text.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)];
  for (const match of blankLinks) {
    const tag = match[0];
    if (!/\brel=["'][^"']*\bnoopener\b[^"']*\bnoreferrer\b[^"']*["']/i.test(tag)) {
      fail(`${file} has target="_blank" link without rel="noopener noreferrer": ${tag.slice(0, 160)}`);
    }
  }
}

function contentSecurityPolicy(text) {
  const cspMeta = [...text.matchAll(/<meta\b[^>]*>/gi)]
    .map((match) => match[0])
    .find((tag) => /\bhttp-equiv=["']Content-Security-Policy["']/i.test(tag));
  if (!cspMeta) {
    return '';
  }
  return cspMeta.match(/\bcontent="([^"]*)"/i)?.[1]
    || cspMeta.match(/\bcontent='([^']*)'/i)?.[1]
    || '';
}

function cspSha256(text) {
  const browserScriptText = String(text || '').replace(/\r\n?/g, '\n');
  return `'sha256-${createHash('sha256').update(browserScriptText, 'utf8').digest('base64')}'`;
}

function inlineScriptHashes(text) {
  return [...text.matchAll(/<script\b(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => cspSha256(match[1]));
}

function assertScriptCspDoesNotAllowUnsafeInline(file, text) {
  const csp = contentSecurityPolicy(text);
  const scriptSrc = csp.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('script-src ')) || '';
  if (!scriptSrc) {
    fail(`${file} is missing script-src in CSP`);
    return;
  }
  if (scriptSrc.includes("'unsafe-inline'")) {
    fail(`${file} script-src still allows 'unsafe-inline'`);
  }
  if (!scriptSrc.includes("'self'")) {
    fail(`${file} script-src must include 'self' for local runtime assets`);
  }
}

function assertInlineScriptHashesAllowed(file, text) {
  const csp = contentSecurityPolicy(text);
  for (const hash of inlineScriptHashes(text)) {
    if (!csp.includes(hash)) {
      fail(`${file} CSP is missing inline script hash: ${hash}`);
    }
  }
}

const htmlFiles = ['index.html', 'v3_template.html', 'aaz-index.html'];
for (const file of htmlFiles) {
  const text = read(file);
  assertNoRemoteScriptSrc(file, text);
  assertBlankLinksAreIsolated(file, text);
  assertScriptCspDoesNotAllowUnsafeInline(file, text);
  assertExcludes(file, text, 'unpkg.com');
  assertExcludes(file, text, 'cdn.jsdelivr.net');
}

const template = read('v3_template.html');
assertIncludes('v3_template.html', template, "default-src 'self'");
assertIncludes('v3_template.html', template, "script-src 'self' __CSP_SCRIPT_HASHES__");
assertIncludes('v3_template.html', template, "worker-src 'self' blob:");
assertIncludes('v3_template.html', template, "object-src 'none'");
assertIncludes('v3_template.html', template, "base-uri 'self'");
assertIncludes('v3_template.html', template, "form-action 'self'");
assertIncludes('v3_template.html', template, '<script src="./vendor/leaflet.js"></script>');
assertIncludes('v3_template.html', template, '<link rel="stylesheet" href="./vendor/leaflet.css">');
assertExcludes('v3_template.html', template, 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js');

const landing = read('index.html');
assertIncludes('index.html', landing, "script-src 'self' 'sha256-");
assertInlineScriptHashesAllowed('index.html', landing);

const appHtml = read('aaz-index.html');
assertIncludes('aaz-index.html', appHtml, "script-src 'self' 'sha256-");
assertExcludes('aaz-index.html', appHtml, '__CSP_SCRIPT_HASHES__');
assertInlineScriptHashesAllowed('aaz-index.html', appHtml);

for (const file of ['sw.js', 'service-worker.js']) {
  const text = read(file);
  assertExcludes(file, text, 'unpkg.com');
  assertExcludes(file, text, 'cdn.jsdelivr.net');
  assertIncludes(file, text, './vendor/leaflet.css');
  assertIncludes(file, text, './vendor/leaflet.js');
}

const manifest = JSON.parse(read('manifest.webmanifest'));
if (manifest.start_url !== './aaz-index.html#v4/home/home') {
  fail('manifest.webmanifest start_url drifted');
}
for (const icon of manifest.icons || []) {
  if (!String(icon.src || '').startsWith('./')) {
    fail(`manifest icon must be same-origin relative: ${icon.src}`);
  }
}

if (!process.exitCode) {
  ok('Static security policy passed.');
}
