/**
 * main.js — Monitor de Flujo Electoral (MFE)
 * Entry point: Orquesta todos los módulos, maneja eventos DOM y coordina el render completo.
 * Importa: StorageManager, MetricsCalculator, ChartManager, CsvHandler.
 */

import { StorageManager }    from './StorageManager.js';
import { MetricsCalculator } from './MetricsCalculator.js';
import { ChartManager }      from './ChartManager.js';
import { CsvHandler }        from './CsvHandler.js';

// ── Instancias de módulos ────────────────────────────────────────────────────
const storage    = new StorageManager();
const calculator = new MetricsCalculator();
const charts     = new ChartManager();
const csv        = new CsvHandler();

// ── Referencias al DOM ───────────────────────────────────────────────────────
const form          = document.getElementById('snapshot-form');
const inputDate     = document.getElementById('input-date');
const inputTime     = document.getElementById('input-time');
const inputPct      = document.getElementById('input-pct');
const inputJP       = document.getElementById('input-jp');
const inputResto    = document.getElementById('input-resto');
const checkZero     = document.getElementById('check-zero');
const formMessage   = document.getElementById('form-message');
const snapshotList  = document.getElementById('snapshot-list');
const tbody         = document.getElementById('audit-tbody');
const btnExport     = document.getElementById('btn-export');
const btnImport     = document.getElementById('btn-import');
const csvInput      = document.getElementById('csv-import-input');
const summaryShare  = document.getElementById('summary-share');
const summaryTotal  = document.getElementById('summary-total');
const summaryAlerts = document.getElementById('summary-alerts');

// ── Inicialización ───────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  charts.init();
  renderAll();
  prefillDateTime();
});

/** Rellena los campos de fecha/hora con la hora actual como valor sugerido. */
function prefillDateTime() {
  const now = new Date();
  inputDate.value = now.toISOString().slice(0, 10);
  inputTime.value = now.toTimeString().slice(0, 5);
}

// ── Render completo de la UI ─────────────────────────────────────────────────

/** Punto de entrada único de renderizado. Se llama cada vez que los datos cambian. */
function renderAll() {
  const snapshots = storage.load();
  const rows      = calculator.computeRows(snapshots);
  renderSnapshotList(snapshots);
  renderTable(rows);
  renderSummary(rows);
  charts.update(rows);
}

// ── Renderizado de la lista del acordeón ────────────────────────────────────
function renderSnapshotList(snapshots) {
  snapshotList.innerHTML = '';

  if (snapshots.length === 0) {
    snapshotList.innerHTML = `<li class="accordion-empty">No hay registros cargados.</li>`;
    return;
  }

  // Mostrar ordenados por timestamp
  const sorted = [...snapshots].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  sorted.forEach(snap => {
    const dt     = new Date(snap.timestamp);
    const label  = dt.toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' });
    const li     = document.createElement('li');
    li.className = `snapshot-list__item${snap.isZero ? ' is-zero' : ''}`;

    li.innerHTML = `
      <span class="snapshot-list__meta">
        ${snap.isZero ? '<span class="snapshot-list__badge">REF</span>' : ''}
        <strong>${label}</strong>
        <span>${snap.pct_actas.toFixed(3)}% actas</span>
        <span>JP: ${snap.votos_auditado.toLocaleString('es')}</span>
        <span>Resto: ${snap.votos_resto_top.toLocaleString('es')}</span>
      </span>
      <button class="btn btn--danger" data-id="${snap.id}" title="Eliminar registro">🗑 Eliminar</button>
    `;
    snapshotList.appendChild(li);
  });
}

