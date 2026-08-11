# Integration Details

This file explains the project internals: which APIs are used, how data moves
through the app, and where the TradingView-specific pieces live.

## Main Files

- `index.html`: loads Advanced Charts assets and `src/main.js`.
- `trading.html`: loads Trading Platform assets and `src/trading.js`.
- `src/main.js`: minimal Advanced Charts bootstrap.
- `src/trading.js`: Trading Platform bootstrap, broker sample setup, alerts,
  toolbar, save/load, and chart-ready subscription area.
- `src/widget-options.js`: shared widget options plus route-specific AC/TP
  option builders. The AC builder removes quote and DOM methods from the exposed
  datafeed.
- `src/datafeed.js`: TradingView datafeed implementation.
- `src/streaming.js`: realtime candle streams.
- `src/quotes.js`: realtime quote streams used by Trading Platform
  widgetbar/details/watchlist UI.
- `src/helpers.js`: Binance request helpers, symbol parsing, and resolution
  mapping.
- `server.mjs`: static server and same-origin CoinDesk RSS proxy.

## TradingView Runtime Assets

`npm run tv:install:ac` and `npm run tv:install:tp` use npm to install
TradingView GitHub repositories into a temporary folder and copy the runtimes
directly into `vendor/tradingview/`.

- `tv:install:ac` installs only Advanced Charts.
- `tv:install:tp` installs Advanced Charts and Trading Platform, so both `/` and
  `/trading` have runtime assets.

`npm run tv:sync` copies whichever local TradingView package folders exist:

- `charting_library-master/charting_library` to
  `vendor/tradingview/advanced_charts`.
- `trading_platform-master/charting_library` to
  `vendor/tradingview/trading_platform`.

The generated `vendor/tradingview/` folder is ignored by git.

The Trading Platform install helper also installs
`broker-sample/dist/bundle.js` into
`third_party/tradingview/broker-sample/dist/bundle.js`. It first checks the
installed package, then falls back to fetching the file from the Trading
Platform repository using the same version or git ref.

## Binance REST APIs

Base URL:

```text
https://api.binance.com/
```

Used endpoints:

- `api/v3/exchangeInfo`: loads Binance spot symbols for `searchSymbols` and
  `resolveSymbol`.
- `api/v3/time`: synchronizes the library's bar-close countdown with Binance
  server time.
- `api/v3/klines`: loads historical OHLCV bars for `getBars`.
- `api/v3/ticker/24hr`: seeds Trading Platform quote fields such as last price,
  bid/ask, daily high/low, volume, and daily change.
- `api/v3/ticker?windowSize=1h`: seeds Trading Platform rolling 1-hour quote
  change fields.

No Binance API key is required.

## Bar Countdown Server Time

The chart's datafeed advertises `supports_time: true`, so the library calls
`getServerTime(callback)` when it needs an authoritative clock for the
bar-close countdown.

`getServerTime` requests Binance's `api/v3/time` endpoint through the shared
`makeApiRequest` helper. Binance responds with an object such as
`{ "serverTime": 1784719101174 }`, where `serverTime` is Unix time in
milliseconds. The datafeed converts it to the seconds value expected by the
Charting Library before calling the callback:

```js
callback(Math.floor(serverTime / 1000));
```

The callback is invoked exactly once for each request. If Binance cannot be
reached or returns an invalid value, the datafeed logs a warning and falls back
to the browser clock so the chart remains usable; its countdown may then differ
from Binance time.

The server-time method provides the value only. The price-scale display is
enabled independently with the `mainSeriesProperties.showCountdown` chart
override in `src/theme.js`, for both light and dark themes.

## Binance WebSocket Streams

Base URL:

```text
wss://stream.binance.com:9443/ws
```

Used streams:

- `<symbol>@kline_<interval>`: native Binance intervals such as `1m`, `5m`,
  `1h`, `1d`.
- `<symbol>@trade`: tick stream used to rebuild custom intervals such as `2`,
  `4`, `10`, `90`, and `180`.
- `<symbol>@ticker`: realtime 24-hour quote updates for Trading Platform quote
  UI.
- `<symbol>@ticker_1h`: realtime rolling 1-hour quote updates for Trading
  Platform quote UI.
- `<symbol>@depth20@100ms`: Trading Platform DOM depth for Binance spot symbols.

The stream modules share sockets, reference-count subscriptions, debounce
startup churn, and reconnect only while active subscribers exist.

## Datafeed Methods

`src/datafeed.js` implements the TradingView methods used by the widgets:

