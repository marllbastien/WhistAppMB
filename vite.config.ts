import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

// Lire la version depuis package.json
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

// Lire le commit hash Git automatiquement
function getGitCommitHash(): string {
	try {
		return execSync('git rev-parse --short HEAD').toString().trim();
	} catch {
		return 'unknown';
	}
}

function getGitBranch(): string {
	try {
		return execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
	} catch {
		return 'unknown';
	}
}

const gitCommit = getGitCommitHash();
const gitBranch = getGitBranch();

export default defineConfig({
	plugins: [sveltekit()],
	define: {
		'__APP_VERSION__': JSON.stringify(pkg.version),
		'__BUILD_TIME__': JSON.stringify(new Date().toISOString()),
		'__GIT_COMMIT__': JSON.stringify(gitCommit),
		'__GIT_BRANCH__': JSON.stringify(gitBranch)
	},
	test: {
		expect: { requireAssertions: true },
		projects: [
			{
				extends: './vite.config.ts',
				test: {
					name: 'client',
					environment: 'browser',
					browser: {
						enabled: true,
						provider: 'playwright',
						instances: [{ browser: 'chromium' }]
					},
					include: ['src/**/*.svelte.{test,spec}.{js,ts}'],
					exclude: ['src/lib/server/**'],
					setupFiles: ['./vitest-setup-client.ts']
				}
			},
			{
				extends: './vite.config.ts',
				test: {
					name: 'server',
					environment: 'node',
					include: ['src/**/*.{test,spec}.{js,ts}'],
					exclude: ['src/**/*.svelte.{test,spec}.{js,ts}']
				}
			}
		]
	}
});
