import Datafeed from './datafeed/datafeed.js';
import { LocalStorageSaveLoadAdapter } from './save-load-adapter.js';
import {
	addDocumentationButton,
	addThemeToggle,
	wireRovingTabindex,
} from './toolbar.js';
import { createTradingPlatformOptions } from './widget-options.js';
import { widget as createWidget } from '/vendor/tradingview/trading_platform/charting_library.esm.js';

import '../third_party/tradingview/broker-sample/dist/bundle.js';

const BROKER_CONFIG = {
	configFlags: {
		supportPositions: true,
		supportMultiposition: true,
		supportReversePosition: true,
		supportNativeReversePosition: true,
		supportPartialClosePosition: true,
		supportClosePosition: true,
		supportPLUpdate: true,
		showQuantityInsteadOfAmount: true,
		supportEditAmount: true,
		supportOrdersHistory: false,
		supportModifyOrderPrice: true,
		supportModifyBrackets: true,
		supportOrderBrackets: true,
		supportPositionBrackets: true,
		supportModifyDuration: true,
		supportAddBracketsToExistingOrder: true,
		supportTrailingStop: true,
		supportModifyTrailingStop: true,
		supportStopLimitOrders: false,
		supportCancelOrderForNonTradableSymbol: true,
		supportLevel2Data: true,
		show_symbol_logos: true,
		supportMultipleExitLevels: true,
	},
	tradedGroupConfig: {
		supportAdaptiveLayout: true,
	},
	durations: [
		{ name: 'DAY', value: 'DAY' },
		{ name: 'IOC', value: 'IOC' },
	],
};

const WATCHLIST_SYMBOLS = [
	'###Binance',
	'Binance:BTC/USDT',
	'Binance:ETH/USDT',
	'Binance:BNB/USDT',
	'Binance:SOL/USDT',
	'Binance:ADA/USDT',
	'Binance:ETH/BTC',
	'Binance:LTC/USDT',
	'Binance:XRP/USDT',
	'Binance:XRP/BTC',
];

function formatAlertPrice(price, chart) {
	const fallback = price.toFixed(2);

	try {
		const formatter =
			chart?.getSeries?.()?.priceFormatter?.() ??
			chart?.priceFormatter?.();
		const formattedPrice = formatter?.format?.(price);

		return formattedPrice || fallback;
	} catch {
		return fallback;
	}
}

// Converts the external BrokerDemo sample into Trading Platform widget options.
function createBrokerOptions(onHostReady) {
	const BrokerDemo = globalThis.Brokers?.BrokerDemo;

	if (!BrokerDemo) {
		return {
			widgetOptions: {},
		};
	}

	class CustomBroker extends BrokerDemo {
		isTradable() {
			return Promise.resolve(true);
		}
	}

	return {
		widgetOptions: {
			broker_factory(host) {
				onHostReady(host);
				return new CustomBroker(host, Datafeed);
			},
			broker_config: BROKER_CONFIG,
		},
	};
}

