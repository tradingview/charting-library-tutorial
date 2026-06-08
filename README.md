# TradingView Charting Library Datafeed Example

This project demonstrates a Binance-backed TradingView datafeed with two
optional run modes:

- Free Advanced Charts from `tradingview/charting_library`.
- Paid Trading Platform from `tradingview/trading_platform`.

You only need the TradingView package for the page you want to test. If both
packages are present, both routes work in the same checkout.

Last tested: June 2026 with TradingView Advanced Charts 31.2.0, Trading
Platform 31.2.0, Binance public Spot REST/WebSocket APIs, CoinDesk RSS, and the
npm dependencies from `package-lock.json`.

## Start The Project

For a fresh clone, install npm dependencies first, then download the TradingView
runtime you want to use:

```bash
npm install
npm run tv:install:tp -- 31.2.0 # current latest version
npm run start
```

For the free Advanced Charts page only, use this instead:

```bash
npm install
npm run tv:install:ac -- 31.2.0
npm run start
```

Open:

```text
http://127.0.0.1:3000
http://127.0.0.1:3000/trading
```

## Download A TradingView Package

If you have GitHub SSH access to TradingView's repositories, the install helper
can download and place the package for you:

```bash
npm run tv:install:ac -- 31.2.0 # tested version
npm run tv:install:tp -- 31.2.0 # tested version
```

Use only the command for the package you need. If you omit the version, the
script downloads `master`.

- `tv:install:ac` installs only Advanced Charts.
- `tv:install:tp` installs both Advanced Charts and Trading Platform, so the
  homepage still works.

Place one or both package folders in the project root:

```text
charting-library-tutorial/
  charting_library-master/
    charting_library/
      charting_library.js
  trading_platform-master/
    charting_library/
      charting_library.js
```

- Use `charting_library-master` for the free Advanced Charts page.
- Use `trading_platform-master` for the Trading Platform page.

For Trading Platform broker features, the `tv:install:tp` script also copies
TradingView's BrokerDemo bundle when it is present in the package. If you place
packages manually, copy the bundle into this path:

```text
third_party/tradingview/broker-sample/dist/bundle.js
```

The bundle can be found in TradingView's Trading Platform repository:
[broker-sample/dist/bundle.js](https://github.com/tradingview/trading_platform/blob/master/broker-sample/dist/bundle.js).

## Routes

- `/`: minimal Advanced Charts example with chart datafeed, theme toggle, and
  documentation button.
- `/trading`: Trading Platform example with broker sample, DOM, account manager,
  alerts, save/load, watchlist, quotes, CoinDesk news, toolbar controls, and
  multi-chart support.

## Updating TradingView Packages

With npm:

```bash
npm run tv:install:ac -- 31.2.0
npm run tv:install:tp -- 31.2.0
```

If you manually placed `charting_library-master` or `trading_platform-master` in
the project root, run:

```bash
npm run tv:sync
npm run start
```

Hard refresh the browser after package changes so old TradingView chunks are not
reused.

## Useful Notes

- `npm run tv:sync` copies package assets into `vendor/tradingview/`.
- `npm run tv:install:ac` installs only the Advanced Charts runtime into
  `vendor/tradingview/advanced_charts`.
- `npm run tv:install:tp` installs Advanced Charts and Trading Platform into
  `vendor/tradingview/`.
- If only `charting_library-master` exists, only `/` is expected to work.
- If only `trading_platform-master` exists, only `/trading` is expected to work.
- `npm run start` serves clean routes and the CoinDesk RSS proxy used by
  `/trading`.
- `npm run start:static` is only a static fallback; Trading Platform CoinDesk
  news will not load there.
- More implementation detail is in
  [INTEGRATION_DETAILS.md](./INTEGRATION_DETAILS.md).
