<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';

  interface TableLockDto {
    tableConfigId: number;
    tableName: string;
    mancheNumber: number;
    playerCount: number;
    gameStatus: number | null;
    lockedBy: string | null;
    lockedAt: string | null;
    lockDurationSeconds: number | null;
    isLockExpired: boolean;
    startTime: string | null;
    createdByIp: string | null;
    createdByUserAgent: string | null;
    competitionType: number | null;
    competitionNumber: number | null;
    competitionName: string | null;
  }

  let locks: TableLockDto[] = [];
  let isLoading = false;
  let loadError = '';
  let actionMessage = '';
  let actionError = '';
  let unlockingId: number | null = null;

  // Rafraîchissement automatique toutes les 10 secondes
  let refreshInterval: ReturnType<typeof setInterval> | null = null;

  const GAME_STATUS_LABELS: Record<number, string> = {
    1: 'En cours',
    2: 'En pause',
    3: 'Terminée',
    4: 'Abandonnée'
  };

  const GAME_STATUS_COLORS: Record<number, string> = {
    1: 'status-in-progress',
    2: 'status-paused',
    3: 'status-completed',
    4: 'status-abandoned'
  };

  onMount(async () => {
    await loadLocks();
    // Rafraîchir toutes les 10 secondes
    refreshInterval = setInterval(loadLocks, 10000);
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  async function loadLocks() {
    isLoading = true;
    loadError = '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/tables/locks`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      locks = await res.json();
    } catch (err: any) {
      console.error(err);
      loadError = 'Impossible de charger les verrous.';
    } finally {
      isLoading = false;
    }
  }

  async function unlockTable(tableConfigId: number, setToPaused: boolean) {
    unlockingId = tableConfigId;
    actionMessage = '';
    actionError = '';

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/tables/${tableConfigId}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ setToPaused })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        actionMessage = data.message;
        // Recharger la liste
        await loadLocks();
      } else {
        actionError = data.message || 'Erreur lors du déverrouillage.';
      }
    } catch (err: any) {
      console.error(err);
      actionError = 'Impossible de contacter le serveur.';
    } finally {
      unlockingId = null;
    }
  }

  function formatDuration(seconds: number | null): string {
    if (seconds === null) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 1) return `${secs}s`;
    return `${mins}m ${secs}s`;
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('fr-BE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function parseUserAgent(ua: string | null): string {
    if (!ua) return 'Inconnu';
    // Simplifier le user agent pour affichage
    if (ua.includes('iPhone')) return 'iPhone';
    if (ua.includes('iPad')) return 'iPad';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Mac')) return 'Mac';
    return 'Navigateur';
  }

  function getStatusLabel(status: number | null): string {
    if (status === null) return 'Inconnu';
    return GAME_STATUS_LABELS[status] || `Statut ${status}`;
  }

  function getStatusClass(status: number | null): string {
    if (status === null) return '';
    return GAME_STATUS_COLORS[status] || '';
  }

  // Calculer les stats
  $: activeLocksCount = locks.filter(l => l.lockedBy && !l.isLockExpired).length;
  $: expiredLocksCount = locks.filter(l => l.isLockExpired).length;
  $: inProgressCount = locks.filter(l => l.gameStatus === 1).length;
</script>

<svelte:head>
  <title>Gestion des verrous - Admin</title>
</svelte:head>