// Keeps the custom alert demo self-contained: context-menu creation, crossing detection, cleanup.
function createAlertController({ getWidget, notify }) {
	let activeAlerts = [];
	let previousPrice = null;
	let lastPlusClickPrice = null;

	return {
		contextMenu: {
			items_processor: async (items, actionsFactory, params) => {
				if (params.menuName !== 'CrosshairMenuView') return items;
				if (
					lastPlusClickPrice === null ||
					lastPlusClickPrice === undefined
				)
					return items;

				const price = lastPlusClickPrice;
				const chart = getWidget()?.activeChart?.();
				const alertAction = actionsFactory.createAction({
					actionId: 'create_custom_alert',
					label: `Add Alert at ${formatAlertPrice(price, chart)}`,
					onExecute: async () => {
						const widget = getWidget();
						const chart = widget.activeChart();
						const lineId = await chart.createShape(
							{ price },
							{
								shape: 'horizontal_line',
								overrides: {
									linecolor: '#ff9800',
									linewidth: 2,
									linestyle: 1,
								},
							}
						);

						activeAlerts.push({ id: lineId, price });
					},
				});

				items.push(actionsFactory.createSeparator());
				items.push(alertAction);

				return items;
			},
		},

		attach(widget) {
			const chart = widget.activeChart();

			widget.subscribe('onPlusClick', params => {
				if (params.price !== undefined) {
					lastPlusClickPrice = params.price;
				}
			});

			widget.subscribe('onTick', tick => {
				const currentPrice = tick.close ?? tick.price ?? tick.last;
				if (currentPrice === undefined) return;

				if (previousPrice !== null) {
					activeAlerts = activeAlerts.filter(alert => {
						const crossedUp =
							previousPrice < alert.price &&
							currentPrice >= alert.price;
						const crossedDown =
							previousPrice > alert.price &&
							currentPrice <= alert.price;

							if (!crossedUp && !crossedDown) return true;

							const alertPrice = formatAlertPrice(alert.price, chart);
							notify(
								'Alert Triggered',
								`Price crossed your alert at ${alertPrice}`
							);
							try {
							chart.removeEntity(alert.id);
						} catch {
							// The line may already be gone if the user removed it manually.
						}

						return false;
					});
				}

				previousPrice = currentPrice;
			});

			widget.subscribe('drawing_event', (id, type) => {
				if (type !== 'points_changed') return;

				window.setTimeout(() => {
					const alert = activeAlerts.find(alert => alert.id === id);
					if (!alert) return;

					const shape = chart.getShapeById(id);
					const newPrice = shape?.getPoints()[0]?.price;
					if (newPrice === undefined) return;

					alert.price = newPrice;
					shape.setProperties({
						text: `Alert: ${formatAlertPrice(newPrice, chart)}`,
					});
				}, 50);
			});
		},
	};
}

// Shows a user-visible hint when Trading Platform broker features do not initialize.
function showTradingPlatformWarning() {
	const existingWarning = document.querySelector('#trading-platform-warning');
	if (existingWarning) return;

	const warning = document.createElement('div');
	warning.id = 'trading-platform-warning';
	warning.textContent =
		'Trading Platform broker features did not initialize. Make sure trading_platform-master was synced and the broker sample bundle exists.';
	warning.style.cssText = [
		'position:fixed',
		'z-index:10000',
		'right:16px',
		'bottom:16px',
		'max-width:380px',
		'padding:12px 14px',
		'border-radius:10px',
		'background:#fff7ed',
		'color:#7c2d12',
		'box-shadow:0 12px 28px rgba(15,23,42,0.18)',
		'font:13px/1.4 sans-serif',
	].join(';');

	document.body.append(warning);
}

// Restores the chart to a clean single-pane view while preserving the current symbol.
function addResetButton(widget) {
	const button = widget.createButton({ align: 'right' });

	button.textContent = 'Reset';
	button.addEventListener('click', () => {
		const chart = widget.activeChart();
		const symbol = chart.symbol();

		chart.removeAllStudies();
		chart.removeAllShapes();
		widget.setLayout('s');
		chart.setSymbol(symbol);
		widget.resetCache();
		chart.resetData();
	});
}

// Adds a tiny fixed watchlist shortcut without distracting from the datafeed example.
function addSymbolDropdown(widget) {
	widget.createDropdown({
		title: 'Select symbol',
		align: 'right',
		tooltip: 'Select one of the symbols to load the chart with',
		icon: '<img src="/src/assets/arrow-down-angle-svgrepo-com.svg" alt="arrow" style="height:22px; display:block; margin-left: auto;">',
		useTradingViewStyle: true,
		items: [
			{
				title: 'BTC/USDT (1D)',
				onSelect: () => {
					widget.activeChart().setSymbol('Binance:BTC/USDT', '1D');
				},
			},
			{
				title: 'ETH/USDT (1D)',
				onSelect: () => {
					widget.activeChart().setSymbol('Binance:ETH/USDT', '1D');
				},
			},
		],
	});
}

