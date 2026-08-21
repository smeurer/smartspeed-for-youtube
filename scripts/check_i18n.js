#!/usr/bin/env node

/**
 * i18n Validation Script for SmartSpeed for YouTube
 *
 * Verifies key symmetry between _locales/en/messages.json and _locales/de/messages.json,
 * scans HTML, JS, and manifest.json files for referenced i18n keys, and flags missing translations.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const LOCALES_DIR = path.join(ROOT_DIR, '_locales');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const RESET = '\x1b[0m';

let errorsCount = 0;
let warningsCount = 0;

function logHeader(title) {
  console.log(`\n${CYAN}=== ${title} ===${RESET}`);
}

function logError(msg) {
  errorsCount++;
  console.log(` ${RED}✖ ${msg}${RESET}`);
}

function logWarning(msg) {
  warningsCount++;
  console.log(` ${YELLOW}⚠ ${msg}${RESET}`);
}

function logSuccess(msg) {
  console.log(` ${GREEN}✔ ${msg}${RESET}`);
}

// 1. Read Locales
logHeader('1. Locales Files Check');

const enPath = path.join(LOCALES_DIR, 'en', 'messages.json');
const dePath = path.join(LOCALES_DIR, 'de', 'messages.json');

if (!fs.existsSync(enPath)) {
  logError(`Missing English locale file: _locales/en/messages.json`);
  process.exit(1);
}

if (!fs.existsSync(dePath)) {
  logError(`Missing German locale file: _locales/de/messages.json`);
  process.exit(1);
}

let enMessages = {};
let deMessages = {};

try {
  enMessages = JSON.parse(fs.readFileSync(enPath, 'utf8'));
  logSuccess(`Loaded _locales/en/messages.json (${Object.keys(enMessages).length} keys)`);
} catch (e) {
  logError(`Failed to parse _locales/en/messages.json: ${e.message}`);
}

try {
  deMessages = JSON.parse(fs.readFileSync(dePath, 'utf8'));
  logSuccess(`Loaded _locales/de/messages.json (${Object.keys(deMessages).length} keys)`);
} catch (e) {
  logError(`Failed to parse _locales/de/messages.json: ${e.message}`);
}

// 2. Key Symmetry Check
logHeader('2. Key Symmetry Check (EN vs DE)');

const enKeys = Object.keys(enMessages);
const deKeys = Object.keys(deMessages);

enKeys.forEach(key => {
  if (!deMessages[key]) {
    logError(`Key '${key}' defined in EN but missing in DE (de/messages.json)`);
  } else if (!deMessages[key].message || deMessages[key].message.trim() === '') {
    logError(`Key '${key}' in DE has empty message value`);
  }
});

deKeys.forEach(key => {
  if (!enMessages[key]) {
    logError(`Key '${key}' defined in DE but missing in EN (en/messages.json)`);
  } else if (!enMessages[key].message || enMessages[key].message.trim() === '') {
    logError(`Key '${key}' in EN has empty message value`);
  }
});

if (errorsCount === 0) {
  logSuccess('All keys in EN and DE are fully synchronized and non-empty.');
}

// 3. Scan Codebase for i18n Key References
logHeader('3. Codebase Reference Check');

const referencedKeys = new Set();

function scanFileContent(filePath) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');

  // Match __MSG_keyName__
  const msgMatches = content.matchAll(/__MSG_([a-zA-Z0-9_]+)__/g);
  for (const m of msgMatches) {
    referencedKeys.add(m[1]);
  }

  // Match data-i18n="keyName" & data-i18n-title="keyName"
  const attrMatches = content.matchAll(/data-i18n(?:-title)?=["']([a-zA-Z0-9_]+)["']/g);
  for (const m of attrMatches) {
    referencedKeys.add(m[1]);
  }

  // Match chrome.i18n.getMessage("keyName")
  const jsMatches = content.matchAll(/chrome\.i18n\.getMessage\(\s*["']([a-zA-Z0-9_]+)["']/g);
  for (const m of jsMatches) {
    referencedKeys.add(m[1]);
  }
}

const filesToScan = [
  path.join(ROOT_DIR, 'manifest.json'),
  path.join(ROOT_DIR, 'popup.html'),
  path.join(ROOT_DIR, 'popup.js'),
  path.join(ROOT_DIR, 'content.js'),
  path.join(ROOT_DIR, 'background.js')
];

filesToScan.forEach(scanFileContent);

console.log(` Found ${referencedKeys.size} distinct i18n keys referenced in code.`);

referencedKeys.forEach(key => {
  if (!enMessages[key]) {
    logError(`Key '${key}' is used in code but MISSING in _locales/en/messages.json`);
  }
  if (!deMessages[key]) {
    logError(`Key '${key}' is used in code but MISSING in _locales/de/messages.json`);
  }
});

// 4. Check for Unused Keys
enKeys.forEach(key => {
  if (!referencedKeys.has(key)) {
    logWarning(`Key '${key}' is defined in messages.json but not explicitly detected in code scan.`);
  }
});

// 5. Final Report
logHeader('Summary');

if (errorsCount > 0) {
  console.log(`\n${RED}FAILED: Found ${errorsCount} error(s) and ${warningsCount} warning(s).${RESET}\n`);
  process.exit(1);
} else {
  console.log(`\n${GREEN}SUCCESS: i18n validation passed cleanly with 0 errors (${warningsCount} warnings)!${RESET}\n`);
  process.exit(0);
}
