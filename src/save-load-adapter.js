const STORAGE_KEYS = {
	charts: 'LocalStorageSaveLoadAdapter_charts',
	studyTemplates: 'LocalStorageSaveLoadAdapter_studyTemplates',
	drawingTemplates: 'LocalStorageSaveLoadAdapter_drawingTemplates',
	chartTemplates: 'LocalStorageSaveLoadAdapter_chartTemplates',
	drawings: 'LocalStorageSaveLoadAdapter_drawings',
};

// Clones saved chart/template content before returning it to the widget.
function cloneContent(content) {
	if (content == null) return content;
	if (typeof structuredClone === 'function') return structuredClone(content);

	return JSON.parse(JSON.stringify(content));
}

// TradingView may pass drawing sources as either a Map or a plain object.
function sourceEntries(sources) {
	if (!sources) return [];
	if (sources instanceof Map) return sources.entries();

	return Object.entries(sources);
}

// Implements TradingView's save/load adapter contract using browser localStorage.
export class LocalStorageSaveLoadAdapter {
	// Loads the persisted state once and periodically flushes later mutations.
	constructor({ flushIntervalMs = 1000 } = {}) {
		this._charts = this._getFromLocalStorage(STORAGE_KEYS.charts, []);
		this._studyTemplates = this._getFromLocalStorage(
			STORAGE_KEYS.studyTemplates,
			[]
		);
		this._drawingTemplates = this._getFromLocalStorage(
			STORAGE_KEYS.drawingTemplates,
			[]
		);
		this._chartTemplates = this._getFromLocalStorage(
			STORAGE_KEYS.chartTemplates,
			[]
		);
		this._drawings = this._getFromLocalStorage(STORAGE_KEYS.drawings, {});
		this._isDirty = false;

		this._flushTimerId = window.setInterval(() => {
			if (!this._isDirty) return;

			this._saveAllToLocalStorage();
			this._isDirty = false;
		}, flushIntervalMs);
	}

	// Lists chart metadata for the Load Chart dialog.
	getAllCharts() {
		return Promise.resolve(this._charts);
	}

	// Removes a saved chart and rejects when TradingView asks for an unknown id.
	removeChart(id) {
		const initialLength = this._charts.length;
		this._charts = this._charts.filter(chart => chart.id !== id);

		if (this._charts.length === initialLength) {
			return Promise.reject(new Error('The chart does not exist'));
		}

		this._isDirty = true;
		return Promise.resolve();
	}

	// Stores chart JSON and returns the stable id TradingView should use later.
	saveChart(chartData) {
		const id = chartData.id || this._generateUniqueChartId();
		chartData.id = id;
		const savedChartData = {
			...chartData,
			id,
			timestamp: Math.round(Date.now() / 1000),
		};

		this._charts = this._charts.filter(chart => chart.id !== id);
		this._charts.push(savedChartData);
		this._isDirty = true;

		return Promise.resolve(id);
	}

	// Returns the serialized chart payload for a saved chart id.
	getChartContent(id) {
		const chart = this._charts.find(item => item.id === id);

		if (!chart) {
			return Promise.reject(new Error('The chart does not exist'));
		}

		return Promise.resolve(chart.content);
	}

	// Removes a named study template from localStorage-backed state.
	removeStudyTemplate(studyTemplateData) {
		const initialLength = this._studyTemplates.length;
		this._studyTemplates = this._studyTemplates.filter(
			template => template.name !== studyTemplateData.name
		);

		if (this._studyTemplates.length === initialLength) {
			return Promise.reject(
				new Error('The study template does not exist')
			);
		}

		this._isDirty = true;
		return Promise.resolve();
	}

	// Loads the saved content for a named study template.
	getStudyTemplateContent(studyTemplateData) {
		const template = this._studyTemplates.find(
			item => item.name === studyTemplateData.name
		);

		if (!template) {
			return Promise.reject(
				new Error('The study template does not exist')
			);
		}

		return Promise.resolve(template.content);
	}

	// Saves or replaces a named study template.
	saveStudyTemplate(studyTemplateData) {
		this._studyTemplates = this._studyTemplates.filter(
			template => template.name !== studyTemplateData.name
		);
		this._studyTemplates.push(studyTemplateData);
		this._isDirty = true;

		return Promise.resolve();
	}

	// Lists study template metadata for TradingView dialogs.
	getAllStudyTemplates() {
		return Promise.resolve(this._studyTemplates);
	}

	// Removes a drawing template for a specific drawing tool.
	removeDrawingTemplate(toolName, templateName) {
		const initialLength = this._drawingTemplates.length;
		this._drawingTemplates = this._drawingTemplates.filter(
			template =>
				template.name !== templateName || template.toolName !== toolName
		);

		if (this._drawingTemplates.length === initialLength) {
			return Promise.reject(
				new Error('The drawing template does not exist')
			);
		}

		this._isDirty = true;
		return Promise.resolve();
	}

