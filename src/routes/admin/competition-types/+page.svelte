<script lang="ts">
  import { onMount } from 'svelte';

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';
  const currentYear = new Date().getFullYear();

  interface CompetitionType {
    id: number;
    name: string;
    shortName: string | null;
    description: string | null;
    isActive: boolean;
    sortOrder: number;
  }

  let competitionTypes: CompetitionType[] = [];
  let isLoading = false;
  let loadError = '';

  // Filtres
  let filterActif: 'all' | 'actif' | 'inactif' = 'all';
  let searchQuery = '';

  // Tri
  type SortColumn = 'id' | 'name' | 'shortName' | 'sortOrder' | 'isActive';
  let sortColumn: SortColumn = 'sortOrder';
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
    name: sortColumn === 'name' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    shortName: sortColumn === 'shortName' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    sortOrder: sortColumn === 'sortOrder' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    isActive: sortColumn === 'isActive' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
  };

  // Modal création/édition
  let showModal = false;
  let editingType: CompetitionType | null = null;
  let formData = {
    name: '',
    shortName: '',
    description: '',
    sortOrder: 0,
    isActive: true
  };
  let saving = false;
  let saveMessage = '';

  $: filteredTypes = competitionTypes
    .filter((t) => {
      // Filtre actif/inactif
      if (filterActif === 'actif' && !t.isActive) return false;
      if (filterActif === 'inactif' && t.isActive) return false;

      // Recherche texte
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!t.name.toLowerCase().includes(q) && 
            !(t.shortName?.toLowerCase().includes(q)) &&
            !(t.description?.toLowerCase().includes(q))) return false;
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
        case 'sortOrder':
          aVal = a.sortOrder;
          bVal = b.sortOrder;
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
    loadCompetitionTypes();
  });

  async function loadCompetitionTypes() {
    isLoading = true;
    loadError = '';

    try {
      const res = await fetch(`${API_BASE_URL}/api/config/competition-types`);
      if (!res.ok) {
        throw new Error('Erreur lors du chargement');
      }
      competitionTypes = await res.json();
    } catch (err: any) {
      console.error(err);
      loadError = 'Impossible de charger les types de compétition.';
    } finally {
      isLoading = false;
    }
  }

  function openNewModal() {
    editingType = null;
    // Calculer le prochain sortOrder
    const maxOrder = competitionTypes.length > 0 
      ? Math.max(...competitionTypes.map(t => t.sortOrder))
      : 0;
    formData = {
      name: '',
      shortName: '',
      description: '',
      sortOrder: maxOrder + 1,
      isActive: true
    };
    saveMessage = '';
    showModal = true;
  }

  function openEditModal(type: CompetitionType) {
    editingType = type;
    formData = {
      name: type.name,
      shortName: type.shortName ?? '',
      description: type.description ?? '',
      sortOrder: type.sortOrder,
      isActive: type.isActive
    };
    saveMessage = '';
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingType = null;
    saveMessage = '';
  }

  async function saveType() {
    if (!formData.name.trim()) {
      saveMessage = 'Le nom est obligatoire';
      return;
    }

    saving = true;
    saveMessage = '';

    const payload = {
      name: formData.name.trim(),
      shortName: formData.shortName.trim() || null,
      description: formData.description.trim() || null,
      sortOrder: formData.sortOrder,
      isActive: formData.isActive
    };

    try {
      let res: Response;
      if (editingType) {
        // Mise à jour
        res = await fetch(`${API_BASE_URL}/api/config/competition-types/${editingType.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        // Création
        res = await fetch(`${API_BASE_URL}/api/config/competition-types`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        closeModal();
        await loadCompetitionTypes();
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

  async function deleteType(type: CompetitionType) {
    if (!confirm(`Voulez-vous vraiment supprimer le type "${type.name}" ?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/config/competition-types/${type.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        await loadCompetitionTypes();
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Erreur lors de la suppression');
      }
    } catch (err) {
      alert('Impossible de contacter le serveur');
    }
  }

  // Couleurs par type (correspondant aux badges existants)
  function getTypeColor(id: number): string {
    const colors: Record<number, string> = {
      1: '#22c55e', // Championnat - vert
      2: '#3b82f6', // Interclub - bleu
      3: '#8b5cf6', // Manche libre - violet
      4: '#f59e0b', // Concours - orange
      5: '#ef4444', // Endurance - rouge
      6: '#ec4899', // Funny Games - rose
      7: '#06b6d4', // Edition festive - cyan
    };
    return colors[id] || '#64748b';
  }

  // Helper pour convertir hex en rgb
  function hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`;
    }
    return '100, 116, 139'; // fallback gris
  }
</script>

<svelte:head>
  <title>Types de compétition - Admin</title>
</svelte:head>

<div class="admin-container">
  <header class="admin-header">
    <a href="/admin" class="back-btn">← Retour</a>
    <h1>🏆 Types de compétition</h1>
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
      Nouveau type
    </button>
  </div>

  <!-- Liste des types -->
  {#if isLoading}
    <div class="loading">Chargement...</div>
  {:else if filteredTypes.length === 0}
    <div class="empty-state">Aucun type de compétition trouvé</div>
  {:else}
    <div class="table-container">
      <table class="data-table">
        <thead>
          <tr>
            <th class="sortable" on:click={() => toggleSort('id')}>ID {sortIcons.id}</th>
            <th class="sortable" on:click={() => toggleSort('name')}>Nom {sortIcons.name}</th>
            <th class="sortable" on:click={() => toggleSort('shortName')}>Abréviation {sortIcons.shortName}</th>
            <th>Description</th>
            <th class="sortable" on:click={() => toggleSort('sortOrder')}>Ordre {sortIcons.sortOrder}</th>
            <th class="sortable" on:click={() => toggleSort('isActive')}>Statut {sortIcons.isActive}</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredTypes as type}
            <tr class:inactive={!type.isActive}>
              <td>{type.id}</td>
              <td>
                <div class="type-name">
                  <span class="type-badge" style="background: rgba({hexToRgb(getTypeColor(type.id))}, 0.2); color: {getTypeColor(type.id)}; border-color: {getTypeColor(type.id)};">
                    {type.name}
                  </span>
                </div>
              </td>
              <td>
                {#if type.shortName}
                  <span class="short-badge">{type.shortName}</span>
                {:else}
                  -
                {/if}
              </td>
              <td class="description-cell">{type.description ?? '-'}</td>
              <td class="order-cell">{type.sortOrder}</td>
              <td>
                <span class="status-badge" class:active={type.isActive}>
                  {type.isActive ? 'Actif' : 'Inactif'}
                </span>
              </td>
              <td>
                <div class="action-buttons">
                  <button class="btn-edit" on:click={() => openEditModal(type)} title="Modifier">
                    <svg class="action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
                    </svg>
                  </button>
                  <button class="btn-delete" on:click={() => deleteType(type)} title="Supprimer">
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
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div class="modal-overlay" on:click={closeModal} on:keydown={(e) => e.key === 'Escape' && closeModal()} role="presentation">
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div class="modal" on:click|stopPropagation>
        <h2>{editingType ? 'Modifier le type' : 'Nouveau type de compétition'}</h2>
        
        {#if saveMessage}
          <div class="save-message error">{saveMessage}</div>
        {/if}

        <form on:submit|preventDefault={saveType}>
          <div class="form-group">
            <label for="name">Nom *</label>
            <input id="name" type="text" bind:value={formData.name} required placeholder="Ex: Championnat" />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="shortName">Abréviation</label>
              <input id="shortName" type="text" bind:value={formData.shortName} placeholder="Ex: Ch" maxlength="10" />
            </div>
            <div class="form-group">
              <label for="sortOrder">Ordre d'affichage</label>
              <input id="sortOrder" type="number" bind:value={formData.sortOrder} min="0" />
            </div>
          </div>

          <div class="form-group">
            <label for="description">Description</label>
            <textarea id="description" bind:value={formData.description} placeholder="Description optionnelle du type" rows="3"></textarea>
          </div>

          <div class="form-group checkbox-group">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={formData.isActive} />
              Type actif
            </label>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-cancel" on:click={closeModal} disabled={saving}>Annuler</button>
            <button type="submit" class="btn-submit" disabled={saving}>
              {saving ? 'Enregistrement...' : (editingType ? 'Mettre à jour' : 'Créer')}
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

  .type-name {
    display: flex;
    align-items: center;
  }

  .type-badge {
    display: inline-block;
    padding: 0.35rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border: 2px solid;
  }

  .short-badge {
    display: inline-block;
    background: rgba(100, 116, 139, 0.3);
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.8rem;
    font-family: monospace;
    color: #94a3b8;
  }

  .description-cell {
    max-width: 250px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #94a3b8;
  }

  .order-cell {
    text-align: center;
    font-weight: 600;
    color: #64748b;
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
  .form-group input[type="number"],
  .form-group textarea {
    width: 100%;
    background: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #e2e8f0;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    font-size: 0.9rem;
    box-sizing: border-box;
    font-family: inherit;
  }

  .form-group textarea {
    resize: vertical;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #22c55e;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
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

    .description-cell {
      max-width: 150px;
    }
  }
</style>
