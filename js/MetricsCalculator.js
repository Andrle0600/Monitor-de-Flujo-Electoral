/**
 * MetricsCalculator.js
 * Responsabilidad única: Toda la lógica matemática del análisis de flujo electoral.
 * Incluye: Caudal de Grupo, Share de Tramo, Share Acumulado, VPH, Delta Actas y alertas.
 */

const TOTAL_ACTAS = 92766;
const ALERT_THRESHOLD = 1.20; // +20% sobre el share acumulado

export class MetricsCalculator {
  /**
   * Procesa un array de snapshots y devuelve las filas calculadas para la UI.
   * Ordena cronológicamente, parte del punto cero y calcula deltas por tramo.
   * @param {Array} snapshots - Array crudo de snapshots desde StorageManager.
   * @returns {Array} rows - Array de objetos con métricas calculadas por tramo.
   */
  computeRows(snapshots) {
    if (!snapshots || snapshots.length === 0) return [];

    // Ordenar cronológicamente
    const sorted = [...snapshots].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    // Encontrar el punto de referencia (isZero)
    const zeroIdx = sorted.findIndex(s => s.isZero);
    if (zeroIdx === -1) return [];

    // Solo procesar desde el snapshot cero en adelante
    const relevant = sorted.slice(zeroIdx);

    let acumCaudal = 0;
    let acumDeltaJP = 0;

    const rows = [];

    for (let i = 0; i < relevant.length; i++) {
      const curr = relevant[i];
      const prev = i > 0 ? relevant[i - 1] : null;

      // --- Fila del Punto de Referencia (Snapshot Cero) ---
      if (i === 0) {
        rows.push({
          snapshot: curr,
          isZeroRow: true,
          deltaActas: 0,
          deltaJP: 0,
          deltaResto: 0,
          caudal: 0,
          shareTramo: null,
          shareAcumulado: null,
          vph: 0,
          deltaHoras: 0,
          isAlert: false,
          isJEE: curr.pct_actas > 91,
          isDataGap: false,
        });
        continue;
      }

      // --- Cálculo del Delta de Tiempo ---
      const deltaMs = new Date(curr.timestamp) - new Date(prev.timestamp);
      const deltaHoras = deltaMs / 3_600_000;

      // --- Delta de Actas (sobre universo de 92,766) ---
      const deltaActas = TOTAL_ACTAS * ((curr.pct_actas - prev.pct_actas) / 100);

      // --- Deltas de votos por candidato ---
      const deltaJP = curr.votos_auditado - prev.votos_auditado;
      const deltaResto = curr.votos_resto_top - prev.votos_resto_top;

      // --- Caudal del Grupo del Tramo (CG) ---
      const caudal = deltaJP + deltaResto;

      // --- Share de Captura del Tramo ---
      const shareTramo = caudal > 0 ? deltaJP / caudal : 0;

      // --- Share Promedio Acumulado (antifalsopositivo) ---
      acumCaudal += caudal;
      acumDeltaJP += deltaJP;
      const shareAcumulado = acumCaudal > 0 ? acumDeltaJP / acumCaudal : 0;

      // --- Velocidad del Grupo (Votos/Hora) ---
      const vph = deltaHoras > 0 ? caudal / deltaHoras : 0;

      // --- Brecha de datos (> 5 horas sin snapshot) ---
      const isDataGap = deltaHoras > 5;

      // --- Alerta de Predominancia Inusual ---
      // El share del tramo supera en 20% o más al share acumulado
      const isAlert = shareAcumulado > 0 && shareTramo >= shareAcumulado * ALERT_THRESHOLD;

      // --- Fase JEE (procesamiento lento > 91%) ---
      const isJEE = curr.pct_actas > 91;

      rows.push({
        snapshot: curr,
        isZeroRow: false,
        deltaActas,
        deltaJP,
        deltaResto,
        caudal,
        shareTramo,
        shareAcumulado,
        vph,
        deltaHoras,
        isAlert,
        isJEE,
        isDataGap,
      });
    }

    return rows;
  }

  /**
   * Determina el estado textual de una fila para la columna "Estado".
   * @param {Object} row
   * @returns {string}
   */
  getEstado(row) {
    if (row.isZeroRow) return 'Punto de Referencia';
    const flags = [];
    if (row.isDataGap) flags.push('⚠ Brecha de Datos');
    if (row.isJEE)    flags.push('🔵 Fase JEE');
    if (row.isAlert)  flags.push('🔴 Predominancia Inusual');
    return flags.length > 0 ? flags.join(' · ') : '✓ Normal';
  }
}