// Toggles user drawings and studies together so reviewers can quickly inspect a clean chart.
function addVisibilityButton(widget) {
	let visualsHidden = false;
	const button = widget.createButton({ align: 'right' });

	function updateLabel() {
		button.textContent = visualsHidden
			? 'Show Indicators/Drawings'
			: 'Hide Indicators/Drawings';
	}

	updateLabel();
	button.addEventListener('click', () => {
		visualsHidden = !visualsHidden;
		widget.hideAllDrawingTools().setValue(visualsHidden);
		widget
			.activeChart()
			.getAllStudies()
			.forEach(study => {
				widget
					.activeChart()
					.getStudyById(study.id)
					.setVisible(!visualsHidden);
			});
		updateLabel();
	});
}

// Installs trading toolbar controls after the TradingView header has finished mounting.
function installToolbar(widget) {
	widget.headerReady().then(() => {
		addResetButton(widget);
		addSymbolDropdown(widget);
		addVisibilityButton(widget);

		const themeSwitchCheckbox = addThemeToggle(widget);
		const documentationButton = addDocumentationButton(widget);

		wireRovingTabindex(themeSwitchCheckbox, documentationButton);
	});
}

// Keep custom chart subscriptions together so future event wiring has one obvious home.
function installChartReadySubscriptions(widget, alertController) {
	widget.subscribe('onAutoSaveNeeded', () => {
		if (typeof widget.saveChartToServer === 'function') {
			const result = widget.saveChartToServer({
				defaultChartName: 'Default',
			});

			if (result && typeof result.then === 'function') {
				result.catch(error => {
					console.error('Failed to save chart to server:', error);
				});
			}
		}
	});

	alertController.attach(widget);

	// ---------------------------------------------------------------------------
	// Custom subscription events
	// Add project-specific TradingView subscriptions here. This runs inside
	// widget.onChartReady, so widget.activeChart() and broker-backed events are
	// ready to use.
	//
	// Examples:
	// widget.subscribe("study_event", (entityId, eventType) => {});
	// widget.activeChart().onSymbolChanged().subscribe(null, () => {});
	// widget.activeChart().onIntervalChanged().subscribe(null, (interval) => {});
	// ---------------------------------------------------------------------------
}

// Boots the Trading Platform page with broker, DOM, save/load, alerts, and toolbar wiring.
async function initTradingPlatformChart() {
	let wdg;

	let brokerHost = null;
	const saveLoadAdapter = new LocalStorageSaveLoadAdapter();
	const brokerOptions = createBrokerOptions(host => {
		brokerHost = host;
	});
	const alertController = createAlertController({
		getWidget: () => wdg,
		notify: (title, message) => {
			brokerHost?.showNotification?.(title, message, 1);
		},
	});

	wdg = new createWidget(
		createTradingPlatformOptions({
			widgetbar: {
				details: true,
				watchlist: true,
				datawindow: true,
				news: true,
				watchlist_settings: {
					default_symbols: WATCHLIST_SYMBOLS,
					readonly: false,
				},
			},
			save_load_adapter: saveLoadAdapter,
			load_last_chart: false,
			auto_save_delay: 5,
			context_menu: alertController.contextMenu,
			...brokerOptions.widgetOptions,
		})
	);
	window.widget = wdg;
	window.tvWidget = wdg;

	wdg.onChartReady(() => {
		window.setTimeout(() => {
			if (!brokerHost) {
				showTradingPlatformWarning();
			}
		}, 1000);

		installChartReadySubscriptions(wdg, alertController);
	});

	installToolbar(wdg);
}

window.addEventListener('DOMContentLoaded', initTradingPlatformChart, {
	once: true,
});
