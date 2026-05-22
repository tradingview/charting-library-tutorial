// Shared helpers for the Binance-backed TradingView datafeed.

export const BINANCE_EXCHANGE = 'Binance';

const BINANCE_API_URL = 'https://api.binance.com/';
const DAY_MS = 24 * 60 * 60 * 1000;

export const SUPPORTED_RESOLUTIONS = [
	'1',
	'2',
	'3',
	'4',
	'5',
	'10',
	'15',
	'30',
	'60',
	'90',
	'120',
	'180',
	'240',
	'360',
	'480',
	'720',
	'1D',
	'3D',
	'1W',
	'1M',
];

const BINANCE_INTERVAL_MS = Object.freeze({
	'1m': 60 * 1000,
	'3m': 3 * 60 * 1000,
	'5m': 5 * 60 * 1000,
	'15m': 15 * 60 * 1000,
	'30m': 30 * 60 * 1000,
	'1h': 60 * 60 * 1000,
	'2h': 2 * 60 * 60 * 1000,
	'4h': 4 * 60 * 60 * 1000,
	'6h': 6 * 60 * 60 * 1000,
	'8h': 8 * 60 * 60 * 1000,
	'12h': 12 * 60 * 60 * 1000,
	'1d': DAY_MS,
	'3d': 3 * DAY_MS,
	'1w': 7 * DAY_MS,
});

const RESOLUTION_SPECS = Object.freeze({
	1: {
		interval: '1m',
		aggregate: 1,
		streamType: 'kline',
		streamInterval: '1m',
	},
	2: { interval: '1m', aggregate: 2, streamType: 'trade' },
	3: {
		interval: '3m',
		aggregate: 1,
		streamType: 'kline',
		streamInterval: '3m',
	},
	4: { interval: '1m', aggregate: 4, streamType: 'trade' },
	5: {
		interval: '5m',
		aggregate: 1,
		streamType: 'kline',
		streamInterval: '5m',
	},
	10: { interval: '5m', aggregate: 2, streamType: 'trade' },
	15: {
		interval: '15m',
		aggregate: 1,
		streamType: 'kline',
		streamInterval: '15m',
	},
	30: {
		interval: '30m',
		aggregate: 1,
		streamType: 'kline',
		streamInterval: '30m',
	},
	60: {
		interval: '1h',
		aggregate: 1,
		streamType: 'kline',
		streamInterval: '1h',
	},
	90: { interval: '30m', aggregate: 3, streamType: 'trade' },
	120: {
		interval: '2h',
		aggregate: 1,
		streamType: 'kline',
		streamInterval: '2h',
	},
	180: { interval: '1h', aggregate: 3, streamType: 'trade' },
	240: {
		interval: '4h',
		aggregate: 1,
		streamType: 'kline',
		streamInterval: '4h',
	},
	360: {
		interval: '6h',
		aggregate: 1,
		streamType: 'kline',
		streamInterval: '6h',
	},
	480: {
		interval: '8h',
		aggregate: 1,
		streamType: 'kline',
		streamInterval: '8h',
	},
	720: {
		interval: '12h',
		aggregate: 1,
		streamType: 'kline',
		streamInterval: '12h',
	},
	'1D': {
		interval: '1d',
		aggregate: 1,
		streamType: 'kline',
		streamInterval: '1d',
	},
	'3D': {
		interval: '3d',
		aggregate: 1,
		streamType: 'kline',
		streamInterval: '3d',
	},
	'1W': {
		interval: '1w',
		aggregate: 1,
		streamType: 'kline',
		streamInterval: '1w',
	},
	'1M': {
		interval: '1M',
		aggregate: 1,
		streamType: 'kline',
		streamInterval: '1M',
	},
});

