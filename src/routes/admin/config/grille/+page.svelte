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
  let filterKind: string | '' = '';
  let filterNbJoueurs: number | '' = '';

  // Modal
  let showModal = false;
  let editMode = false;
  let currentEntry: Partial<GrilleResultat> & { code: string; kind: string; nbJoueursDedans: number; resultatInd: number; resultatJeu: number } = getEmptyEntry();

  const kindOptions: Record<string, string> = {
    'SOLO': 'Preneur seul',
    'DUO': 'Preneur + 1 partenaire',
    'TRIO': 'Preneur + 2 partenaires'
  };

  const etatOptions: Record<string, string> = {
    'REUSSI': 'Réussi',
    'ECHOUE': 'Échoué'
  };

  function getEmptyEntry() {
    return {
      id: 0,
      code: '',
      annonceLabel: '',
      kind: 'SOLO',
      nbJoueursDedans: 1,
      plisFaits: 0,
      etat: 'REUSSI',
      resultatInd: 0,
      resultatJeu: 0
    };
  }

  function generateCode(entry: typeof currentEntry): string {
    const etatStr = entry.etat === 'REUSSI' ? 'R' : 'E';
    return `K${entry.kind}_J${entry.nbJoueursDedans}_P${entry.plisFaits}_${etatStr}`;
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

  $: filteredGrille = grille.filter(entry => {
    if (filterKind !== '' && entry.kind !== filterKind) return false;
    if (filterNbJoueurs !== '' && entry.nbJoueursDedans !== filterNbJoueurs) return false;
    return true;
  });

  onMount(loadGrille);
</script>

<svelte:head>
  <title>Grille de résultats - Admin</title>
</svelte:head>

<div class="admin-container">
  <header class="admin-header">
    <a href="/admin/config" class="back-btn">← Retour</a>
    <h1>📊 Grille de résultats</h1>
  </header>

  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  {#if successMessage}
    <div class="success-message">{successMessage}</div>
  {/if}

  <div class="actions-bar">
    <div class="filters">
      <select bind:value={filterKind}>
        <option value="">Tous les types</option>
        {#each Object.entries(kindOptions) as [val, lbl]}
          <option value={val}>{lbl}</option>
        {/each}
      </select>
      <select bind:value={filterNbJoueurs}>
        <option value="">Tous nb joueurs</option>
        <option value={1}>1 joueur</option>
        <option value={2}>2 joueurs</option>
        <option value={3}>3 joueurs</option>
        <option value={4}>4 joueurs</option>
      </select>
    </div>
    <button class="btn-create" on:click={openCreate}>+ Nouvelle entrée</button>
  </div>

  <p class="hint">Barème de points selon le nombre de plis faits et l'état (réussi/échoué).</p>

  {#if loading}
    <div class="loading">Chargement...</div>
  {:else if filteredGrille.length === 0}
    <div class="empty-state">Aucune entrée dans la grille</div>
  {:else}
    <div class="grille-table-container">
      <table class="grille-table">
        <thead>
          <tr>
            <th>Code</th>
            <th>Type</th>
            <th>Joueurs dedans</th>
            <th>Plis faits</th>
            <th>État</th>
            <th class="points-col">Points Ind.</th>
            <th class="points-col">Points Jeu</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredGrille as entry}
            <tr class:success={entry.etat === 'REUSSI'} class:failure={entry.etat === 'ECHOUE'}>
              <td><code>{entry.code}</code></td>
              <td class="type-cell">{kindOptions[entry.kind] || entry.kind}</td>
              <td>{entry.nbJoueursDedans}</td>
              <td class="plis-cell">{entry.plisFaits ?? '-'}</td>
              <td>
                <span class="etat-badge" class:reussi={entry.etat === 'REUSSI'} class:echoue={entry.etat === 'ECHOUE'}>
                  {entry.etat === 'REUSSI' ? '✓ Réussi' : entry.etat === 'ECHOUE' ? '✗ Échoué' : '-'}
                </span>
              </td>
              <td class="points-cell">{entry.resultatInd > 0 ? '+' : ''}{entry.resultatInd}</td>
              <td class="points-cell">{entry.resultatJeu > 0 ? '+' : ''}{entry.resultatJeu}</td>
              <td class="actions-cell">
                <button class="btn-icon" on:click={() => openEdit(entry)} title="Modifier">✏️</button>
                <button class="btn-icon delete" on:click={() => deleteEntry(entry.id)} title="Supprimer">🗑️</button>
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
    <div class="modal-overlay" on:click={() => showModal = false} on:keydown={(e) => e.key === 'Escape' && (showModal = false)} role="button" tabindex="0">
      <div class="modal" on:click|stopPropagation role="dialog" aria-modal="true">
        <h2>{editMode ? 'Modifier l\'entrée' : 'Nouvelle entrée'}</h2>
        <form on:submit|preventDefault={saveEntry}>
          {#if editMode}
            <div class="form-group">
              <label for="code">Code</label>
              <input id="code" type="text" value={currentEntry.code} disabled />
            </div>
          {/if}
          
          <div class="form-row">
            <div class="form-group">
              <label for="kind">Type de contrat</label>
              <select id="kind" bind:value={currentEntry.kind}>
                {#each Object.entries(kindOptions) as [val, lbl]}
                  <option value={val}>{lbl}</option>
                {/each}
              </select>
            </div>
            <div class="form-group">
              <label for="nbJoueurs">Nb joueurs dedans</label>
              <input id="nbJoueurs" type="number" bind:value={currentEntry.nbJoueursDedans} min="1" max="4" />
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
                {#each Object.entries(etatOptions) as [val, lbl]}
                  <option value={val}>{lbl}</option>
                {/each}
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
  }

  .filters select {
    background: #0f172a;
    color: #e2e8f0;
    border: 1px solid rgba(34, 197, 94, 0.3);
    padding: 0.5rem;
    border-radius: 8px;
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
    font-size: 0.9rem;
    padding: 0.25rem;
    opacity: 0.7;
    transition: opacity 0.2s;
  }

  .btn-icon:hover {
    opacity: 1;
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
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    color: #94a3b8;
    font-size: 0.85rem;
    margin-bottom: 0.3rem;
  }

  .form-group input,
  .form-group select {
    width: 100%;
    background: #020617;
    color: #e2e8f0;
    border: 1px solid rgba(34, 197, 94, 0.3);
    padding: 0.6rem 0.8rem;
    border-radius: 8px;
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
