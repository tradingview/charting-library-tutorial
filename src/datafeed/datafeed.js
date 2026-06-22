import {
	BINANCE_EXCHANGE,
	SUPPORTED_RESOLUTIONS,
	barStartTime,
	generateSymbol,
	getResolutionSpec,
	intervalToMilliseconds,
	makeApiRequest,
	parseFullSymbol,
} from './helpers.js';
import {
	subscribeQuotesOnStream,
	unsubscribeQuotesFromStream,
} from './quotes.js';
import { subscribeOnStream, unsubscribeFromStream } from './streaming.js';

const lastBarsCache = new Map();
const quotePriceCache = new Map();
const quoteTickerState = new Map();
const depthSubscriptions = new Map();
const symbolPriceScaleCache = new Map();
const INTRADAY_MULTIPLIERS = [
	'1',
	'3',
	'5',
	'15',
	'30',
	'60',
	'120',
	'240',
	'360',
	'480',
	'720',
];
const BINANCE_WS_URL = 'wss://stream.binance.com:9443/ws';
const DEPTH_LEVELS = 20;
const DEPTH_PUSH_INTERVAL_MS = 250;
const DEPTH_RECONNECT_DELAY_MS = 2_000;
const FILE_MARKER_URL = new URL('../assets/file.svg', import.meta.url).href;
const ALIEN_MARKER_URL = new URL('../assets/alien.svg', import.meta.url).href;

let symbolsCachePromise = null;

const configurationData = {
	supports_timescale_marks: true,
	supports_marks: true,
	supports_time: true,
	supported_resolutions: SUPPORTED_RESOLUTIONS,
	exchanges: [
		{
			value: BINANCE_EXCHANGE,
			name: BINANCE_EXCHANGE,
			desc: 'Binance spot market',
		},
	],
	symbols_types: [{ name: 'crypto', value: 'crypto' }],
};

// Derives a TradingView pricescale from Binance tick size metadata.
function tickSizeToPriceScale(tickSize) {
	if (!tickSize) return 100;

	const trimmed = tickSize.replace(/0+$/, '');
	if (!trimmed.includes('.')) return 1;

	return 10 ** trimmed.split('.')[1].length;
}

// Loads and caches the Binance spot symbol catalog for search and resolve requests.
async function getAllSymbols() {
	if (!symbolsCachePromise) {
		symbolsCachePromise = (async () => {
			const data = await makeApiRequest('api/v3/exchangeInfo');

			return (data.symbols ?? [])
				.filter(
					symbol =>
						symbol.status === 'TRADING' &&
						symbol.isSpotTradingAllowed !== false
				)
				.map(symbol => {
					const generated = generateSymbol(
						BINANCE_EXCHANGE,
						symbol.baseAsset,
						symbol.quoteAsset
					);
					const priceFilter = symbol.filters?.find(
						filter => filter.filterType === 'PRICE_FILTER'
					);

					return {
						symbol: generated.short,
						full_name: generated.full,
						ticker: generated.full,
						description: generated.short,
						exchange: BINANCE_EXCHANGE,
						type: 'crypto',
						providerSymbol: symbol.symbol,
						priceScale: tickSizeToPriceScale(priceFilter?.tickSize),
					};
				})
				.sort((left, right) => left.ticker.localeCompare(right.ticker));
		})();
	}

	return symbolsCachePromise;
}

// Finds a symbol regardless of whether the library passes short or full ticker text.
function getSymbolInfoItem(symbols, symbolName) {
	const needle = symbolName.toLowerCase();

	return symbols.find(
		symbol =>
			symbol.ticker.toLowerCase() === needle ||
			symbol.full_name.toLowerCase() === needle ||
			symbol.symbol.toLowerCase() === needle
	);
}

