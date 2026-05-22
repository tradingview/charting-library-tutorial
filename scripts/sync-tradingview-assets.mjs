import { cp, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const outputRoot = path.join(projectRoot, 'vendor', 'tradingview');
const advancedChartsOutput = path.join(outputRoot, 'advanced_charts');
const tradingPlatformOutput = path.join(outputRoot, 'trading_platform');
const RUNTIME_ALIASES = new Map([
	['all', ['ac', 'tp']],
	['ac', ['ac']],
	['advanced-charts', ['ac']],
	['charting-library', ['ac']],
	['tp', ['tp']],
	['trading-platform', ['tp']],
]);

// Checks optional package paths without throwing when a variant is not installed.
async function exists(targetPath) {
	try {
		const stats = await stat(targetPath);
		return stats.isDirectory();
	} catch {
		return false;
	}
}

// Replaces generated vendor assets with the exact package contents the user provided.
async function copyDirectory(sourcePath, destinationPath) {
	await rm(destinationPath, { recursive: true, force: true });
	await mkdir(path.dirname(destinationPath), { recursive: true });
	await cp(sourcePath, destinationPath, { recursive: true, force: true });
}

function formatCheckedPaths(candidatePaths) {
	return candidatePaths
		.map(candidatePath => `- ${path.relative(projectRoot, candidatePath)}`)
		.join('\n');
}

function getSelectedRuntimeKeys() {
	const args = process.argv.slice(2);
	if (args.length === 0) {
		return new Set(['ac', 'tp']);
	}

	const selected = new Set();

	args.forEach(arg => {
		const aliases = RUNTIME_ALIASES.get(arg);

		if (!aliases) {
			throw new Error(
				`Unknown runtime "${arg}". Use "ac", "tp", or "all".`
			);
		}

		aliases.forEach(key => selected.add(key));
	});

	return selected;
}

// Picks the first package layout that exists and explains what is unavailable otherwise.
async function syncRuntime({ label, route, sourcePaths, outputPath }) {
	for (const candidatePath of sourcePaths.filter(Boolean)) {
		if (await exists(candidatePath)) {
			await copyDirectory(candidatePath, outputPath);
			console.log(
				`Synced ${label} from ${path.relative(projectRoot, candidatePath)}.`
			);
			return true;
		}
	}

	if (await exists(outputPath)) {
		console.warn(
			[
				`Skipped ${label}; no source package folder was found.`,
				`Left existing ${path.relative(projectRoot, outputPath)} unchanged.`,
				'Checked:',
				formatCheckedPaths(sourcePaths.filter(Boolean)),
			].join('\n')
		);
		return true;
	}

	console.warn(
		[
			`Skipped ${label}; ${route} will be unavailable until that package is added.`,
			'Checked:',
			formatCheckedPaths(sourcePaths.filter(Boolean)),
		].join('\n')
	);

	return false;
}

// Syncs the two served TradingView runtimes into vendor/.
async function main() {
	const selectedRuntimeKeys = getSelectedRuntimeKeys();
	await rm(path.join(outputRoot, 'charting_library'), {
		recursive: true,
		force: true,
	});

	const runtimes = [
		{
			key: 'ac',
			label: 'Advanced Charts',
			route: '/',
			sourcePaths: [
				path.join(
					projectRoot,
					'charting_library-master',
					'charting_library'
				),
			],
			outputPath: advancedChartsOutput,
		},
		{
			key: 'tp',
			label: 'Trading Platform',
			route: '/trading',
			sourcePaths: [
				path.join(
					projectRoot,
					'trading_platform-master',
					'charting_library'
				),
			],
			outputPath: tradingPlatformOutput,
		},
	];
	const syncResults = [];

	for (const runtime of runtimes) {
		if (!selectedRuntimeKeys.has(runtime.key)) {
			continue;
		}

		syncResults.push(await syncRuntime(runtime));
	}

	if (!syncResults.some(Boolean)) {
		console.warn(
			[
				'No TradingView runtime assets were synced.',
				'Add charting_library-master for /, or trading_platform-master for /trading, then rerun npm run tv:sync.',
				'Alternatively, use npm run tv:install:ac or npm run tv:install:tp to install directly into vendor/.',
			].join('\n')
		);
	}
}

main().catch(error => {
	console.error(error.message);
	process.exitCode = 1;
});
