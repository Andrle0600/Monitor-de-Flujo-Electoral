/**
 * StorageManager.js
 * Responsabilidad única: Persistencia y recuperación de Snapshots en localStorage.
 * Llave de almacenamiento: 'mfe_data_v1'
 */

const STORAGE_KEY = 'mfe_data_v1';

export class StorageManager {
  /**
   * Carga todos los snapshots del almacenamiento local.
   * @returns {Array} Array de objetos snapshot, o [] si está vacío o corrompido.
   */
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error('[StorageManager] Error al leer localStorage:', e);
      return [];
    }
  }

  /**
   * Persiste el array completo de snapshots en localStorage.
   * @param {Array} snapshots
   */
  save(snapshots) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshots));
  }

  /**
   * Añade un nuevo snapshot al almacenamiento y lo persiste.
   * @param {Object} snapshot
   * @returns {Array} Array actualizado de snapshots.
   */
  add(snapshot) {
    const snapshots = this.load();
    snapshots.push(snapshot);
    this.save(snapshots);
    return snapshots;
  }

  /**
   * Elimina un snapshot por su ID y persiste el resultado.
   * @param {string} id
   * @returns {Array} Array actualizado de snapshots.
   */
  remove(id) {
    const snapshots = this.load().filter(s => s.id !== id);
    this.save(snapshots);
    return snapshots;
  }

  /**
   * Reemplaza todos los snapshots actuales por un nuevo array (usado en importación).
   * @param {Array} snapshots
   */
  replace(snapshots) {
    this.save(snapshots);
  }

  /**
   * Limpia completamente el almacenamiento.
   */
  clear() {
    localStorage.removeItem(STORAGE_KEY);
  }

  /**
   * Genera un ID único para un nuevo snapshot.
   * @returns {string}
   */
  generateId() {
    return `snap_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