// Pages through Binance klines until the requested time window is covered.
async function fetchKlines(symbol, interval, fromMs, toMs) {
	const intervalMs = intervalToMilliseconds(interval);
	if (!intervalMs && interval !== '1M') {
		throw new Error(`Unsupported Binance interval: ${interval}`);
	}

	const results = [];
	let cursor = fromMs;
	let requestCount = 0;
	const hardStop = 25;

	while (cursor < toMs && requestCount < hardStop) {
		const batch = await makeApiRequest('api/v3/klines', {
			symbol,
			interval,
			startTime: cursor,
			endTime: toMs,
			limit: 1000,
		});

		if (!Array.isArray(batch) || batch.length === 0) {
			break;
		}

		results.push(...batch);

		const lastOpenTime = batch[batch.length - 1][0];
		const nextCursor =
			interval === '1M'
				? new Date(lastOpenTime).setUTCMonth(
						new Date(lastOpenTime).getUTCMonth() + 1
					)
				: lastOpenTime + intervalMs;

		if (nextCursor <= cursor) {
			break;
		}

		cursor = nextCursor;
		requestCount += 1;

		if (batch.length < 1000) {
			break;
		}
	}

	const deduped = new Map();
	results.forEach(entry => {
		deduped.set(entry[0], entry);
	});

	return [...deduped.values()].sort((left, right) => left[0] - right[0]);
}

// Converts raw Binance kline arrays into TradingView bar objects.
function normalizeKlines(klines) {
	return klines.map(entry => ({
		time: entry[0],
		open: parseFloat(entry[1]),
		high: parseFloat(entry[2]),
		low: parseFloat(entry[3]),
		close: parseFloat(entry[4]),
		volume: parseFloat(entry[5]),
	}));
}

// Rebuilds higher custom resolutions from the raw interval bars we fetched.
function aggregateBars(rawBars, resolution) {
	const aggregated = [];

	rawBars.forEach(bar => {
		const bucketTime = barStartTime(bar.time, resolution);
		const current = aggregated[aggregated.length - 1];

		if (current && current.time === bucketTime) {
			current.high = Math.max(current.high, bar.high);
			current.low = Math.min(current.low, bar.low);
			current.close = bar.close;
			current.volume += bar.volume;
			return;
		}

		aggregated.push({
			time: bucketTime,
			open: bar.open,
			high: bar.high,
			low: bar.low,
			close: bar.close,
			volume: bar.volume,
		});
	});

	return aggregated;
}

// Normalizes single-object and array responses into a consistent array shape.
function asArray(value) {
	if (Array.isArray(value)) return value;
	return value ? [value] : [];
}

// Translates Binance day and hour ticker payloads into TradingView quote fields.
function buildQuoteFromState(symbol, state, fallbackQuote = null) {
	const dayTicker = state?.dayTicker ?? null;
	const hourTicker = state?.hourTicker ?? null;

	const price = dayTicker
		? parseFloat(dayTicker.lastPrice ?? dayTicker.c)
		: (fallbackQuote?.price ?? 0);
	const bid = dayTicker
		? parseFloat(dayTicker.bidPrice ?? dayTicker.b)
		: (fallbackQuote?.bid ?? price);
	const ask = dayTicker
		? parseFloat(dayTicker.askPrice ?? dayTicker.a)
		: (fallbackQuote?.ask ?? price);

	return {
		price,
		lp: price,
		ask,
		bid,
		spread: ask - bid,
		open_price: dayTicker
			? parseFloat(dayTicker.openPrice ?? dayTicker.o)
			: (fallbackQuote?.open_price ?? price),
		high_price: dayTicker
			? parseFloat(dayTicker.highPrice ?? dayTicker.h)
			: (fallbackQuote?.high_price ?? price),
		low_price: dayTicker
			? parseFloat(dayTicker.lowPrice ?? dayTicker.l)
			: (fallbackQuote?.low_price ?? price),
		prev_close_price: dayTicker
			? parseFloat(
					dayTicker.prevClosePrice ??
						dayTicker.x ??
						dayTicker.openPrice ??
						dayTicker.o
				)
			: (fallbackQuote?.prev_close_price ?? price),
		volume: dayTicker
			? parseFloat(dayTicker.volume ?? dayTicker.v)
			: (fallbackQuote?.volume ?? 0),
		ch: dayTicker
			? parseFloat(dayTicker.priceChange ?? dayTicker.p ?? 0)
			: (fallbackQuote?.ch ?? 0),
		chp: dayTicker
			? parseFloat(dayTicker.priceChangePercent ?? dayTicker.P ?? 0)
			: (fallbackQuote?.chp ?? 0),
		rtc: hourTicker
			? parseFloat(hourTicker.openPrice ?? hourTicker.o)
			: (fallbackQuote?.rtc ?? price),
		rtc_time: Math.floor(
			(hourTicker?.closeTime ??
				hourTicker?.C ??
				dayTicker?.closeTime ??
				dayTicker?.C ??
				Date.now()) / 1000
		),
		rch: hourTicker
			? parseFloat(hourTicker.priceChange ?? hourTicker.p ?? 0)
			: (fallbackQuote?.rch ?? 0),
		rchp: hourTicker
			? parseFloat(hourTicker.priceChangePercent ?? hourTicker.P ?? 0)
			: (fallbackQuote?.rchp ?? 0),
		original_name: symbol,
		short_name: symbol,
	};
}

