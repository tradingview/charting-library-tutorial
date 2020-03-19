# Datafeed Implementation

## Why you need external data source

The Charting Library is used to display financial data, but it doesn't contain any data itself. Whatever you have, a web API, a database or a CSV file, you can display your data in the Charting Library. In this example we'll use a web API integration of  [CryptoCompare][cryptocompare-website-url] (also [CryptoCompare API][cryptocompare-api-url]).

## How the datafeed works

Datafeed is an Object you supply to the TradingView Widget. It has a set of methods like "getBars" or "resolveSymbol" that are called by the Charting Library in certain cases. The datafeed returns results using callback functions.

## onReady

[Link to the doc][onready-docs-url].

This method is used by the Charting Library to get a configuration of your datafeed (e.g. supported resolutions, exchanges and so on). This is the first method of the datafeed that is called.

We'll use the following configuration for our datafeed sample:

```javascript
const configurationData = {
    supported_resolutions: ['1D', '1W', '1M'],
    exchanges: [
        {
            value: 'Bitfinex',
            name: 'Bitfinex',
            desc: 'Bitfinex',
        },
        {
            // `exchange` argument for the `searchSymbols` method, if a user selects this exchange
            value: 'Kraken',

            // filter name
            name: 'Kraken',

            // full exchange name displayed in the filter popup
            desc: 'Kraken bitcoin exchange',
        },
    ],
    symbols_types: [
        {
            name: 'crypto',

            // `symbolType` argument for the `searchSymbols` method, if a user selects this symbol type
            value: 'crypto',
        },
        // ...
    ],
};
```

Our datafeed should return this configuration to the Charting Library.
Note, that the callback must be called asynchronously.

[datafeed.js][datafeed-file-url]:

```javascript
const configurationData = {
    // ...
};

export default {
    onReady: (callback) => {
        console.log('[onReady]: Method call');
        setTimeout(() => callback(configurationData));
    },
};
```

## resolveSymbol

[Link to the doc][resolve-symbol-docs-url].

This method is used by the library to retrieve information about a specific symbol (exchange, price scale, full symbol etc.).

Let's add some shared functions in `helpers.js` that we'll need to implement `resolveSymbol`. These functions are specific for using CryptoCompare and, probably, you won't need most of them for implementing your own datafeed.

[helpers.js][helpers-file-url]:

```javascript
// Make requests to CryptoCompare API
export async function makeApiRequest(path) {
    try {
        const response = await fetch(`https://min-api.cryptocompare.com/${path}`);
        return response.json();
    } catch(error) {
        throw new Error(`CryptoCompare request error: ${error.status}`);
    }
}

