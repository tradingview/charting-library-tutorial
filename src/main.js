import { widget as createWidget } from '/vendor/tradingview/advanced_charts/charting_library.esm.js';
import { createAdvancedChartOptions } from './widget-options.js';
import { installThemeToolbar } from './toolbar.js';

// Boots the minimal tutorial chart: shared widget options plus the theme toggle.
function initChart() {
	const wdg = new createWidget(createAdvancedChartOptions());
	window.widget = wdg;
	window.tvWidget = wdg;

	installThemeToolbar(wdg);
}

window.addEventListener('DOMContentLoaded', initChart, { once: true });
