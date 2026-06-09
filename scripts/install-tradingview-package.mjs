// Downloads private TradingView GitHub packages into vendor/tradingview and
// copies the Trading Platform BrokerDemo bundle when available. See README.md
// for setup commands and INTEGRATION_DETAILS.md for the runtime layout.
import {
	cp,
	mkdir,
	mkdtemp,
	readdir,
	rm,
	stat,
	writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const outputRoot = path.join(projectRoot, 'vendor', 'tradingview');
const brokerSampleRelativePath = path.join(
	'broker-sample',
	'dist',
	'bundle.js'
);
const brokerSampleDestinationPath = path.join(
	projectRoot,
	'third_party',
	'tradingview',
	brokerSampleRelativePath
);

const RUNTIMES = {
	ac: {
		label: 'Advanced Charts',
		repository: 'charting_library',
		outputPath: path.join(outputRoot, 'advanced_charts'),
	},
	tp: {
		label: 'Trading Platform',
		repository: 'trading_platform',
		outputPath: path.join(outputRoot, 'trading_platform'),
	},
};

const INSTALL_TARGETS = {
	ac: [RUNTIMES.ac],
	'advanced-charts': [RUNTIMES.ac],
	tp: [RUNTIMES.ac, RUNTIMES.tp],
	'trading-platform': [RUNTIMES.ac, RUNTIMES.tp],
};

function printUsage() {
	console.log(
		[
			'Usage:',
			'  npm run tv:install:ac -- [version-or-git-ref]',
			'  npm run tv:install:tp -- [version-or-git-ref]',
			'',
			'Examples:',
			'  npm run tv:install:ac -- 31.2.0',
			'  npm run tv:install:tp -- 31.2.0',
			'  npm run tv:install:tp -- master',
			'',
			'When omitted, version-or-git-ref defaults to master.',
			'tv:install:ac installs only Advanced Charts.',
			'tv:install:tp installs Advanced Charts and Trading Platform.',
		].join('\n')
	);
}

function buildPackageSpec(repository, ref = 'master') {
	const fragment = /^\d+\.\d+\.\d+$/.test(ref) ? `semver:${ref}` : ref;

	return `git+ssh://git@github.com/tradingview/${repository}.git#${fragment}`;
}

function run(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			stdio: 'inherit',
			...options,
		});

		child.on('error', reject);
		child.on('exit', code => {
			if (code === 0) {
				resolve();
				return;
			}

			reject(
				new Error(
					`${command} ${args.join(' ')} exited with code ${code}`
				)
			);
		});
	});
}

async function exists(targetPath) {
	try {
		const stats = await stat(targetPath);
		return stats.isDirectory();
	} catch {
		return false;
	}
}

async function existsFile(targetPath) {
	try {
		const stats = await stat(targetPath);
		return stats.isFile();
	} catch {
		return false;
	}
}

async function copyBrokerSample(sourcePath) {
	await mkdir(path.dirname(brokerSampleDestinationPath), { recursive: true });
	await cp(sourcePath, brokerSampleDestinationPath, { force: true });
}

async function getInstalledPackagePaths(nodeModulesPath) {
	const entries = await readdir(nodeModulesPath, { withFileTypes: true });
	const packagePaths = [];

	for (const entry of entries) {
		if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

		const entryPath = path.join(nodeModulesPath, entry.name);

		if (entry.name.startsWith('@')) {
			const scopedEntries = await readdir(entryPath, {
				withFileTypes: true,
			});

			scopedEntries.forEach(scopedEntry => {
				if (scopedEntry.isDirectory()) {
					packagePaths.push(path.join(entryPath, scopedEntry.name));
				}
			});
			continue;
		}

		packagePaths.push(entryPath);
	}

	return packagePaths;
}

async function findInstalledRuntime(nodeModulesPath, repository) {
	const packagePaths = await getInstalledPackagePaths(nodeModulesPath);
	const runtimeCandidates = [];

	for (const packagePath of packagePaths) {
		const runtimePath = path.join(packagePath, 'charting_library');

		if (await exists(runtimePath)) {
			runtimeCandidates.push({ packagePath, runtimePath });
		}
	}

	if (runtimeCandidates.length === 0) {
		throw new Error(
			'Installed package did not contain a charting_library/ runtime folder.'
		);
	}

	if (repository === 'trading_platform') {
		for (const candidate of runtimeCandidates) {
			const brokerSamplePath = path.join(
				candidate.packagePath,
				'broker-sample',
				'dist',
				'bundle.js'
			);

			if (await existsFile(brokerSamplePath)) {
				return candidate;
			}
		}
	}

	const matchingPackageName = runtimeCandidates.find(candidate =>
		path.basename(candidate.packagePath).includes(repository)
	);

	return matchingPackageName ?? runtimeCandidates[0];
}

