/**
 * CsvHandler.js
 * Responsabilidad única: Serialización y deserialización de Snapshots en formato CSV.
 * Utiliza la API FileReader nativa del navegador. Sin dependencias externas.
 */

const CSV_HEADERS = ['timestamp', 'isZero', 'pct_actas', 'votos_auditado', 'votos_resto_top'];

export class CsvHandler {
  /**
   * Exporta un array de snapshots como archivo CSV y lo descarga en el navegador.
   * @param {Array} snapshots - Array de snapshots desde StorageManager.
   */
  export(snapshots) {
    if (!snapshots || snapshots.length === 0) {
      alert('No hay datos para exportar.');
      return;
    }

    const lines = [CSV_HEADERS.join(',')];

    for (const s of snapshots) {
      const row = [
        s.timestamp,
        s.isZero ? '1' : '0',
        s.pct_actas,
        s.votos_auditado,
        s.votos_resto_top,
      ];
      lines.push(row.join(','));
    }

    const csvContent = lines.join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const now = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '-');
    const a = document.createElement('a');
    a.href = url;
    a.download = `mfe_auditoria_${now}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Importa un archivo CSV y devuelve una promesa con el array de snapshots parseados.
   * Valida las columnas requeridas antes de procesar las filas.
   * @param {File} file - Objeto File del input[type=file].
   * @returns {Promise<Array>} Promesa que resuelve con el array de snapshots.
   */
  import(file) {
    return new Promise((resolve, reject) => {
      if (!file || !file.name.endsWith('.csv')) {
        reject(new Error('El archivo seleccionado no es un CSV válido.'));
        return;
      }

      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const text = e.target.result;
          const lines = text.trim().split(/\r?\n/);

          if (lines.length < 2) {
            throw new Error('El archivo CSV está vacío o no tiene registros.');
          }

          // Parsear cabecera
          const header = lines[0].split(',').map(h => h.trim().toLowerCase());

          // Validar que existan todas las columnas requeridas
          for (const required of CSV_HEADERS) {
            if (!header.includes(required)) {
              throw new Error(`Columna requerida faltante en el CSV: "${required}"`);
            }
          }

          // Mapear índices de columnas
          const idx = {};
          CSV_HEADERS.forEach(col => { idx[col] = header.indexOf(col); });

          // Parsear filas de datos
          const snapshots = lines.slice(1)
            .filter(line => line.trim() !== '')
            .map((line, i) => {
              const vals = line.split(',').map(v => v.trim());

              const timestamp = vals[idx['timestamp']];
              if (!timestamp || isNaN(new Date(timestamp).getTime())) {
                throw new Error(`Fila ${i + 2}: timestamp inválido ("${timestamp}").`);
              }

              const pct = parseFloat(vals[idx['pct_actas']]);
              const votosJP = parseInt(vals[idx['votos_auditado']], 10);
              const votosResto = parseInt(vals[idx['votos_resto_top']], 10);

              if (isNaN(pct) || isNaN(votosJP) || isNaN(votosResto)) {
                throw new Error(`Fila ${i + 2}: valores numéricos inválidos.`);
              }

              return {
                id: `import_${Date.now()}_${i}`,
                timestamp,
                isZero: vals[idx['isZero']] === '1' || vals[idx['isZero']] === 'true',
                pct_actas: pct,
                votos_auditado: votosJP,
                votos_resto_top: votosResto,
              };
            });

          resolve(snapshots);
        } catch (err) {
          reject(err);
        }
      };

      reader.onerror = () => reject(new Error('Error al leer el archivo. Intente de nuevo.'));
      reader.readAsText(file, 'UTF-8');
    });
  }
}
