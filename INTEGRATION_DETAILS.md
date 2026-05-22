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

The Trading Platform install helper also copies `broker-sample/dist/bundle.js`
into `third_party/tradingview/broker-sample/dist/bundle.js` when the installed
package contains it.

## Binance REST APIs

Base URL:

```text
https://api.binance.com/
```

Used endpoints:

- `api/v3/exchangeInfo`: loads Binance spot symbols for `searchSymbols` and
  `resolveSymbol`.
- `api/v3/klines`: loads historical OHLCV bars for `getBars`.
- `api/v3/ticker/24hr`: seeds Trading Platform quote fields such as last price,
  bid/ask, daily high/low, volume, and daily change.
- `api/v3/ticker?windowSize=1h`: seeds Trading Platform rolling 1-hour quote
  change fields.

No Binance API key is required.

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