// Sends a REST request to Binance and normalizes transport errors.
export async function makeApiRequest(path, params = {}) {
	try {
		const url = new URL(path, BINANCE_API_URL);

		Object.entries(params).forEach(([key, value]) => {
			if (value !== undefined && value !== null) {
				url.searchParams.set(key, String(value));
			}
		});

		const response = await fetch(url.toString());
		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`);
		}

		return response.json();
	} catch (error) {
		throw new Error(`Binance request error: ${error.message}`);
	}
}

// Splits a TradingView ticker into exchange, base, quote, and provider symbol parts.
export function parseFullSymbol(fullSymbol) {
	const match = fullSymbol.match(/^([^:]+):([^/]+)\/([^/]+)$/);
	if (!match) return null;

	const exchange = match[1];
	const fromSymbol = match[2].toUpperCase();
	const toSymbol = match[3].toUpperCase();

	return {
		exchange,
		fromSymbol,
		toSymbol,
		symbol: `${fromSymbol}${toSymbol}`,
	};
}

// Builds the symbol shapes used by TradingView search and resolve flows.
export function generateSymbol(exchange, fromSymbol, toSymbol) {
	const base = fromSymbol.toUpperCase();
	const quote = toSymbol.toUpperCase();
	const short = `${base}/${quote}`;

	return {
		short,
		full: `${exchange}:${short}`,
		symbol: `${base}${quote}`,
	};
}

// Maps a TradingView resolution to the Binance interval and stream strategy behind it.
export function getResolutionSpec(resolution) {
	return RESOLUTION_SPECS[resolution] ?? null;
}

// Converts a native Binance interval into milliseconds when the duration is fixed.
export function intervalToMilliseconds(interval) {
	if (BINANCE_INTERVAL_MS[interval]) {
		return BINANCE_INTERVAL_MS[interval];
	}

	if (interval === '1M') {
		return null;
	}

	return null;
}

// Converts a TradingView resolution into milliseconds when the duration is fixed.
export function resolutionToMilliseconds(resolution) {
	if (resolution === '1D') return DAY_MS;
	if (resolution === '3D') return 3 * DAY_MS;
	if (resolution === '1W') return 7 * DAY_MS;
	if (resolution === '1M') return null;

	const minutes = parseInt(resolution, 10);
	if (!Number.isNaN(minutes)) {
		return minutes * 60 * 1000;
	}

	const hourMatch = resolution.match(/^(\d+)H$/i);
	if (hourMatch) {
		return parseInt(hourMatch[1], 10) * 60 * 60 * 1000;
	}

	return null;
}

// Rounds a timestamp down to the opening time of its containing bar.
export function barStartTime(timestampMs, resolution) {
	if (resolution === '1D') {
		const d = new Date(timestampMs);
		d.setUTCHours(0, 0, 0, 0);
		return d.getTime();
	}

	if (resolution === '3D') {
		const d = new Date(timestampMs);
		d.setUTCHours(0, 0, 0, 0);
		return Math.floor(d.getTime() / (3 * DAY_MS)) * (3 * DAY_MS);
	}

	if (resolution === '1W') {
		const d = new Date(timestampMs);
		const day = d.getUTCDay();
		const mondayOffset = day === 0 ? 6 : day - 1;
		d.setUTCDate(d.getUTCDate() - mondayOffset);
		d.setUTCHours(0, 0, 0, 0);
		return d.getTime();
	}

	if (resolution === '1M') {
		const d = new Date(timestampMs);
		d.setUTCDate(1);
		d.setUTCHours(0, 0, 0, 0);
		return d.getTime();
	}

	const intervalMs = resolutionToMilliseconds(resolution);
	if (!intervalMs) return timestampMs;

	return Math.floor(timestampMs / intervalMs) * intervalMs;
}

// Advances a bar timestamp to the next bar boundary for the same resolution.
export function getNextBarTime(barTimeMs, resolution) {
	if (resolution === '1M') {
		const d = new Date(barTimeMs);
		d.setUTCMonth(d.getUTCMonth() + 1);
		return d.getTime();
	}

	const intervalMs = resolutionToMilliseconds(resolution);
	if (!intervalMs) return barTimeMs;

	return barTimeMs + intervalMs;
}
