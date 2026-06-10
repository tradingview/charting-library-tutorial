// Allows reviewers to force a theme with ?theme=dark or ?theme=light.
function getRequestedTheme() {
	const requestedTheme = new URLSearchParams(window.location.search).get(
		'theme'
	);
	return requestedTheme === 'dark' || requestedTheme === 'light'
		? requestedTheme
		: null;
}

// Falls back to the browser preference when the URL does not force a theme.
function prefersDarkTheme() {
	return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
}

// TradingView loads custom widget CSS through a URL, so we expose this string as a Blob.
const customCSS = `
  @font-face {
    font-family: 'NanumBarunGothic';
    src: url('/src/assets/fonts/NanumBarunGothic.otf') format('opentype');
    font-weight: normal;
    font-style: normal;
  }

  #documentation-toolbar-button {
    all: unset;
    position: relative;
    color: #fff;
    font-size: 14px;
    font-weight: 400;
    line-height: 18px;
    letter-spacing: 0.15408px;
    padding: 5px 12px;
    border-radius: 80px;
    background: #2962ff;
    cursor: pointer;
  }

  #documentation-toolbar-button:hover {
    background: #1e53e5;
  }

  #documentation-toolbar-button:active {
    background: #1948cc;
  }

  #theme-toggle {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
  }

  .switcher {
    display: inline-block;
    position: relative;
    flex: 0 0 auto;
    width: 38px;
    height: 20px;
    vertical-align: middle;
    z-index: 0;
    -webkit-tap-highlight-color: transparent;
  }

  .switcher input {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    opacity: 0;
    z-index: 1;
    cursor: default;
  }

  .switcher .thumb-wrapper {
    display: block;
    border-radius: 20px;
    position: relative;
    z-index: 0;
    width: 100%;
    height: 100%;
  }

  .switcher .track {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    border-radius: 20px;
    background-color: #a3a6af;
  }

  #theme-switch:checked + .thumb-wrapper .track {
    background-color: #2962ff;
  }

  .switcher .thumb {
    display: block;
    width: 14px;
    height: 14px;
    border-radius: 14px;
    transition-duration: 250ms;
    transition-property: transform;
    transition-timing-function: ease-out;
    transform: translate(3px, 3px);
    background: #fff;
  }

  [dir=rtl] .switcher .thumb {
    transform: translate(-3px, 3px);
  }

  .switcher input:checked + .thumb-wrapper .thumb {
    transform: translate(21px, 3px);
  }

  [dir=rtl] .switcher input:checked + .thumb-wrapper .thumb {
    transform: translate(-21px, 3px);
  }

  #documentation-toolbar-button:focus-visible::before,
  .switcher:focus-within::before {
    content: '';
    display: block;
    position: absolute;
    top: -2px;
    right: -2px;
    bottom: -2px;
    left: -2px;
    border-radius: 16px;
    outline: #2962ff solid 2px;
  }

  button[data-qa-id="dom-price-step-dropdown-button"] {
    pointer-events: none !important;
    background: transparent !important;
  }

  button[data-qa-id="dom-price-step-dropdown-button"] span[role="img"] {
    display: none !important;
  }
`;

const cssBlob = new Blob([customCSS], {
	type: 'text/css',
});

export const cssBlobUrl = URL.createObjectURL(cssBlob);
export const theme =
	getRequestedTheme() ?? (prefersDarkTheme() ? 'dark' : 'light');

// Keeps chart-pane colors synchronized with the resolved widget theme.
export function getChartOverrides(currentTheme = theme) {
	if (currentTheme === 'dark') {
		return {
			'paneProperties.backgroundType': 'gradient',
			'paneProperties.background': '#111827',
			'paneProperties.backgroundGradientStartColor': '#36364a',
			'paneProperties.backgroundGradientEndColor': '#353924',
			'paneProperties.vertGridProperties.color':
				'rgba(255, 255, 255, 0.08)',
			'paneProperties.horzGridProperties.color':
				'rgba(255, 255, 255, 0.08)',
			'paneProperties.crossHairProperties.color': '#b9c0cc',
			'paneProperties.crossHairProperties.transparency': 40,
			'scalesProperties.textColor': '#ffffff',
			'scalesProperties.lineColor': 'rgba(255, 255, 255, 0.14)',
			'scalesProperties.fontSize': 14,
			'time_scale.show_bar_countdown': true,
			'mainSeriesProperties.showPrevClosePriceLine': true,
			'backgrounds.outOfSession.color': 'rgba(16, 20, 32, 0.2)',
			'mainSeriesProperties.baselineStyle.topLineColor':
				'rgba(205, 17, 33, 0.2)',
			'mainSeriesProperties.baselineStyle.bottomLineColor':
				'rgba(10, 32, 6, 0.2)',
		};
	}

	return {
		'paneProperties.backgroundType': 'solid',
		'paneProperties.background': '#f8fafc',
		'paneProperties.backgroundGradientStartColor': '#f8fafc',
		'paneProperties.backgroundGradientEndColor': '#eef2f7',
		'paneProperties.vertGridProperties.color': 'rgba(15, 23, 42, 0.08)',
		'paneProperties.horzGridProperties.color': 'rgba(15, 23, 42, 0.08)',
		'paneProperties.crossHairProperties.color': '#475569',
		'paneProperties.crossHairProperties.transparency': 35,
		'scalesProperties.textColor': '#1f2933',
		'scalesProperties.lineColor': 'rgba(15, 23, 42, 0.16)',
		'scalesProperties.fontSize': 14,
		'time_scale.show_bar_countdown': true,
		'mainSeriesProperties.showPrevClosePriceLine': true,
		'backgrounds.outOfSession.color': 'rgba(239, 243, 247, 0.75)',
		'mainSeriesProperties.baselineStyle.topLineColor':
			'rgba(205, 17, 33, 0.16)',
		'mainSeriesProperties.baselineStyle.bottomLineColor':
			'rgba(10, 112, 41, 0.16)',
	};
}
