import { BINANCE_EXCHANGE, parseFullSymbol } from './helpers.js';

const WSS_URL = 'wss://stream.binance.com:9443/ws';
const MAX_RECONNECT_DELAY = 30_000;
const SOCKET_CONNECT_DELAY_MS = 100;

const streamRefCounts = new Map();
const streamToMeta = new Map();
const providerSymbolToFullSymbol = new Map();
const symbolToListeners = new Map();
const listenerToSymbols = new Map();
const listenerCallbacks = new Map();

let socket = null;
let reconnectDelay = 1_000;
let reconnectTimer = null;
let connectTimer = null;
let requestId = 0;

// Generates monotonically increasing ids for Binance websocket control messages.
function nextRequestId() {
	requestId += 1;
	return requestId;
}

// Builds the 24h rolling ticker stream name for a Binance spot symbol.
function getTickerStreamName(providerSymbol) {
	return `${providerSymbol.toLowerCase()}@ticker`;
}

// Builds the 1h rolling ticker stream name for a Binance spot symbol.
function getHourTickerStreamName(providerSymbol) {
	return `${providerSymbol.toLowerCase()}@ticker_1h`;
}

// Sends a websocket subscribe command when the socket is ready.
function sendSubscribe(ws, streamName) {
	if (!ws || ws.readyState !== WebSocket.OPEN) return;

	ws.send(
		JSON.stringify({
			method: 'SUBSCRIBE',
			params: [streamName],
			id: nextRequestId(),
		})
	);
}

// Sends a websocket unsubscribe command when the last listener goes away.
function sendUnsubscribe(ws, streamName) {
	if (!ws || ws.readyState !== WebSocket.OPEN) return;

	ws.send(
		JSON.stringify({
			method: 'UNSUBSCRIBE',
			params: [streamName],
			id: nextRequestId(),
		})
	);
}

// Checks whether any TradingView listener still needs Binance quote updates.
function hasActiveStreams() {
	return [...streamRefCounts.values()].some(count => count > 0);
}

// Defers opening Binance until TradingView's initial quote-subscription churn settles.
function ensureSocket() {
	if (
		socket &&
		(socket.readyState === WebSocket.CONNECTING ||
			socket.readyState === WebSocket.OPEN)
	) {
		return socket;
	}

	if (!connectTimer) {
		connectTimer = setTimeout(() => {
			connectTimer = null;

			if (hasActiveStreams()) {
				socket = createSocket();
			}
		}, SOCKET_CONNECT_DELAY_MS);
	}

	return socket;
}

// Cancels pending reconnect/start work when TradingView releases every quote stream.
// Already-open sockets are left alone; if Binance closes them while idle, we do not reconnect.
function stopSocketWorkIfIdle() {
	if (hasActiveStreams()) return;

	if (connectTimer) {
		clearTimeout(connectTimer);
		connectTimer = null;
	}

	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}

	reconnectDelay = 1_000;
}

// Creates the shared quote socket and restores active stream subscriptions after reconnects.
function createSocket() {
	if (connectTimer) {
		clearTimeout(connectTimer);
		connectTimer = null;
	}

	if (reconnectTimer) {
		clearTimeout(reconnectTimer);
		reconnectTimer = null;
	}

	const ws = new WebSocket(WSS_URL);

	ws.addEventListener('open', () => {
		reconnectDelay = 1_000;

		streamRefCounts.forEach((count, streamName) => {
			if (count > 0) {
				sendSubscribe(ws, streamName);
			}
		});
	});

	ws.addEventListener('close', () => {
		if (socket === ws) {
			socket = null;
		}

		if (!hasActiveStreams()) return;

		reconnectTimer = setTimeout(() => {
			reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
			socket = createSocket();
		}, reconnectDelay);
	});

	ws.addEventListener('error', () => {
		if (ws.readyState === WebSocket.OPEN) {
			ws.close();
		}
	});

	ws.addEventListener('message', onMessage);
	return ws;
}

