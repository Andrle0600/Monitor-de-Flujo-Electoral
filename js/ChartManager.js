/**
 * ChartManager.js
 * Responsabilidad única: Adaptador de Chart.js.
 * Gestiona la instanciación, configuración y actualización de los dos gráficos.
 * No conoce la lógica de negocio: recibe filas ya calculadas por MetricsCalculator.
 */

// --- Tokens de Color (sincronizados con styles.css) ---
const COLOR_JP_NORMAL = 'rgba(56, 161, 105, 0.80)';      // Verde JP
const COLOR_RESTO_NORMAL = 'rgba(113, 128, 150, 0.70)';  // Gris pizarra Resto
const COLOR_JEE = 'rgba(128, 90, 213, 0.75)';            // Morado fase JEE
const COLOR_JEE_RESTO = 'rgba(128, 90, 213, 0.45)';      // Morado atenuado para Resto en JEE

const CHART_FONT_FAMILY = "'Inter', 'Segoe UI', sans-serif";
const CHART_TICK_COLOR = '#718096';
const CHART_GRID_COLOR = 'rgba(226, 232, 240, 0.8)';

/** Opciones base compartidas por ambos gráficos */
function baseOptions(titleText) {
  return {
    responsive: true,
    maintainAspectRatio: true,
    animation: { duration: 350, easing: 'easeInOutQuart' },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: { family: CHART_FONT_FAMILY, size: 12 },
          color: '#4a5568',
          padding: 16,
          usePointStyle: true,
        },
      },
      title: {
        display: true,
        text: titleText,
        font: { family: CHART_FONT_FAMILY, size: 13, weight: '600' },
        color: '#2d3748',
        padding: { bottom: 10 },
      },
      tooltip: {
        backgroundColor: 'rgba(45, 55, 72, 0.90)',
        titleFont: { family: CHART_FONT_FAMILY, size: 12 },
        bodyFont: { family: CHART_FONT_FAMILY, size: 12 },
        cornerRadius: 6,
        padding: 10,
      },
    },
    scales: {
      x: {
        grid: { color: CHART_GRID_COLOR },
        ticks: {
          color: CHART_TICK_COLOR,
          font: { family: CHART_FONT_FAMILY, size: 11 },
          maxRotation: 45,
        },
      },
      y: {
        grid: { color: CHART_GRID_COLOR },
        ticks: {
          color: CHART_TICK_COLOR,
          font: { family: CHART_FONT_FAMILY, size: 11 },
          callback: (val) => val.toLocaleString('es'),
        },
        beginAtZero: true,
      },
    },
  };
}

export class ChartManager {
  constructor() {
    this.flowChart = null;
    this.logChart = null;
  }

  /**
   * Inicializa ambos gráficos sobre sus canvas respectivos.
   * Debe llamarse una vez que el DOM esté listo.
   */
  init() {
    const ctxFlow = document.getElementById('chart-flow').getContext('2d');
    const ctxLog = document.getElementById('chart-log').getContext('2d');

    // --- Gráfico de Flujo (Barras Apiladas) ---
    const flowOpts = baseOptions('Flujo de Votos por Tramo');
    flowOpts.scales.x.stacked = true;
    flowOpts.scales.y.stacked = true;
    flowOpts.plugins.tooltip.callbacks = {
      label: (ctx) => `${ctx.dataset.label}: ${Math.round(ctx.parsed.y).toLocaleString('es')} votos`,
    };

    this.flowChart = new Chart(ctxFlow, {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: flowOpts,
    });

    // --- Gráfico Logístico (Barras simples de Δ Actas) ---
    const logOpts = baseOptions('Δ Actas Procesadas por Tramo');
    logOpts.plugins.tooltip.callbacks = {
      label: (ctx) => `Δ Actas: ${Math.round(ctx.parsed.y).toLocaleString('es')}`,
    };

    this.logChart = new Chart(ctxLog, {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: logOpts,
    });
  }

  /**
   * Actualiza ambos gráficos con las filas calculadas por MetricsCalculator.
   * @param {Array} rows - Array de filas devuelto por MetricsCalculator.computeRows()
   */
  update(rows) {
    // Excluir fila del snapshot cero (no tiene deltas reales)
    const dataRows = rows.filter(r => !r.isZeroRow);

    if (dataRows.length === 0) {
      this._clearCharts();
      return;
    }

    // Etiquetas del eje X: hora del snapshot
    const labels = dataRows.map(r => {
      const d = new Date(r.snapshot.timestamp);
      return d.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false });
    });

    // --- Datos para el Gráfico de Flujo ---
    const jpData = dataRows.map(r => r.isDataGap ? null : Math.max(0, r.deltaJP));
    const restoData = dataRows.map(r => r.isDataGap ? null : Math.max(0, r.deltaResto));

    // Colores barra JP: verde o morado-JEE
    const jpColors = dataRows.map(r => r.isJEE ? COLOR_JEE : COLOR_JP_NORMAL);
    // Colores barra Resto: gris o morado-JEE atenuado
    const restoColors = dataRows.map(r => r.isJEE ? COLOR_JEE_RESTO : COLOR_RESTO_NORMAL);

    this.flowChart.data.labels = labels;
    this.flowChart.data.datasets = [
      {
        label: 'JP (Auditado)',
        data: jpData,
        backgroundColor: jpColors,
        borderRadius: 3,
        borderSkipped: false,
      },
      {
        label: 'Resto Top 8',
        data: restoData,
        backgroundColor: restoColors,
        borderRadius: 3,
        borderSkipped: false,
      },
    ];
    this.flowChart.update();

    // --- Datos para el Gráfico Logístico ---
    const actasData = dataRows.map(r => r.isDataGap ? null : Math.max(0, Math.round(r.deltaActas)));
    const logColors = dataRows.map(r => r.isJEE ? COLOR_JEE : COLOR_JP_NORMAL);

    this.logChart.data.labels = labels;
    this.logChart.data.datasets = [
      {
        label: 'Δ Actas Procesadas',
        data: actasData,
        backgroundColor: logColors,
        borderRadius: 3,
        borderSkipped: false,
      },
    ];
    this.logChart.update();
  }

  /**
   * Limpia ambos gráficos (sin datos).
   */
  _clearCharts() {
    [this.flowChart, this.logChart].forEach(chart => {
      if (chart) {
        chart.data.labels = [];
        chart.data.datasets = [];
        chart.update();
      }
    });
  }

  /**
   * Destruye las instancias de Chart.js. Útil antes de re-inicializar.
   */
  destroy() {
    this.flowChart?.destroy();
    this.logChart?.destroy();
    this.flowChart = null;
    this.logChart = null;
  }
}