// Remembers symbol precision for the DOM fallback ladder before live depth arrives.
function rememberSymbolPriceScale(symbolItem) {
	[symbolItem.ticker, symbolItem.full_name, symbolItem.symbol].forEach(
		symbol => {
			if (symbol) {
				symbolPriceScaleCache.set(symbol, symbolItem.priceScale);
			}
		}
	);
}

// Fetches the initial REST snapshots that seed quotes before websocket updates arrive.
async function fetchQuoteSnapshots(symbols) {
	const parsedSymbols = symbols
		.map(symbol => ({ symbol, parsed: parseFullSymbol(symbol) }))
		.filter(entry => entry.parsed);

	if (parsedSymbols.length === 0) {
		return [];
	}

	const providerSymbols = parsedSymbols.map(entry => entry.parsed.symbol);
	const symbolsParam = JSON.stringify(providerSymbols);

	const [dayData, hourData] = await Promise.all([
		makeApiRequest('api/v3/ticker/24hr', { symbols: symbolsParam }),
		makeApiRequest('api/v3/ticker', {
			symbols: symbolsParam,
			windowSize: '1h',
		}),
	]);

	const dayMap = new Map(asArray(dayData).map(item => [item.symbol, item]));
	const hourMap = new Map(asArray(hourData).map(item => [item.symbol, item]));

	return parsedSymbols.map(({ symbol, parsed }) => {
		const state = {
			dayTicker: dayMap.get(parsed.symbol) ?? null,
			hourTicker: hourMap.get(parsed.symbol) ?? null,
		};

		quoteTickerState.set(symbol, state);

		return {
			symbol,
			quote: buildQuoteFromState(
				symbol,
				state,
				quotePriceCache.get(symbol) ?? null
			),
		};
	});
}

