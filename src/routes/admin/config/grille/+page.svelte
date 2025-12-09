<script lang="ts">
  import { onMount } from 'svelte';

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';
  const currentYear = new Date().getFullYear();

  interface GrilleResultat {
    id: number;
    code: string;
    annonceLabel: string;
    kind: string;
    nbJoueursDedans: number;
    plisFaits: number | null;
    etat: string | null;
    resultatInd: number;
    resultatJeu: number;
  }

  let grille: GrilleResultat[] = [];
  let loading = true;
  let error = '';
  let successMessage = '';

  // Filters
  let filterKind: string = '';
  let filterNbJoueurs: string = '';
  let filterEtat: string = '';
  let filterCode: string = '';
  let filterAnnonce: string = '';

  // Sorting
  type SortKey = 'code' | 'annonceLabel' | 'kind' | 'nbJoueursDedans' | 'plisFaits' | 'etat' | 'resultatInd' | 'resultatJeu';
  let sortKey: SortKey | '' = '';
  let sortAsc = true;

  // Dynamic filter options derived from data
  $: kindValues = [...new Set(grille.map(e => e.kind))].filter(Boolean).sort();
  $: etatValues = [...new Set(grille.map(e => e.etat).filter((e): e is string => e !== null))].sort();
  $: nbJoueursValues = [...new Set(grille.map(e => e.nbJoueursDedans))].sort((a, b) => a - b);

  // Labels for display
  const kindLabels: Record<string, string> = {
    'plis': 'Par plis',
    'etat': 'Par état'
  };

  const etatLabels: Record<string, string> = {
    'Réussi': 'Réussi',
    'Raté': 'Raté',
    'RéussiRaté': 'Réussi/Raté',
    'Capot': 'Capot'
  };

  // Modal
  let showModal = false;
  let editMode = false;
  let currentEntry: Partial<GrilleResultat> & { code: string; kind: string; nbJoueursDedans: number; resultatInd: number; resultatJeu: number } = getEmptyEntry();

  function getEmptyEntry() {
    return {
      id: 0,
      code: '',
      annonceLabel: '',
      kind: 'plis',
      nbJoueursDedans: 1,
      plisFaits: 0,
      etat: 'Réussi',
      resultatInd: 0,
      resultatJeu: 0
    };
  }

  function generateCode(entry: typeof currentEntry): string {
    const kindPrefix = entry.kind === 'plis' ? 'P' : 'E';
    const etatSuffix = entry.etat ? entry.etat.charAt(0).toUpperCase() : '';
    return `${kindPrefix}${entry.nbJoueursDedans}_${entry.plisFaits ?? 0}${etatSuffix}`;
  }

  async function loadGrille() {
    loading = true;
    error = '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/grille-ref`);
      if (res.ok) {
        grille = await res.json();
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
    currentEntry = getEmptyEntry();
    showModal = true;
  }

  function openEdit(entry: GrilleResultat) {
    editMode = true;
    currentEntry = { ...entry };
    showModal = true;
  }

  async function saveEntry() {
    error = '';
    successMessage = '';

    // Auto-generate code
    if (!editMode) {
      currentEntry.code = generateCode(currentEntry);
    }

    try {
      const url = editMode 
        ? `${API_BASE_URL}/api/config/grille-ref/${currentEntry.id}`
        : `${API_BASE_URL}/api/config/grille-ref`;
      
      const res = await fetch(url, {
        method: editMode ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentEntry)
      });

      if (res.ok) {
        showModal = false;
        successMessage = editMode ? 'Entrée modifiée' : 'Entrée créée';
        setTimeout(() => successMessage = '', 3000);
        await loadGrille();
      } else {
        error = 'Erreur lors de la sauvegarde';
      }
    } catch (err) {
      error = 'Impossible de contacter le serveur';
    }
  }

  async function deleteEntry(id: number) {
    if (!confirm(`Supprimer cette entrée de la grille ?\n\nAttention: cela peut affecter le scoring existant.`)) return;
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/grille-ref/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        successMessage = 'Entrée supprimée';
        setTimeout(() => successMessage = '', 3000);
        await loadGrille();
      } else {
        error = 'Erreur lors de la suppression';
      }
    } catch (err) {
      error = 'Impossible de contacter le serveur';
    }
  }

  // Sorting function
  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      sortAsc = !sortAsc;
    } else {
      sortKey = key;
      sortAsc = true;
    }
  }

  function getSortIcon(key: SortKey): string {
    if (sortKey !== key) return '↕';
    return sortAsc ? '↑' : '↓';
  }

  $: filteredGrille = grille
    .filter(entry => {
      if (filterKind !== '' && entry.kind !== filterKind) return false;
      if (filterNbJoueurs !== '' && entry.nbJoueursDedans !== parseInt(filterNbJoueurs)) return false;
      if (filterEtat !== '' && entry.etat !== filterEtat) return false;
      if (filterCode !== '' && !entry.code.toLowerCase().includes(filterCode.toLowerCase())) return false;
      if (filterAnnonce !== '' && !entry.annonceLabel.toLowerCase().includes(filterAnnonce.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => {
      if (!sortKey) return 0;
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (aVal === null || aVal === undefined) return 1;
      if (bVal === null || bVal === undefined) return -1;
      let cmp = 0;
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        cmp = aVal - bVal;
      } else {
        cmp = String(aVal).localeCompare(String(bVal));
      }
      return sortAsc ? cmp : -cmp;
    });

  onMount(loadGrille);
</script>

<svelte:head>
  <title>Grille de résultats - Admin</title>
</svelte:head>

<div class="admin-container">
  <header class="admin-header">
    <a href="/admin/config" class="back-btn">← Retour</a>
    <h1>
      <svg class="title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <path d="M3 9h18"/>
        <path d="M3 15h18"/>
        <path d="M9 3v18"/>
        <path d="M15 3v18"/>
      </svg>
      Grille de résultats
    </h1>
  </header>

  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  {#if successMessage}
    <div class="success-message">{successMessage}</div>
  {/if}

  <div class="actions-bar">
    <div class="filters">
      <input 
        type="text" 
        placeholder="Rechercher code..." 
        bind:value={filterCode}
        class="filter-input"
      />
      <input 
        type="text" 
        placeholder="Rechercher annonce..." 
        bind:value={filterAnnonce}
        class="filter-input"
      />
      <select bind:value={filterKind}>
        <option value="">Tous les types</option>
        {#each kindValues as val}
          <option value={val}>{kindLabels[val] || val}</option>
        {/each}
      </select>
      <select bind:value={filterNbJoueurs}>
        <option value="">Tous nb joueurs</option>
        {#each nbJoueursValues as val}
          <option value={val}>{val} joueur{val > 1 ? 's' : ''}</option>
        {/each}
      </select>
      <select bind:value={filterEtat}>
        <option value="">Tous états</option>
        {#each etatValues as val}
          <option value={val}>{etatLabels[val] || val}</option>
        {/each}
      </select>
    </div>
    <button class="btn-create" on:click={openCreate}>+ Nouvelle entrée</button>
  </div>

  <p class="hint">Barème de points selon le nombre de plis faits et l'état (réussi/raté). Cliquez sur les en-têtes pour trier.</p>

  {#if loading}
    <div class="loading">Chargement...</div>
  {:else if filteredGrille.length === 0}
    <div class="empty-state">Aucune entrée dans la grille</div>
  {:else}
    <div class="grille-table-container">
      <table class="grille-table">
        <thead>
          <tr>
            <th class="sortable" on:click={() => toggleSort('code')}>
              Code <span class="sort-icon">{getSortIcon('code')}</span>
            </th>
            <th class="sortable" on:click={() => toggleSort('annonceLabel')}>
              Annonce <span class="sort-icon">{getSortIcon('annonceLabel')}</span>
            </th>
            <th class="sortable" on:click={() => toggleSort('kind')}>
              Type <span class="sort-icon">{getSortIcon('kind')}</span>
            </th>
            <th class="sortable" on:click={() => toggleSort('nbJoueursDedans')}>
              Joueurs <span class="sort-icon">{getSortIcon('nbJoueursDedans')}</span>
            </th>
            <th class="sortable" on:click={() => toggleSort('plisFaits')}>
              Plis <span class="sort-icon">{getSortIcon('plisFaits')}</span>
            </th>
            <th class="sortable" on:click={() => toggleSort('etat')}>
              État <span class="sort-icon">{getSortIcon('etat')}</span>
            </th>
            <th class="points-col sortable" on:click={() => toggleSort('resultatInd')}>
              Pts Ind. <span class="sort-icon">{getSortIcon('resultatInd')}</span>
            </th>
            <th class="points-col sortable" on:click={() => toggleSort('resultatJeu')}>
              Pts Jeu <span class="sort-icon">{getSortIcon('resultatJeu')}</span>
            </th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredGrille as entry}
            <tr class:success={entry.etat === 'Réussi' || entry.etat === 'RéussiRaté'} class:failure={entry.etat === 'Raté' || entry.etat === 'Capot'}>
              <td><code>{entry.code}</code></td>
              <td class="type-cell">{entry.annonceLabel || '-'}</td>
              <td>{kindLabels[entry.kind] || entry.kind}</td>
              <td>{entry.nbJoueursDedans}</td>
              <td class="plis-cell">{entry.plisFaits ?? '-'}</td>
              <td>
                <span class="etat-badge" 
                      class:reussi={entry.etat === 'Réussi'} 
                      class:echoue={entry.etat === 'Raté'}
                      class:mixte={entry.etat === 'RéussiRaté'}
                      class:capot={entry.etat === 'Capot'}>
                  {etatLabels[entry.etat ?? ''] || entry.etat || '-'}
                </span>
              </td>
              <td class="points-cell">{entry.resultatInd > 0 ? '+' : ''}{entry.resultatInd}</td>
              <td class="points-cell">{entry.resultatJeu > 0 ? '+' : ''}{entry.resultatJeu}</td>
              <td class="actions-cell">
                <button class="btn-icon edit" on:click={() => openEdit(entry)} title="Modifier">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
                <button class="btn-icon delete" on:click={() => deleteEntry(entry.id)} title="Supprimer">
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
    <p class="table-info">Affichage: {filteredGrille.length} sur {grille.length} entrées</p>
  {/if}

  <!-- Modal -->
  {#if showModal}
    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
    <div class="modal-overlay" on:click={() => showModal = false} role="presentation">
      <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
      <div class="modal" on:click|stopPropagation>
        <h2>{editMode ? 'Modifier l\'entrée' : 'Nouvelle entrée'}</h2>
        <form on:submit|preventDefault={saveEntry}>
          {#if editMode}
            <div class="form-group">
              <label for="code">Code</label>
              <input id="code" type="text" value={currentEntry.code} disabled />
            </div>
          {/if}

          <div class="form-group">
            <label for="annonceLabel">Libellé de l'annonce</label>
            <input id="annonceLabel" type="text" bind:value={currentEntry.annonceLabel} placeholder="Ex: Emballage 9 plis" />
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="kind">Type de contrat</label>
              <select id="kind" bind:value={currentEntry.kind}>
                <option value="plis">Par plis</option>
                <option value="etat">Par état</option>
              </select>
            </div>
            <div class="form-group">
              <label for="nbJoueurs">Nb joueurs dedans</label>
              <select id="nbJoueurs" bind:value={currentEntry.nbJoueursDedans}>
                <option value={1}>1 joueur</option>
                <option value={2}>2 joueurs</option>
              </select>
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="plisFaits">Plis faits</label>
              <input id="plisFaits" type="number" bind:value={currentEntry.plisFaits} min="0" max="13" />
            </div>
            <div class="form-group">
              <label for="etat">État</label>
              <select id="etat" bind:value={currentEntry.etat}>
                <option value="">- Aucun -</option>
                <option value="Réussi">Réussi</option>
                <option value="Raté">Raté</option>
                <option value="RéussiRaté">Réussi/Raté</option>
                <option value="Capot">Capot</option>
              </select>
            </div>
          </div>

          <div class="points-section">
            <h3>Points attribués</h3>
            <div class="form-row">
              <div class="form-group">
                <label for="resultatInd">Points individuels</label>
                <input id="resultatInd" type="number" bind:value={currentEntry.resultatInd} />
              </div>
              <div class="form-group">
                <label for="resultatJeu">Points jeu</label>
                <input id="resultatJeu" type="number" bind:value={currentEntry.resultatJeu} />
              </div>
            </div>
          </div>

          {#if !editMode}
            <p class="code-preview">
              Code généré : <code>{generateCode(currentEntry)}</code>
            </p>
          {/if}

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
    stroke: #22c55e;
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
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .filters {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .filters select,
  .filter-input {
    background: #0f172a;
    color: #e2e8f0;
    border: 1px solid rgba(34, 197, 94, 0.3);
    padding: 0.5rem;
    border-radius: 8px;
    font-size: 0.85rem;
  }

  .filter-input {
    width: 140px;
  }

  .filter-input::placeholder {
    color: #64748b;
  }

  .hint {
    color: #64748b;
    font-size: 0.85rem;
    margin: 0 0 1rem 0;
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

  .grille-table-container {
    overflow-x: auto;
  }

  .grille-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .grille-table th,
  .grille-table td {
    padding: 0.6rem 0.4rem;
    text-align: center;
    border-bottom: 1px solid rgba(34, 197, 94, 0.1);
  }

  .grille-table th {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    font-weight: 500;
    font-size: 0.75rem;
  }

  .grille-table th.sortable {
    cursor: pointer;
    user-select: none;
    transition: background 0.2s;
  }

  .grille-table th.sortable:hover {
    background: rgba(34, 197, 94, 0.2);
  }

  .sort-icon {
    opacity: 0.5;
    font-size: 0.7rem;
    margin-left: 0.25rem;
  }

  .grille-table tbody tr:hover {
    background: rgba(34, 197, 94, 0.05);
  }

  .grille-table tr.inactive {
    opacity: 0.5;
  }

  .grille-table tr.success td {
    border-left: 3px solid transparent;
  }

  .grille-table tr.failure td {
    border-left: 3px solid transparent;
  }

  .grille-table tr.success td:first-child {
    border-left: 3px solid #22c55e;
  }

  .grille-table tr.failure td:first-child {
    border-left: 3px solid #ef4444;
  }

  .type-cell {
    text-align: left;
    font-size: 0.8rem;
  }

  .plis-cell {
    font-weight: bold;
    color: #22c55e;
  }

  code {
    background: rgba(34, 197, 94, 0.1);
    padding: 0.1rem 0.3rem;
    border-radius: 4px;
    font-family: monospace;
    font-size: 0.7rem;
  }

  .etat-badge {
    display: inline-block;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
  }

  .etat-badge.reussi {
    background: rgba(34, 197, 94, 0.2);
    color: #86efac;
  }

  .etat-badge.echoue {
    background: rgba(239, 68, 68, 0.2);
    color: #fca5a5;
  }

  .etat-badge.mixte {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
  }

  .etat-badge.capot {
    background: rgba(139, 92, 246, 0.2);
    color: #a78bfa;
  }

  .points-col {
    min-width: 80px;
  }

  .points-cell {
    font-weight: bold;
    font-family: monospace;
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

  .table-info {
    text-align: right;
    color: #64748b;
    font-size: 0.8rem;
    margin-top: 0.5rem;
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
    max-width: 550px;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal h2 {
    color: #22c55e;
    margin: 0 0 1.5rem 0;
  }

  .modal h3 {
    color: #94a3b8;
    font-size: 0.9rem;
    margin: 1rem 0 0.75rem 0;
    padding-top: 1rem;
    border-top: 1px solid rgba(34, 197, 94, 0.2);
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

  .points-section {
    background: rgba(34, 197, 94, 0.05);
    padding: 0.5rem 1rem 1rem 1rem;
    border-radius: 8px;
    margin: 1rem 0;
  }

  .points-section h3 {
    border-top: none;
    padding-top: 0;
    margin-top: 0.5rem;
  }

  .checkboxes-row {
    display: flex;
    gap: 1rem;
    margin: 1rem 0;
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

  .code-preview {
    background: rgba(34, 197, 94, 0.1);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    text-align: center;
    color: #94a3b8;
    font-size: 0.85rem;
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

    .grille-table {
      font-size: 0.7rem;
    }

    .grille-table th,
    .grille-table td {
      padding: 0.4rem 0.2rem;
    }

    .filters {
      flex-direction: column;
      width: 100%;
    }

    .filters select {
      width: 100%;
    }
  }
</style>
