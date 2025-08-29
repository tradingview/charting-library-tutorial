import {
	makeApiRequest,
	generateSymbol,
	parseFullSymbol,
} from './helpers.js';
import {
	subscribeOnStream,
	unsubscribeFromStream,
} from './streaming.js';

// Use a Map to store the last bar for each symbol subscription.
// This is essential for the streaming logic to update the chart correctly.
const lastBarsCache = new Map();

// DatafeedConfiguration implementation
const configurationData = {
	// Represents the resolutions for bars supported by your datafeed
	supported_resolutions: ['1', "5", "15", '60', '180', '1D', '1W', '1M'],

	// The `exchanges` arguments are used for the `searchSymbols` method if a user selects the exchange
	exchanges: [{
		value: 'Bitfinex',
		name: 'Bitfinex',
		desc: 'Bitfinex',
	},
	{
		value: 'Kraken',
		// Filter name
		name: 'Kraken',
		// Full exchange name displayed in the filter popup
		desc: 'Kraken bitcoin exchange',
	},
	],
	// The `symbols_types` arguments are used for the `searchSymbols` method if a user selects this symbol type
	symbols_types: [{
		name: 'crypto',
		value: 'crypto',
	},
	],
};

// Obtains all symbols for all exchanges supported by CryptoCompare API
async function getAllSymbols() {
	const data = await makeApiRequest('data/v3/all/exchanges');
	let allSymbols = [];

	for (const exchange of configurationData.exchanges) {
		if (data.Data[exchange.value]) {
			const pairs = data.Data[exchange.value].pairs;

			for (const leftPairPart of Object.keys(pairs)) {
				const symbols = pairs[leftPairPart].map(rightPairPart => {
					const symbol = generateSymbol(exchange.value, leftPairPart, rightPairPart);
					return {
						symbol: symbol.short,
						ticker: symbol.full,
						description: symbol.short,
						exchange: exchange.value,
						type: 'crypto'
					};
				});
				allSymbols = [...allSymbols, ...symbols];
			}
		}
	}
	return allSymbols;
}

export default {
	onReady: (callback) => {
		console.log('[onReady]: Method call');
		setTimeout(() => callback(configurationData));
	},

	searchSymbols: async (
		userInput,
		exchange,
		symbolType,
		onResultReadyCallback,
	) => {
		console.log('[searchSymbols]: Method call');
		const symbols = await getAllSymbols();
		const newSymbols = symbols.filter(symbol => {
			const isExchangeValid = exchange === '' || symbol.exchange === exchange;
			const isFullSymbolContainsInput = symbol.ticker
				.toLowerCase()
				.indexOf(userInput.toLowerCase()) !== -1;
			return isExchangeValid && isFullSymbolContainsInput;
		});
		onResultReadyCallback(newSymbols);
	},

	resolveSymbol: async (
		symbolName,
		onSymbolResolvedCallback,
		onResolveErrorCallback,
		extension
	) => {
		console.log('[resolveSymbol]: Method call', symbolName);
		const symbols = await getAllSymbols();
		const symbolItem = symbols.find(({
			ticker,
		}) => ticker === symbolName);
		if (!symbolItem) {
			console.log('[resolveSymbol]: Cannot resolve symbol', symbolName);
			onResolveErrorCallback("unknown_symbol"); // for ghost icon
			return;
		}
		// Symbol information object
		const symbolInfo = {
			ticker: symbolItem.ticker,
			name: symbolItem.symbol,
			description: symbolItem.description,
			type: symbolItem.type,
			exchange: symbolItem.exchange,
			listed_exchange: symbolItem.exchange,
			session: '24x7',
			timezone: 'Etc/UTC',
			minmov: 1,
			pricescale: 10000,
			has_intraday: true,
			intraday_multipliers: ["1", "60"],
			has_daily: true,
			daily_multipliers: ["1"],
			visible_plots_set: "ohlcv",
			supported_resolutions: configurationData.supported_resolutions,
			volume_precision: 2,
			data_status: 'streaming',
		};

		console.log('[resolveSymbol]: Symbol resolved', symbolName);
		onSymbolResolvedCallback(symbolInfo);
	},

	getBars: async (symbolInfo, resolution, periodParams, onHistoryCallback, onErrorCallback) => {
		const { from, to, firstDataRequest } = periodParams;
		console.log('[getBars]: Method call', symbolInfo, resolution, from, to);
		const parsedSymbol = parseFullSymbol(symbolInfo.ticker);

		let endpoint;
		// Determine the correct endpoint based on the base resolution requested by the library
		if (resolution === '1D') {
			endpoint = 'histoday';
		} else if (resolution === '60') {
			endpoint = 'histohour';
		} else if (resolution === '1') {
			endpoint = 'histominute';
		} else {
			onErrorCallback(`Invalid resolution: ${resolution}`);
			return;
		}

		const urlParameters = {
			e: parsedSymbol.exchange,
			fsym: parsedSymbol.fromSymbol,
			tsym: parsedSymbol.toSymbol,
			toTs: to,
			limit: 2000,
		};

	    // example of historical OHLC 5 minute data request: 
		// https://min-api.cryptocompare.com/data/v2/histominute?fsym=ETH&tsym=USDT&limit=10&e=Binance&api_key="API_KEY"
		const query = Object.keys(urlParameters)
			.map(name => `${name}=${encodeURIComponent(urlParameters[name])}`)
			.join('&');

		try {
			const data = await makeApiRequest(`data/v2/${endpoint}?${query}`);
			if ((data.Response && data.Response === 'Error') || !data.Data || !data.Data.Data || data.Data.Data.length === 0) {
				// "noData" should be set if there is no data in the requested period
				onHistoryCallback([], { noData: true });
				return;
			}

			let bars = [];
			data.Data.Data.forEach(bar => {
				if (bar.time >= from && bar.time < to) {
					bars.push({
						time: bar.time * 1000,
						low: bar.low,
						high: bar.high,
						open: bar.open,
						close: bar.close,
						volume: bar.volumefrom,
					});
				}
			});

			if (firstDataRequest) {
				lastBarsCache.set(symbolInfo.ticker, { ...bars[bars.length - 1] });
			}
			console.log(`[getBars]: returned ${bars.length} bar(s)`);
			onHistoryCallback(bars, { noData: false });
		} catch (error) {
			console.log('[getBars]: Get error', error);
			onErrorCallback(error);
		}
	},

	subscribeBars: (
		symbolInfo,
		resolution,
		onRealtimeCallback,
		subscriberUID,
		onResetCacheNeededCallback,
	) => {
		console.log('[subscribeBars]: Method call with subscriberUID:', subscriberUID);
		subscribeOnStream(
			symbolInfo,
			resolution,
			onRealtimeCallback,
			subscriberUID,
			onResetCacheNeededCallback,
			// Pass the last bar from cache if available
			lastBarsCache.get(symbolInfo.ticker)
		);
	},

	unsubscribeBars: (subscriberUID) => {
		console.log('[unsubscribeBars]: Method call with subscriberUID:', subscriberUID);
		unsubscribeFromStream(subscriberUID);
	},
};
