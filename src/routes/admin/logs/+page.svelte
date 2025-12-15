<script lang="ts">
  import { onMount } from 'svelte';

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';
  const ADMIN_PIN = '060784';

  interface SessionLog {
    id: number;
    tableConfigId: number | null;
    sessionId: string | null;
    eventType: string;
    appVersion: string | null;
    userAgent: string | null;
    isOnline: boolean | null;
    isPWA: boolean | null;
    competitionType: number | null;
    donneCount: number | null;
    grilleSource: string | null;
    annoncesSource: string | null;
    details: string | null;
    clientTimestamp: string | null;
    createdAt: string;
  }

  let logs: SessionLog[] = [];
  let totalCount = 0;
  let page = 1;
  let pageSize = 50;
  let isLoading = false;
  let error: string | null = null;

  // Filtres
  let filterTableConfigId = '';
  let filterEventType = '';

  // Purge
  let isPurging = false;
  let purgeResult: { deletedCount: number; cutoffDate: string } | null = null;

  async function loadLogs() {
    isLoading = true;
    error = null;

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString()
      });

      if (filterTableConfigId) {
        params.set('tableConfigId', filterTableConfigId);
      }
      if (filterEventType) {
        params.set('eventType', filterEventType);
      }

      const response = await fetch(`${API_BASE_URL}/api/logs/session?${params}`, {
        headers: {
          'X-Admin-Pin': ADMIN_PIN
        }
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      const data = await response.json();
      logs = data.logs;
      totalCount = data.totalCount;
    } catch (e) {
      error = e instanceof Error ? e.message : 'Erreur inconnue';
    } finally {
      isLoading = false;
    }
  }

  async function purgeLogs() {
    if (!confirm('Supprimer tous les logs de plus de 10 jours ?')) return;

    isPurging = true;
    purgeResult = null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/logs/session/purge?daysToKeep=10`, {
        method: 'DELETE',
        headers: {
          'X-Admin-Pin': ADMIN_PIN
        }
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }

      purgeResult = await response.json();
      await loadLogs();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Erreur purge';
    } finally {
      isPurging = false;
    }
  }

  function applyFilters() {
    page = 1;
    loadLogs();
  }

  function clearFilters() {
    filterTableConfigId = '';
    filterEventType = '';
    page = 1;
    loadLogs();
  }

  function nextPage() {
    if (page * pageSize < totalCount) {
      page++;
      loadLogs();
    }
  }

  function prevPage() {
    if (page > 1) {
      page--;
      loadLogs();
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('fr-BE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  function formatUserAgent(ua: string | null): string {
    if (!ua) return '-';
    if (ua.includes('Android')) {
      const match = ua.match(/Android (\d+(?:\.\d+)?)/);
      return `Android ${match?.[1] ?? ''}`;
    }
    if (ua.includes('iPhone') || ua.includes('iPad')) {
      return 'iOS';
    }
    if (ua.includes('Windows')) {
      return 'Windows';
    }
    if (ua.includes('Mac')) {
      return 'macOS';
    }
    return ua.slice(0, 30) + '...';
  }

  function getEventTypeClass(eventType: string): string {
    switch (eventType) {
      case 'SESSION_START': return 'event-start';
      case 'GRILLE_LOADED': return 'event-grille';
      case 'DRAFT_RESTORED': return 'event-draft';
      case 'ERROR': return 'event-error';
      default: return '';
    }
  }

  // Stats
  $: totalPages = Math.ceil(totalCount / pageSize) || 1;

  onMount(() => {
    loadLogs();
  });
</script>

<svelte:head>
  <title>Logs de session - Admin</title>
</svelte:head>

<div class="logs-page">
  <h1>
    <a href="/admin" class="back-link">← Administration</a>
    <span class="sep">⟶</span> Logs de session
  </h1>

  <!-- Stats bar -->
  <div class="stats-bar">
    <div class="stat-item">
      <span class="stat-value">{totalCount}</span>
      <span class="stat-label">Logs total</span>
    </div>
    <div class="stat-item stat-info">
      <span class="stat-value">{logs.length}</span>
      <span class="stat-label">Cette page</span>
    </div>
    <button class="btn-refresh" on:click={loadLogs} disabled={isLoading}>
      {isLoading ? '⏳' : '🔄'} Rafraîchir
    </button>
    <button class="btn-purge" on:click={purgeLogs} disabled={isPurging}>
      {isPurging ? '⏳' : '🗑️'} Purger (+10j)
    </button>
  </div>

  <!-- Filtres -->
  <div class="filters-section">
    <div class="filter-row">
      <div class="filter-group">
        <label for="tableConfigId">TableConfigId</label>
        <input
          type="number"
          id="tableConfigId"
          bind:value={filterTableConfigId}
          placeholder="Ex: 194"
        />
      </div>
      <div class="filter-group">
        <label for="eventType">Type d'événement</label>
        <select id="eventType" bind:value={filterEventType}>
          <option value="">Tous</option>
          <option value="SESSION_START">SESSION_START</option>
          <option value="GRILLE_LOADED">GRILLE_LOADED</option>
          <option value="DRAFT_RESTORED">DRAFT_RESTORED</option>
          <option value="ERROR">ERROR</option>
        </select>
      </div>
      <div class="filter-actions">
        <button class="btn-filter" on:click={applyFilters}>Filtrer</button>
        <button class="btn-clear" on:click={clearFilters}>Effacer</button>
      </div>
    </div>
  </div>

  <!-- Messages -->
  {#if purgeResult}
    <div class="message success">
      {purgeResult.deletedCount} log{purgeResult.deletedCount > 1 ? 's' : ''} supprimé{purgeResult.deletedCount > 1 ? 's' : ''}
    </div>
  {/if}

  {#if error}
    <div class="message error">{error}</div>
  {/if}

  <!-- Contenu -->
  <div class="logs-container">
    {#if isLoading && logs.length === 0}
      <p class="loading">Chargement des logs...</p>
    {:else if logs.length === 0}
      <div class="empty-state">
        <span class="empty-icon">📋</span>
        <p>Aucun log trouvé.</p>
      </div>
    {:else}
      <div class="table-wrapper">
        <table class="logs-table">
          <thead>
            <tr>
              <th>Événement</th>
              <th>Reçu</th>
              <th>Type</th>
              <th>Table</th>
              <th>Version</th>
              <th>Online</th>
              <th>PWA</th>
              <th>Donnes</th>
              <th>Grille</th>
              <th>Annonces</th>
              <th>Appareil</th>
            </tr>
          </thead>
          <tbody>
            {#each logs as log (log.id)}
              <tr>
                <td class="date-cell">{formatDate(log.clientTimestamp)}</td>
                <td class="date-cell">{formatDate(log.createdAt)}</td>
                <td>
                  <span class="event-badge {getEventTypeClass(log.eventType)}">
                    {log.eventType}
                  </span>
                </td>
                <td class="mono">{log.tableConfigId ?? '-'}</td>
                <td class="mono">{log.appVersion ?? '-'}</td>
                <td>
                  {#if log.isOnline === true}
                    <span class="status-online">Online</span>
                  {:else if log.isOnline === false}
                    <span class="status-offline">Offline</span>
                  {:else}
                    -
                  {/if}
                </td>
                <td>{log.isPWA ? 'Oui' : log.isPWA === false ? 'Non' : '-'}</td>
                <td>{log.donneCount ?? '-'}</td>
                <td class="source-cell">{log.grilleSource ?? '-'}</td>
                <td class="source-cell">{log.annoncesSource ?? '-'}</td>
                <td class="ua-cell" title={log.userAgent ?? ''}>
                  {formatUserAgent(log.userAgent)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div class="pagination">
        <button on:click={prevPage} disabled={page === 1}>← Précédent</button>
        <span class="page-info">Page {page} / {totalPages}</span>
        <button on:click={nextPage} disabled={page >= totalPages}>Suivant →</button>
      </div>
    {/if}
  </div>

  <!-- Info box -->
  <div class="info-box">
    <h3>💡 À propos des logs de session</h3>
    <ul>
      <li><strong>Événement :</strong> Quand l'action s'est produite côté client (peut être décalé si offline).</li>
      <li><strong>Reçu :</strong> Quand le serveur a reçu le log.</li>
      <li><strong>SESSION_START :</strong> Ouverture de la page d'encodage.</li>
      <li><strong>GRILLE_LOADED :</strong> Chargement réussi des données depuis le serveur.</li>
      <li><strong>DRAFT_RESTORED :</strong> Restauration d'un brouillon local.</li>
      <li><strong>ERROR :</strong> Une erreur s'est produite.</li>
    </ul>
  </div>
</div>

<style>
  .logs-page {
    max-width: 1400px;
    margin: 2rem auto;
    padding: 1rem;
    color: #f9fafb;
  }

  h1 {
    font-size: 1.6rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .back-link {
    color: #22c55e;
    text-decoration: none;
    font-weight: 600;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  .sep {
    opacity: 0.6;
    margin: 0 0.3rem;
  }

  /* Stats bar */
  .stats-bar {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .stat-item {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 10px;
    padding: 0.75rem 1.25rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 100px;
  }

  .stat-item.stat-info {
    background: rgba(59, 130, 246, 0.1);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .stat-value {
    font-size: 1.8rem;
    font-weight: 700;
    color: #22c55e;
  }

  .stat-info .stat-value {
    color: #60a5fa;
  }

  .stat-label {
    font-size: 0.8rem;
    color: #9ca3af;
    margin-top: 0.25rem;
  }

  .btn-refresh,
  .btn-purge {
    margin-left: auto;
    padding: 0.6rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s ease;
    border: 1px solid;
  }

  .btn-refresh {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.4);
    color: #60a5fa;
    margin-left: auto;
  }

  .btn-refresh:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.3);
    border-color: #60a5fa;
  }

  .btn-purge {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.4);
    color: #f87171;
    margin-left: 0;
  }

  .btn-purge:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.3);
    border-color: #f87171;
  }

  .btn-refresh:disabled,
  .btn-purge:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Filtres */
  .filters-section {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    padding: 1rem;
    margin-bottom: 1.5rem;
  }

  .filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: flex-end;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .filter-group label {
    font-size: 0.85rem;
    color: #9ca3af;
  }

  .filter-group input,
  .filter-group select {
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(0, 0, 0, 0.3);
    color: #e5e7eb;
    font-size: 0.9rem;
  }

  .filter-group input {
    width: 100px;
  }

  .filter-group select {
    min-width: 160px;
  }

  .filter-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-filter,
  .btn-clear {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid;
    cursor: pointer;
    font-size: 0.85rem;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .btn-filter {
    background: rgba(34, 197, 94, 0.2);
    border-color: rgba(34, 197, 94, 0.4);
    color: #4ade80;
  }

  .btn-filter:hover {
    background: rgba(34, 197, 94, 0.3);
    border-color: #4ade80;
  }

  .btn-clear {
    background: rgba(107, 114, 128, 0.2);
    border-color: rgba(107, 114, 128, 0.4);
    color: #9ca3af;
  }

  .btn-clear:hover {
    background: rgba(107, 114, 128, 0.3);
    border-color: #9ca3af;
  }

  /* Messages */
  .message {
    padding: 0.75rem 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
    font-weight: 500;
  }

  .message.success {
    background: rgba(34, 197, 94, 0.15);
    border: 1px solid rgba(34, 197, 94, 0.4);
    color: #4ade80;
  }

  .message.error {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    color: #f87171;
  }

  /* Container */
  .logs-container {
    min-height: 200px;
  }

  .loading {
    color: #9ca3af;
    text-align: center;
    padding: 2rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    background: rgba(59, 130, 246, 0.05);
    border: 1px dashed rgba(59, 130, 246, 0.3);
    border-radius: 12px;
  }

  .empty-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 1rem;
  }

  .empty-state p {
    color: #9ca3af;
    margin: 0;
  }

  /* Table */
  .table-wrapper {
    overflow-x: auto;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }

  .logs-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .logs-table th,
  .logs-table td {
    padding: 0.75rem 0.6rem;
    text-align: left;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .logs-table th {
    background: rgba(0, 0, 0, 0.4);
    color: #22c55e;
    font-weight: 600;
    font-size: 0.8rem;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .logs-table tbody tr:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .date-cell {
    white-space: nowrap;
    font-size: 0.8rem;
    color: #9ca3af;
  }

  .mono {
    font-family: monospace;
    font-size: 0.85rem;
  }

  .event-badge {
    padding: 0.25rem 0.6rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .event-start {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.4);
  }

  .event-grille {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.4);
  }

  .event-draft {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.4);
  }

  .event-error {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }

  .status-online {
    color: #4ade80;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .status-offline {
    color: #f87171;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .source-cell {
    font-size: 0.8rem;
  }

  .ua-cell {
    font-size: 0.75rem;
    color: #9ca3af;
    max-width: 100px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Pagination */
  .pagination {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .pagination button {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.2);
    background: rgba(255, 255, 255, 0.05);
    color: #e5e7eb;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .pagination button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: rgba(255, 255, 255, 0.3);
  }

  .pagination button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .page-info {
    color: #9ca3af;
    font-size: 0.9rem;
  }

  /* Info box */
  .info-box {
    margin-top: 2rem;
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 12px;
    padding: 1.25rem;
  }

  .info-box h3 {
    margin: 0 0 1rem 0;
    font-size: 1rem;
    color: #60a5fa;
  }

  .info-box ul {
    margin: 0;
    padding-left: 1.25rem;
    color: #9ca3af;
    line-height: 1.8;
  }

  .info-box li strong {
    color: #e5e7eb;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .logs-page {
      padding: 0.75rem;
      margin: 1rem auto;
    }

    h1 {
      font-size: 1.3rem;
    }

    .sep {
      display: none;
    }

    .stats-bar {
      flex-direction: column;
      align-items: stretch;
    }

    .stat-item {
      flex-direction: row;
      justify-content: space-between;
      padding: 0.6rem 1rem;
    }

    .stat-value {
      font-size: 1.4rem;
    }

    .btn-refresh,
    .btn-purge {
      margin-left: 0;
    }

    .filter-row {
      flex-direction: column;
    }

    .filter-group {
      width: 100%;
    }

    .filter-group input,
    .filter-group select {
      width: 100%;
    }

    .filter-actions {
      width: 100%;
    }

    .filter-actions button {
      flex: 1;
    }

    .logs-table {
      font-size: 0.75rem;
    }

    .logs-table th,
    .logs-table td {
      padding: 0.5rem 0.4rem;
    }

    .info-box {
      font-size: 0.9rem;
    }
  }
</style>
