<script lang="ts">
  import { onMount } from 'svelte';

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';

  const currentYear = new Date().getFullYear();

  interface Joueur {
    id: number;
    alias: string;
    nom: string;
    prenom: string;
  }

  interface Arbitre {
    id: number;
    joueurId: number;
    joueurAlias: string;
    code: string;
    dateDebut: string;
    dateFin: string | null;
    isActive: boolean;
    estActuellementActif: boolean;
  }

  let arbitres: Arbitre[] = [];
  let joueursInternes: Joueur[] = [];
  let isLoading = false;
  let loadError = '';

  // Filtres
  let filterActif: 'all' | 'actif' | 'inactif' = 'all';
  let searchQuery = '';

  // Tri
  type SortColumn = 'id' | 'joueurAlias' | 'dateDebut' | 'dateFin' | 'isActive';
  let sortColumn: SortColumn = 'joueurAlias';
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
    joueurAlias: sortColumn === 'joueurAlias' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    dateDebut: sortColumn === 'dateDebut' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    dateFin: sortColumn === 'dateFin' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    isActive: sortColumn === 'isActive' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
  };

  // Modal création/édition
  let showModal = false;
  let editingArbitre: Arbitre | null = null;
  let formData = {
    joueurId: 0,
    code: '',
    dateDebut: '',
    dateFin: '',
    isActive: true
  };
  let saving = false;
  let saveMessage = '';

  // Modal affichage code
  let showCodeModal = false;
  let displayedCode = '';
  let displayedAlias = '';

  $: filteredArbitres = arbitres
    .filter((a) => {
      // Filtre actif/inactif
      if (filterActif === 'actif' && !a.estActuellementActif) return false;
      if (filterActif === 'inactif' && a.estActuellementActif) return false;

      // Recherche texte
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!a.joueurAlias.toLowerCase().includes(q)) return false;
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
        case 'joueurAlias':
          aVal = a.joueurAlias.toLowerCase();
          bVal = b.joueurAlias.toLowerCase();
          break;
        case 'dateDebut':
          aVal = a.dateDebut;
          bVal = b.dateDebut;
          break;
        case 'dateFin':
          aVal = a.dateFin ?? '';
          bVal = b.dateFin ?? '';
          break;
        case 'isActive':
          aVal = a.estActuellementActif ? 1 : 0;
          bVal = b.estActuellementActif ? 1 : 0;
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
    loadData();
  });

  async function loadData() {
    isLoading = true;
    loadError = '';

    try {
      const [resArbitres, resJoueurs] = await Promise.all([
        fetch(`${API_BASE_URL}/api/arbitres`),
        fetch(`${API_BASE_URL}/api/admin/joueurs/internes`)
      ]);

      if (!resArbitres.ok || !resJoueurs.ok) {
        throw new Error('Erreur lors du chargement');
      }

      arbitres = await resArbitres.json();
      joueursInternes = await resJoueurs.json();
    } catch (err: any) {
      console.error(err);
      loadError = 'Impossible de charger les données.';
    } finally {
      isLoading = false;
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR');
  }

  function formatDateForInput(dateStr: string | null): string {
    if (!dateStr) return '';
    return dateStr.split('T')[0];
  }

  function openNewModal() {
    editingArbitre = null;
    const today = new Date().toISOString().split('T')[0];
    formData = {
      joueurId: joueursInternes[0]?.id ?? 0,
      code: '',
      dateDebut: today,
      dateFin: '',
      isActive: true
    };
    saveMessage = '';
    showModal = true;
  }

  function openEditModal(arbitre: Arbitre) {
    editingArbitre = arbitre;
    formData = {
      joueurId: arbitre.joueurId,
      code: arbitre.code,
      dateDebut: formatDateForInput(arbitre.dateDebut),
      dateFin: formatDateForInput(arbitre.dateFin),
      isActive: arbitre.isActive
    };
    saveMessage = '';
    showModal = true;
  }

  function closeModal() {
    showModal = false;
    editingArbitre = null;
    saveMessage = '';
  }

  function showCode(arbitre: Arbitre) {
    displayedCode = arbitre.code;
    displayedAlias = arbitre.joueurAlias;
    showCodeModal = true;
  }

  function closeCodeModal() {
    showCodeModal = false;
    displayedCode = '';
    displayedAlias = '';
  }

  async function saveArbitre() {
    if (!formData.joueurId) {
      saveMessage = 'Veuillez sélectionner un joueur.';
      return;
    }

    saving = true;
    saveMessage = '';

    try {
      if (editingArbitre) {
        // Mise à jour
        const res = await fetch(`${API_BASE_URL}/api/arbitres/${editingArbitre.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: formData.code || null,
            dateDebut: formData.dateDebut,
            dateFin: formData.dateFin || null,
            isActive: formData.isActive
          })
        });

        if (!res.ok) throw new Error('Erreur lors de la mise à jour');
        saveMessage = 'Arbitre mis à jour ✅';
      } else {
        // Création
        const res = await fetch(`${API_BASE_URL}/api/arbitres`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            joueurId: formData.joueurId,
            code: formData.code || null,
            dateDebut: formData.dateDebut,
            dateFin: formData.dateFin || null
          })
        });

        if (!res.ok) throw new Error('Erreur lors de la création');
        saveMessage = 'Arbitre créé ✅';
      }

      await loadData();
      setTimeout(closeModal, 1000);
    } catch (err: any) {
      console.error(err);
      saveMessage = 'Erreur ❌';
    } finally {
      saving = false;
    }
  }

  async function deleteArbitre(arbitre: Arbitre) {
    if (!confirm(`Désactiver l'arbitre "${arbitre.joueurAlias}" ?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/arbitres/${arbitre.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Erreur lors de la désactivation');

      await loadData();
    } catch (err: any) {
      console.error(err);
      alert('Erreur lors de la désactivation.');
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
  }
</script>

<svelte:head>
  <title>Administration – Arbitres</title>
</svelte:head>

<div class="admin-page">
  <h1>
    <a href="/admin" class="back-link">← Administration</a>
    <span class="sep">⟶</span> Gestion des arbitres
  </h1>

  <div class="admin-card">
    <!-- Filtres -->
    <div class="filters-row">
      <input
        type="text"
        class="search-input"
        placeholder="Rechercher un arbitre..."
        bind:value={searchQuery}
      />

      <select class="filter-select" bind:value={filterActif}>
        <option value="all">Tous</option>
        <option value="actif">Actifs uniquement</option>
        <option value="inactif">Inactifs</option>
      </select>

      <button class="btn-add" on:click={openNewModal}>
        + Nouvel arbitre
      </button>
    </div>

    <!-- Contenu -->
    {#if isLoading}
      <p>Chargement…</p>
    {:else if loadError}
      <p class="error">{loadError}</p>
    {:else if filteredArbitres.length === 0}
      <p>Aucun arbitre trouvé.</p>
    {:else}
      <!-- Vue desktop: tableau -->
      <div class="desktop-view">
        <table class="arbitres-table">
          <thead>
            <tr>
              <th class="sortable" on:click={() => toggleSort('id')}>ID <span class="sort-icon">{sortIcons.id}</span></th>
              <th class="sortable" on:click={() => toggleSort('joueurAlias')}>Joueur <span class="sort-icon">{sortIcons.joueurAlias}</span></th>
              <th>Code</th>
              <th class="sortable" on:click={() => toggleSort('dateDebut')}>Début <span class="sort-icon">{sortIcons.dateDebut}</span></th>
              <th class="sortable" on:click={() => toggleSort('dateFin')}>Fin <span class="sort-icon">{sortIcons.dateFin}</span></th>
              <th class="sortable center" on:click={() => toggleSort('isActive')}>Statut <span class="sort-icon">{sortIcons.isActive}</span></th>
              <th class="center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredArbitres as arbitre}
              <tr class:inactive={!arbitre.estActuellementActif}>
                <td>{arbitre.id}</td>
                <td class="alias-cell">{arbitre.joueurAlias}</td>
                <td>
                  <button class="btn-code" on:click={() => showCode(arbitre)} title="Voir le code">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Afficher
                  </button>
                </td>
                <td>{formatDate(arbitre.dateDebut)}</td>
                <td>{formatDate(arbitre.dateFin)}</td>
                <td class="center">
                  {#if arbitre.estActuellementActif}
                    <span class="badge-actif">✅ Actif</span>
                  {:else}
                    <span class="badge-inactif">❌ Inactif</span>
                  {/if}
                </td>
                <td class="center actions-cell">
                  <button class="btn-edit" on:click={() => openEditModal(arbitre)} title="Modifier">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                  {#if arbitre.isActive}
                    <button class="btn-deactivate" on:click={() => deleteArbitre(arbitre)} title="Désactiver">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" x2="19.07" y1="4.93" y2="19.07"/></svg>
                    </button>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Vue mobile: cartes -->
      <div class="mobile-view">
        <div class="mobile-cards">
          {#each filteredArbitres as arbitre}
            <div class="arbitre-card" class:inactive={!arbitre.estActuellementActif}>
              <div class="card-header">
                <span class="card-alias">{arbitre.joueurAlias}</span>
                <span class="card-id">#{arbitre.id}</span>
              </div>
              <div class="card-body">
                <div class="card-info">
                  <span class="card-label">Période:</span>
                  <span class="card-value">{formatDate(arbitre.dateDebut)} → {formatDate(arbitre.dateFin)}</span>
                </div>
                <div class="card-info">
                  <span class="card-label">Statut:</span>
                  {#if arbitre.estActuellementActif}
                    <span class="badge-actif">✅ Actif</span>
                  {:else}
                    <span class="badge-inactif">❌ Inactif</span>
                  {/if}
                </div>
              </div>
              <div class="card-actions">
                <button class="btn-code" on:click={() => showCode(arbitre)}>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  Code
                </button>
                <button class="btn-edit" on:click={() => openEditModal(arbitre)} title="Modifier">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                </button>
                {#if arbitre.isActive}
                  <button class="btn-deactivate" on:click={() => deleteArbitre(arbitre)} title="Désactiver">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" x2="19.07" y1="4.93" y2="19.07"/></svg>
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <footer class="copyright">
    © {currentYear} Wb-Scoring — Tous droits réservés
  </footer>
</div>

<!-- Modal création/édition -->
{#if showModal}
  <div class="modal-backdrop" on:click={closeModal} role="button" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && closeModal()}>
    <div class="modal" on:click|stopPropagation role="dialog">
      <h2>{editingArbitre ? 'Modifier l\'arbitre' : 'Nouvel arbitre'}</h2>
      {#if editingArbitre}
        <p class="modal-subtitle">⚖️ {editingArbitre.joueurAlias}</p>
      {/if}

      <div class="form-group">
        <label for="joueur">Joueur</label>
        {#if editingArbitre}
          <input type="text" value={editingArbitre.joueurAlias} disabled />
        {:else}
          <select id="joueur" bind:value={formData.joueurId}>
            {#each joueursInternes as joueur}
              <option value={joueur.id}>{joueur.alias} ({joueur.nom} {joueur.prenom})</option>
            {/each}
          </select>
        {/if}
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="dateDebut">Date début</label>
          <input type="date" id="dateDebut" bind:value={formData.dateDebut} />
        </div>
        <div class="form-group">
          <label for="dateFin">Date fin (optionnel)</label>
          <input type="date" id="dateFin" bind:value={formData.dateFin} />
        </div>
      </div>

      <div class="form-group">
        <label for="code">Code d'accès (laisser vide pour générer auto)</label>
        <input type="text" id="code" bind:value={formData.code} placeholder="ABC123" />
      </div>

      {#if editingArbitre}
        <div class="form-group checkbox-group">
          <label>
            <input type="checkbox" bind:checked={formData.isActive} />
            Arbitre actif
          </label>
        </div>
      {/if}

      {#if saveMessage}
        <p class={saveMessage.includes('✅') ? 'success' : 'error'}>{saveMessage}</p>
      {/if}

      <div class="modal-actions">
        <button class="btn-cancel" on:click={closeModal}>Annuler</button>
        <button class="btn-save" on:click={saveArbitre} disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal affichage code -->
{#if showCodeModal}
  <div class="modal-backdrop" on:click={closeCodeModal} role="button" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && closeCodeModal()}>
    <div class="modal code-modal" on:click|stopPropagation role="dialog">
      <h2>Code d'accès arbitre</h2>
      <p class="modal-subtitle">⚖️ {displayedAlias}</p>

      <div class="code-display">
        <span class="code-value">{displayedCode}</span>
        <button class="btn-copy" on:click={() => copyCode(displayedCode)} title="Copier">
          📋
        </button>
      </div>

      <p class="code-info">
        Ce code permet à l'arbitre d'attribuer des pénalités aux joueurs.
      </p>

      <div class="modal-actions">
        <button class="btn-save" on:click={closeCodeModal}>Fermer</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .admin-page {
    max-width: 1200px;
    margin: 2rem auto;
    padding: 1rem;
    color: #f1f5f9;
    min-height: calc(100vh - 80px);
    background: radial-gradient(circle at top, #125c2a 0%, #04140a 40%, #020506 100%);
    border-radius: 16px;
  }

  h1 {
    font-size: 1.6rem;
    margin-bottom: 1.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #f9fafb;
  }

  .back-link {
    color: #22c55e;
    text-decoration: none;
    font-weight: 500;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  .sep {
    color: #64748b;
    font-size: 1.2rem;
  }

  .admin-card {
    background: #020617;
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 16px;
    padding: 1.5rem;
    margin-bottom: 2rem;
  }

  .filters-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1rem;
    align-items: center;
  }

  .search-input {
    flex: 1;
    min-width: 200px;
    padding: 0.5rem 1rem;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.6);
    background: #020617;
    color: #f9fafb;
  }

  .filter-select {
    padding: 0.5rem 1rem;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.6);
    background: #020617;
    color: #f9fafb;
  }

  .btn-add {
    padding: 0.5rem 1rem;
    border-radius: 999px;
    border: none;
    background: #22c55e;
    color: #020617;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-add:hover {
    filter: brightness(1.1);
  }

  .arbitres-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
    font-size: 0.9rem;
  }

  .arbitres-table th,
  .arbitres-table td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid rgba(51, 65, 85, 0.9);
    text-align: left;
  }

  .arbitres-table th {
    background: linear-gradient(to bottom, #14532d, #052e16);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.78rem;
  }

  .arbitres-table th.sortable {
    cursor: pointer;
    user-select: none;
    transition: background 0.2s;
  }

  .arbitres-table th.sortable:hover {
    background: linear-gradient(to bottom, #166534, #14532d);
  }

  .sort-icon {
    font-size: 0.7rem;
    opacity: 0.7;
    margin-left: 0.3rem;
  }

  .arbitres-table tbody tr:nth-child(even) {
    background: #020b06;
  }

  .arbitres-table tbody tr:hover {
    background: #064e3b;
  }

  .arbitres-table tbody tr.inactive {
    opacity: 0.6;
  }

  .alias-cell {
    font-weight: 600;
    color: #22c55e;
  }

  .center {
    text-align: center;
  }

  .badge-actif {
    color: #22c55e;
    font-size: 0.85rem;
  }

  .badge-inactif {
    color: #ef4444;
    font-size: 0.85rem;
  }

  .actions-cell {
    display: flex;
    gap: 0.35rem;
    justify-content: center;
    align-items: center;
  }

  .btn-code {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.4rem 0.6rem;
    border-radius: 6px;
    border: 1px solid rgba(34, 197, 94, 0.5);
    background: transparent;
    color: #22c55e;
    cursor: pointer;
    font-size: 0.75rem;
    transition: all 0.15s ease;
  }

  .btn-code:hover {
    background: rgba(34, 197, 94, 0.1);
  }

  .btn-code svg {
    flex-shrink: 0;
  }

  .btn-edit {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.4rem;
    border-radius: 6px;
    border: 1px solid rgba(34, 197, 94, 0.5);
    background: transparent;
    color: #22c55e;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-edit:hover {
    background: rgba(34, 197, 94, 0.1);
  }

  .btn-edit svg {
    flex-shrink: 0;
  }

  .btn-deactivate {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.4rem;
    border-radius: 6px;
    border: 1px solid rgba(251, 146, 60, 0.5);
    background: transparent;
    color: #fb923c;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .btn-deactivate:hover {
    background: rgba(251, 146, 60, 0.1);
  }

  .btn-deactivate svg {
    flex-shrink: 0;
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    background: #020617;
    border: 1px solid rgba(34, 197, 94, 0.4);
    border-radius: 16px;
    padding: 1.5rem;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  }

  .modal h2 {
    margin: 0 0 0.25rem 0;
    color: #f9fafb;
  }

  .modal-subtitle {
    color: #22c55e;
    margin: 0 0 1rem 0;
    font-weight: 600;
  }

  .form-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .form-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin-bottom: 0.75rem;
  }

  .form-group label {
    font-size: 0.85rem;
    color: #9ca3af;
  }

  .form-group input[type='text'],
  .form-group input[type='date'],
  .form-group select {
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(75, 85, 99, 0.8);
    background: #020617;
    color: #e5e7eb;
  }

  .form-group input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .checkbox-group {
    flex-direction: row;
    align-items: center;
  }

  .checkbox-group label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .btn-cancel {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid rgba(75, 85, 99, 0.8);
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
  }

  .btn-save {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: none;
    background: #22c55e;
    color: #020617;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Code modal */
  .code-modal {
    text-align: center;
  }

  .code-display {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin: 1.5rem 0;
    padding: 1rem;
    background: rgba(34, 197, 94, 0.1);
    border: 2px dashed rgba(34, 197, 94, 0.5);
    border-radius: 12px;
  }

  .code-value {
    font-family: monospace;
    font-size: 2rem;
    font-weight: bold;
    color: #22c55e;
    letter-spacing: 0.2em;
  }

  .btn-copy {
    padding: 0.5rem;
    border-radius: 8px;
    border: 1px solid rgba(34, 197, 94, 0.5);
    background: transparent;
    cursor: pointer;
    font-size: 1.2rem;
  }

  .btn-copy:hover {
    background: rgba(34, 197, 94, 0.1);
  }

  .code-info {
    font-size: 0.85rem;
    color: #9ca3af;
    margin-bottom: 0;
  }

  .error {
    color: #f97373;
  }

  .success {
    color: #22c55e;
  }

  .copyright {
    position: fixed;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.8rem;
    color: #d9d9d9;
    opacity: 0.9;
    background: rgba(0, 0, 0, 0.8);
    padding: 4px 10px;
    border-radius: 10px;
    backdrop-filter: blur(4px);
    z-index: 9999;
  }

  /* Responsive */
  .desktop-view {
    display: block;
  }

  .mobile-view {
    display: none;
  }

  @media (max-width: 700px) {
    .desktop-view {
      display: none;
    }

    .mobile-view {
      display: block;
    }

    h1 {
      font-size: 1.2rem;
      flex-wrap: wrap;
    }

    .filters-row {
      flex-direction: column;
    }

    .search-input,
    .filter-select,
    .btn-add {
      width: 100%;
      box-sizing: border-box;
    }

    .admin-card {
      padding: 1rem;
    }

    .mobile-cards {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .arbitre-card {
      background: radial-gradient(circle at top, #125c2a 0%, #04140a 40%, #020506 100%);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 10px;
      padding: 0.75rem;
    }

    .arbitre-card.inactive {
      opacity: 0.6;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
      padding-bottom: 0.5rem;
      border-bottom: 1px solid rgba(51, 65, 85, 0.4);
    }

    .card-alias {
      font-size: 1rem;
      font-weight: 700;
      color: #22c55e;
    }

    .card-id {
      font-size: 0.7rem;
      color: #6b7280;
      background: rgba(75, 85, 99, 0.3);
      padding: 0.15rem 0.4rem;
      border-radius: 5px;
    }

    .card-body {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .card-info {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.85rem;
    }

    .card-label {
      color: #9ca3af;
    }

    .card-value {
      color: #e5e7eb;
    }

    .card-actions {
      margin-top: 0.75rem;
      display: flex;
      gap: 0.5rem;
      justify-content: flex-end;
    }

    .modal {
      max-width: 95%;
      padding: 1rem;
    }

    .form-row {
      flex-direction: column;
      gap: 0.5rem;
    }

    .code-value {
      font-size: 1.5rem;
    }
  }
</style>

