<script lang="ts">
  import { onMount } from 'svelte';

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';
  const currentYear = new Date().getFullYear();

  interface JetonType {
    code: string;
    label: string;
    color: string;
    defaultValeur: number;
    sortOrder: number;
    isActive: boolean;
  }

  let jetons: JetonType[] = [];
  let loading = true;
  let error = '';
  let successMessage = '';

  // Modal
  let showModal = false;
  let editMode = false;
  let currentJeton: JetonType = {
    code: '',
    label: '',
    color: '#FFD700',
    defaultValeur: 5,
    sortOrder: 0,
    isActive: true
  };

  async function loadJetons() {
    loading = true;
    error = '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/jetons-ref`);
      if (res.ok) {
        jetons = await res.json();
      } else {
        error = 'Erreur lors du chargement';
      }
    } catch (err) {
      error = 'Impossible de contacter le serveur';
    } finally {
      loading = false;
    }
  }

  function openCreate() {
    editMode = false;
    currentJeton = {
      code: '',
      label: '',
      color: '#FFD700',
      defaultValeur: 5,
      sortOrder: jetons.length + 1,
      isActive: true
    };
    showModal = true;
  }

  function openEdit(jeton: JetonType) {
    editMode = true;
    currentJeton = { ...jeton };
    showModal = true;
  }

  async function saveJeton() {
    error = '';
    successMessage = '';
    try {
      const url = editMode 
        ? `${API_BASE_URL}/api/config/jetons-ref/${currentJeton.code}`
        : `${API_BASE_URL}/api/config/jetons-ref`;
      
      const res = await fetch(url, {
        method: editMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentJeton)
      });

      if (res.ok) {
        showModal = false;
        successMessage = editMode ? 'Jeton modifié' : 'Jeton créé';
        setTimeout(() => successMessage = '', 3000);
        await loadJetons();
      } else {
        error = 'Erreur lors de la sauvegarde';
      }
    } catch (err) {
      error = 'Impossible de contacter le serveur';
    }
  }

  async function deleteJeton(code: string) {
    if (!confirm(`Supprimer le jeton "${code}" ?`)) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/jetons-ref/${code}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        successMessage = 'Jeton supprimé';
        setTimeout(() => successMessage = '', 3000);
        await loadJetons();
      } else {
        error = 'Erreur lors de la suppression';
      }
    } catch (err) {
      error = 'Impossible de contacter le serveur';
    }
  }

  onMount(loadJetons);
</script>

<svelte:head>
  <title>Types de jetons - Admin</title>
</svelte:head>