- `onReady`
- `getServerTime`
- `searchSymbols`
- `resolveSymbol`
- `getBars`
- `subscribeBars`
- `unsubscribeBars`
- `getMarks`
- `getTimescaleMarks`
- `getQuotes`
- `subscribeQuotes`
- `unsubscribeQuotes`
- `subscribeDepth`
- `unsubscribeDepth`

The Advanced Charts route exposes only chart/search/history/realtime bar
methods. `getQuotes`, `subscribeQuotes`, `unsubscribeQuotes`, `subscribeDepth`,
and `unsubscribeDepth` are exposed only to the Trading Platform route.

`subscribeDepth` is Trading Platform-specific. It uses live Binance depth first
and only generates synthetic levels while live depth is unavailable.

## Custom Symbol Status

`src/symbol-status.js` adds a custom item to the Market Status popup in the chart
header describing where the loaded symbol's data comes from and how fresh it is:
a hover tooltip (`Real-time · Binance`) plus a drop-down section with the raw
Binance feed symbol, the exchange, the session, and a link to the Binance API
docs.

The module exposes two functions:

- `setSymbolStatus(symbolInfo, providerSymbol)` — called from `resolveSymbol`.
- `installSymbolStatus(widget)` — called from both page bootstraps.

The status is published from `resolveSymbol` rather than from a `chartReady()`
block subscribed to `onSymbolChanged`. `ICustomSymbolStatusApi.symbol()` keys
each status on a `symbolId` that must match the resolved symbol exactly — the
full ticker `Binance:BTC/USDT`, never the short `BTC/USDT` name — and
`resolveSymbol` is the one place that value is known for certain. Driving it
from `onSymbolChanged` works too, but only by reading `symbolInfo.ticker` and
deferring the call with a timeout, because the header applies the status after
the event fires.

`widget.customSymbolStatus()` is only available once the chart exists, so
`installSymbolStatus` resolves it inside `headerReady()`. The first
`resolveSymbol` can land before that promise settles, so statuses derived in the
meantime are queued in a `Map` keyed by symbol id and replayed on connect
instead of being dropped.

`CustomStatusDropDownContent.content` strings are interpreted as HTML markup.
Everything interpolated into them comes from the Binance `exchangeInfo`
response, so the module escapes those values before building the section.

`describeFeed` derives the wording from the symbol info instead of hardcoding
it: a `delay` above zero produces the amber "delayed" variant, anything else
produces the teal real-time variant. Binance spot is real-time and this datafeed
never sets `delay`, so the delayed branch is the path to reuse when pointing the
app at a feed that reports one.

## Supported Resolutions

```js
[
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
```

Native Binance-backed intervals:

- `1`, `3`, `5`, `15`, `30`, `60`, `120`, `240`, `360`, `480`, `720`, `1D`,
  `3D`, `1W`, `1M`.

Custom intervals rebuilt locally:

- `2`, `4`, `10`, `90`, `180`.

## News

The Trading Platform widgetbar uses CoinDesk RSS through this local route:

```text
/api/news/coindesk-rss
```

CoinDesk does not provide browser CORS headers for local development, so
`server.mjs` fetches the RSS feed server-side, returns it same-origin, and
strips HTML tags from RSS titles/descriptions before TradingView displays the
items. The free Advanced Charts route does not configure `rss_news_feed`.

## Trading Platform Extras

The `/trading` route adds:

- BrokerDemo runtime from
  `third_party/tradingview/broker-sample/dist/bundle.js`.
- `broker_factory` and `broker_config`.
- Trading Platform DOM via `subscribeDepth`.
- LocalStorage-backed save/load adapter.
- Custom alert demo using chart shapes plus broker notifications.
- Account manager, watchlist, details, quote data, data window, news, and
  toolbar controls.

The BrokerDemo bundle source is:
[broker-sample/dist/bundle.js](https://github.com/tradingview/trading_platform/blob/master/broker-sample/dist/bundle.js).

## Persistence

TradingView internal settings localStorage is disabled through
`disabled_features` so tutorial defaults are deterministic across `localhost`
and `127.0.0.1`.

The Trading Platform save/load adapter still stores charts, drawings, templates,
and study templates in browser `localStorage`.

## Known Constraints

- Binance public endpoint availability can vary by jurisdiction or network.
- Trading Platform CoinDesk news depends on the local server route, so use
  `npm run start`.
- Chart marks and timescale marks are demo data.
- Non-Binance symbols cannot use live Binance DOM depth and will fall back to
  generated DOM levels.
