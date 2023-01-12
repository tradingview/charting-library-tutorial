# Getting Started

## About this tutorial

TradingView’s Charting Library is a powerful instrument for displaying financial data. It has different technical analysis tools including, but not limited to, about 100 indicators and over 70 drawings. Under the hood, the Charting Library can process and display thousands of data points, build custom resolutions and compare data from different time zones.

After reading through this tutorial, you will know how to connect data to the Charting Library, including how to stream real-time data.

As an example, we will connect the Charting Library to CryptoCompare which provides data from different crypto exchanges via a single API.

The tutorial is split into three main parts:

1) setting up the widget
2) integrating historical data
3) real-time updates using WebSocket.

## Before we begin

The Charting Library is free, but its code is in the private repository on GitHub.

Make sure that you have access to this repository: <https://github.com/tradingview/charting_library/>.

If you see a 404 error page, then you need to request access to this repository on our [dedicated page](https://tradingview.com/HTML5-stock-forex-bitcoin-charting-library/?feature=technical-analysis-charts) and click on the `Get library` button.

## Results

If you want to see the results of this tutorial right away, you will need to take the following next steps:

1. Clone the [Tutorial Repo][tutorial-repo-url]. Please note, for the real project it is better to use this repo as a submodule in yours.

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
[demo-url]: https://charting-library.tradingview.com/index.html
