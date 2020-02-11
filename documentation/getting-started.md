# Getting Started

## About this tutorial

TradingView Charting Library is a powerful instrument for displaying financial data. It has different technical analysis tools including about 100 indicators and more than 70 drawings. Under the hood it can process and display dozens thousands of data points, build custom resolutions and compare data from different time zones.

After reading this tutorial you will know how to connect data to the Charting Library, including streaming of real-time data.

As an example, we will connect the Charting Library to CryptoCompare which provides data from different crypto exchanges via a single API.

The tutorial is split into three parts: setting up the widget, integration of historical data and realtime updates using WebSocket.

## Before we begin

The Charting Library is free, but its code is in the private repository on GitHub.
Make sure that you have access to this repository: <https://github.com/tradingview/charting_library/>.

If you see 404 error page, then you need to request access to this repository at <https://tradingview.com/HTML5-stock-forex-bitcoin-charting-library/>, click on the `Get Library` button inside the Technical Analysis Chart tab.

## Result

If you want to see the result of this tutorial right away, you need to do the following steps:

1. Clone the [Tutorial Repo][tutorial-repo-url]:

    ```bash
    git clone https://github.com/tradingview/charting-library-tutorial.git
    ```

1. Go to the repo folder and init git submodule with the charting library:

    ```bash
    git submodule update --init --recursive
    ```

1. Run the following command to serve static files:

    ```bash
    npx serve
    ```
[Deployed Preview][demo-url]

## Let's begin

Proceed to the [Integration](integration.md) or return to [Home Page](home.md).

[tutorial-repo-url]: https://github.com/tradingview/charting-library-tutorial
[demo-url]: https://charting-library.tradingview.com/
