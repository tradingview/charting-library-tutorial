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

async function findInstalledRuntime(nodeModulesPath) {
	const entries = await readdir(nodeModulesPath, { withFileTypes: true });

	for (const entry of entries) {
		if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

		const packagePath = path.join(nodeModulesPath, entry.name);
		const runtimePath = path.join(packagePath, 'charting_library');

		if (await exists(runtimePath)) {
			return { packagePath, runtimePath };
		}
	}

	throw new Error(
		'Installed package did not contain a charting_library/ runtime folder.'
	);
}

async function copyBrokerSampleIfPresent(packagePath) {
	const sourcePath = path.join(
		packagePath,
		'broker-sample',
		'dist',
		'bundle.js'
	);

	try {
		await stat(sourcePath);
	} catch {
		return false;
	}

	const destinationPath = path.join(
		projectRoot,
		'third_party',
		'tradingview',
		'broker-sample',
		'dist',
		'bundle.js'
	);

	await mkdir(path.dirname(destinationPath), { recursive: true });
	await cp(sourcePath, destinationPath, { force: true });

	return true;
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

		const { packagePath, runtimePath } = await findInstalledRuntime(
			path.join(tempRoot, 'node_modules')
		);

		await rm(runtime.outputPath, { recursive: true, force: true });
		await mkdir(path.dirname(runtime.outputPath), { recursive: true });
		await cp(runtimePath, runtime.outputPath, {
			recursive: true,
			force: true,
		});

		if (runtime.repository === 'trading_platform') {
			const copiedBrokerSample =
				await copyBrokerSampleIfPresent(packagePath);
			if (copiedBrokerSample) {
				console.log(
					'Copied broker sample bundle into third_party/tradingview/broker-sample/dist/bundle.js.'
				);
			} else {
				console.warn(
					'Broker sample bundle was not found in the installed package.'
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
