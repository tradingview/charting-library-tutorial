const COINDESK_RSS_PROXY_URL = '/api/news/coindesk-rss';

// CoinDesk does not send browser CORS headers, so the local server exposes it same-origin.
// TradingView reads this object directly through the rss_news_feed widget option.
export const CRYPTO_RSS_NEWS_FEED = {
	default: {
		url: COINDESK_RSS_PROXY_URL,
		name: 'CoinDesk',
	},
	crypto: {
		url: COINDESK_RSS_PROXY_URL,
		name: 'CoinDesk',
	},
};

export const CRYPTO_RSS_TITLE = 'CoinDesk';
