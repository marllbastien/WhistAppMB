<script lang="ts">
  import { onMount } from 'svelte';

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';
  const currentYear = new Date().getFullYear();

  interface Club {
    id: number;
    bk: string | null;
    name: string;
    shortName: string | null;
    compteur: number | null;
    code: string | null;
    logoPath: string | null;
    color: string | null;
    isActive: boolean;
  }

  let clubs: Club[] = [];
  let isLoading = false;
  let loadError = '';

  // Filtres
  let filterActif: 'all' | 'actif' | 'inactif' = 'all';
  let searchQuery = '';

  // Tri
  type SortColumn = 'id' | 'name' | 'shortName' | 'code' | 'isActive';
  let sortColumn: SortColumn = 'name';
  let sortDirection: 'asc' | 'desc' = 'asc';

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
  }

  $: sortIcons = {
    id: sortColumn === 'id' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    bk: sortColumn === 'bk' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    name: sortColumn === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    shortName: sortColumn === 'shortName' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    code: sortColumn === 'code' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    isActive: sortColumn === 'isActive' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
  };

  // Modal création/édition
  let showModal = false;
  let editingClub: Club | null = null;
  let formData = {
    bk: '',
    name: '',
    shortName: '',
    compteur: null as number | null,
    code: '',
    logoPath: '',
    color: '#22c55e',
    isActive: true
  };
  let saving = false;
  let saveMessage = '';

  $: filteredClubs = clubs
    .filter((c) => {
      // Filtre actif/inactif
      if (filterActif === 'actif' && !c.isActive) return false;
      if (filterActif === 'inactif' && c.isActive) return false;

      // Recherche texte
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!c.name.toLowerCase().includes(q) && 
            !(c.shortName?.toLowerCase().includes(q)) &&
            !(c.code?.toLowerCase().includes(q))) return false;
      }

      return true;
    })
    .sort((a, b) => {
      let aVal: string | number | boolean = '';
      let bVal: string | number | boolean = '';

      switch (sortColumn) {
        case 'id':
          aVal = a.id;
          bVal = b.id;
          break;
        case 'name':
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case 'shortName':
          aVal = (a.shortName ?? '').toLowerCase();
          bVal = (b.shortName ?? '').toLowerCase();
          break;
        case 'code':
          aVal = (a.code ?? '').toLowerCase();
          bVal = (b.code ?? '').toLowerCase();
          break;
        case 'isActive':
          aVal = a.isActive ? 1 : 0;
          bVal = b.isActive ? 1 : 0;
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  onMount(() => {
    const flag = localStorage.getItem('whist_admin_ok');
    if (flag !== 'true') {
      window.location.href = '/admin';
      return;
    }
    loadClubs();
  });

  async function loadClubs() {
    isLoading = true;
    loadError = '';

    try {
      const res = await fetch(`${API_BASE_URL}/api/config/clubs`);
      if (!res.ok) {
        throw new Error('Erreur lors du chargement');
      }
      clubs = await res.json();
    } catch (err: any) {
      console.error(err);
      loadError = 'Impossible de charger les clubs.';
    } finally {
      isLoading = false;
    }
  }

  function openNewModal() {
    editingClub = null;
    formData = {
      bk: '',
      name: '',
      shortName: '',
      compteur: null,
      code: '',
      logoPath: '',
      color: '#22c55e',
      isActive: true
    };
    saveMessage = '';
    showModal = true;
  }

  function openEditModal(club: Club) {
    editingClub = club;
    formData = {
      bk: club.bk ?? '',
      name: club.name,
      shortName: club.shortName ?? '',
      compteur: club.compteur,
      code: club.code ?? '',
      logoPath: club.logoPath ?? '',
      color: club.color ?? '#22c55e',
      isActive: club.isActive
    };
    saveMessage = '';
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingClub = null;
    saveMessage = '';
  }

  async function saveClub() {
    if (!formData.name.trim()) {
      saveMessage = 'Le nom est obligatoire';
      return;
    }

    saving = true;
    saveMessage = '';

    const payload = {
      bk: formData.bk.trim() || null,
      name: formData.name.trim(),
      shortName: formData.shortName.trim() || null,
      compteur: formData.compteur,
      code: formData.code.trim() || null,
      logoPath: formData.logoPath.trim() || null,
      color: formData.color || null,
      isActive: formData.isActive
    };

    try {
      let res: Response;
      if (editingClub) {
        // Mise à jour
        res = await fetch(`${API_BASE_URL}/api/config/clubs/${editingClub.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        // Création
        res = await fetch(`${API_BASE_URL}/api/config/clubs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        closeModal();
        await loadClubs();
      } else {
        const errData = await res.json().catch(() => ({}));
        saveMessage = errData.error || 'Erreur lors de la sauvegarde';
      }
    } catch (err) {
      saveMessage = 'Impossible de contacter le serveur';
    } finally {
      saving = false;
    }
  }

  async function deleteClub(club: Club) {
    if (!confirm(`Voulez-vous vraiment supprimer le club "${club.name}" ?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/config/clubs/${club.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await loadClubs();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Erreur lors de la suppression');
      }
    } catch (err) {
      alert('Impossible de contacter le serveur');
    }
  }
</script>

<svelte:head>
  <title>Gestion des clubs - Admin</title>
</svelte:head>

<div class="admin-container">
  <header class="admin-header">
    <a href="/admin" class="back-btn">← Retour</a>
    <h1>🏛️ Gestion des clubs</h1>
  </header>

  {#if loadError}
    <div class="error-message">{loadError}</div>
  {/if}

  <!-- Barre d'actions -->
  <div class="actions-bar">
    <div class="filters">
      <input
        type="text"
        class="search-input"
        placeholder="Rechercher..."
        bind:value={searchQuery}
      />
      <select bind:value={filterActif}>
        <option value="all">Tous</option>
        <option value="actif">Actifs</option>
        <option value="inactif">Inactifs</option>
      </select>
    </div>
    <button class="btn-create" on:click={openNewModal}>
      <svg class="action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
      Nouveau club
    </button>
  </div>

  <!-- Liste des clubs -->
  {#if isLoading}
    <div class="loading">Chargement...</div>
  {:else if filteredClubs.length === 0}
    <div class="empty-state">Aucun club trouvé</div>
  {:else}
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th class="sortable" on:click={() => toggleSort('id')}>ID {sortIcons.id}</th>
            <th class="sortable" on:click={() => toggleSort('bk')}>BK {sortIcons.bk}</th>
            <th class="sortable" on:click={() => toggleSort('name')}>Nom {sortIcons.name}</th>
            <th class="sortable" on:click={() => toggleSort('shortName')}>Abréviation {sortIcons.shortName}</th>
            <th class="sortable" on:click={() => toggleSort('code')}>Code {sortIcons.code}</th>
            <th>Couleur</th>
            <th class="sortable" on:click={() => toggleSort('isActive')}>Statut {sortIcons.isActive}</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredClubs as club}
            <tr class:inactive={!club.isActive}>
              <td>{club.id}</td>
              <td class="bk-cell">{club.bk ?? '-'}</td>
              <td>
                <div class="club-name">
                  {#if club.color}
                    <span class="color-dot" style="background: {club.color};"></span>
                  {/if}
                  {club.name}
                </div>
              </td>
              <td>{club.shortName ?? '-'}</td>
              <td>{club.code ?? '-'}</td>
              <td>
                {#if club.color}
                  <span class="color-badge" style="background: {club.color};">{club.color}</span>
                {:else}
                  -
                {/if}
              </td>
              <td>
                <span class="status-badge" class:active={club.isActive}>
                  {club.isActive ? 'Actif' : 'Inactif'}
                </span>
              </td>
              <td>
                <div class="action-buttons">
                  <button class="btn-edit" on:click={() => openEditModal(club)} title="Modifier">
                    <svg class="action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                    </svg>
                  </button>
                  <button class="btn-delete" on:click={() => deleteClub(club)} title="Supprimer">
                    <svg class="action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                      <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Modal création/édition -->
  {#if showModal}
    <div class="modal-overlay" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()} role="button" tabindex="0">
      <div class="modal" on:click|stopPropagation role="dialog" aria-modal="true">
        <h2>{editingClub ? 'Modifier le club' : 'Nouveau club'}</h2>
        
        {#if saveMessage}
          <div class="save-message error">{saveMessage}</div>
        {/if}

        <form on:submit|preventDefault={saveClub}>
          <div class="form-group">
            <label for="name">Nom *</label>
            <input id="name" type="text" bind:value={formData.name} required placeholder="Nom du club" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="shortName">Abréviation</label>
              <input id="shortName" type="text" bind:value={formData.shortName} placeholder="Ex: LAR" maxlength="10" />
            </div>
            <div class="form-group">
              <label for="code">Code</label>
              <input id="code" type="text" bind:value={formData.code} placeholder="Ex: 001" maxlength="10" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="bk">Clé métier (BK)</label>
              <input id="bk" type="text" bind:value={formData.bk} placeholder="Identifiant externe" />
            </div>
            <div class="form-group">
              <label for="compteur">Compteur</label>
              <input id="compteur" type="number" bind:value={formData.compteur} placeholder="0" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="color">Couleur</label>
              <div class="color-input-group">
                <input id="color" type="color" bind:value={formData.color} />
                <input type="text" bind:value={formData.color} placeholder="#22c55e" />
              </div>
            </div>
            <div class="form-group">
              <label for="logoPath">Logo (chemin)</label>
              <input id="logoPath" type="text" bind:value={formData.logoPath} placeholder="/logos/club.png" />
            </div>
          </div>

          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={formData.isActive} />
              Club actif
            </label>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-cancel" on:click={closeModal} disabled={saving}>Annuler</button>
            <button type="submit" class="btn-submit" disabled={saving}>
              {saving ? 'Enregistrement...' : (editingClub ? 'Mettre à jour' : 'Créer')}
            </button>
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

  .actions-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .filters {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .search-input {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #e2e8f0;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.9rem;
    min-width: 200px;
  }

  .search-input::placeholder {
    color: #64748b;
  }

  .filters select {
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #e2e8f0;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.9rem;
  }

  .btn-create {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-create:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
  }

  .action-icon {
    flex-shrink: 0;
  }

  .loading, .empty-state {
    text-align: center;
    padding: 3rem;
    color: #94a3b8;
    font-size: 1.1rem;
  }

  .table-container {
    background: #020617;
    border-radius: 12px;
    border: 1px solid rgba(34, 197, 94, 0.2);
    overflow: hidden;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
  }

  .data-table th {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    padding: 1rem;
    text-align: left;
    font-weight: 600;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .data-table th.sortable {
    cursor: pointer;
    user-select: none;
  }

  .data-table th.sortable:hover {
    background: rgba(34, 197, 94, 0.2);
  }

  .data-table td {
    padding: 0.875rem 1rem;
    border-bottom: 1px solid rgba(34, 197, 94, 0.1);
    font-size: 0.9rem;
  }

  .data-table tr:hover {
    background: rgba(34, 197, 94, 0.05);
  }

  .data-table tr.inactive {
    opacity: 0.6;
  }

  .club-name {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .color-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-family: monospace;
    color: white;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  }

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background: rgba(100, 116, 139, 0.2);
    color: #94a3b8;
    border: 1px solid rgba(100, 116, 139, 0.3);
  }

  .status-badge.active {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
    border-color: rgba(34, 197, 94, 0.3);
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .btn-edit, .btn-delete {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-edit {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
  }

  .btn-edit:hover {
    background: rgba(59, 130, 246, 0.3);
  }

  .btn-delete {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .btn-delete:hover {
    background: rgba(239, 68, 68, 0.3);
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: 1rem;
  }

  .modal {
    background: #0f172a;
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 16px;
    padding: 2rem;
    width: 100%;
    max-width: 500px;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal h2 {
    color: #22c55e;
    margin: 0 0 1.5rem;
    font-size: 1.25rem;
  }

  .save-message {
    padding: 0.75rem 1rem;
    border-radius: 8px;
    margin-bottom: 1rem;
  }

  .save-message.error {
    background: rgba(239, 68, 68, 0.2);
    border: 1px solid #ef4444;
    color: #fca5a5;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    color: #94a3b8;
    font-size: 0.85rem;
    margin-bottom: 0.5rem;
  }

  .form-group input[type="text"],
  .form-group input[type="number"] {
    width: 100%;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #e2e8f0;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.9rem;
    box-sizing: border-box;
  }

  .form-group input:focus {
    outline: none;
    border-color: #22c55e;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .color-input-group {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .color-input-group input[type="color"] {
    width: 50px;
    height: 38px;
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 6px;
    cursor: pointer;
    background: transparent;
  }

  .color-input-group input[type="text"] {
    flex: 1;
    font-family: monospace;
  }

  .checkbox-group {
    margin-top: 1rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    color: #e2e8f0;
  }

  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: #22c55e;
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;
    justify-content: flex-end;
  }

  .btn-cancel {
    background: rgba(100, 116, 139, 0.2);
    border: 1px solid rgba(100, 116, 139, 0.3);
    color: #94a3b8;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-cancel:hover:not(:disabled) {
    background: rgba(100, 116, 139, 0.3);
  }

  .btn-submit {
    background: linear-gradient(135deg, #22c55e, #16a34a);
    border: none;
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-submit:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.3);
  }

  .btn-submit:disabled, .btn-cancel:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-footer {
    text-align: center;
    padding: 2rem 0;
    margin-top: 2rem;
    border-top: 1px solid rgba(34, 197, 94, 0.2);
    color: #64748b;
    font-size: 0.85rem;
  }

  @media (max-width: 640px) {
    .form-row {
      grid-template-columns: 1fr;
    }

    .actions-bar {
      flex-direction: column;
      align-items: stretch;
    }

    .filters {
      flex-direction: column;
    }

    .search-input {
      min-width: 100%;
    }
  }
</style>
