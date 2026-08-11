// Custom symbol status shown next to the market status in the chart header.
// The status describes where a symbol's data comes from and how fresh it is.

const REAL_TIME_COLOR = '#089981';
const DELAYED_COLOR = '#d97706';
const BINANCE_API_DOCS_URL =
	'https://developers.binance.com/docs/binance-spot-api-docs';

// Concentric broadcast arcs: reads as "streaming" and stays legible at header size.
const REAL_TIME_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
	<circle cx="10" cy="10" r="2" fill="currentColor" stroke="none" />
	<path d="M13.2 6.8a4.5 4.5 0 0 1 0 6.4" />
	<path d="M6.8 13.2a4.5 4.5 0 0 1 0-6.4" />
	<path d="M15.6 4.4a7.9 7.9 0 0 1 0 11.2" />
	<path d="M4.4 15.6a7.9 7.9 0 0 1 0-11.2" />
</svg>`;

const DELAYED_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
	<circle cx="10" cy="10" r="7" />
	<path d="M10 5.8v4.4l3.2 1.8" />
</svg>`;

const HTML_ESCAPES = Object.freeze({
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;',
});

let statusApi = null;
const pendingStatuses = new Map();

// Drop-down content is interpreted as HTML, so escape everything the datafeed supplies.
function escapeHtml(value) {
	return String(value ?? '').replace(
		/[&<>"']/g,
		character => HTML_ESCAPES[character]
	);
}

// Derives the freshness wording from the symbol info itself instead of hardcoding it.
function describeFeed(symbolInfo) {
	const delaySeconds = symbolInfo.delay ?? 0;

	if (delaySeconds > 0) {
		const minutes = Math.max(1, Math.round(delaySeconds / 60));

		return {
			label: `Delayed ${minutes} min`,
			title: 'Delayed market data',
			summary: `This feed reports a ${minutes} minute delay, so the most recent bars lag the live market.`,
			icon: DELAYED_ICON,
			color: DELAYED_COLOR,
		};
	}

	return {
		label: 'Real-time',
		title: 'Real-time market data',
		summary:
			'Prices stream straight from the Binance public WebSocket API, so bars and quotes update as trades happen.',
		icon: REAL_TIME_ICON,
		color: REAL_TIME_COLOR,
	};
}

// Builds a ready-to-apply status descriptor for one resolved symbol.
function describeSymbolStatus(symbolInfo, providerSymbol) {
	const feed = describeFeed(symbolInfo);

	return {
		symbolId: symbolInfo.ticker,
		icon: feed.icon,
		color: feed.color,
		tooltip: `${feed.label} · ${symbolInfo.exchange}`,
		dropDownContent: [
			{
				title: feed.title,
				content: [
					`${feed.summary}<br/><br/>`,
					`Feed symbol: <code>${escapeHtml(providerSymbol)}</code><br/>`,
					`Exchange: ${escapeHtml(symbolInfo.exchange)}<br/>`,
					`Session: ${escapeHtml(symbolInfo.session)} · ${escapeHtml(symbolInfo.timezone)}`,
				],
				action: {
					text: 'Binance API docs',
					tooltip: 'Opens in a new tab',
					onClick: () => {
						window.open(BINANCE_API_DOCS_URL, '_blank');
					},
				},
			},
		],
	};
}

// Pushes one descriptor through the widget's custom symbol status adapter.
function applyStatus(status) {
	statusApi
		.symbol(status.symbolId)
		.setVisible(true)
		.setIcon(status.icon)
		.setColor(status.color)
		.setTooltip(status.tooltip)
		.setDropDownContent(status.dropDownContent);
}

// Publishes a symbol's status while the datafeed resolves it, which is the only
// point where the exact symbol id the library will use is known for certain.
export function setSymbolStatus(symbolInfo, providerSymbol) {
	const status = describeSymbolStatus(symbolInfo, providerSymbol);

	if (!statusApi) {
		pendingStatuses.set(status.symbolId, status);
		return;
	}

	applyStatus(status);
}

// Connects the writer to the widget. The first resolveSymbol can land before the
// header exists, so anything resolved in the meantime is replayed here.
export function installSymbolStatus(widget) {
	widget.headerReady().then(() => {
		statusApi = widget.customSymbolStatus();

		pendingStatuses.forEach(status => applyStatus(status));
		pendingStatuses.clear();
	});
}