export default {
	// Publishes the datafeed capabilities TradingView uses during startup.
	onReady(callback) {
		setTimeout(() => callback(configurationData));
	},

	// Returns search matches from the cached Binance spot symbol catalog.
	async searchSymbols(
		userInput,
		exchange,
		symbolType,
		onResultReadyCallback
	) {
		const symbols = await getAllSymbols();
		const query = userInput.trim().toLowerCase();

		const filtered = symbols.filter(symbol => {
			const matchesExchange = !exchange || symbol.exchange === exchange;
			const matchesType = !symbolType || symbol.type === symbolType;
			const matchesQuery =
				!query ||
				symbol.ticker.toLowerCase().includes(query) ||
				symbol.symbol.toLowerCase().includes(query);

			return matchesExchange && matchesType && matchesQuery;
		});

		onResultReadyCallback(filtered.slice(0, 200));
	},

	// Resolves a TradingView ticker into the symbol metadata needed to load a chart.
	async resolveSymbol(
		symbolName,
		onSymbolResolvedCallback,
		onResolveErrorCallback
	) {
		try {
			const symbols = await getAllSymbols();
			const symbolItem = getSymbolInfoItem(symbols, symbolName);

			if (!symbolItem) {
				console.warn('[resolveSymbol] Cannot resolve:', symbolName);
				onResolveErrorCallback('unknown_symbol');
				return;
			}

			rememberSymbolPriceScale(symbolItem);
			onSymbolResolvedCallback({
				ticker: symbolItem.ticker,
				name: symbolItem.symbol,
				description: symbolItem.description,
				type: symbolItem.type,
				exchange: symbolItem.exchange,
				listed_exchange: symbolItem.exchange,
				session: '24x7',
				logo_urls: [],
				timezone: 'Etc/UTC',
				minmov: 1,
				pricescale: symbolItem.priceScale,
				format: 'price',
				has_intraday: true,
				intraday_multipliers: INTRADAY_MULTIPLIERS,
				has_daily: true,
				daily_multipliers: ['1', '3'],
				has_weekly_and_monthly: true,
				visible_plots_set: 'ohlcv',
				supported_resolutions: configurationData.supported_resolutions,
				data_status: 'streaming',
			});
		} catch (error) {
			console.error('[resolveSymbol] Error:', error);
			onResolveErrorCallback('unknown_symbol');
		}
	},

	// Fetches historical bars and rebuilds custom resolutions when needed.
	async getBars(
		symbolInfo,
		resolution,
		periodParams,
		onHistoryCallback,
		onErrorCallback
	) {
		const { from, to, firstDataRequest } = periodParams;

		const parsed = parseFullSymbol(symbolInfo.ticker);
		if (!parsed) {
			onErrorCallback('Cannot parse symbol ticker');
			return;
		}

		const spec = getResolutionSpec(resolution);
		if (!spec) {
			onErrorCallback(`Unsupported resolution: ${resolution}`);
			return;
		}

		const fromMs = barStartTime(from * 1000, resolution);
		const toMs = to * 1000;

		try {
			const rawKlines = await fetchKlines(
				parsed.symbol,
				spec.interval,
				fromMs,
				toMs
			);
			if (rawKlines.length === 0) {
				onHistoryCallback([], { noData: true });
				return;
			}

			const baseBars = normalizeKlines(rawKlines);
			const resolvedBars =
				spec.aggregate === 1
					? baseBars
					: aggregateBars(baseBars, resolution);

			const bars = resolvedBars.filter(
				bar => bar.time >= from * 1000 && bar.time < to * 1000
			);

			if (bars.length === 0) {
				onHistoryCallback([], { noData: true });
				return;
			}

			if (firstDataRequest) {
				lastBarsCache.set(symbolInfo.ticker, {
					...bars[bars.length - 1],
				});
			}

			onHistoryCallback(bars, { noData: false });
		} catch (error) {
			console.error('[getBars] Error:', error);
			onErrorCallback(error);
		}
	},

	// Starts the realtime stream for the active chart symbol and resolution.
	subscribeBars(
		symbolInfo,
		resolution,
		onRealtimeCallback,
		subscriberUID,
		onResetCacheNeededCallback
	) {
		subscribeOnStream(
			symbolInfo,
			resolution,
			onRealtimeCallback,
			subscriberUID,
			onResetCacheNeededCallback,
			lastBarsCache.get(symbolInfo.ticker) ?? null
		);
	},

	// Stops the realtime bar stream when TradingView releases a subscriber.
	unsubscribeBars(subscriberUID) {
		unsubscribeFromStream(subscriberUID);
	},

	// Supplies example chart markers for the tutorial overlay APIs.
	getMarks(symbolInfo, from, to, onDataCallback, _resolution) {
		const time = Date.now() / 1000;
		const ONE_DAY_SEC = 86_400;

		onDataCallback([
			{
				id: 1,
				time: time,
				borderWidth: 0,
				text: [
					'wallet address, 1m within, buy txs:1, buy total: 123123, avr price: 123123',
				],
				imageUrl: FILE_MARKER_URL,
			},
			{
				id: 2,
				time: time - ONE_DAY_SEC * 5,
				color: 'green',
				label: 'S',
				labelFontColor: 'green',
				minSize: 10,
				text: ['Second marker'],
			},
			{
				id: 3,
				time: time - ONE_DAY_SEC * 4,
				color: 'blue',
				label: 'T',
				labelFontColor: 'blue',
				minSize: 9,
				text: ['Third marker'],
			},
			{
				id: 4,
				time: time - ONE_DAY_SEC,
				color: 'purple',
				label: 'F',
				labelFontColor: 'purple',
				minSize: 20,
				text: ['Fourth marker'],
			},
			{
				id: 5,
				time: time - ONE_DAY_SEC * 2,
				color: 'orange',
				label: 'O',
				labelFontColor: 'orange',
				minSize: 21,
				text: ['Fifth marker'],
			},
		]);
	},

	// Supplies example timescale markers for the tutorial overlay APIs.
	getTimescaleMarks(symbolInfo, from, to, onDataCallback, _resolution) {
		const now = Date.now() / 1000;
		const ONE_DAY_SEC = 86_400;

		function fmt(sec) {
			const d = new Date(sec * 1000);
			const dd = String(d.getUTCDate()).padStart(2, '0');
			const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
			const yy = String(d.getUTCFullYear()).slice(-2);
			return `${dd}/${mm}/${yy}`;
		}

		onDataCallback(
			Array.from({ length: 15 }, (_, i) => {
				const idx = i + 1;
				const t = now - ONE_DAY_SEC * idx;
				return {
					id: `tsm${idx}`,
					time: t,
					color: idx % 2 === 0 ? '#FFAA00' : '#089981',
					label: idx === 1 ? 'A' : 'B',
					labelFontColor: '#FFFFFF',
					imageUrl: ALIEN_MARKER_URL,
					tooltip: [
						fmt(t),
						'**Bitcoin logo**',
						'_Note_: Short-term volatility',
						'Source: Exchange data',
					],
				};
			})
		);
	},

	// Returns a current quote snapshot for the requested symbol list.
	async getQuotes(symbols, onDataCallback, onErrorCallback) {
		try {
			const snapshots = await fetchQuoteSnapshots(symbols);

			const result = snapshots
				.map(({ symbol, quote }) => {
					if (!quote) return null;

					quotePriceCache.set(symbol, quote);
					return { n: symbol, s: 'ok', v: quote };
				})
				.filter(Boolean);

			setTimeout(() => onDataCallback(result), 10);
		} catch (error) {
			console.error('[getQuotes] Error:', error);
			if (onErrorCallback) onErrorCallback(error);
		}
	},

	// Seeds quotes from REST once and then keeps them live with websocket ticker streams.
	subscribeQuotes(symbols, fastSymbols, onRealtimeCallback, listenerGUID) {
		const trackedSymbols = [...new Set([...symbols, ...fastSymbols])];
		fetchQuoteSnapshots(trackedSymbols)
			.then(snapshots => {
				const initialQuotes = snapshots
					.map(({ symbol, quote }) => {
						if (!quote) return null;

						quotePriceCache.set(symbol, quote);
						return { s: 'ok', n: symbol, v: quote };
					})
					.filter(Boolean);

				if (initialQuotes.length > 0) {
					onRealtimeCallback(initialQuotes);
				}
			})
			.catch(error => {
				console.error('[subscribeQuotes] Bootstrap error:', error);
			});

		subscribeQuotesOnStream(
			trackedSymbols,
			listenerGUID,
			({ symbol, type, payload }) => {
				const currentState = quoteTickerState.get(symbol) ?? {
					dayTicker: null,
					hourTicker: null,
				};

				if (type === 'day') {
					currentState.dayTicker = payload;
				} else if (type === 'hour') {
					currentState.hourTicker = payload;
				}

				quoteTickerState.set(symbol, currentState);

				const quote = buildQuoteFromState(
					symbol,
					currentState,
					quotePriceCache.get(symbol) ?? null
				);
				quotePriceCache.set(symbol, quote);
				onRealtimeCallback([{ s: 'ok', n: symbol, v: quote }]);
			}
		);
	},

	// Tears down quote listeners that are no longer needed by the widget.
	unsubscribeQuotes(listenerGUID) {
		unsubscribeQuotesFromStream(listenerGUID);
	},

	// Supplies live Binance top-of-book depth for the Trading Platform example.
	subscribeDepth(symbol, callback) {
		const listenerId = Math.round(Math.random() * 10000000).toString(36);
		const subscription = {
			symbol,
			callback,
			socket: null,
			reconnectTimerId: null,
			latestDepth: null,
			closed: false,
			intervalId: null,
		};

		subscription.intervalId = window.setInterval(() => {
			pushDepthSnapshot(subscription);
		}, DEPTH_PUSH_INTERVAL_MS);

		depthSubscriptions.set(listenerId, subscription);
		pushDepthSnapshot(subscription);
		connectDepthStream(subscription);

		return listenerId;
	},

	// Stops one Trading Platform DOM subscription and releases its socket/timer.
	unsubscribeDepth(listenerID) {
		const subscription = depthSubscriptions.get(listenerID);
		if (!subscription) return;

		subscription.closed = true;
		window.clearInterval(subscription.intervalId);
		window.clearTimeout(subscription.reconnectTimerId);
		subscription.socket?.close();
		depthSubscriptions.delete(listenerID);
	},
};

