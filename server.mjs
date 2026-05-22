import http from 'node:http';
import process from 'node:process';
import handler from 'serve-handler';

const COINDESK_RSS_URL = 'https://www.coindesk.com/arc/outboundfeeds/rss/';
const DEFAULT_HOST = '127.0.0.1';
const DEFAULT_PORT = 3000;
const NEWS_CACHE_TTL_MS = 60_000;
const HTML_ROUTE_PATHS = new Map([
	['/index', '/index.html'],
	['/trading', '/trading.html'],
]);

let cachedNewsResponse = null;

// Keeps the CoinDesk feed fresh enough for demos without hammering the upstream RSS URL.
function isFreshCache(entry) {
	return entry && Date.now() - entry.updatedAt < NEWS_CACHE_TTL_MS;
}

// Escapes cleaned text before we put it back into RSS CDATA fields.
function toCdata(text) {
	return `<![CDATA[${text.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
}

// Converts numeric HTML entities without letting malformed values break the RSS proxy.
function fromHtmlCodePoint(value, radix = 10) {
	const codePoint = Number.parseInt(value, radix);

	return Number.isFinite(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
		? String.fromCodePoint(codePoint)
		: '';
}

// Decodes the common HTML entities seen in RSS descriptions before stripping tags.
function decodeHtmlEntities(text) {
	return text
		.replace(/&#(\d+);/g, (_, value) => fromHtmlCodePoint(value))
		.replace(/&#x([0-9a-f]+);/gi, (_, value) =>
			fromHtmlCodePoint(value, 16)
		)
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'");
}

// Turns HTML-rich RSS summaries into plain text so TradingView does not show raw markup.
function cleanRssText(value) {
	return decodeHtmlEntities(value)
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

// Cleans item/channel title and description fields while preserving the RSS envelope.
function sanitizeRssPresentation(xml) {
	return xml.replace(
		/<(title|description)>([\s\S]*?)<\/\1>/g,
		(match, tagName, rawValue) => {
			const cdataMatch = rawValue.match(/^<!\[CDATA\[([\s\S]*)\]\]>$/);
			const value = cdataMatch ? cdataMatch[1] : rawValue;
			const cleaned = cleanRssText(value);

			return cleaned
				? `<${tagName}>${toCdata(cleaned)}</${tagName}>`
				: match;
		}
	);
}

// Fetches CoinDesk RSS server-side so the browser can consume it from this app origin.
async function fetchCoinDeskRss() {
	if (isFreshCache(cachedNewsResponse)) {
		return cachedNewsResponse;
	}

	const response = await fetch(COINDESK_RSS_URL, {
		headers: {
			'user-agent': 'tradingview-charting-library-datafeed-example/1.0',
		},
	});

	if (!response.ok) {
		throw new Error(
			`CoinDesk RSS request failed with HTTP ${response.status}`
		);
	}

	cachedNewsResponse = {
		body: sanitizeRssPresentation(await response.text()),
		etag: response.headers.get('etag'),
		lastModified: response.headers.get('last-modified'),
		updatedAt: Date.now(),
	};

	return cachedNewsResponse;
}

// Preserves RSS metadata while making the proxy response look like a normal feed.
function writeNewsHeaders(response, payload) {
	response.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
	response.setHeader('Cache-Control', 'public, max-age=60');

	if (payload.etag) {
		response.setHeader('ETag', payload.etag);
	}

	if (payload.lastModified) {
		response.setHeader('Last-Modified', payload.lastModified);
	}
}

// Avoids stale TradingView chunk hashes while iterating on local library versions.
function writeStaticHeaders(response) {
	response.setHeader('Cache-Control', 'no-store, max-age=0');
	response.setHeader('Pragma', 'no-cache');
	response.setHeader('Expires', '0');
}

// Handles the one dynamic route in the project: same-origin CoinDesk RSS.
async function handleCoinDeskNews(request, response) {
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		response.writeHead(405, { Allow: 'GET, HEAD' });
		response.end('Method Not Allowed');
		return;
	}

	try {
		const payload = await fetchCoinDeskRss();
		writeNewsHeaders(response, payload);
		response.writeHead(200);

		if (request.method === 'HEAD') {
			response.end();
			return;
		}

		response.end(payload.body);
	} catch (error) {
		console.error('[news proxy] Error:', error);
		response.writeHead(502, {
			'Content-Type': 'text/plain; charset=utf-8',
		});
		response.end('Unable to load CoinDesk RSS feed.');
	}
}

// Routes API requests first, then falls through to serve-handler for static files.
async function handleRequest(request, response) {
	const url = new URL(
		request.url ?? '/',
		`http://${request.headers.host ?? `${DEFAULT_HOST}:${DEFAULT_PORT}`}`
	);

	if (url.pathname === '/api/news/coindesk-rss') {
		await handleCoinDeskNews(request, response);
		return;
	}

	if (url.pathname === '/') {
		request.url = '/index.html';
	} else if (HTML_ROUTE_PATHS.has(url.pathname)) {
		request.url = `${HTML_ROUTE_PATHS.get(url.pathname)}${url.search}`;
	}

	writeStaticHeaders(response);

	await handler(request, response, {
		public: '.',
		cleanUrls: false,
		directoryListing: false,
	});
}

const port = Number.parseInt(process.argv[2] ?? '', 10) || DEFAULT_PORT;
const host = process.argv[3] ?? DEFAULT_HOST;

const server = http.createServer((request, response) => {
	handleRequest(request, response).catch(error => {
		console.error('[server] Unhandled error:', error);
		response.writeHead(500, {
			'Content-Type': 'text/plain; charset=utf-8',
		});
		response.end('Internal Server Error');
	});
});

server.listen(port, host, () => {
	console.log(`Server running at http://${host}:${port}`);
});
