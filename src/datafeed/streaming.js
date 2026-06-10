import {
	barStartTime,
	getNextBarTime,
	getResolutionSpec,
	parseFullSymbol,
} from './helpers.js';

const UPDATE_FREQUENCY = 250;
const WSS_URL = 'wss://stream.binance.com:9443/ws';
const MAX_RECONNECT_DELAY = 30_000;
const SOCKET_CONNECT_DELAY_MS = 100;

const streamToSubscription = new Map();
const subscriberToStream = new Map();

let socket = null;
let reconnectDelay = 1_000;
let reconnectTimer = null;
let connectTimer = null;
let hasConnectedBefore = false;
let requestId = 0;

// Generates monotonically increasing ids for Binance websocket control messages.
function nextRequestId() {
	requestId += 1;
	return requestId;
}

// Checks whether any chart pane currently needs realtime bar updates.
function hasActiveStreams() {
	return streamToSubscription.size > 0;
}

// Defers the first socket open until the chart's initial subscribe/unsubscribe churn settles.
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

// Stops pending connection work when every bar subscriber has gone away.
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

// Creates the shared Binance websocket and restores subscriptions after reconnects.
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
		if (hasConnectedBefore) {
			streamToSubscription.forEach(item => {
				item.handlers.forEach(handler => {
					handler.onResetCacheNeededCallback?.();
				});
			});
		}

		hasConnectedBefore = true;
		reconnectDelay = 1_000;

		streamToSubscription.forEach((_, streamName) => {
			sendSubscribe(ws, streamName);
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

// Builds the Binance trade stream name for resolutions we assemble from ticks.
function getTradeStreamName(providerSymbol) {
	return `${providerSymbol.toLowerCase()}@trade`;
}

// Builds the Binance kline stream name for resolutions Binance publishes directly.
function getKlineStreamName(providerSymbol, interval) {
	return `${providerSymbol.toLowerCase()}@kline_${interval}`;
}

// Chooses the websocket stream type that should drive a given resolution.
function getStreamName(providerSymbol, resolution) {
	const spec = getResolutionSpec(resolution);
	if (!spec) return null;

	if (spec.streamType === 'trade') {
		return getTradeStreamName(providerSymbol);
	}

	return getKlineStreamName(providerSymbol, spec.streamInterval);
}

// Updates an in-flight bar using raw trade ticks for rebuilt resolutions.
function updateHandlerFromTrade(handler, message) {
	const price = parseFloat(message.p);
	const quantity = parseFloat(message.q);
	const tradeTimeMs = message.T;
	const lastBar = handler.lastBar;
	const currentBarStart = barStartTime(tradeTimeMs, handler.resolution);

	if (!lastBar || currentBarStart > lastBar.time) {
		handler.lastBar = {
			time: currentBarStart,
			open: price,
			high: price,
			low: price,
			close: price,
			volume: quantity,
		};
		handler.isDirty = true;
		return;
	}

	if (tradeTimeMs >= getNextBarTime(lastBar.time, handler.resolution)) {
		handler.lastBar = {
			time: currentBarStart,
			open: price,
			high: price,
			low: price,
			close: price,
			volume: quantity,
		};
		handler.isDirty = true;
		return;
	}

	handler.lastBar = {
		...lastBar,
		high: Math.max(lastBar.high, price),
		low: Math.min(lastBar.low, price),
		close: price,
		volume: (lastBar.volume || 0) + quantity,
	};
	handler.isDirty = true;
}

// Replaces subscriber bars with Binance's server-built kline payloads.
function updateHandlersFromKline(subscription, message) {
	const kline = message.k;
	const bar = {
		time: kline.t,
		open: parseFloat(kline.o),
		high: parseFloat(kline.h),
		low: parseFloat(kline.l),
		close: parseFloat(kline.c),
		volume: parseFloat(kline.v),
	};

	subscription.handlers.forEach(handler => {
		handler.lastBar = bar;
		handler.isDirty = true;
	});
}

// Routes incoming websocket events to the matching bar subscribers.
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

	if (message.e === 'trade') {
		const streamName = getTradeStreamName(message.s);
		const subscription = streamToSubscription.get(streamName);
		if (!subscription) return;

		subscription.handlers.forEach(handler => {
			updateHandlerFromTrade(handler, message);
		});
		return;
	}

	if (message.e === 'kline' && message.k?.s && message.k?.i) {
		const streamName = getKlineStreamName(message.k.s, message.k.i);
		const subscription = streamToSubscription.get(streamName);
		if (!subscription) return;

		updateHandlersFromKline(subscription, message);
	}
}

// Batches websocket bursts before notifying TradingView, reducing chart redraw pressure.
setInterval(() => {
	streamToSubscription.forEach(subscription => {
		subscription.handlers.forEach(handler => {
			if (!handler.isDirty || !handler.lastBar) return;

			handler.callback(handler.lastBar);
			handler.isDirty = false;
		});
	});
}, UPDATE_FREQUENCY);

// Subscribes a chart listener to the Binance stream that powers its resolution.
export function subscribeOnStream(
	symbolInfo,
	resolution,
	onRealtimeCallback,
	subscriberUID,
	onResetCacheNeededCallback,
	lastBar
) {
	if (!symbolInfo?.ticker) {
		console.error('[subscribeBars] Invalid symbolInfo:', symbolInfo);
		return;
	}

	const parsed = parseFullSymbol(symbolInfo.ticker);
	if (!parsed) {
		console.error(
			'[subscribeBars] Cannot parse ticker:',
			symbolInfo.ticker
		);
		return;
	}

	const streamName = getStreamName(parsed.symbol, resolution);
	if (!streamName) {
		console.error('[subscribeBars] Unsupported resolution:', resolution);
		return;
	}

	const handler = {
		id: subscriberUID,
		callback: onRealtimeCallback,
		onResetCacheNeededCallback,
		resolution,
		lastBar: lastBar ?? null,
		isDirty: false,
	};

	const existing = streamToSubscription.get(streamName);
	if (existing) {
		existing.handlers.push(handler);
		subscriberToStream.set(subscriberUID, streamName);
		return;
	}

	streamToSubscription.set(streamName, {
		streamName,
		handlers: [handler],
	});
	subscriberToStream.set(subscriberUID, streamName);

	sendSubscribe(ensureSocket(), streamName);
}

// Removes a chart subscriber and closes the stream when nobody is left on it.
export function unsubscribeFromStream(subscriberUID) {
	const streamName = subscriberToStream.get(subscriberUID);
	if (!streamName) return;

	const subscription = streamToSubscription.get(streamName);
	if (!subscription) {
		subscriberToStream.delete(subscriberUID);
		return;
	}

	subscription.handlers = subscription.handlers.filter(
		handler => handler.id !== subscriberUID
	);
	subscriberToStream.delete(subscriberUID);

	if (subscription.handlers.length === 0) {
		sendUnsubscribe(socket, streamName);
		streamToSubscription.delete(streamName);
		stopSocketWorkIfIdle();
		return;
	}
}