// Opens Binance's partial-book stream for one DOM subscriber and reconnects if it drops.
function connectDepthStream(subscription) {
	const parsed = parseFullSymbol(subscription.symbol);
	if (!parsed || parsed.exchange !== BINANCE_EXCHANGE) return;

	const streamName = `${parsed.symbol.toLowerCase()}@depth${DEPTH_LEVELS}@100ms`;
	const socket = new WebSocket(`${BINANCE_WS_URL}/${streamName}`);
	subscription.socket = socket;

	socket.addEventListener('message', event => {
		const depth = parseDepthMessage(event.data);
		if (!depth) return;

		subscription.latestDepth = depth;
		rememberDepthQuote(subscription.symbol, depth);
	});

	socket.addEventListener('close', () => {
		if (subscription.closed) return;

		subscription.reconnectTimerId = window.setTimeout(() => {
			connectDepthStream(subscription);
		}, DEPTH_RECONNECT_DELAY_MS);
	});

	socket.addEventListener('error', () => {
		socket.close();
	});
}

// Parses Binance partial-book messages into TradingView DOM level arrays.
function parseDepthMessage(data) {
	let message;

	try {
		message = JSON.parse(data);
	} catch {
		return null;
	}

	const bids = normalizeDepthLevels(message.bids ?? message.b);
	const asks = normalizeDepthLevels(message.asks ?? message.a);
	if (bids.length === 0 || asks.length === 0) return null;

	return { bids, asks };
}

