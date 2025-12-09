<script lang="ts">
  import { onMount } from 'svelte';

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';
  const currentYear = new Date().getFullYear();

  interface Annonce {
    code: string;
    label: string;
    templateResult: number;
    type: string;
    modeJeu: string;
    requirePartner: boolean;
    requirePlis: boolean;
    nbPlayers: number;
    requireArbitre: boolean;
    isActive: boolean;
    sortOrder: number;
  }

  let annonces: Annonce[] = [];
  let loading = true;
  let error = '';
  let successMessage = '';

  // Filtres
  let filterCode = '';
  let filterLabel = '';
  let filterType = '';
  let filterNbPlayers = '';
  let filterActif = '';

  // Tri
  let sortColumn = 'sortOrder';
  let sortAsc = true;

  // Modal
  let showModal = false;
  let editMode = false;
  let currentAnnonce: Annonce = {
    code: '',
    label: '',
    templateResult: 0,
    type: '',
    modeJeu: '',
    requirePartner: false,
    requirePlis: true,
    nbPlayers: 1,
    requireArbitre: false,
    isActive: true,
    sortOrder: 0
  };

  // Listes dynamiques extraites des données existantes
  $: uniqueTypes = [...new Set(annonces.map(a => a.type))].filter(t => t).sort();
  $: uniqueModeJeu = [...new Set(annonces.map(a => a.modeJeu))].filter(m => m).sort();

  // Annonces filtrées et triées
  $: filteredAnnonces = annonces
    .filter(a => {
      if (filterCode && !a.code.toLowerCase().includes(filterCode.toLowerCase())) return false;
      if (filterLabel && !a.label.toLowerCase().includes(filterLabel.toLowerCase())) return false;
      if (filterType && a.type !== filterType) return false;
      if (filterNbPlayers && a.nbPlayers !== parseInt(filterNbPlayers)) return false;
      if (filterActif === 'actif' && !a.isActive) return false;
      if (filterActif === 'inactif' && a.isActive) return false;
      return true;
    })
    .sort((a, b) => {
      let valA: any, valB: any;
      switch (sortColumn) {
        case 'sortOrder': valA = a.sortOrder; valB = b.sortOrder; break;
        case 'code': valA = a.code.toLowerCase(); valB = b.code.toLowerCase(); break;
        case 'label': valA = a.label.toLowerCase(); valB = b.label.toLowerCase(); break;
        case 'type': valA = a.type; valB = b.type; break;
        case 'nbPlayers': valA = a.nbPlayers; valB = b.nbPlayers; break;
        case 'isActive': valA = a.isActive ? 1 : 0; valB = b.isActive ? 1 : 0; break;
        default: valA = a.sortOrder; valB = b.sortOrder;
      }
      if (valA < valB) return sortAsc ? -1 : 1;
      if (valA > valB) return sortAsc ? 1 : -1;
      return 0;
    });

  function sortBy(column: string) {
    if (sortColumn === column) {
      sortAsc = !sortAsc;
    } else {
      sortColumn = column;
      sortAsc = true;
    }
  }

  function resetFilters() {
    filterCode = '';
    filterLabel = '';
    filterType = '';
    filterNbPlayers = '';
    filterActif = '';
    sortColumn = 'sortOrder';
    sortAsc = true;
  }

  // Les modes de jeu sont chargés dynamiquement depuis les données

  async function loadAnnonces() {
    loading = true;
    error = '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/annonces-ref`);
      if (res.ok) {
        annonces = await res.json();
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
    currentAnnonce = {
      code: '',
      label: '',
      templateResult: 0,
      type: uniqueTypes[0] || '',
      modeJeu: uniqueModeJeu[0] || '',
      requirePartner: false,
      requirePlis: true,
      nbPlayers: 1,
      requireArbitre: false,
      isActive: true,
      sortOrder: annonces.length > 0 ? Math.max(...annonces.map(a => a.sortOrder)) + 10 : 10
    };
    showModal = true;
  }

  function openEdit(annonce: Annonce) {
    editMode = true;
    currentAnnonce = { ...annonce };
    showModal = true;
  }

  async function saveAnnonce() {
    error = '';
    successMessage = '';
    try {
      const url = editMode 
        ? `${API_BASE_URL}/api/config/annonces-ref/${currentAnnonce.code}`
        : `${API_BASE_URL}/api/config/annonces-ref`;
      
      const res = await fetch(url, {
        method: editMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentAnnonce)
      });

      if (res.ok) {
        showModal = false;
        successMessage = editMode ? 'Annonce modifiée' : 'Annonce créée';
        setTimeout(() => successMessage = '', 3000);
        await loadAnnonces();
      } else {
        error = 'Erreur lors de la sauvegarde';
      }
    } catch (err) {
      error = 'Impossible de contacter le serveur';
    }
  }

  async function deleteAnnonce(code: string) {
    if (!confirm(`Supprimer l'annonce "${code}" ?\n\nAttention: cela peut affecter les données de scoring existantes.`)) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/annonces-ref/${code}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        successMessage = 'Annonce supprimée';
        setTimeout(() => successMessage = '', 3000);
        await loadAnnonces();
      } else {
        error = 'Erreur lors de la suppression';
      }
    } catch (err) {
      error = 'Impossible de contacter le serveur';
    }
  }

  // --- Drag & Drop pour réorganiser l'ordre ---
  let draggedIndex: number | null = null;
  let dragOverIndex: number | null = null;
  let isSavingOrder = false;

  // Le drag & drop ne fonctionne que si on est trié par sortOrder (ordre naturel)
  $: canDragDrop = sortColumn === 'sortOrder' && sortAsc && !filterCode && !filterLabel && !filterType && !filterNbPlayers && !filterActif;

  function handleDragStart(e: DragEvent, index: number) {
    if (!canDragDrop) return;
    draggedIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', index.toString());
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    if (!canDragDrop || draggedIndex === null) return;
    e.preventDefault();
    dragOverIndex = index;
  }

  function handleDragLeave() {
    dragOverIndex = null;
  }

  function handleDrop(e: DragEvent, targetIndex: number) {
    e.preventDefault();
    if (!canDragDrop || draggedIndex === null || draggedIndex === targetIndex) {
      draggedIndex = null;
      dragOverIndex = null;
      return;
    }

    // Réorganiser le tableau
    const items = [...filteredAnnonces];
    const [draggedItem] = items.splice(draggedIndex, 1);
    items.splice(targetIndex, 0, draggedItem);

    // Mettre à jour les sortOrder
    items.forEach((item, i) => {
      item.sortOrder = (i + 1) * 10;
    });

    // Appliquer à annonces (liste principale)
    annonces = items;

    draggedIndex = null;
    dragOverIndex = null;

    // Sauvegarder l'ordre
    saveOrder();
  }

  function handleDragEnd() {
    draggedIndex = null;
    dragOverIndex = null;
  }

  async function saveOrder() {
    if (isSavingOrder) return;
    isSavingOrder = true;
    error = '';

    try {
      // Préparer les données : liste des codes avec leur nouvel ordre
      const orderData = annonces.map(a => ({
        code: a.code,
        sortOrder: a.sortOrder
      }));

      const res = await fetch(`${API_BASE_URL}/api/config/annonces-ref/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData)
      });

      if (res.ok) {
        successMessage = 'Ordre sauvegardé';
        setTimeout(() => successMessage = '', 2000);
      } else {
        error = 'Erreur lors de la sauvegarde de l\'ordre';
        await loadAnnonces(); // Recharger en cas d'erreur
      }
    } catch (err) {
      error = 'Impossible de sauvegarder l\'ordre';
      await loadAnnonces();
    } finally {
      isSavingOrder = false;
    }
  }

  onMount(loadAnnonces);
</script>

<svelte:head>
  <title>Annonces - Admin</title>
</svelte:head>

<div class="admin-container">
  <header class="admin-header">
    <a href="/admin/config" class="back-btn">← Retour</a>
    <h1>
      <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 01-3.46 0"/>
      </svg>
      Annonces de référence
    </h1>
  </header>

  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  {#if successMessage}
    <div class="success-message">{successMessage}</div>
  {/if}

  <div class="actions-bar">
    <p class="hint">Types d'annonces disponibles dans le jeu (Solo, Misère, Abondance...).</p>
    <button class="btn-create" on:click={openCreate}>+ Nouvelle annonce</button>
  </div>

  {#if loading}
    <div class="loading">Chargement...</div>
  {:else if annonces.length === 0}
    <div class="empty-state">Aucune annonce configurée</div>
  {:else}
    <!-- Filtres -->
    <div class="filters-bar">
      <div class="filter-group">
        <label for="filterCode">Code</label>
        <input id="filterCode" type="text" bind:value={filterCode} placeholder="Filtrer..." />
      </div>
      <div class="filter-group">
        <label for="filterLabel">Libellé</label>
        <input id="filterLabel" type="text" bind:value={filterLabel} placeholder="Filtrer..." />
      </div>
      <div class="filter-group">
        <label for="filterType">Type</label>
        <select id="filterType" bind:value={filterType}>
          <option value="">Tous</option>
          {#each uniqueTypes as t}
            <option value={t}>{t}</option>
          {/each}
        </select>
      </div>
      <div class="filter-group">
        <label for="filterNbPlayers">Joueurs</label>
        <select id="filterNbPlayers" bind:value={filterNbPlayers}>
          <option value="">Tous</option>
          <option value="1">1</option>
          <option value="2">2</option>
        </select>
      </div>
      <div class="filter-group">
        <label for="filterActif">Statut</label>
        <select id="filterActif" bind:value={filterActif}>
          <option value="">Tous</option>
          <option value="actif">Actif</option>
          <option value="inactif">Inactif</option>
        </select>
      </div>
      <button class="btn-reset-filters" on:click={resetFilters} title="Réinitialiser les filtres">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
          <path d="M3 3v5h5"/>
        </svg>
        Reset
      </button>
    </div>

    <div class="results-info">
      <div class="results-count">{filteredAnnonces.length} annonce{filteredAnnonces.length > 1 ? 's' : ''} sur {annonces.length}</div>
      {#if canDragDrop}
        <div class="drag-hint">
          <span class="drag-icon">⠿</span> Glissez les lignes pour réorganiser l'ordre
        </div>
      {:else if filterCode || filterLabel || filterType || filterNbPlayers || filterActif}
        <div class="drag-disabled-hint">
          Désactivez les filtres pour réorganiser l'ordre
        </div>
      {:else if sortColumn !== 'sortOrder' || !sortAsc}
        <div class="drag-disabled-hint">
          Triez par "Ordre ▲" pour réorganiser
        </div>
      {/if}
    </div>

    <div class="annonces-table-container">
      <table class="annonces-table">
        <thead>
          <tr>
            <th class="sortable" class:sorted={sortColumn === 'sortOrder'} on:click={() => sortBy('sortOrder')}>
              Ordre {sortColumn === 'sortOrder' ? (sortAsc ? '▲' : '▼') : ''}
            </th>
            <th class="sortable" class:sorted={sortColumn === 'code'} on:click={() => sortBy('code')}>
              Code {sortColumn === 'code' ? (sortAsc ? '▲' : '▼') : ''}
            </th>
            <th class="sortable" class:sorted={sortColumn === 'label'} on:click={() => sortBy('label')}>
              Libellé {sortColumn === 'label' ? (sortAsc ? '▲' : '▼') : ''}
            </th>
            <th class="sortable" class:sorted={sortColumn === 'type'} on:click={() => sortBy('type')}>
              Type {sortColumn === 'type' ? (sortAsc ? '▲' : '▼') : ''}
            </th>
            <th class="sortable" class:sorted={sortColumn === 'nbPlayers'} on:click={() => sortBy('nbPlayers')}>
              Joueurs {sortColumn === 'nbPlayers' ? (sortAsc ? '▲' : '▼') : ''}
            </th>
            <th>Partenaire</th>
            <th>Plis</th>
            <th>Arbitre</th>
            <th class="sortable" class:sorted={sortColumn === 'isActive'} on:click={() => sortBy('isActive')}>
              Actif {sortColumn === 'isActive' ? (sortAsc ? '▲' : '▼') : ''}
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredAnnonces as annonce, idx}
            <tr 
              class:inactive={!annonce.isActive} 
              class:row-even={idx % 2 === 0} 
              class:row-odd={idx % 2 !== 0}
              class:dragging={draggedIndex === idx}
              class:drag-over={dragOverIndex === idx}
              draggable={canDragDrop}
              on:dragstart={(e) => handleDragStart(e, idx)}
              on:dragover={(e) => handleDragOver(e, idx)}
              on:dragleave={handleDragLeave}
              on:drop={(e) => handleDrop(e, idx)}
              on:dragend={handleDragEnd}
            >
              <td class="order-cell">
                {#if canDragDrop}
                  <span class="drag-handle" title="Glisser pour réorganiser">⠿</span>
                {/if}
                {annonce.sortOrder}
              </td>
              <td><code class="code-badge">{annonce.code}</code></td>
              <td class="label-cell">{annonce.label}</td>
              <td><span class="type-badge" data-type={annonce.type}>{annonce.type}</span></td>
              <td class="center-cell">{annonce.nbPlayers}</td>
              <td class="center-cell">{annonce.requirePartner ? '✓' : '-'}</td>
              <td class="center-cell">{annonce.requirePlis ? '✓' : '-'}</td>
              <td class="arbitre-cell">{annonce.requireArbitre ? '⚖️' : '-'}</td>
              <td class="center-cell">
                <span class="status-dot" class:active={annonce.isActive}></span>
              </td>
              <td class="actions-cell">
                <button class="btn-icon edit" on:click={() => openEdit(annonce)} title="Modifier">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="btn-icon delete" on:click={() => deleteAnnonce(annonce.code)} title="Supprimer">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}

  <!-- Modal -->
  {#if showModal}
    <div class="modal-overlay" on:click={() => showModal = false} on:keydown={(e) => e.key === 'Escape' && (showModal = false)} role="button" tabindex="0">
      <div class="modal" on:click|stopPropagation role="dialog" aria-modal="true">
        <h2>{editMode ? 'Modifier l\'annonce' : 'Nouvelle annonce'}</h2>
        <form on:submit|preventDefault={saveAnnonce}>
          <div class="form-row">
            <div class="form-group">
              <label for="code">Code</label>
              <input 
                id="code" 
                type="text" 
                bind:value={currentAnnonce.code} 
                required 
                disabled={editMode}
                placeholder="Ex: SOLO"
                maxlength="50"
              />
            </div>
            <div class="form-group">
              <label for="label">Libellé</label>
              <input id="label" type="text" bind:value={currentAnnonce.label} required placeholder="Ex: Solo" />
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="type">Type</label>
              <select id="type" bind:value={currentAnnonce.type}>
                {#each uniqueTypes as t}
                  <option value={t}>{t}</option>
                {/each}
              </select>
            </div>
            <div class="form-group">
              <label for="modeJeu">Mode de jeu</label>
              <select id="modeJeu" bind:value={currentAnnonce.modeJeu}>
                {#each uniqueModeJeu as m}
                  <option value={m}>{m}</option>
                {/each}
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="nbPlayers">Nombre de joueurs</label>
              <input id="nbPlayers" type="number" bind:value={currentAnnonce.nbPlayers} min="1" max="4" />
            </div>
            <div class="form-group">
              <label for="sortOrder">Ordre d'affichage</label>
              <input id="sortOrder" type="number" bind:value={currentAnnonce.sortOrder} min="0" />
            </div>
          </div>

          <div class="form-group">
            <label for="templateResult">Template résultat (code)</label>
            <input id="templateResult" type="number" bind:value={currentAnnonce.templateResult} min="0" />
          </div>

          <div class="checkboxes-row">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={currentAnnonce.requirePartner} />
              Nécessite partenaire
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={currentAnnonce.requirePlis} />
              Nécessite plis
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={currentAnnonce.requireArbitre} />
              ⚖️ Appel arbitre
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={currentAnnonce.isActive} />
              Actif
            </label>
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
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .title-icon {
    width: 28px;
    height: 28px;
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

  /* Filtres */
  .filters-bar {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: flex-end;
    margin-bottom: 1rem;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 8px;
    border: 1px solid rgba(34, 197, 94, 0.15);
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .filter-group label {
    font-size: 0.7rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .filter-group input,
  .filter-group select {
    background: #020617;
    border: 1px solid rgba(34, 197, 94, 0.3);
    color: #e2e8f0;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    font-size: 0.8rem;
    min-width: 100px;
  }

  .filter-group input:focus,
  .filter-group select:focus {
    outline: none;
    border-color: #22c55e;
  }

  .btn-reset-filters {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    background: transparent;
    border: 1px solid rgba(100, 116, 139, 0.5);
    color: #94a3b8;
    padding: 0.4rem 0.75rem;
    border-radius: 6px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-reset-filters:hover {
    border-color: #22c55e;
    color: #22c55e;
  }

  .results-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .results-count {
    font-size: 0.8rem;
    color: #64748b;
  }

  .drag-hint {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
    color: #22c55e;
    background: rgba(34, 197, 94, 0.1);
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .drag-hint .drag-icon {
    font-size: 1rem;
  }

  .drag-disabled-hint {
    font-size: 0.75rem;
    color: #94a3b8;
    font-style: italic;
  }

  .annonces-table-container {
    overflow-x: auto;
  }

  .annonces-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  .annonces-table th,
  .annonces-table td {
    padding: 0.75rem 0.5rem;
    text-align: center;
    border-bottom: 1px solid rgba(34, 197, 94, 0.1);
  }

  .annonces-table th {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    font-weight: 500;
    font-size: 0.8rem;
  }

  .annonces-table th.sortable {
    cursor: pointer;
    user-select: none;
    transition: background 0.2s;
  }

  .annonces-table th.sortable:hover {
    background: rgba(34, 197, 94, 0.2);
  }

  .annonces-table th.sorted {
    background: rgba(34, 197, 94, 0.25);
  }

  .annonces-table tbody tr:hover {
    background: rgba(34, 197, 94, 0.05);
  }

  .annonces-table tbody tr.row-even {
    background: rgba(0, 0, 0, 0.2);
  }

  .annonces-table tbody tr.row-odd {
    background: rgba(0, 0, 0, 0.1);
  }

  .annonces-table tbody tr.row-even:hover,
  .annonces-table tbody tr.row-odd:hover {
    background: rgba(34, 197, 94, 0.1);
  }

  .annonces-table tr.inactive {
    opacity: 0.5;
  }

  /* Drag & Drop styles */
  .annonces-table tbody tr[draggable="true"] {
    cursor: grab;
  }

  .annonces-table tbody tr[draggable="true"]:active {
    cursor: grabbing;
  }

  .annonces-table tbody tr.dragging {
    opacity: 0.4;
    background: rgba(34, 197, 94, 0.2);
  }

  .annonces-table tbody tr.drag-over {
    border-top: 3px solid #22c55e;
    background: rgba(34, 197, 94, 0.15);
  }

  .drag-handle {
    display: inline-block;
    margin-right: 0.4rem;
    color: #64748b;
    cursor: grab;
    font-size: 1rem;
    vertical-align: middle;
  }

  .drag-handle:hover {
    color: #22c55e;
  }

  .order-cell {
    color: #64748b;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .label-cell {
    text-align: left;
    font-weight: 500;
  }

  code {
    background: rgba(34, 197, 94, 0.1);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.8rem;
  }

  .code-badge {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-weight: 700;
    font-size: 0.75rem;
    background: rgba(34, 197, 94, 0.3);
    color: #86efac;
    border: 1px solid rgba(34, 197, 94, 0.5);
  }

  .type-badge {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.7rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  /* Couleurs par type */
  .type-badge[data-type="SOLO"] {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.4);
  }
  .type-badge[data-type="MISERE"],
  .type-badge[data-type="GRANDEMISERE"] {
    background: rgba(168, 85, 247, 0.2);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.4);
  }
  .type-badge[data-type="ABONDANCE"],
  .type-badge[data-type="PETITCHELEM"],
  .type-badge[data-type="GRANDCHELEM"] {
    background: rgba(249, 115, 22, 0.2);
    color: #fb923c;
    border: 1px solid rgba(249, 115, 22, 0.4);
  }
  .type-badge[data-type="STANDARD"] {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.4);
  }

  .center-cell {
    text-align: center;
  }

  .arbitre-cell {
    font-size: 1rem;
  }

  .status-dot {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #4b5563;
  }

  .status-dot.active {
    background: #22c55e;
  }

  .actions-cell {
    display: flex;
    gap: 0.25rem;
    justify-content: center;
  }

  .btn-icon {
    background: transparent;
    border: none;
    cursor: pointer;
    padding: 0.35rem;
    opacity: 0.7;
    transition: opacity 0.2s, color 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .btn-icon svg {
    width: 16px;
    height: 16px;
  }

  .btn-icon.edit {
    color: #60a5fa;
  }

  .btn-icon.edit:hover {
    opacity: 1;
    color: #93c5fd;
  }

  .btn-icon.delete {
    color: #f87171;
  }

  .btn-icon.delete:hover {
    opacity: 1;
    color: #fca5a5;
  }

  /* Modal */
  .modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.85);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    z-index: 100;
    overflow: hidden;
  }

  .modal {
    background: #0f172a;
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 16px;
    padding: 1.5rem;
    max-width: 550px;
    width: 100%;
    max-height: 85vh;
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: rgba(34, 197, 94, 0.4) transparent;
  }

  .modal::-webkit-scrollbar {
    width: 6px;
  }

  .modal::-webkit-scrollbar-track {
    background: transparent;
  }

  .modal::-webkit-scrollbar-thumb {
    background: rgba(34, 197, 94, 0.4);
    border-radius: 3px;
  }

  .modal h2 {
    color: #22c55e;
    margin: 0 0 1.5rem 0;
  }

  .form-group {
    display: flex;
    flex-direction: column;
  }

  .form-row + .form-group {
    margin-bottom: 0.75rem;
  }

  .form-group label {
    color: #94a3b8;
    font-size: 0.85rem;
    margin-bottom: 0.3rem;
    white-space: nowrap;
  }

  .form-group input,
  .form-group select {
    width: 100%;
    background: #020617;
    color: #e2e8f0;
    border: 1px solid rgba(34, 197, 94, 0.3);
    padding: 0.6rem 0.8rem;
    border-radius: 8px;
    box-sizing: border-box;
  }

  .form-group input:focus,
  .form-group select:focus {
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
    margin-bottom: 0.75rem;
  }

  .checkboxes-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
    margin: 1rem 0;
    padding: 0.75rem;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 8px;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #e2e8f0;
    cursor: pointer;
    font-size: 0.9rem;
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

  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
    }

    .annonces-table {
      font-size: 0.75rem;
    }

    .annonces-table th,
    .annonces-table td {
      padding: 0.5rem 0.25rem;
    }
  }
</style>
