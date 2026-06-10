import { getChartOverrides, theme as initialTheme } from './theme.js';

// Makes custom toolbar controls participate in TradingView's keyboard navigation model.
function enableRovingTabindex(...elements) {
	const handleMainElement = event => {
		event.target.tabIndex = 0;
	};
	const handleSecondaryElement = event => {
		event.target.tabIndex = -1;
	};

	elements.filter(Boolean).forEach(element => {
		element.addEventListener(
			'roving-tabindex:main-element',
			handleMainElement
		);
		element.addEventListener(
			'roving-tabindex:secondary-element',
			handleSecondaryElement
		);
	});
}

// Adds a theme switch and reapplies chart overrides so pane colors follow the UI theme.
export function addThemeToggle(widget) {
	const themeToggleEl = widget.createButton({
		useTradingViewStyle: false,
		align: 'right',
	});

	themeToggleEl.dataset.internalAllowKeyboardNavigation = 'true';
	themeToggleEl.id = 'theme-toggle';
	themeToggleEl.innerHTML = `<label for="theme-switch" id="theme-switch-label"></label>
    <div class="switcher">
      <input type="checkbox" id="theme-switch" tabindex="-1">
      <span class="thumb-wrapper">
        <span class="track"></span>
        <span class="thumb"></span>
      </span>
    </div>`;
	themeToggleEl.title = 'Toggle theme';

	const checkboxEl = themeToggleEl.querySelector('#theme-switch');
	const labelEl = themeToggleEl.querySelector('#theme-switch-label');

	function updateLabel() {
		labelEl.textContent = checkboxEl.checked ? 'Dark theme' : 'Light theme';
	}

	checkboxEl.checked =
		typeof widget.getTheme === 'function'
			? widget.getTheme() === 'dark'
			: initialTheme === 'dark';
	updateLabel();
	checkboxEl.addEventListener('change', async function () {
		const themeToSet = this.checked ? 'dark' : 'light';
		this.disabled = true;

		try {
			await widget.changeTheme(themeToSet, { disableUndo: true });
			widget.applyOverrides(getChartOverrides(themeToSet));
		} finally {
			this.disabled = false;
			updateLabel();
		}
	});

	return checkboxEl;
}

// Adds a small documentation shortcut to the optional trading toolbar.
export function addDocumentationButton(widget) {
	const element = widget.createButton({
		useTradingViewStyle: false,
		align: 'right',
	});

	element.dataset.internalAllowKeyboardNavigation = 'true';
	element.innerHTML =
		'<button id="documentation-toolbar-button" tabindex="-1">Documentation</button>';
	element.title = 'View the documentation site';
	element.addEventListener('click', () => {
		window.open(
			'https://www.tradingview.com/charting-library-docs/',
			'_blank'
		);
	});

	return element.querySelector('#documentation-toolbar-button');
}

// Installs the small Advanced Charts toolbar: theme toggle plus docs shortcut.
export function installThemeToolbar(widget) {
	widget.headerReady().then(() => {
		const themeSwitchCheckbox = addThemeToggle(widget);
		const documentationButton = addDocumentationButton(widget);

		enableRovingTabindex(themeSwitchCheckbox, documentationButton);
	});
}

// Installs only the documentation shortcut for pages that want a tiny toolbar.
export function installDocumentationToolbar(widget) {
	widget.headerReady().then(() => {
		const documentationButton = addDocumentationButton(widget);

		enableRovingTabindex(documentationButton);
	});
}

// Exposes roving-tabindex wiring for pages that compose multiple controls.
export function wireRovingTabindex(...elements) {
	enableRovingTabindex(...elements);
}
