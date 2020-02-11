# Streaming Implementation

In this article we'll implement real-time updates via WebSocket.

## Connect
To connect to the streaming API we need to add socket.io script to the page **before** main.js script.

[index.html](../index.html):

```html
<!DOCTYPE HTML>
<html>
    <head>
        <!-- ... -->
        <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/1.7.2/socket.io.js"></script>
        <!-- ... -->
    </body>
</html>
```

Let's create a new file called [streaming.js][streaming-file-url], where we'll implement a connection to the WebSocket and streaming real-time updates.

[streaming.js][streaming-file-url]:

```javascript
const socket = io('wss://streamer.cryptocompare.com');

socket.on('connect', () => {
    console.log('[socket] Connected');
});

socket.on('disconnect', (reason) => {
    console.log('[socket] Disconnected:', reason);
});

socket.on('error', (error) => {
    console.log('[socket] Error:', error);
});

export function subscribeOnStream() {
    // todo
}

export function unsubscribeFromStream() {
    // todo
}
```


And now we can use these functions in [datafeed.js][datafeed-file-url] file to make a subscription to real-time updates.

- [subscribeBars documentation][subscribe-bars-docs-url]
- [unsubscribeBars documentation][unsubscribe-bars-docs-url]

[datafeed.js][datafeed-file-url]:

```javascript
import { subscribeOnStream, unsubscribeFromStream } from './streaming.js';

const lastBarsCache = new Map();
// ...
export default {
    // ...
    subscribeBars: (
        symbolInfo,
        resolution,
        onRealtimeCallback,
        subscribeUID,
        onResetCacheNeededCallback
    ) => {
        console.log('[subscribeBars]: Method call with subscribeUID:', subscribeUID);
        subscribeOnStream(
            symbolInfo,
            resolution,
            onRealtimeCallback,
            subscribeUID,
            onResetCacheNeededCallback,
            lastBarsCache.get(symbolInfo.full_name)
        );
    },

    unsubscribeBars: (subscriberUID) => {
        console.log('[unsubscribeBars]: Method call with subscriberUID:', subscriberUID);
        unsubscribeFromStream(subscriberUID);
    },
};
```

## Subscribe

We've connected to the WebSocket, now we need to subscribe to the channels to receive updates:

[streaming.js][streaming-file-url]:

```javascript
import { parseFullSymbol } from './helpers.js';
// ...
const channelToSubscription = new Map();
// ...
export function subscribeOnStream(
    symbolInfo,
    resolution,
    onRealtimeCallback,
    subscribeUID,
    onResetCacheNeededCallback,
    lastDailyBar
) {
    const parsedSymbol = parseFullSymbol(symbolInfo.full_name);
    const channelString = `0~${parsedSymbol.exchange}~${parsedSymbol.fromSymbol}~${parsedSymbol.toSymbol}`;
    const handler = {
        id: subscribeUID,
        callback: onRealtimeCallback,
    };
    let subscriptionItem = channelToSubscription.get(channelString);
    if (subscriptionItem) {
        // already subscribed to the channel, use the existing subscription
        subscriptionItem.handlers.push(handler);
        return;
    }
    subscriptionItem = {
        subscribeUID,
        resolution,
        lastDailyBar,
        handlers: [handler],
    };
    channelToSubscription.set(channelString, subscriptionItem);
    console.log('[subscribeBars]: Subscribe to streaming. Channel:', channelString);
    socket.emit('SubAdd', { subs: [channelString] });
}
```

Let's also implement the `unsubscribeFromStream` function:

```javascript
export function unsubscribeFromStream(subscriberUID) {

    // find a subscription with id === subscriberUID
    for (const channelString of channelToSubscription.keys()) {
        const subscriptionItem = channelToSubscription.get(channelString);
        const handlerIndex = subscriptionItem.handlers
            .findIndex(handler => handler.id === subscriberUID);

        if (handlerIndex !== -1) {
            // remove from handlers
            subscriptionItem.handlers.splice(handlerIndex, 1);

            if (subscriptionItem.handlers.length === 0) {
                // unsubscribe from the channel, if it was the last handler
                console.log('[unsubscribeBars]: Unsubscribe from streaming. Channel:', channelString);
                socket.emit('SubRemove', { subs: [channelString] });
                channelToSubscription.delete(channelString);
                break;
            }
        }
    }
}
```