<div class="locks-page">
  <h1>
    <a href="/admin" class="back-link">← Administration</a>
    <span class="sep">⟶</span> Gestion des verrous
  </h1>

  <!-- Statistiques -->
  <div class="stats-bar">
    <div class="stat-item">
      <span class="stat-value">{locks.length}</span>
      <span class="stat-label">Tables actives</span>
    </div>
    <div class="stat-item stat-warning">
      <span class="stat-value">{activeLocksCount}</span>
      <span class="stat-label">Verrous actifs</span>
    </div>
    <div class="stat-item stat-danger">
      <span class="stat-value">{expiredLocksCount}</span>
      <span class="stat-label">Verrous expirés</span>
    </div>
    <button class="btn-refresh" on:click={loadLocks} disabled={isLoading}>
      {isLoading ? '⏳' : '🔄'} Rafraîchir
    </button>
  </div>

  <!-- Messages -->
  {#if actionMessage}
    <div class="message success">{actionMessage}</div>
  {/if}
  {#if actionError}
    <div class="message error">{actionError}</div>
  {/if}

  <!-- Contenu -->
  <div class="locks-container">
    {#if isLoading && locks.length === 0}
      <p class="loading">Chargement des verrous...</p>
    {:else if loadError}
      <p class="error">{loadError}</p>
    {:else if locks.length === 0}
      <div class="empty-state">
        <span class="empty-icon">✅</span>
        <p>Aucune table verrouillée ou en cours d'encodage.</p>
      </div>
    {:else}
      <div class="locks-grid">
        {#each locks as lock (lock.tableConfigId)}
          <div class="lock-card" class:expired={lock.isLockExpired} class:has-lock={lock.lockedBy}>
            <!-- En-tête -->
            <div class="card-header">
              <div class="card-title">
                <span class="table-name">Table {lock.tableName}</span>
                <span class="manche-number">Manche {lock.mancheNumber}</span>
              </div>
              <span class="badge {getStatusClass(lock.gameStatus)}">
                {getStatusLabel(lock.gameStatus)}
              </span>
            </div>

            <!-- Infos de compétition -->
            {#if lock.competitionName || lock.competitionNumber}
              <div class="competition-info">
                {lock.competitionName || `Compétition n°${lock.competitionNumber}`}
              </div>
            {/if}

            <!-- Détails du verrou -->
            <div class="lock-details">
              {#if lock.lockedBy}
                <div class="detail-row">
                  <span class="detail-label">🔒 Verrouillé depuis</span>
                  <span class="detail-value duration" class:expired={lock.isLockExpired}>
                    {formatDuration(lock.lockDurationSeconds)}
                    {#if lock.isLockExpired}
                      <span class="expired-badge">EXPIRÉ</span>
                    {/if}
                  </span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">📱 Appareil</span>
                  <span class="detail-value">{parseUserAgent(lock.createdByUserAgent)}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">🌐 IP</span>
                  <span class="detail-value ip">{lock.createdByIp || 'Inconnue'}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-label">🔑 Session</span>
                  <span class="detail-value session">{lock.lockedBy.substring(0, 12)}...</span>
                </div>
              {:else}
                <div class="detail-row no-lock">
                  <span class="detail-label">🔓 Pas de verrou actif</span>
                  <span class="detail-value">Table en cours sans lock</span>
                </div>
              {/if}

              <div class="detail-row">
                <span class="detail-label">👤 Joueurs</span>
                <span class="detail-value">{lock.playerCount}</span>
              </div>

              <div class="detail-row">
                <span class="detail-label">📅 Début</span>
                <span class="detail-value">{formatDate(lock.startTime)}</span>
              </div>
            </div>

            <!-- Actions -->
            <div class="card-actions">
              <button
                class="btn-unlock pause"
                on:click={() => unlockTable(lock.tableConfigId, true)}
                disabled={unlockingId === lock.tableConfigId}
                title="Déverrouiller et mettre en pause"
              >
                {#if unlockingId === lock.tableConfigId}
                  ⏳
                {:else}
                  ⏸️ Mettre en pause
                {/if}
              </button>
              <button
                class="btn-unlock release"
                on:click={() => unlockTable(lock.tableConfigId, false)}
                disabled={unlockingId === lock.tableConfigId}
                title="Déverrouiller sans changer le statut"
              >
                {#if unlockingId === lock.tableConfigId}
                  ⏳
                {:else}
                  🔓 Libérer le verrou
                {/if}
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Info box -->
  <div class="info-box">
    <h3>💡 Comment fonctionne le système de verrous ?</h3>
    <ul>
      <li><strong>Verrou actif :</strong> Un terminal est en train d'encoder cette table. Personne d'autre ne peut l'encoder.</li>
      <li><strong>Verrou expiré :</strong> Le verrou a plus de 5 minutes. Un autre terminal peut reprendre l'encodage automatiquement.</li>
      <li><strong>Mettre en pause :</strong> Libère le verrou ET passe la table en pause. Utile si l'encodage doit être repris plus tard.</li>
      <li><strong>Libérer le verrou :</strong> Libère uniquement le verrou, la table reste "En cours". Utile pour reprendre immédiatement sur un autre appareil.</li>
    </ul>
  </div>
</div>

<style>
  .locks-page {
    max-width: 1200px;
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

  .stat-item.stat-warning {
    background: rgba(251, 191, 36, 0.1);
    border-color: rgba(251, 191, 36, 0.3);
  }

  .stat-item.stat-danger {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.3);
  }

  .stat-value {
    font-size: 1.8rem;
    font-weight: 700;
    color: #22c55e;
  }

  .stat-warning .stat-value {
    color: #fbbf24;
  }

  .stat-danger .stat-value {
    color: #ef4444;
  }

  .stat-label {
    font-size: 0.8rem;
    color: #9ca3af;
    margin-top: 0.25rem;
  }

  .btn-refresh {
    margin-left: auto;
    background: rgba(59, 130, 246, 0.2);
    border: 1px solid rgba(59, 130, 246, 0.4);
    color: #60a5fa;
    padding: 0.6rem 1rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s ease;
  }

  .btn-refresh:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.3);
    border-color: #60a5fa;
  }

  .btn-refresh:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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
  .locks-container {
    min-height: 200px;
  }

  .loading {
    color: #9ca3af;
    text-align: center;
    padding: 2rem;
  }

  .error {
    color: #f87171;
    text-align: center;
    padding: 1rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    background: rgba(34, 197, 94, 0.05);
    border: 1px dashed rgba(34, 197, 94, 0.3);
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

  /* Grille de cartes */
  .locks-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: 1.25rem;
  }

  /* Carte */
  .lock-card {
    background: linear-gradient(135deg, #052e16 0%, #020617 100%);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 12px;
    padding: 1.25rem;
    transition: all 0.2s ease;
  }

  .lock-card.has-lock {
    border-color: rgba(251, 191, 36, 0.5);
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, #020617 100%);
  }

  .lock-card.expired {
    border-color: rgba(239, 68, 68, 0.5);
    background: linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, #020617 100%);
  }

  .lock-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
  }

  /* Header */
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 0.75rem;
  }

  .card-title {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .table-name {
    font-size: 1.2rem;
    font-weight: 700;
    color: #22c55e;
  }

  .manche-number {
    font-size: 0.9rem;
    color: #9ca3af;
  }

  .badge {
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .status-in-progress {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.4);
  }

  .status-paused {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.4);
  }

  .status-completed {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.4);
  }

  .status-abandoned {
    background: rgba(107, 114, 128, 0.2);
    color: #9ca3af;
    border: 1px solid rgba(107, 114, 128, 0.4);
  }

  /* Competition info */
  .competition-info {
    font-size: 0.85rem;
    color: #c084fc;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  /* Details */
  .lock-details {
    display: flex;
    flex-direction: column;
    gap: 0.6rem;
    margin-bottom: 1rem;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.85rem;
  }

  .detail-row.no-lock {
    background: rgba(34, 197, 94, 0.1);
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    margin: 0.25rem 0;
  }

  .detail-label {
    color: #9ca3af;
  }

  .detail-value {
    color: #e5e7eb;
    font-weight: 500;
  }

  .detail-value.duration {
    color: #fbbf24;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .detail-value.duration.expired {
    color: #ef4444;
  }

  .expired-badge {
    background: rgba(239, 68, 68, 0.3);
    color: #f87171;
    font-size: 0.65rem;
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-weight: 700;
  }

  .detail-value.ip {
    font-family: monospace;
    font-size: 0.8rem;
  }

  .detail-value.session {
    font-family: monospace;
    font-size: 0.75rem;
    color: #6b7280;
  }

  /* Actions */
  .card-actions {
    display: flex;
    gap: 0.75rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.1);
  }

  .btn-unlock {
    flex: 1;
    padding: 0.6rem 0.75rem;
    border-radius: 8px;
    font-size: 0.85rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid;
  }

  .btn-unlock.pause {
    background: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.4);
    color: #60a5fa;
  }

  .btn-unlock.pause:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.3);
    border-color: #60a5fa;
  }

  .btn-unlock.release {
    background: rgba(251, 191, 36, 0.2);
    border-color: rgba(251, 191, 36, 0.4);
    color: #fbbf24;
  }

  .btn-unlock.release:hover:not(:disabled) {
    background: rgba(251, 191, 36, 0.3);
    border-color: #fbbf24;
  }

  .btn-unlock:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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
    .locks-page {
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

    .btn-refresh {
      margin-left: 0;
    }

    .locks-grid {
      grid-template-columns: 1fr;
    }

    .card-actions {
      flex-direction: column;
    }

    .info-box {
      font-size: 0.9rem;
    }
  }
</style>