// ── Renderizado de la tabla de auditoría ────────────────────────────────────
function renderTable(rows) {
  tbody.innerHTML = '';

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="table-empty">
      Sin datos. Ingrese el Punto de Referencia y al menos un snapshot más.
    </td></tr>`;
    return;
  }

  rows.forEach(row => {
    const tr = document.createElement('tr');

    if (row.isZeroRow) {
      tr.className = 'row--zero';
    } else if (row.isAlert) {
      tr.className = 'row--alert';
    } else if (row.isJEE) {
      tr.className = 'row--jee';
    } else if (row.isDataGap) {
      tr.className = 'row--gap';
    }

    const dt = new Date(row.snapshot.timestamp);
    const horaStr = dt.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false });
    const fechaStr = dt.toLocaleDateString('es', { day: '2-digit', month: '2-digit' });

    const deltaActasStr = row.isZeroRow
      ? '—'
      : `≈ ${Math.round(row.deltaActas).toLocaleString('es')}`;

    const caudalStr = row.isZeroRow
      ? '—'
      : row.caudal.toLocaleString('es');

    const shareStr = (row.shareTramo == null)
      ? '—'
      : `${(row.shareTramo * 100).toFixed(2)}%`;

    const shareAcumStr = (row.shareAcumulado == null)
      ? '—'
      : `${(row.shareAcumulado * 100).toFixed(2)}%`;

    const shareClass = row.isAlert ? 'share-value high' : 'share-value normal';

    tr.innerHTML = `
      <td><strong>${horaStr}</strong><br><span style="font-size:0.72rem;color:var(--text-secondary)">${fechaStr}</span></td>
      <td>${deltaActasStr}</td>
      <td>${caudalStr}</td>
      <td class="${shareClass}">${shareStr}</td>
      <td style="font-family:var(--font-mono);font-size:0.78rem;color:var(--text-secondary)">${shareAcumStr}</td>
      <td>${buildEstadoBadge(row)}</td>
    `;
    tbody.appendChild(tr);
  });
}

/** Construye el badge HTML de la columna Estado. */
function buildEstadoBadge(row) {
  if (row.isZeroRow)  return `<span class="badge badge--zero">Punto de Referencia</span>`;
  if (row.isAlert)    return `<span class="badge badge--alert">🔴 Predominancia Inusual</span>`;
  if (row.isJEE)      return `<span class="badge badge--jee">🔵 Fase JEE / Actas Obs.</span>`;
  if (row.isDataGap)  return `<span class="badge badge--gap">⚠ Brecha de Datos</span>`;
  return                     `<span class="badge badge--normal">✓ Normal</span>`;
}

// ── Renderizado del resumen estadístico ─────────────────────────────────────
function renderSummary(rows) {
  const dataRows = rows.filter(r => !r.isZeroRow && r.shareAcumulado != null);
  if (dataRows.length === 0) {
    summaryShare.textContent  = '—';
    summaryTotal.textContent  = '—';
    summaryAlerts.textContent = '—';
    return;
  }

  const lastRow    = dataRows[dataRows.length - 1];
  const totalAlerts = dataRows.filter(r => r.isAlert).length;

  summaryShare.textContent  = `${(lastRow.shareAcumulado * 100).toFixed(2)}%`;
  summaryTotal.textContent  = lastRow.caudal > 0
    ? `${lastRow.snapshot.pct_actas.toFixed(2)}% actas`
    : '—';
  summaryAlerts.textContent = `${totalAlerts}`;
  summaryAlerts.style.color = totalAlerts > 0
    ? 'var(--color-alert)'
    : 'var(--color-normal)';
}

// ── Eventos del Formulario ───────────────────────────────────────────────────
form.addEventListener('submit', (e) => {
  e.preventDefault();
  clearMessage();

  // Construir timestamp
  const dateVal = inputDate.value;
  const timeVal = inputTime.value;
  if (!dateVal || !timeVal) {
    return showMessage('Fecha y hora son requeridas.', 'error');
  }
  const timestamp = new Date(`${dateVal}T${timeVal}:00`).toISOString();

  // Parsear valores numéricos
  const pct_actas      = parseFloat(inputPct.value);
  const votos_auditado = parseInt(inputJP.value, 10);
  const votos_resto_top = parseInt(inputResto.value, 10);
  const isZero = checkZero.checked;

  if (isNaN(pct_actas) || isNaN(votos_auditado) || isNaN(votos_resto_top)) {
    return showMessage('Todos los campos numéricos son requeridos.', 'error');
  }
  if (pct_actas < 0 || pct_actas > 100) {
    return showMessage('El % de actas debe estar entre 0 y 100.', 'error');
  }

  // Validación cronológica: avisar si regresa en el tiempo
  const existing = storage.load().sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );
  if (existing.length > 0) {
    const lastTs  = new Date(existing[existing.length - 1].timestamp);
    const lastPct = existing[existing.length - 1].pct_actas;
    const newTs   = new Date(timestamp);

    if (newTs < lastTs || pct_actas < lastPct) {
      const ok = window.confirm(
        `⚠ El timestamp (${new Date(timestamp).toLocaleString('es')}) o el % de actas (${pct_actas}%) ` +
        `es menor al último registro.\n\n¿Confirma que desea ingresar un dato histórico?`
      );
      if (!ok) return;
    }
  }

  const snapshot = {
    id: storage.generateId(),
    isZero,
    timestamp,
    pct_actas,
    votos_auditado,
    votos_resto_top,
  };

  storage.add(snapshot);
  showMessage('Snapshot registrado correctamente.', 'success');
  form.reset();
  prefillDateTime();
  renderAll();
});

// ── Eliminar snapshot desde el acordeón ─────────────────────────────────────
snapshotList.addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-id]');
  if (!btn) return;

  const id = btn.dataset.id;
  const ok = window.confirm('¿Eliminar este snapshot? Esta acción no se puede deshacer.');
  if (!ok) return;

  storage.remove(id);
  renderAll();
});

// ── Exportar CSV ─────────────────────────────────────────────────────────────
btnExport.addEventListener('click', () => {
  csv.export(storage.load());
});

// ── Importar CSV ─────────────────────────────────────────────────────────────
btnImport.addEventListener('click', () => {
  csvInput.click();
});

csvInput.addEventListener('change', async () => {
  const file = csvInput.files[0];
  if (!file) return;

  try {
    const snapshots = await csv.import(file);
    const existing  = storage.load();

    let action = 'replace';
    if (existing.length > 0) {
      const choice = window.confirm(
        `Se encontraron ${snapshots.length} registros en el archivo.\n\n` +
        `• Aceptar → Reemplazar los datos actuales con el CSV importado.\n` +
        `• Cancelar → Añadir los registros importados a los existentes.`
      );
      action = choice ? 'replace' : 'merge';
    }

    if (action === 'replace') {
      storage.replace(snapshots);
    } else {
      const merged = [...existing, ...snapshots];
      storage.replace(merged);
    }

    renderAll();
    showMessage(`${snapshots.length} snapshots importados correctamente.`, 'success');
  } catch (err) {
    showMessage(`Error al importar: ${err.message}`, 'error');
  }

  csvInput.value = ''; // resetear input para permitir reimportar el mismo archivo
});

// ── Helpers de UI ────────────────────────────────────────────────────────────
function showMessage(text, type) {
  formMessage.textContent = text;
  formMessage.className   = `form-message ${type}`;
  setTimeout(() => clearMessage(), 4000);
}

function clearMessage() {
  formMessage.textContent = '';
  formMessage.className   = 'form-message';
}