// Converts Binance [price, quantity] tuples into the DOM shape TradingView expects.
function normalizeDepthLevels(levels) {
	if (!Array.isArray(levels)) return [];

	return levels
		.map(level => {
			const price = parseFloat(level[0]);
			const volume = parseFloat(level[1]);

			if (
				!Number.isFinite(price) ||
				!Number.isFinite(volume) ||
				volume <= 0
			) {
				return null;
			}

			return { price, volume };
		})
		.filter(Boolean)
		.slice(0, DEPTH_LEVELS);
}

// Lets quote consumers reuse the best bid/ask learned from the DOM stream.
function rememberDepthQuote(symbol, depth) {
	const bid = depth.bids[0]?.price;
	const ask = depth.asks[0]?.price;
	if (!Number.isFinite(bid) || !Number.isFinite(ask)) return;

	const price = (bid + ask) / 2;
	quotePriceCache.set(symbol, {
		...quotePriceCache.get(symbol),
		price,
		lp: price,
		bid,
		ask,
		spread: ask - bid,
	});
}

// Pushes either live depth or a temporary synthetic ladder until live depth arrives.
function pushDepthSnapshot(subscription) {
	if (subscription.closed) return;

	const snapshot = subscription.latestDepth
		? { snapshot: true, ...subscription.latestDepth }
		: buildSyntheticDepthSnapshot(subscription.symbol);

	subscription.callback(snapshot);
}

// Builds a visible fallback so the DOM widget is not blank before Binance sends data.
function buildSyntheticDepthSnapshot(symbol) {
	const latestPrice = getLatestDepthPrice(symbol);
	const tickSize = getDepthTickSize(symbol, latestPrice);

	return {
		snapshot: true,
		bids: generateSyntheticDOMData(
			latestPrice - tickSize,
			-tickSize,
			tickSize
		),
		asks: generateSyntheticDOMData(
			latestPrice + tickSize,
			tickSize,
			tickSize
		),
	};
}

// Chooses the best available anchor price for synthetic DOM fallback levels.
function getLatestDepthPrice(symbol) {
	return (
		quotePriceCache.get(symbol)?.price ??
		lastBarsCache.get(symbol)?.close ??
		100
	);
}

// Reuses resolved symbol precision where possible so fallback levels move by valid ticks.
function getDepthTickSize(symbol, latestPrice) {
	const priceScale = symbolPriceScaleCache.get(symbol);
	if (priceScale) return 1 / priceScale;

	if (latestPrice >= 1000) return 0.1;
	if (latestPrice >= 100) return 0.01;
	if (latestPrice >= 1) return 0.001;
	return 0.0001;
}

// Generates descending bid or ascending ask levels around the latest known price.
function generateSyntheticDOMData(start, step, tickSize) {
	const levels = [];
	const amount = 10_000;

	for (let index = 0; index < DEPTH_LEVELS; index += 1) {
		const price = start + step * index;
		const distanceWeight = (DEPTH_LEVELS - index) / DEPTH_LEVELS;
		const jitter = 0.9 + Math.random() * 0.2;

		levels.push({
			price: roundToTick(price, tickSize),
			volume: amount * distanceWeight * jitter,
		});
	}

	return levels;
}

// Rounds fallback prices to the inferred tick precision.
function roundToTick(price, tickSize) {
	const decimals = Math.max(0, Math.ceil(-Math.log10(tickSize)));

	return Number(price.toFixed(decimals));
}
