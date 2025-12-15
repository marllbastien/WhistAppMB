/**
 * Script de pre-build qui met a jour la version du service worker
 * avec le commit hash Git actuel
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Lire le commit hash
function getGitCommitHash() {
    try {
        return execSync('git rev-parse --short HEAD').toString().trim();
    } catch {
        return 'unknown';
    }
}

// Lire la version du package.json
function getPackageVersion() {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));
    return pkg.version;
}

const commitHash = getGitCommitHash();
const version = getPackageVersion();
const swPath = join(__dirname, '..', 'static', 'service-worker.js');

// Lire le service worker actuel
let swContent = readFileSync(swPath, 'utf-8');

// Remplacer la ligne CACHE_VERSION
const newCacheVersion = `wb-scoring-v${version}-${commitHash}`;
swContent = swContent.replace(
    /const CACHE_VERSION = '[^']+'/,
    `const CACHE_VERSION = '${newCacheVersion}'`
);

// Ecrire le fichier mis a jour
writeFileSync(swPath, swContent);

console.log(`[SW] Version mise a jour: ${newCacheVersion}`);