## Handle updates

Now we need to handle updates coming from the WebSocket. The response will look like this:

```
0~Bitfinex~BTC~USD~2~335394436~1548837377~0.36~3504.1~1261.4759999999999~1f
```
We can parse this response string according to [fields description][cryptocompare-fields-url].
Also, from all [event types][cryptocompare-events-url] we have to pick only trade events. 

[streaming.js][streaming-file-url]:

```javascript
// ...
socket.on('m', data => {
    console.log('[socket] Message:', data);
    const [
        eventTypeStr,
        exchange,
        fromSymbol,
        toSymbol,
        ,
        ,
        tradeTimeStr,
        ,
        tradePriceStr,
    ] = data.split('~');

    if (parseInt(eventTypeStr) !== 0) {
        // skip all non-TRADE events
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
    let bar = {
        ...lastDailyBar,
        high: Math.max(lastDailyBar.high, tradePrice),
        low: Math.min(lastDailyBar.low, tradePrice),
        close: tradePrice,
    };
    console.log('[socket] Update the latest bar by price', tradePrice);
    subscriptionItem.lastDailyBar = bar;

    // send data to every subscriber of that symbol
    subscriptionItem.handlers.forEach(handler => handler.callback(bar));
});
```

Before running the project, open your [datafeed.js][datafeed-file-url] file and adjust your `GetBars` method to save the last bar data for the current symbol. We wouldn't need this, if we had a more accurate way to check for the new bar or if we had a bars streaming API.

```javascript
//...
data.Data.forEach( ... );

if (firstDataRequest) {
    lastBarsCache.set(symbolInfo.full_name, { ...bars[bars.length - 1] });
}
console.log(`[getBars]: returned ${bars.length} bar(s)`);
//...
```

CryptoCompare provides a streaming of ticks, but not bars. So, let's roughly check that the new trade is related to the new daily bar. Please note, you may need more comprehensive check here for the production version.
Adjust code in [streaming.js][streaming-file-url].
Add an utility function:

```javascript
function getNextDailyBarTime(barTime) {
    const date = new Date(barTime * 1000);
    date.setDate(date.getDate() + 1);
    return date.getTime() / 1000;
}
```
and adjust `socket.on` listener: 

```javascript
socket.on('m', data => {
    //...
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
    //...
});
```

## Run

We've implemented a datafeed with searching/resolving of symbols, loading historical data and providing real-time updates via WebSocket.

Now you can go upper to the `chart` folder, run `npx serve` and see how it works.

The full code of this example you can find in the [Tutorial Repo][tutorial-repo-url].

:warning: Note: We cannot guarantee that СryptoCompare works in your region. If you see `ERR_CONNECTION_REFUSED` error, try to use proxy/vpn.

Return to [Home Page](home.md).

[tutorial-repo-url]: https://github.com/tradingview/charting-library-tutorial
[cryptocompare-fields-url]: https://github.com/cryptoqween/cryptoqween.github.io/blob/d6c16d53717c4d4e4880d3f40284ee6eacb9e832/streamer/ccc-streamer-utilities.js#L196-L207
[cryptocompare-events-url]: https://github.com/cryptoqween/cryptoqween.github.io/blob/d6c16d53717c4d4e4880d3f40284ee6eacb9e832/streamer/ccc-streamer-utilities.js#L6
[subscribe-bars-docs-url]: https://github.com/tradingview/charting_library/wiki/JS-Api#subscribebarssymbolinfo-resolution-onrealtimecallback-subscriberuid-onresetcacheneededcallback
[unsubscribe-bars-docs-url]: https://github.com/tradingview/charting_library/wiki/JS-Api#unsubscribebarssubscriberuid

[streaming-file-url]: ../src/streaming.js
[datafeed-file-url]: ../src/datafeed.js
