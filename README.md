# Advanced Charts: Connecting data via the Datafeed API

## Overview

This repository contains sample code for the [Datafeed API tutorial] that explains how to implement real-time data streaming to [Advanced Charts].
As an example, the tutorial describes connection via free [CryptoCompare API] that provides data from different crypto exchanges.

> [!NOTE]
> Advanced Charts is a standalone client-side library that is used to display financial charts, prices, and technical analysis tools.
> Learn more about Advanced Charts on the [TradingView website].

## Prerequisites

- The [Advanced Charts repository] is private.
Refer to [Getting Access] for more information on how to get the library.
- To use [CryptoCompare API], you should create an account and generate a free API key. For more information, refer to the [CryptoCompare documentation](https://www.cryptocompare.com/coins/guides/how-to-use-our-api/).

## How to run

Take the following steps to run this project:

1. Clone the repository.
    Note that for the real project, it is better to use this repository as a submodule in yours.

    ```bash
    git clone https://github.com/tradingview/charting-library-tutorial.git
    ```

2. Go to the repository folder and initialize the Git submodule with the library:

    ```bash
    git submodule update --init --recursive
    ```

    Alternatively, you can download the [library repository] from a ZIP file or clone it using Git.

3. Run the following command to serve static files:

    ```bash
    npx serve
    ```

## Release notes

### September, 2025

The latest version introduces several key improvements:

- **Intraday resolutions**: Added support for minute and hour resolutions.
- **SymbolInfo update**: Removed `full_name` from the `SymbolInfo` object. Now, `ticker` is used instead.
- **Improved search**: `searchSymbols` now properly filters results by user input, selected exchange, and symbol type.
- **Improved `getBars`**: `getBars` now selects the correct API endpoint based on the requested `resolution` (minute, hour, or day), ensuring the most appropriate data is used.
- **Enhanced streaming**: Reworked streaming logic to support [multiple subscriptions] to data updates.

[Advanced Charts]: https://www.tradingview.com/charting-library-docs/
[Datafeed API tutorial]: https://www.tradingview.com/charting-library-docs/latest/tutorials/implement_datafeed_tutorial/
[CryptoCompare API]: https://www.cryptocompare.com/
[TradingView website]: https://www.tradingview.com/HTML5-stock-forex-bitcoin-charting-library/?feature=technical-analysis-charts
[Advanced Charts repository]: https://github.com/tradingview/charting_library
[Getting Access]: https://www.tradingview.com/charting-library-docs/latest/getting_started/quick-start#getting-access
[multiple subscriptions]: https://www.tradingview.com/charting-library-docs/latest/connecting_data/datafeed-api/required-methods#multiple-subscriptions
[library repository]: https://github.com/tradingview/charting_library
