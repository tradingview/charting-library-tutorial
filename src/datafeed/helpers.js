// Shared helpers for the Binance-backed TradingView datafeed.

export const BINANCE_EXCHANGE = 'Binance';

const BINANCE_API_URL = 'https://api.binance.com/';

// Every resolution the chart offers. The library builds the ones Binance does not
// serve natively (5S, 15S, 30S, 2, 4, 10, 90, 180) by aggregating the raw
// intervals below.
export const SUPPORTED_RESOLUTIONS = [
	'1S',
	'5S',
	'15S',
	'30S',
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

// Resolutions Binance publishes as native kline intervals. These are the only
// values the datafeed declares in its *_multipliers, and the only resolutions the
// library ever requests: it picks the largest entry that divides the resolution a
// user selected and aggregates the bars itself.
const BINANCE_INTERVALS = Object.freeze({
	'1S': '1s',
	1: '1m',
	3: '3m',
	5: '5m',
	15: '15m',
	30: '30m',
	60: '1h',
	120: '2h',
	240: '4h',
	360: '6h',
	480: '8h',
	720: '12h',
	'1D': '1d',
	'3D': '3d',
	'1W': '1w',
	'1M': '1M',
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

// Maps a TradingView resolution to the Binance kline interval that serves it.
export function getBinanceInterval(resolution) {
	return BINANCE_INTERVALS[resolution] ?? null;
}