<div class="admin-container">
  <header class="admin-header">
    <a href="/admin/config" class="back-btn">← Retour</a>
    <h1>🎰 Types de jetons</h1>
  </header>

  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  {#if successMessage}
    <div class="success-message">{successMessage}</div>
  {/if}

  <div class="actions-bar">
    <p class="hint">Types de jetons utilisés pour les pénalités. Ces valeurs sont les valeurs par défaut.</p>
    <button class="btn-create" on:click={openCreate}>+ Nouveau jeton</button>
  </div>

  {#if loading}
    <div class="loading">Chargement...</div>
  {:else if jetons.length === 0}
    <div class="empty-state">Aucun type de jeton configuré</div>
  {:else}
    <div class="jetons-list">
      {#each jetons as jeton}
        <div class="jeton-card" class:inactive={!jeton.isActive}>
          <div class="jeton-visual" style="background-color: {jeton.color}">
            <span>{jeton.code.charAt(0)}</span>
          </div>
          <div class="jeton-info">
            <h3>{jeton.label}</h3>
            <div class="jeton-details">
              <span class="detail">Code: <code>{jeton.code}</code></span>
              <span class="detail">Valeur: <strong>{jeton.defaultValeur} pts</strong></span>
              <span class="detail">Ordre: {jeton.sortOrder}</span>
              <span class="status" class:active={jeton.isActive}>
                {jeton.isActive ? 'Actif' : 'Inactif'}
              </span>
            </div>
          </div>
          <div class="jeton-actions">
            <button class="btn-edit" on:click={() => openEdit(jeton)}>✏️</button>
            <button class="btn-delete" on:click={() => deleteJeton(jeton.code)}>🗑️</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Modal -->
  {#if showModal}
    <div class="modal-overlay" on:click={() => showModal = false} on:keydown={(e) => e.key === 'Escape' && (showModal = false)} role="button" tabindex="0">
      <div class="modal" on:click|stopPropagation role="dialog" aria-modal="true">
        <h2>{editMode ? 'Modifier le jeton' : 'Nouveau jeton'}</h2>
        <form on:submit|preventDefault={saveJeton}>
          <div class="form-group">
            <label for="code">Code</label>
            <input 
              id="code" 
              type="text" 
              bind:value={currentJeton.code} 
              required 
              disabled={editMode}
              placeholder="Ex: JAUNE"
              maxlength="20"
            />
          </div>
          <div class="form-group">
            <label for="label">Libellé</label>
            <input id="label" type="text" bind:value={currentJeton.label} required placeholder="Ex: Jeton Jaune" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="color">Couleur</label>
              <div class="color-input-group">
                <input id="color" type="color" bind:value={currentJeton.color} />
                <input type="text" bind:value={currentJeton.color} pattern="^#[0-9A-Fa-f]{6}$" />
              </div>
            </div>
            <div class="form-group">
              <label for="valeur">Valeur par défaut</label>
              <input id="valeur" type="number" bind:value={currentJeton.defaultValeur} min="0" required />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="sortOrder">Ordre</label>
              <input id="sortOrder" type="number" bind:value={currentJeton.sortOrder} min="0" />
            </div>
            <div class="form-group checkbox-group">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={currentJeton.isActive} />
                Actif
              </label>
            </div>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-cancel" on:click={() => showModal = false}>Annuler</button>
            <button type="submit" class="btn-submit">{editMode ? 'Modifier' : 'Créer'}</button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <footer class="admin-footer">
    <p>© {currentYear} Wb-Scoring — Tous droits réservés</p>
  </footer>
</div>

<style>
  .admin-container {
    min-height: 100vh;
    background: radial-gradient(circle at top, #125c2a 0%, #04140a 40%, #020506 100%);
    color: #e2e8f0;
    padding: 1rem;
  }

  .admin-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(34, 197, 94, 0.3);
  }

  .back-btn {
    color: #22c55e;
    text-decoration: none;
    font-size: 0.9rem;
    padding: 0.5rem 1rem;
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 8px;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: rgba(34, 197, 94, 0.1);
  }

  h1 {
    font-size: 1.5rem;
    color: #22c55e;
    margin: 0;
  }

  .error-message {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid #ef4444;
    color: #fca5a5;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .success-message {
    background: rgba(34, 197, 94, 0.2);
    border: 1px solid #22c55e;
    color: #86efac;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .actions-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .hint {
    color: #64748b;
    font-size: 0.9rem;
    margin: 0;
  }

  .btn-create {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }

  .loading, .empty-state {
    text-align: center;
    padding: 3rem;
    color: #94a3b8;
  }

  .jetons-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .jeton-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: #020617;
    border: 1px solid rgba(34, 197, 94, 0.2);
    border-radius: 12px;
    padding: 1rem;
  }

  .jeton-card.inactive {
    opacity: 0.6;
  }

  .jeton-visual {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: bold;
    color: white;
    text-shadow: 0 1px 2px rgba(0,0,0,0.5);
    box-shadow: inset 0 -3px 6px rgba(0,0,0,0.3), 0 2px 4px rgba(0,0,0,0.3);
  }

  .jeton-info {
    flex: 1;
  }

  .jeton-info h3 {
    color: #f1f5f9;
    margin: 0 0 0.5rem 0;
  }

  .jeton-details {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    font-size: 0.85rem;
  }

  .detail {
    color: #94a3b8;
  }

  .detail code {
    background: rgba(34, 197, 94, 0.1);
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
    font-family: monospace;
  }

  .detail strong {
    color: #22c55e;
  }

  .status {
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    background: #4b5563;
    color: white;
  }

  .status.active {
    background: #22c55e;
  }

  .jeton-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-edit, .btn-delete {
    background: transparent;
    border: 1px solid rgba(34, 197, 94, 0.3);
    padding: 0.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1rem;
  }

  .btn-edit:hover {
    background: rgba(34, 197, 94, 0.1);
  }

  .btn-delete {
    border-color: rgba(239, 68, 68, 0.3);
  }

  .btn-delete:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 100;
  }

  .modal {
    background: #0f172a;
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 16px;
    padding: 1.5rem;
    max-width: 500px;
    width: 100%;
  }

  .modal h2 {
    color: #22c55e;
    margin: 0 0 1.5rem 0;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    color: #94a3b8;
    font-size: 0.85rem;
    margin-bottom: 0.3rem;
  }

  .form-group input[type="text"],
  .form-group input[type="number"] {
    width: 100%;
    background: #020617;
    color: #e2e8f0;
    border: 1px solid rgba(34, 197, 94, 0.3);
    padding: 0.6rem 0.8rem;
    border-radius: 8px;
  }

  .form-group input:focus {
    outline: none;
    border-color: #22c55e;
  }

  .form-group input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .color-input-group {
    display: flex;
    gap: 0.5rem;
  }

  .color-input-group input[type="color"] {
    width: 50px;
    height: 38px;
    padding: 0;
    border: none;
    border-radius: 8px;
    cursor: pointer;
  }

  .color-input-group input[type="text"] {
    flex: 1;
  }

  .checkbox-group {
    display: flex;
    align-items: flex-end;
    padding-bottom: 0.5rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #e2e8f0;
    cursor: pointer;
  }

  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: #22c55e;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .btn-cancel {
    background: transparent;
    color: #94a3b8;
    border: 1px solid #4b5563;
    padding: 0.6rem 1.2rem;
    border-radius: 8px;
    cursor: pointer;
  }

  .btn-submit {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    color: white;
    border: none;
    padding: 0.6rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
  }

  .admin-footer {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(34, 197, 94, 0.2);
    text-align: center;
    color: #64748b;
    font-size: 0.85rem;
  }

  @media (max-width: 640px) {
    .form-row {
      grid-template-columns: 1fr;
    }

    .jeton-card {
      flex-wrap: wrap;
    }

    .jeton-actions {
      width: 100%;
      justify-content: flex-end;
    }
  }
</style>
