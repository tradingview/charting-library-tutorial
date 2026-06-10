import Datafeed from './datafeed/datafeed.js';
import { CRYPTO_RSS_NEWS_FEED, CRYPTO_RSS_TITLE } from './news.js';
import { cssBlobUrl, getChartOverrides, theme } from './theme.js';

const SHARED_ENABLED_FEATURES = [
	'custom_resolutions',
	'allow_arbitrary_symbol_search_input',
	'display_data_mode',
	'use_symbol_name_for_header_toolbar',
	'chart_drag_export',
];

const SHARED_DISABLED_FEATURES = [
	'use_localstorage_for_settings',
	'save_chart_properties_to_local_storage',
	'volume_force_overlay',
];

const TRADING_PLATFORM_ENABLED_FEATURES = [
	'dom_widget',
	'saveload_separate_drawings_storage',
	'pre_post_market_price_line',
	'legend_last_day_change',
];

const TRADING_PLATFORM_DISABLED_FEATURES = [
	'open_account_manager',
	'show_right_widgets_panel_by_default',
];

// The free Advanced Charts page does not have widgetbar quote/news/DOM UI, so expose
// only the chart datafeed methods it can use.
function createAdvancedChartsDatafeed(datafeed) {
	const clone = { ...datafeed };

	delete clone.getQuotes;
	delete clone.subscribeQuotes;
	delete clone.unsubscribeQuotes;
	delete clone.subscribeDepth;
	delete clone.unsubscribeDepth;

	return clone;
}

const ADVANCED_CHARTS_DATAFEED = createAdvancedChartsDatafeed(Datafeed);

// Deduplicates feature flags after individual pages add their own options.
function unique(values) {
	return [...new Set(values)];
}

// Builds the common widget constructor payload used by the minimal and trading pages.
export function createWidgetOptions({
	datafeed = Datafeed,
	enabledFeatures = [],
	disabledFeatures = [],
	chartOverrides = {},
	libraryPath = 'vendor/tradingview/advanced_charts/',
	...options
} = {}) {
	return {
		symbol: 'Binance:ETH/USDT',
		interval: '1D',
		fullscreen: true,
		container: 'tv_chart_container',
		datafeed,
		library_path: libraryPath,
		locale: 'en',
		symbol_search_request_delay: 1000,
		theme,
		custom_css_url: cssBlobUrl,
		custom_font_family: "'NanumBarunGothic', sans-serif",
		enabled_features: unique([
			...SHARED_ENABLED_FEATURES,
			...enabledFeatures,
		]),
		disabled_features: unique([
			...SHARED_DISABLED_FEATURES,
			...disabledFeatures,
		]),
		overrides: {
			...getChartOverrides(theme),
			...chartOverrides,
		},
		...options,
	};
}

// Builds the regular Advanced Charts experience without Trading Platform-only options.
export function createAdvancedChartOptions({ ...options } = {}) {
	return createWidgetOptions({
		...options,
		datafeed: ADVANCED_CHARTS_DATAFEED,
		libraryPath: 'vendor/tradingview/advanced_charts/',
	});
}

// Builds the Trading Platform experience with broker, account-manager, and layout UI enabled.
export function createTradingPlatformOptions({
	enabledFeatures = [],
	disabledFeatures = [],
	...options
} = {}) {
	return createWidgetOptions({
		...options,
		libraryPath: 'vendor/tradingview/trading_platform/',
		rss_news_feed: CRYPTO_RSS_NEWS_FEED,
		rss_news_title: CRYPTO_RSS_TITLE,
		enabledFeatures: [
			...TRADING_PLATFORM_ENABLED_FEATURES,
			...enabledFeatures,
		],
		disabledFeatures: [
			...TRADING_PLATFORM_DISABLED_FEATURES,
			...disabledFeatures,
		],
	});
}