async function findBrokerSampleBundle(nodeModulesPath, preferredPackagePath) {
	const preferredSourcePath = path.join(
		preferredPackagePath,
		brokerSampleRelativePath
	);

	if (await existsFile(preferredSourcePath)) {
		return preferredSourcePath;
	}

	const packagePaths = await getInstalledPackagePaths(nodeModulesPath);

	for (const packagePath of packagePaths) {
		const sourcePath = path.join(packagePath, brokerSampleRelativePath);

		if (await existsFile(sourcePath)) {
			return sourcePath;
		}
	}

	return null;
}

async function copyBrokerSampleIfPresent(nodeModulesPath, preferredPackagePath) {
	const sourcePath = await findBrokerSampleBundle(
		nodeModulesPath,
		preferredPackagePath
	);

	if (!sourcePath) return false;

	await copyBrokerSample(sourcePath);

	return true;
}

function getBrokerSampleFetchRefs(ref) {
	if (/^\d+\.\d+\.\d+$/.test(ref)) {
		return [ref, `v${ref}`];
	}

	return [ref];
}

async function fetchBrokerSampleFromRepository(ref) {
	const tempRoot = await mkdtemp(
		path.join(os.tmpdir(), 'tradingview-broker-sample-')
	);

	try {
		await run('git', ['init'], { cwd: tempRoot });
		await run(
			'git',
			[
				'remote',
				'add',
				'origin',
				'git@github.com:tradingview/trading_platform.git',
			],
			{ cwd: tempRoot }
		);

		let lastError;
		for (const fetchRef of getBrokerSampleFetchRefs(ref)) {
			try {
				await run('git', ['fetch', '--depth', '1', 'origin', fetchRef], {
					cwd: tempRoot,
				});
				lastError = null;
				break;
			} catch (error) {
				lastError = error;
			}
		}

		if (lastError) {
			throw lastError;
		}

		await run(
			'git',
			['checkout', 'FETCH_HEAD', '--', 'broker-sample/dist/bundle.js'],
			{ cwd: tempRoot }
		);

		const sourcePath = path.join(tempRoot, brokerSampleRelativePath);
		if (!(await existsFile(sourcePath))) {
			throw new Error(
				'broker-sample/dist/bundle.js was not found in the Trading Platform repository.'
			);
		}

		await copyBrokerSample(sourcePath);
		return true;
	} finally {
		await rm(tempRoot, { recursive: true, force: true });
	}
}

async function downloadAndCopyRuntime(runtime, ref) {
	const packageSpec = buildPackageSpec(runtime.repository, ref);
	const tempRoot = await mkdtemp(
		path.join(os.tmpdir(), 'tradingview-package-')
	);

	try {
		await writeFile(
			path.join(tempRoot, 'package.json'),
			'{"private":true}\n'
		);

		console.log(`Downloading ${runtime.label} from ${packageSpec}`);
		await run(
			'npm',
			[
				'install',
				'--ignore-scripts',
				'--no-audit',
				'--no-fund',
				'--package-lock=false',
				'--cache',
				path.join(tempRoot, '.npm-cache'),
				packageSpec,
			],
			{ cwd: tempRoot }
		);

		const nodeModulesPath = path.join(tempRoot, 'node_modules');
		const { packagePath, runtimePath } = await findInstalledRuntime(
			nodeModulesPath,
			runtime.repository
		);

		await rm(runtime.outputPath, { recursive: true, force: true });
		await mkdir(path.dirname(runtime.outputPath), { recursive: true });
		await cp(runtimePath, runtime.outputPath, {
			recursive: true,
			force: true,
		});

		if (runtime.repository === 'trading_platform') {
			const copiedBrokerSample = await copyBrokerSampleIfPresent(
				nodeModulesPath,
				packagePath
			);
			if (copiedBrokerSample) {
				console.log(
					'Copied broker sample bundle into third_party/tradingview/broker-sample/dist/bundle.js.'
				);
			} else {
				console.warn(
					'Broker sample bundle was not found in the installed package; fetching it from tradingview/trading_platform.'
				);
				await fetchBrokerSampleFromRepository(ref);
				console.log(
					'Fetched broker sample bundle into third_party/tradingview/broker-sample/dist/bundle.js.'
				);
			}
		}

		console.log(
			`Copied ${runtime.label} runtime into ${path.relative(projectRoot, runtime.outputPath)}.`
		);
	} finally {
		await rm(tempRoot, { recursive: true, force: true });
	}
}

async function main() {
	const targetKey = process.argv[2];
	const ref = process.argv[3] ?? 'master';

	if (
		!targetKey ||
		targetKey === '--help' ||
		targetKey === '-h' ||
		ref === '--help' ||
		ref === '-h'
	) {
		printUsage();
		return;
	}

	const runtimes = INSTALL_TARGETS[targetKey];
	if (!runtimes) {
		printUsage();
		throw new Error(`Unknown TradingView package target: ${targetKey}`);
	}

	for (const runtime of runtimes) {
		await downloadAndCopyRuntime(runtime, ref);
	}
}

main().catch(error => {
	console.error(error.message);
	process.exitCode = 1;
});
