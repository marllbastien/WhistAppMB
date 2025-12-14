<script lang="ts">
  import { onMount } from 'svelte';
  import JetonPoker from '$lib/components/JetonPoker.svelte';

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';

  interface NotificationSetting {
    id: number;
    notificationType: string;
    isEnabled: boolean;
    recipientEmail: string;
    description: string | null;
    updatedAt: string | null;
  }

  interface NotificationLog {
    id: number;
    notificationType: string;
    recipientEmail: string;
    subject: string;
    isSuccess: boolean;
    errorMessage: string | null;
    relatedEntityId: number | null;
    relatedEntityType: string | null;
    sentAt: string;
  }

  interface NotificationStats {
    totalSent: number;
    totalSuccess: number;
    totalFailed: number;
    lastSentAt: string | null;
    byType: Record<string, number>;
  }

  // Données
  let settings: NotificationSetting[] = [];
  let logs: NotificationLog[] = [];
  let stats: NotificationStats | null = null;

  // États
  let isLoading = false;
  let loadError = '';
  let updating: string | null = null;
  let testing: string | null = null;
  let testMessage = '';

  // Filtres logs
  let logTypeFilter = '';
  let logSuccessFilter: string = '';

  // Labels pour les types de notification
  // icon: 'JETON_BLEU' = utilise le composant JetonPoker
  const typeLabels: Record<string, { label: string; icon: string; color: string }> = {
    'TableCreated': { label: 'Table créée', icon: '♠', color: '#c9a227' },
    'TableCompleted': { label: 'Table terminée', icon: '✓', color: '#2e8b2e' },
    'TableDeletedByAdmin': { label: 'Table supprimée', icon: '🗑️', color: '#dc143c' },
    'TableForceClosed': { label: 'Fermeture forcée', icon: '⚠️', color: '#ff8c00' },
    'PenaltyAdded': { label: 'Pénalité ajoutée', icon: 'JETON_BLEU', color: '#2563eb' },
    'TableLockedTooLong': { label: 'Verrou trop long', icon: '🔒', color: '#666' },
    'PlayerConverted': { label: 'Joueur converti', icon: '👤', color: '#1e90ff' },
    'ProvisionalPlayerCreated': { label: 'Joueur provisoire créé', icon: '➕', color: '#9333ea' },
    'CompetitionCreated': { label: 'Compétition créée', icon: '🏆', color: '#c9a227' },
    'EncodingStopped': { label: 'Encodage fermé', icon: '🛑', color: '#dc143c' }
  };

  function getTypeInfo(type: string) {
    return typeLabels[type] || { label: type, icon: '📧', color: '#888' };
  }

  onMount(async () => {
    await loadAll();
  });

  async function loadAll() {
    isLoading = true;
    loadError = '';

    try {
      await Promise.all([loadSettings(), loadStats(), loadLogs()]);
    } catch (e: any) {
      loadError = e.message || 'Erreur lors du chargement';
    } finally {
      isLoading = false;
    }
  }

  async function loadSettings() {
    const resp = await fetch(`${API_BASE_URL}/api/admin/notifications/settings`);
    if (!resp.ok) throw new Error('Erreur chargement paramètres');
    settings = await resp.json();
  }

  async function loadStats() {
    const resp = await fetch(`${API_BASE_URL}/api/admin/notifications/stats`);
    if (!resp.ok) throw new Error('Erreur chargement stats');
    stats = await resp.json();
  }

  async function loadLogs() {
    let url = `${API_BASE_URL}/api/admin/notifications/logs?limit=50`;
    if (logTypeFilter) url += `&type=${encodeURIComponent(logTypeFilter)}`;
    if (logSuccessFilter === 'success') url += '&successOnly=true';
    if (logSuccessFilter === 'failed') url += '&successOnly=false';

    const resp = await fetch(url);
    if (!resp.ok) throw new Error('Erreur chargement logs');
    logs = await resp.json();
  }

  async function toggleSetting(setting: NotificationSetting) {
    updating = setting.notificationType;
    try {
      const resp = await fetch(
        `${API_BASE_URL}/api/admin/notifications/settings/${setting.notificationType}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isEnabled: !setting.isEnabled })
        }
      );
      if (!resp.ok) throw new Error('Erreur mise à jour');
      setting.isEnabled = !setting.isEnabled;
      settings = [...settings]; // Trigger reactivity
    } catch (e: any) {
      alert('Erreur: ' + e.message);
    } finally {
      updating = null;
    }
  }

  async function sendTest(type: string) {
    testing = type;
    testMessage = '';
    try {
      const resp = await fetch(
        `${API_BASE_URL}/api/admin/notifications/test/${type}`,
        { method: 'POST' }
      );
      if (!resp.ok) throw new Error('Erreur envoi test');
      testMessage = `Test "${getTypeInfo(type).label}" envoyé !`;
      // Recharger les logs après un court délai
      setTimeout(() => loadLogs(), 2000);
    } catch (e: any) {
      testMessage = 'Erreur: ' + e.message;
    } finally {
      testing = null;
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-BE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
</script>

<div class="notifications-page">
  <header class="page-header">
    <a href="/admin" class="back-link">← Retour</a>
    <h1>📧 Gestion des Notifications</h1>
  </header>

  {#if isLoading}
    <div class="loading">Chargement...</div>
  {:else if loadError}
    <div class="error">{loadError}</div>
  {:else}
    <!-- Stats -->
    {#if stats}
      <section class="stats-section">
        <h2>Statistiques</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{stats.totalSent}</div>
            <div class="stat-label">Total envoyées</div>
          </div>
          <div class="stat-card success">
            <div class="stat-value">{stats.totalSuccess}</div>
            <div class="stat-label">Réussies</div>
          </div>
          <div class="stat-card error">
            <div class="stat-value">{stats.totalFailed}</div>
            <div class="stat-label">Échouées</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">{formatDate(stats.lastSentAt)}</div>
            <div class="stat-label">Dernière envoyée</div>
          </div>
        </div>
      </section>
    {/if}

    <!-- Settings -->
    <section class="settings-section">
      <h2>Paramètres des notifications</h2>
      {#if testMessage}
        <div class="test-message">{testMessage}</div>
      {/if}
      <div class="settings-list">
        {#each settings as setting}
          {@const info = getTypeInfo(setting.notificationType)}
          <div class="setting-card" class:enabled={setting.isEnabled}>
            <div class="setting-icon" style="color: {info.color}">
              {#if info.icon === 'JETON_BLEU'}
                <JetonPoker color="bleu" size={24} />
              {:else}
                {info.icon}
              {/if}
            </div>
            <div class="setting-info">
              <div class="setting-name">{info.label}</div>
              <div class="setting-description">{setting.description || ''}</div>
              <div class="setting-email">→ {setting.recipientEmail}</div>
            </div>
            <div class="setting-actions">
              <button
                class="toggle-btn"
                class:active={setting.isEnabled}
                disabled={updating === setting.notificationType}
                on:click={() => toggleSetting(setting)}
              >
                {setting.isEnabled ? 'ON' : 'OFF'}
              </button>
              <button
                class="test-btn"
                disabled={testing === setting.notificationType}
                on:click={() => sendTest(setting.notificationType)}
              >
                {testing === setting.notificationType ? '...' : 'Test'}
              </button>
            </div>
          </div>
        {/each}
      </div>
    </section>

    <!-- Logs -->
    <section class="logs-section">
      <h2>Historique des envois</h2>
      <div class="logs-filters">
        <select bind:value={logTypeFilter} on:change={() => loadLogs()}>
          <option value="">Tous les types</option>
          {#each Object.entries(typeLabels) as [type, info]}
            <option value={type}>{info.label}</option>
          {/each}
        </select>
        <select bind:value={logSuccessFilter} on:change={() => loadLogs()}>
          <option value="">Tous les statuts</option>
          <option value="success">Réussies</option>
          <option value="failed">Échouées</option>
        </select>
        <button class="refresh-btn" on:click={() => loadLogs()}>🔄</button>
      </div>
      <div class="logs-list">
        {#if logs.length === 0}
          <div class="no-logs">Aucune notification envoyée</div>
        {:else}
          {#each logs as log}
            {@const info = getTypeInfo(log.notificationType)}
            <div class="log-card" class:success={log.isSuccess} class:error={!log.isSuccess}>
              <div class="log-status">
                {log.isSuccess ? '✓' : '✗'}
              </div>
              <div class="log-icon" style="color: {info.color}">
                {#if info.icon === 'JETON_BLEU'}
                  <JetonPoker color="bleu" size={20} />
                {:else}
                  {info.icon}
                {/if}
              </div>
              <div class="log-info">
                <div class="log-subject">{log.subject}</div>
                <div class="log-meta">
                  {formatDate(log.sentAt)} • {log.recipientEmail}
                  {#if log.relatedEntityId}
                    • Table #{log.relatedEntityId}
                  {/if}
                </div>
                {#if log.errorMessage}
                  <div class="log-error">{log.errorMessage}</div>
                {/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>
    </section>
  {/if}
</div>

<style>
  .notifications-page {
    min-height: 100vh;
    background: radial-gradient(circle at top, #125c2a 0%, #04140a 40%, #020506 100%);
    padding: 1rem;
    color: #f9fafb;
  }

  .page-header {
    max-width: 1000px;
    margin: 0 auto 1.5rem auto;
  }

  .back-link {
    color: #22c55e;
    text-decoration: none;
    font-size: 0.9rem;
    display: inline-block;
    margin-bottom: 0.5rem;
    font-weight: 600;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  h1 {
    color: #22c55e;
    margin: 0;
    font-size: 1.8rem;
  }

  h2 {
    color: #22c55e;
    font-size: 1.2rem;
    margin: 0 0 1rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(34, 197, 94, 0.3);
  }

  section {
    max-width: 1000px;
    margin: 0 auto 2rem auto;
    background: #020617;
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 16px;
    padding: 1.5rem;
  }

  .loading, .error {
    text-align: center;
    padding: 2rem;
    font-size: 1.1rem;
  }

  .error {
    color: #ff6b6b;
  }

  /* Stats */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
  }

  .stat-card {
    background: rgba(255, 255, 255, 0.05);
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
  }

  .stat-card.success {
    border-left: 3px solid #2e8b2e;
  }

  .stat-card.error {
    border-left: 3px solid #dc143c;
  }

  .stat-value {
    font-size: 1.5rem;
    font-weight: bold;
    color: #22c55e;
  }

  .stat-label {
    font-size: 0.8rem;
    color: #888;
    margin-top: 0.25rem;
  }

  /* Settings */
  .test-message {
    background: rgba(34, 197, 94, 0.1);
    border-left: 3px solid #22c55e;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
    border-radius: 4px;
  }

  .settings-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .setting-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 8px;
    padding: 1rem;
    border-left: 3px solid #444;
    transition: all 0.2s ease;
  }

  .setting-card.enabled {
    border-left-color: #2e8b2e;
    background: rgba(46, 139, 46, 0.1);
  }

  .setting-icon {
    font-size: 1.5rem;
    width: 40px;
    text-align: center;
  }

  .setting-info {
    flex: 1;
  }

  .setting-name {
    font-weight: bold;
    color: #fff;
  }

  .setting-description {
    font-size: 0.85rem;
    color: #888;
    margin-top: 0.25rem;
  }

  .setting-email {
    font-size: 0.8rem;
    color: #666;
    margin-top: 0.25rem;
  }

  .setting-actions {
    display: flex;
    gap: 0.5rem;
  }

  .toggle-btn {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 20px;
    cursor: pointer;
    font-weight: bold;
    font-size: 0.85rem;
    transition: all 0.2s ease;
    background: #333;
    color: #888;
  }

  .toggle-btn.active {
    background: #2e8b2e;
    color: #fff;
  }

  .toggle-btn:hover:not(:disabled) {
    transform: scale(1.05);
  }

  .toggle-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .test-btn {
    padding: 0.5rem 1rem;
    border: 1px solid rgba(34, 197, 94, 0.5);
    border-radius: 20px;
    background: transparent;
    color: #22c55e;
    cursor: pointer;
    font-size: 0.85rem;
    transition: all 0.2s ease;
  }

  .test-btn:hover:not(:disabled) {
    background: #22c55e;
    color: #020617;
  }

  .test-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Logs */
  .logs-filters {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .logs-filters select {
    padding: 0.5rem;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    border-radius: 4px;
    color: #fff;
  }

  .refresh-btn {
    padding: 0.5rem 0.75rem;
    background: transparent;
    border: 1px solid rgba(34, 197, 94, 0.5);
    border-radius: 4px;
    cursor: pointer;
  }

  .refresh-btn:hover {
    background: rgba(34, 197, 94, 0.2);
  }

  .logs-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .no-logs {
    text-align: center;
    color: #666;
    padding: 2rem;
  }

  .log-card {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    background: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    border-left: 3px solid #444;
  }

  .log-card.success {
    border-left-color: #2e8b2e;
  }

  .log-card.error {
    border-left-color: #dc143c;
    background: rgba(220, 20, 60, 0.1);
  }

  .log-status {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.8rem;
    flex-shrink: 0;
  }

  .log-card.success .log-status {
    background: #2e8b2e;
    color: white;
  }

  .log-card.error .log-status {
    background: #dc143c;
    color: white;
  }

  .log-icon {
    font-size: 1.2rem;
    flex-shrink: 0;
  }

  .log-info {
    flex: 1;
    min-width: 0;
  }

  .log-subject {
    font-weight: 500;
    color: #fff;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .log-meta {
    font-size: 0.8rem;
    color: #888;
    margin-top: 0.25rem;
  }

  .log-error {
    font-size: 0.8rem;
    color: #ff6b6b;
    margin-top: 0.25rem;
    font-style: italic;
  }

  /* Responsive */
  @media (max-width: 600px) {
    .setting-card {
      flex-wrap: wrap;
    }

    .setting-actions {
      width: 100%;
      justify-content: flex-end;
      margin-top: 0.5rem;
    }

    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
</style>