// Generate a symbol ID from a pair of the coins
export function generateSymbol(exchange, fromSymbol, toSymbol) {
    const short = `${fromSymbol}/${toSymbol}`;
    return {
        short,
        full: `${exchange}:${short}`,
    };
}
```

In [datafeed.js][datafeed-file-url] we are going to add a helper function that is used to load all symbols for all supported exchanges (see [CryptoCompare API][load-all-cryptocompare-api-url]):

```javascript
import { makeApiRequest, generateSymbol } from './helpers.js';
// ...
async function getAllSymbols() {
    const data = await makeApiRequest('data/v3/all/exchanges');
    let allSymbols = [];

    for (const exchange of configurationData.exchanges) {
        const pairs = data.Data[exchange.value].pairs;

        for (const leftPairPart of Object.keys(pairs)) {
            const symbols = pairs[leftPairPart].map(rightPairPart => {
                const symbol = generateSymbol(exchange.value, leftPairPart, rightPairPart);
                return {
                    symbol: symbol.short,
                    full_name: symbol.full,
                    description: symbol.short,
                    exchange: exchange.value,
                    type: 'crypto',
                };
            });
            allSymbols = [...allSymbols, ...symbols];
        }
    }
    return allSymbols;
}
```

And we can use this function in `resolveSymbol`. Please note, that the library can build weekly and monthly resolutions from 1D, if we add these resolutions to the supported ones, but we need to directly specify that the datafeed doesn't have these resolutions by setting `has_weekly_and_monthly` to `false`:

```javascript
export default {
    // ...
    resolveSymbol: async (
        symbolName,
        onSymbolResolvedCallback,
        onResolveErrorCallback
    ) => {
        console.log('[resolveSymbol]: Method call', symbolName);
        const symbols = await getAllSymbols();
        const symbolItem = symbols.find(({ full_name }) => full_name === symbolName);
        if (!symbolItem) {
            console.log('[resolveSymbol]: Cannot resolve symbol', symbolName);
            onResolveErrorCallback('cannot resolve symbol');
            return;
        }
        const symbolInfo = {
            name: symbolItem.symbol,
            description: symbolItem.description,
            type: symbolItem.type,
            session: '24x7',
            timezone: 'Etc/UTC',
            exchange: symbolItem.exchange,
            minmov: 1,
            pricescale: 100,
            has_intraday: false,
            has_no_volume: true,
            has_weekly_and_monthly: false,
            supported_resolutions: configurationData.supported_resolutions,
            volume_precision: 2,
            data_status: 'streaming',
        };

        console.log('[resolveSymbol]: Symbol resolved', symbolName);
        onSymbolResolvedCallback(symbolInfo);
    },
// ...
};
```

## getBars

[Link to the doc][get-bars-docs-url].

This method is used by the charting library to get historical data for the symbol.

Add `parseFullSymbol` function to [helpers.js][helpers-file-url]. It parses a crypto pair symbol (`full` value returned from `generateSymbol`) and returns all parts of this symbol:

```javascript
// ...
export function parseFullSymbol(fullSymbol) {
    const match = fullSymbol.match(/^(\w+):(\w+)\/(\w+)$/);
    if (!match) {
        return null;
    }

    return { exchange: match[1], fromSymbol: match[2], toSymbol: match[3] };
}
```

Use [Cryptocompare API][get-history-cryptocompare-api-url] and newly created function `parseFullSymbol` in `getBars` method at [datafeed.js][datafeed-file-url]. The API doesn't allow to specify a `from` date so we have to filter bars on the client-side:

```javascript
import { makeApiRequest, parseFullSymbol, generateSymbol } from './helpers.js';
// ...
export default {
  // ...
    getBars: async (symbolInfo, resolution, from, to, onHistoryCallback, onErrorCallback, firstDataRequest) => {
        console.log('[getBars]: Method call', symbolInfo, resolution, from, to);
        const parsedSymbol = parseFullSymbol(symbolInfo.full_name);
        const urlParameters = {
            e: parsedSymbol.exchange,
            fsym: parsedSymbol.fromSymbol,
            tsym: parsedSymbol.toSymbol,
            toTs: to,
            limit: 2000,
        };
        const query = Object.keys(urlParameters)
            .map(name => `${name}=${encodeURIComponent(urlParameters[name])}`)
                .join('&');
        try {
            const data = await makeApiRequest(`data/histoday?${query}`);
            if (data.Response && data.Response === 'Error' || data.Data.length === 0) {
                // "noData" should be set if there is no data in the requested period.
                onHistoryCallback([], { noData: true });
                return;
            }
            let bars = [];
            data.Data.forEach(bar => {
                if (bar.time >= from && bar.time < to) {
                    bars = [...bars, {
                        time: bar.time * 1000,
                        low: bar.low,
                        high: bar.high,
                        open: bar.open,
                        close: bar.close,
                    }];
                }
            });
            console.log(`[getBars]: returned ${bars.length} bar(s)`);
            onHistoryCallback(bars, { noData: false });
        } catch (error) {
            console.log('[getBars]: Get error', error);
            onErrorCallback(error);
        }
    },
//...
};
```

## searchSymbols

[Link to the doc][search-symbols-docs-url].

This method is used by the Charting Library to search symbols every time a user types a text in the symbol search box. Changing symbols also works using the symbol search.

We will request all available symbols from the API and then filter them in [datafeed.js][datafeed-file-url]. If a user is not selected an exchange, the `exchange` argument will be equal to an empty string:

```javascript
searchSymbols: async (
    userInput,
    exchange,
    symbolType,
    onResultReadyCallback
) => {
    console.log('[searchSymbols]: Method call');
    const symbols = await getAllSymbols();
    const newSymbols = symbols.filter(symbol => {
        const isExchangeValid = exchange === '' || symbol.exchange === exchange;
        const isFullSymbolContainsInput = symbol.full_name
            .toLowerCase()
            .indexOf(userInput.toLowerCase()) !== -1;
        return isExchangeValid && isFullSymbolContainsInput;
    });
    onResultReadyCallback(newSymbols);
},
```

Now we can search symbols and display historical data. Let's [implement the streaming](streaming-implementation.md).
Also you can return to [Home Page](home.md).

[cryptocompare-website-url]: https://www.cryptocompare.com/
[cryptocompare-api-url]: https://min-api.cryptocompare.com/
[load-all-cryptocompare-api-url]: https://min-api.cryptocompare.com/documentation?key=Other&cat=allExchangesV3Endpoint
[get-history-cryptocompare-api-url]: https://min-api.cryptocompare.com/documentation?key=Historical&cat=dataHistoday

[onready-docs-url]: https://github.com/tradingview/charting_library/wiki/JS-Api#onreadycallback
[resolve-symbol-docs-url]: https://github.com/tradingview/charting_library/wiki/JS-Api#resolvesymbolsymbolname-onsymbolresolvedcallback-onresolveerrorcallback
[get-bars-docs-url]: https://github.com/tradingview/charting_library/wiki/JS-Api#getbarssymbolinfo-resolution-from-to-onhistorycallback-onerrorcallback-firstdatarequest
[search-symbols-docs-url]: https://github.com/tradingview/charting_library/wiki/JS-Api#searchsymbolsuserinput-exchange-symboltype-onresultreadycallback

[datafeed-file-url]: ../src/datafeed.js
[helpers-file-url]: ../src/helpers.js