	// Loads a drawing-template payload for a specific drawing tool.
	loadDrawingTemplate(toolName, templateName) {
		const template = this._drawingTemplates.find(
			item => item.name === templateName && item.toolName === toolName
		);

		if (!template) {
			return Promise.reject(
				new Error('The drawing template does not exist')
			);
		}

		return Promise.resolve(template.content);
	}

	// Saves or replaces a drawing template for a specific drawing tool.
	saveDrawingTemplate(toolName, templateName, content) {
		this._drawingTemplates = this._drawingTemplates.filter(
			template =>
				template.name !== templateName || template.toolName !== toolName
		);
		this._drawingTemplates.push({
			name: templateName,
			content,
			toolName,
		});
		this._isDirty = true;

		return Promise.resolve();
	}

	// Lists the drawing template names TradingView can show in the UI.
	getDrawingTemplates() {
		return Promise.resolve(
			this._drawingTemplates.map(template => template.name)
		);
	}

	// Lists chart template names for the template selector.
	async getAllChartTemplates() {
		return this._chartTemplates.map(template => template.name);
	}

	// Saves or replaces a chart template payload.
	async saveChartTemplate(templateName, content) {
		const template = this._chartTemplates.find(
			item => item.name === templateName
		);

		if (template) {
			template.content = content;
		} else {
			this._chartTemplates.push({ name: templateName, content });
		}

		this._isDirty = true;
	}

	// Removes a chart template by name.
	async removeChartTemplate(templateName) {
		this._chartTemplates = this._chartTemplates.filter(
			template => template.name !== templateName
		);
		this._isDirty = true;
	}

	// Returns a cloned chart-template payload so callers cannot mutate storage directly.
	async getChartTemplateContent(templateName) {
		const template = this._chartTemplates.find(
			item => item.name === templateName
		);

		return {
			content: cloneContent(template?.content),
		};
	}

	// Stores drawings separately from the chart when saveload_separate_drawings_storage is enabled.
	async saveLineToolsAndGroups(layoutId, chartId, state) {
		const key = this._getDrawingKey(layoutId, chartId);
		const drawings = sourceEntries(state?.sources);

		if (!drawings) return;

		this._drawings[key] ??= {};

		for (const [sourceKey, sourceState] of drawings) {
			if (sourceState === null) {
				delete this._drawings[key][sourceKey];
			} else {
				this._drawings[key][sourceKey] = sourceState;
			}
		}

		this._isDirty = true;
	}

	// Loads drawings for the current layout/chart pair in TradingView's expected Map shape.
	async loadLineToolsAndGroups(layoutId, chartId) {
		if (!layoutId) return null;

		const rawSources =
			this._drawings[this._getDrawingKey(layoutId, chartId)];
		if (!rawSources) return null;

		return {
			sources: new Map(Object.entries(rawSources)),
		};
	}

	// Flushes any pending writes and stops the periodic localStorage timer.
	destroy() {
		window.clearInterval(this._flushTimerId);

		if (this._isDirty) {
			this._saveAllToLocalStorage();
			this._isDirty = false;
		}
	}

	// Creates a collision-resistant enough id for a browser-only demo.
	_generateUniqueChartId() {
		const existingIds = new Set(this._charts.map(chart => chart.id));

		while (true) {
			const uid = Math.random().toString(16).slice(2);
			if (!existingIds.has(uid)) return uid;
		}
	}

	// Reads localStorage defensively so corrupted demo data does not break startup.
	_getFromLocalStorage(key, fallback) {
		try {
			const dataFromStorage = window.localStorage.getItem(key);
			return dataFromStorage ? JSON.parse(dataFromStorage) : fallback;
		} catch {
			return fallback;
		}
	}

	// Writes a single state bucket into localStorage.
	_saveToLocalStorage(key, data) {
		window.localStorage.setItem(key, JSON.stringify(data));
	}

	// Persists every state bucket together to keep charts/templates/drawings in sync.
	_saveAllToLocalStorage() {
		this._saveToLocalStorage(STORAGE_KEYS.charts, this._charts);
		this._saveToLocalStorage(
			STORAGE_KEYS.studyTemplates,
			this._studyTemplates
		);
		this._saveToLocalStorage(
			STORAGE_KEYS.drawingTemplates,
			this._drawingTemplates
		);
		this._saveToLocalStorage(
			STORAGE_KEYS.chartTemplates,
			this._chartTemplates
		);
		this._saveToLocalStorage(STORAGE_KEYS.drawings, this._drawings);
	}

	// Namespaces drawing state by layout and chart id, matching TradingView's adapter calls.
	_getDrawingKey(layoutId, chartId) {
		return `${layoutId}/${chartId}`;
	}
}
