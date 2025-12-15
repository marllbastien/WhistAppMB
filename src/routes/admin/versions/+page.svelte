<script lang="ts">
  import { onMount } from 'svelte';

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';

  interface VersionEntry {
    id: number;
    version: string;
    commitHash: string | null;
    branch: string | null;
    environment: string;
    machineName: string | null;
    deployedAt: string;
    notes: string | null;
  }

  let versions: VersionEntry[] = [];
  let isLoading = true;
  let error: string | null = null;

  async function loadVersions() {
    isLoading = true;
    error = null;

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/versions`);
      if (!response.ok) {
        throw new Error(`Erreur ${response.status}`);
      }
      versions = await response.json();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Erreur inconnue';
    } finally {
      isLoading = false;
    }
  }

  function formatDate(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleString('fr-BE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function getEnvBadgeClass(env: string): string {
    switch (env) {
      case 'PROD': return 'badge-prod';
      case 'DEV': return 'badge-dev';
      case 'FRONTEND-PROD': return 'badge-frontend-prod';
      case 'FRONTEND-DEV': return 'badge-frontend-dev';
      default: return 'badge-default';
    }
  }

  function getEnvLabel(env: string): string {
    switch (env) {
      case 'PROD': return 'Backend PROD';
      case 'DEV': return 'Backend DEV';
      case 'FRONTEND-PROD': return 'Frontend PROD';
      case 'FRONTEND-DEV': return 'Frontend DEV';
      default: return env;
    }
  }

  onMount(() => {
    loadVersions();
  });
</script>

<div class="admin-page">
  <a href="/admin" class="back-link">← Retour admin</a>

  <h1>Historique des versions</h1>
  <p class="subtitle">Suivi des deploiements Backend et Frontend</p>

  {#if isLoading}
    <div class="loading">Chargement...</div>
  {:else if error}
    <div class="error-message">{error}</div>
  {:else if versions.length === 0}
    <div class="empty-state">
      <p>Aucune version enregistree</p>
      <p class="hint">Les versions sont enregistrees automatiquement au demarrage de l'API et du frontend.</p>
    </div>
  {:else}
    <div class="versions-container">
      <table class="versions-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Environnement</th>
            <th>Version</th>
            <th>Commit</th>
            <th>Branche</th>
            <th>Machine</th>
          </tr>
        </thead>
        <tbody>
          {#each versions as v}
            <tr>
              <td class="col-date">{formatDate(v.deployedAt)}</td>
              <td class="col-env">
                <span class="badge {getEnvBadgeClass(v.environment)}">
                  {getEnvLabel(v.environment)}
                </span>
              </td>
              <td class="col-version">{v.version}</td>
              <td class="col-commit">
                {#if v.commitHash}
                  <code>{v.commitHash}</code>
                {:else}
                  <span class="no-data">-</span>
                {/if}
              </td>
              <td class="col-branch">
                {#if v.branch}
                  <span class="branch-name">{v.branch}</span>
                {:else}
                  <span class="no-data">-</span>
                {/if}
              </td>
              <td class="col-machine">
                {#if v.machineName}
                  <span class="machine-name" title={v.machineName}>
                    {v.machineName.length > 20 ? v.machineName.slice(0, 20) + '...' : v.machineName}
                  </span>
                {:else}
                  <span class="no-data">-</span>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <span class="stat-value">{versions.filter(v => v.environment === 'PROD' || v.environment === 'DEV').length}</span>
        <span class="stat-label">Backend</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{versions.filter(v => v.environment.startsWith('FRONTEND')).length}</span>
        <span class="stat-label">Frontend</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{versions.length}</span>
        <span class="stat-label">Total</span>
      </div>
    </div>
  {/if}
</div>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
  }

  :global(body) {
    font-family: 'Poppins', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background:
      radial-gradient(circle at top, #125c2a 0%, #04140a 40%, #020506 100%);
    background-attachment: fixed;
    background-repeat: no-repeat;
    background-color: #020506;
    color: #ffffff;
  }

  .admin-page {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  .back-link {
    display: inline-block;
    color: #9ca3af;
    text-decoration: none;
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
    transition: color 0.2s;
  }

  .back-link:hover {
    color: #4ade80;
  }

  h1 {
    font-size: 1.8rem;
    margin: 0 0 0.3rem 0;
    color: #f9fafb;
  }

  .subtitle {
    color: #9ca3af;
    margin: 0 0 2rem 0;
    font-size: 0.95rem;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: #9ca3af;
  }

  .error-message {
    padding: 1rem;
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: 8px;
    color: #f87171;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #9ca3af;
  }

  .empty-state .hint {
    font-size: 0.85rem;
    margin-top: 0.5rem;
    opacity: 0.7;
  }

  .versions-container {
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 12px;
    overflow: hidden;
  }

  .versions-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  .versions-table th {
    background: rgba(0, 0, 0, 0.3);
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    color: #d1d5db;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .versions-table td {
    padding: 0.75rem 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
  }

  .versions-table tbody tr:hover {
    background: rgba(255, 255, 255, 0.03);
  }

  .col-date {
    white-space: nowrap;
    color: #9ca3af;
    font-size: 0.85rem;
  }

  .col-version {
    font-weight: 600;
    color: #f9fafb;
  }

  .col-commit code {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
    font-family: 'Monaco', 'Menlo', monospace;
  }

  .branch-name {
    background: rgba(168, 85, 247, 0.2);
    color: #c084fc;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.85rem;
  }

  .machine-name {
    color: #9ca3af;
    font-size: 0.85rem;
  }

  .no-data {
    color: #4b5563;
  }

  /* Badges */
  .badge {
    display: inline-block;
    padding: 0.25rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .badge-prod {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
  }

  .badge-dev {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.3);
  }

  .badge-frontend-prod {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .badge-frontend-dev {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .badge-default {
    background: rgba(107, 114, 128, 0.2);
    color: #9ca3af;
    border: 1px solid rgba(107, 114, 128, 0.3);
  }

  /* Stats */
  .stats-row {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
  }

  .stat-card {
    flex: 1;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 8px;
    padding: 1rem;
    text-align: center;
  }

  .stat-value {
    display: block;
    font-size: 1.5rem;
    font-weight: 700;
    color: #4ade80;
  }

  .stat-label {
    display: block;
    font-size: 0.8rem;
    color: #9ca3af;
    margin-top: 0.25rem;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .versions-table {
      font-size: 0.8rem;
    }

    .versions-table th,
    .versions-table td {
      padding: 0.5rem;
    }

    .col-machine {
      display: none;
    }

    .stats-row {
      flex-wrap: wrap;
    }

    .stat-card {
      min-width: calc(50% - 0.5rem);
    }
  }
</style>
