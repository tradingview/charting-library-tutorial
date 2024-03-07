import { parseFullSymbol, apiKey } from './helpers.js';

const socket = new WebSocket(
	'wss://streamer.cryptocompare.com/v2?api_key=' + apiKey
);
const channelToSubscription = new Map();

socket.addEventListener('open', () => {
	console.log('[socket] Connected');
});

socket.addEventListener('close', (reason) => {
	console.log('[socket] Disconnected:', reason);
});

socket.addEventListener('error', (error) => {
	console.log('[socket] Error:', error);
});

socket.addEventListener('message', (event) => {
	const data = JSON.parse(event.data);
	console.log('[socket] Message:', data);
	const {
		TYPE: eventTypeStr,
		M: exchange,
		FSYM: fromSymbol,
		TSYM: toSymbol,
		TS: tradeTimeStr,
		P: tradePriceStr,
	} = data;

	if (parseInt(eventTypeStr) !== 0) {
		// Skip all non-trading events
		return;
	}
	const tradePrice = parseFloat(tradePriceStr);
	const tradeTime = parseInt(tradeTimeStr);
	const channelString = `0~${exchange}~${fromSymbol}~${toSymbol}`;
	const subscriptionItem = channelToSubscription.get(channelString);
	if (subscriptionItem === undefined) {
		return;
	}
	const lastDailyBar = subscriptionItem.lastDailyBar;
	const nextDailyBarTime = getNextDailyBarTime(lastDailyBar.time);

	let bar;
	if (tradeTime >= nextDailyBarTime) {
		bar = {
			time: nextDailyBarTime,
			open: tradePrice,
			high: tradePrice,
			low: tradePrice,
			close: tradePrice,
		};
		console.log('[socket] Generate new bar', bar);
	} else {
		bar = {
			...lastDailyBar,
			high: Math.max(lastDailyBar.high, tradePrice),
			low: Math.min(lastDailyBar.low, tradePrice),
			close: tradePrice,
		};
		console.log('[socket] Update the latest bar by price', tradePrice);
	}
	subscriptionItem.lastDailyBar = bar;

	// Send data to every subscriber of that symbol
	subscriptionItem.handlers.forEach((handler) => handler.callback(bar));
});

function getNextDailyBarTime(barTime) {
	const date = new Date(barTime * 1000);
	date.setDate(date.getDate() + 1);
	return date.getTime() / 1000;
}

export function subscribeOnStream(
	symbolInfo,
	resolution,
	onRealtimeCallback,
	subscriberUID,
	onResetCacheNeededCallback,
	lastDailyBar
) {
	const parsedSymbol = parseFullSymbol(symbolInfo.full_name);
	const channelString = `0~${parsedSymbol.exchange}~${parsedSymbol.fromSymbol}~${parsedSymbol.toSymbol}`;
	const handler = {
		id: subscriberUID,
		callback: onRealtimeCallback,
	};
	let subscriptionItem = channelToSubscription.get(channelString);
	if (subscriptionItem) {
		// Already subscribed to the channel, use the existing subscription
		subscriptionItem.handlers.push(handler);
		return;
	}
	subscriptionItem = {
		subscriberUID,
		resolution,
		lastDailyBar,
		handlers: [handler],
	};
	channelToSubscription.set(channelString, subscriptionItem);
	console.log(
		'[subscribeBars]: Subscribe to streaming. Channel:',
		channelString
	);
	const subRequest = {
		action: 'SubAdd',
		subs: [channelString],
	};
	socket.send(JSON.stringify(subRequest));
}

export function unsubscribeFromStream(subscriberUID) {
	// Find a subscription with id === subscriberUID
	for (const channelString of channelToSubscription.keys()) {
		const subscriptionItem = channelToSubscription.get(channelString);
		const handlerIndex = subscriptionItem.handlers.findIndex(
			(handler) => handler.id === subscriberUID
		);

		if (handlerIndex !== -1) {
			// Remove from handlers
			subscriptionItem.handlers.splice(handlerIndex, 1);

			if (subscriptionItem.handlers.length === 0) {
				// Unsubscribe from the channel if it was the last handler
				console.log(
					'[unsubscribeBars]: Unsubscribe from streaming. Channel:',
					channelString
				);
				const subRequest = {
					action: 'SubRemove',
					subs: [channelString],
				};
				socket.send(JSON.stringify(subRequest));
				channelToSubscription.delete(channelString);
				break;
			}
		}
	}
}