// Increments the reference count for a quote stream shared across listeners.
function addStreamRef(fullSymbol, providerSymbol, streamName, type) {
	const count = streamRefCounts.get(streamName) ?? 0;
	streamRefCounts.set(streamName, count + 1);
	streamToMeta.set(streamName, { fullSymbol, providerSymbol, type });
	providerSymbolToFullSymbol.set(providerSymbol, fullSymbol);

	if (count === 0) {
		sendSubscribe(ensureSocket(), streamName);
	}
}

// Decrements the reference count and unsubscribes once a stream is no longer shared.
function removeStreamRef(streamName) {
	const count = streamRefCounts.get(streamName);
	if (!count) return;

	if (count > 1) {
		streamRefCounts.set(streamName, count - 1);
		return;
	}

	streamRefCounts.delete(streamName);
	const meta = streamToMeta.get(streamName);
	streamToMeta.delete(streamName);
	sendUnsubscribe(socket, streamName);
	stopSocketWorkIfIdle();

	if (!meta) return;

	const stillReferenced = [...streamToMeta.values()].some(
		item => item.providerSymbol === meta.providerSymbol
	);

	if (!stillReferenced) {
		providerSymbolToFullSymbol.delete(meta.providerSymbol);
	}
}

// Routes Binance quote events to the listeners registered for that symbol.
function onMessage(event) {
	let message;

	try {
		message = JSON.parse(event.data);
	} catch {
		return;
	}

	if (message.result === null || message.id !== undefined) {
		return;
	}

	const fullSymbol = providerSymbolToFullSymbol.get(message.s);
	if (!fullSymbol) return;

	const listeners = symbolToListeners.get(fullSymbol);
	if (!listeners || listeners.size === 0) return;

	const type =
		message.e === '24hrTicker'
			? 'day'
			: message.e === '1hTicker'
				? 'hour'
				: null;
	if (!type) return;

	listeners.forEach(listenerGUID => {
		const callback = listenerCallbacks.get(listenerGUID);
		callback?.({ symbol: fullSymbol, type, payload: message });
	});
}

// Subscribes quote listeners to shared Binance day and hour ticker streams.
export function subscribeQuotesOnStream(symbols, listenerGUID, onEvent) {
	listenerCallbacks.set(listenerGUID, onEvent);

	const trackedSymbols = new Set();

	symbols.forEach(fullSymbol => {
		const parsed = parseFullSymbol(fullSymbol);
		if (!parsed || parsed.exchange !== BINANCE_EXCHANGE) return;

		trackedSymbols.add(fullSymbol);

		if (!symbolToListeners.has(fullSymbol)) {
			symbolToListeners.set(fullSymbol, new Set());
		}
		symbolToListeners.get(fullSymbol).add(listenerGUID);

		addStreamRef(
			fullSymbol,
			parsed.symbol,
			getTickerStreamName(parsed.symbol),
			'day'
		);
		addStreamRef(
			fullSymbol,
			parsed.symbol,
			getHourTickerStreamName(parsed.symbol),
			'hour'
		);
	});

	listenerToSymbols.set(listenerGUID, trackedSymbols);
	stopSocketWorkIfIdle();
}

// Removes quote listeners and releases any streams they no longer need.
export function unsubscribeQuotesFromStream(listenerGUID) {
	const trackedSymbols = listenerToSymbols.get(listenerGUID);
	listenerCallbacks.delete(listenerGUID);
	listenerToSymbols.delete(listenerGUID);

	if (!trackedSymbols) return;

	trackedSymbols.forEach(fullSymbol => {
		const parsed = parseFullSymbol(fullSymbol);
		if (!parsed) return;

		const listeners = symbolToListeners.get(fullSymbol);
		if (listeners) {
			listeners.delete(listenerGUID);
			if (listeners.size === 0) {
				symbolToListeners.delete(fullSymbol);
			}
		}

		removeStreamRef(getTickerStreamName(parsed.symbol));
		removeStreamRef(getHourTickerStreamName(parsed.symbol));
	});
}
