# Integration

From this article you can learn the basic elements of integration and you can create a skeleton version that we can use later on.

## Browser support

In the example we are using ES6, which might be not supported by some older browsers, such as Safari or IE11. If you want to run this sample in older browsers, you will need to transpile all modules to ES5 standard or add polyfills.

## Getting the Library

1. First, create a folder for your project:

    ```bash
    mkdir chart
    cd chart
    ```

1. Clone [TradingView Charting Library][library-url]. For access instructions, see [Getting Started](getting-started.md).

    ```bash
    git clone https://github.com/tradingview/charting_library charting_library_clonned_data
    ```

## Adding a container

You need to have some DOM container that will be used to display of the chart.
Create an initial HTML file [index.html](../index.html) in your project folder and add the following code:

```html
<!DOCTYPE HTML>
<html>
    <head>
        <title>TradingView Charting Library example</title>
        <script
            type="text/javascript"
            src="charting_library_clonned_data/charting_library/charting_library.min.js">
        </script>

        <!-- Custom datafeed module. -->
        <script type="module" src="src/main.js"></script>
    </head>
    <body style="margin:0px;">
        <div id="tv_chart_container">
            <!-- This div will contain the Charting Library widget. -->
        </div>
    </body>
</html>
```

We've just added a script that is used to load the Charting Library and a container that will be used as a placeholder for the chart.

## Creating a Charting Library widget

Add a folder `src`, then create [main.js](../src/main.js) in it and add code depicted below. This will create a [Charting Library widget][widget-docs-url]. Note that the widget constructor has many different settings. We will be setting only mandatory ones.

```javascript
// Datafeed implementation, will be added later
import Datafeed from './datafeed.js';

window.tvWidget = new TradingView.widget({
    symbol: 'Bitfinex:BTC/USD', // default symbol
    interval: '1D', // default interval
    fullscreen: true, // displays the chart in the fullscreen mode
    container_id: 'tv_chart_container',
    datafeed: Datafeed,
    library_path: '../charting_library_clonned_data/charting_library/',
});
```

## Creating a mock of the datafeed

Now you are only one step away from being able to start your implementation. Let's create datafeed that writes a message to the console when any method is called. In the next part of the tutorial we'll implement all of these methods, but for now you can copy this code to [datafeed.js](../src/datafeed.js), go to the chart folder and try to run the implementation using `npx serve`.

```javascript
export default {
    onReady: (callback) => {
        console.log('[onReady]: Method call');
    },
    searchSymbols: (userInput, exchange, symbolType, onResultReadyCallback) => {
        console.log('[searchSymbols]: Method call');
    },
    resolveSymbol: (symbolName, onSymbolResolvedCallback, onResolveErrorCallback) => {
        console.log('[resolveSymbol]: Method call', symbolName);
    },
    getBars: (symbolInfo, resolution, from, to, onHistoryCallback, onErrorCallback, firstDataRequest) => {
        console.log('[getBars]: Method call', symbolInfo);
    },
    subscribeBars: (symbolInfo, resolution, onRealtimeCallback, subscribeUID, onResetCacheNeededCallback) => {
        console.log('[subscribeBars]: Method call with subscribeUID:', subscribeUID);
    },
    unsubscribeBars: (subscriberUID) => {
        console.log('[unsubscribeBars]: Method call with subscriberUID:', subscriberUID);
    },
};
```

Now we're ready to [implement these methods](datafeed-implementation.md).
Also you can return to [Home Page](home.md).

[library-url]: https://github.com/tradingview/charting_library/
[widget-docs-url]: https://github.com/tradingview/charting_library/wiki/Widget-Constructor
