<script lang="ts">
  import { onMount } from 'svelte';

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';
  const currentYear = new Date().getFullYear();

  // Types
  interface Competition {
    id: number;
    competitionType: number;
    competitionNumber: number | null;
    name: string;
    allowedPlayers: string | null;
    manchesCount: number | null;
    nbreToursPerManche: number | null;
    scoringGridCode: string | null;
    usesArbitre: boolean;
    isActive: boolean;
    eventDate: string | null;
    logoPath: string | null;
    reglementText: string | null;
    clubId: number | null;
    clubName: string | null;
    clubShortName: string | null;
    clubColor: string | null;
  }

  interface Club {
    id: number;
    name: string;
    shortName: string | null;
    color: string | null;
    isActive: boolean;
  }

  // État
  let competitions: Competition[] = [];
  let clubs: Club[] = [];
  let loading = true;
  let error = '';
  let showCreateModal = false;
  let showDeleteModal = false;
  let competitionToDelete: Competition | null = null;

  // Filtres
  let filterType: number | null = null;
  let filterActive: boolean | null = null;

  // Formulaire de création
  let newCompetition = {
    competitionType: 1,
    competitionNumber: null as number | null,
    name: '',
    manchesCount: null as number | null,
    nbreToursPerManche: null as number | null,
    scoringGridCode: 'STANDARD',
    usesArbitre: true,
    isActive: true,
    eventDate: null as string | null,
    allowedPlayers: null as string | null,
    logoPath: null as string | null,
    reglementText: null as string | null,
    clubId: null as number | null
  };

  const competitionTypes: Record<number, string> = {
    1: 'Championnat',
    2: 'Interclub',
    3: 'Manche Libre',
    4: 'Concours'
  };

  // Charger les compétitions et les clubs
  async function loadCompetitions() {
    loading = true;
    error = '';
    try {
      const [resComp, resClubs] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/competitions`),
        fetch(`${API_BASE_URL}/api/config/clubs/active`)
      ]);
      if (resComp.ok) {
        competitions = await resComp.json();
      } else {
        error = 'Erreur lors du chargement des compétitions';
      }
      if (resClubs.ok) {
        clubs = await resClubs.json();
      }
    } catch (err) {
      error = 'Impossible de contacter le serveur';
    } finally {
      loading = false;
    }
  }

  // Filtrer les compétitions
  $: filteredCompetitions = competitions.filter(c => {
    if (filterType !== null && c.competitionType !== filterType) return false;
    if (filterActive !== null && c.isActive !== filterActive) return false;
    return true;
  });

  // Créer une compétition
  async function createCompetition() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/competitions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCompetition)
      });
      if (res.ok) {
        showCreateModal = false;
        resetNewCompetition();
        await loadCompetitions();
      } else {
        error = 'Erreur lors de la création';
      }
    } catch (err) {
      error = 'Impossible de contacter le serveur';
    }
  }

  // Dupliquer une compétition
  async function duplicateCompetition(id: number) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/competitions/${id}/duplicate`, {
        method: 'POST'
      });
      if (res.ok) {
        await loadCompetitions();
      } else {
        error = 'Erreur lors de la duplication';
      }
    } catch (err) {
      error = 'Impossible de contacter le serveur';
    }
  }

  // Supprimer une compétition
  async function deleteCompetition() {
    if (!competitionToDelete) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/competitions/${competitionToDelete.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        showDeleteModal = false;
        competitionToDelete = null;
        await loadCompetitions();
      } else {
        error = 'Erreur lors de la suppression';
      }
    } catch (err) {
      error = 'Impossible de contacter le serveur';
    }
  }

  function resetNewCompetition() {
    newCompetition = {
      competitionType: 1,
      competitionNumber: null,
      name: '',
      manchesCount: null,
      nbreToursPerManche: null,
      scoringGridCode: 'STANDARD',
      usesArbitre: true,
      isActive: true,
      eventDate: null,
      allowedPlayers: null,
      logoPath: null,
      reglementText: null,
      clubId: null
    };
  }

  function confirmDelete(comp: Competition) {
    competitionToDelete = comp;
    showDeleteModal = true;
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-BE');
  }

  onMount(loadCompetitions);
</script>

<svelte:head>
  <title>Configuration des compétitions - Admin</title>
</svelte:head>

<div class="admin-container">
  <header class="admin-header">
    <a href="/admin" class="back-btn">← Retour</a>
    <h1>🏆 Configuration des compétitions</h1>
  </header>

  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  <!-- Barre d'actions -->
  <div class="actions-bar">
    <div class="filters">
      <select bind:value={filterType}>
        <option value={null}>Tous les types</option>
        {#each Object.entries(competitionTypes) as [value, label]}
          <option value={parseInt(value)}>{label}</option>
        {/each}
      </select>
      <select bind:value={filterActive}>
        <option value={null}>Tous les statuts</option>
        <option value={true}>Actives</option>
        <option value={false}>Inactives</option>
      </select>
    </div>
    <button class="btn-create" on:click={() => showCreateModal = true}>
      + Nouvelle compétition
    </button>
  </div>

  <!-- Liste des compétitions -->
  {#if loading}
    <div class="loading">Chargement...</div>
  {:else if filteredCompetitions.length === 0}
    <div class="empty-state">Aucune compétition trouvée</div>
  {:else}
    <div class="competitions-grid">
      {#each filteredCompetitions as comp}
        <div class="competition-card" class:inactive={!comp.isActive}>
          <div class="card-header">
            <span class="type-badge type-{comp.competitionType}">
              {competitionTypes[comp.competitionType] || 'Inconnu'}
            </span>
            <span class="status-badge" class:active={comp.isActive}>
              {comp.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          <h3 class="card-title">{comp.name}</h3>
          {#if comp.clubName}
            <div class="club-info">
              <span class="club-dot" style="background: {comp.clubColor || '#22c55e'};"></span>
              <span class="club-name">{comp.clubShortName || comp.clubName}</span>
            </div>
          {/if}
          <div class="card-details">
            {#if comp.competitionNumber}
              <div class="detail">
                <span class="label">Numéro:</span>
                <span class="value">{comp.competitionNumber}</span>
              </div>
            {/if}
            {#if comp.manchesCount}
              <div class="detail">
                <span class="label">Manches:</span>
                <span class="value">{comp.manchesCount}</span>
              </div>
            {/if}
            {#if comp.nbreToursPerManche}
              <div class="detail">
                <span class="label">Tours/manche:</span>
                <span class="value">{comp.nbreToursPerManche}</span>
              </div>
            {/if}
            {#if comp.eventDate}
              <div class="detail">
                <span class="label">Date:</span>
                <span class="value">{formatDate(comp.eventDate)}</span>
              </div>
            {/if}
            <div class="detail">
              <span class="label">Arbitre:</span>
              <span class="value">{comp.usesArbitre ? 'Oui' : 'Non'}</span>
            </div>
          </div>
          <div class="card-actions">
            <a href="/admin/competitions/{comp.id}" class="btn-edit">
              <svg class="action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
              </svg>
              Configurer
            </a>
            <button class="btn-duplicate" on:click={() => duplicateCompetition(comp.id)}>
              <svg class="action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="9" y="9" width="13" height="13" rx="2" stroke="currentColor" stroke-width="2" fill="none"/>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/>
              </svg>
              Dupliquer
            </button>
            <button class="btn-delete" on:click={() => confirmDelete(comp)} title="Supprimer">
              <svg class="action-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <line x1="10" y1="11" x2="10" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="14" y1="11" x2="14" y2="17" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- Modal de création -->
  {#if showCreateModal}
    <div class="modal-overlay" on:click={() => showCreateModal = false} on:keydown={(e) => e.key === 'Escape' && (showCreateModal = false)} role="button" tabindex="0">
      <div class="modal" on:click|stopPropagation role="dialog" aria-modal="true">
        <h2>Nouvelle compétition</h2>
        <form on:submit|preventDefault={createCompetition}>
          <div class="form-row">
            <div class="form-group">
              <label for="type">Type</label>
              <select id="type" bind:value={newCompetition.competitionType} required>
                {#each Object.entries(competitionTypes) as [value, label]}
                  <option value={parseInt(value)}>{label}</option>
                {/each}
              </select>
            </div>
            <div class="form-group">
              <label for="club">Club</label>
              <select id="club" bind:value={newCompetition.clubId}>
                <option value={null}>— Aucun club —</option>
                {#each clubs as club}
                  <option value={club.id}>{club.name}{club.shortName ? ` (${club.shortName})` : ''}</option>
                {/each}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label for="name">Nom</label>
            <input id="name" type="text" bind:value={newCompetition.name} required placeholder="Ex: Championnat 29" />
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="number">Numéro</label>
              <input id="number" type="number" bind:value={newCompetition.competitionNumber} placeholder="Ex: 29" />
            </div>
            <div class="form-group">
              <label for="eventDate">Date événement</label>
              <input id="eventDate" type="date" bind:value={newCompetition.eventDate} />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="manches">Nb manches</label>
              <input id="manches" type="number" bind:value={newCompetition.manchesCount} placeholder="Ex: 10" />
            </div>
            <div class="form-group">
              <label for="tours">Tours/manche</label>
              <input id="tours" type="number" bind:value={newCompetition.nbreToursPerManche} placeholder="Ex: 16" />
            </div>
          </div>
          <div class="form-row checkboxes">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={newCompetition.usesArbitre} />
              Utilise un arbitre
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={newCompetition.isActive} />
              Active
            </label>
          </div>
          <div class="modal-actions">
            <button type="button" class="btn-cancel" on:click={() => showCreateModal = false}>Annuler</button>
            <button type="submit" class="btn-submit">Créer</button>
          </div>
        </form>
      </div>
    </div>
  {/if}

  <!-- Modal de confirmation de suppression -->
  {#if showDeleteModal && competitionToDelete}
    <div class="modal-overlay" on:click={() => showDeleteModal = false} on:keydown={(e) => e.key === 'Escape' && (showDeleteModal = false)} role="button" tabindex="0">
      <div class="modal modal-delete" on:click|stopPropagation role="dialog" aria-modal="true">
        <h2>⚠️ Confirmer la suppression</h2>
        <p>Êtes-vous sûr de vouloir supprimer la compétition <strong>{competitionToDelete.name}</strong> ?</p>
        <p class="warning">Cette action est irréversible et supprimera toutes les configurations associées.</p>
        <div class="modal-actions">
          <button class="btn-cancel" on:click={() => showDeleteModal = false}>Annuler</button>
          <button class="btn-delete-confirm" on:click={deleteCompetition}>Supprimer</button>
        </div>
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

  .action-icon {
    flex-shrink: 0;
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
    gap: 0.5rem;
  }

  .filters select {
    background: #020617;
    color: #e2e8f0;
    border: 1px solid rgba(34, 197, 94, 0.3);
    padding: 0.5rem 1rem;
    border-radius: 8px;
    cursor: pointer;
  }

  .btn-create {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .btn-create:hover {
    transform: translateY(-2px);
  }

  .loading, .empty-state {
    text-align: center;
    padding: 3rem;
    color: #94a3b8;
  }

  .competitions-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.25rem;
  }

  .competition-card {
    background: #020617;
    border: 1px solid rgba(34, 197, 94, 0.2);
    border-radius: 12px;
    padding: 1.25rem;
    transition: all 0.2s;
  }

  .competition-card:hover {
    border-color: #22c55e;
    transform: translateY(-2px);
  }

  .competition-card.inactive {
    opacity: 0.6;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 0.75rem;
  }

  .type-badge {
    font-size: 0.75rem;
    padding: 0.35rem 0.75rem;
    border-radius: 9999px;
    font-weight: 600;
    border: 2px solid;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .type-badge.type-1 { 
    background: rgba(59, 130, 246, 0.2); 
    color: #60a5fa; 
    border-color: #3b82f6;
  }
  .type-badge.type-2 { 
    background: rgba(245, 158, 11, 0.2); 
    color: #fbbf24; 
    border-color: #f59e0b;
  }
  .type-badge.type-3 { 
    background: rgba(139, 92, 246, 0.2); 
    color: #a78bfa; 
    border-color: #8b5cf6;
  }
  .type-badge.type-4 { 
    background: rgba(236, 72, 153, 0.2); 
    color: #f472b6; 
    border-color: #ec4899;
  }

  .status-badge {
    font-size: 0.7rem;
    padding: 0.25rem 0.6rem;
    border-radius: 9999px;
    background: rgba(75, 85, 99, 0.3);
    color: #9ca3af;
    border: 1px solid #4b5563;
    font-weight: 500;
  }

  .status-badge.active {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
    border-color: #22c55e;
  }

  .card-title {
    font-size: 1.15rem;
    color: #4ade80;
    margin: 0 0 0.5rem 0;
    font-weight: 600;
  }

  .club-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    font-size: 0.85rem;
    color: #94a3b8;
  }

  .club-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .club-name {
    font-style: italic;
  }

  .card-details {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
    margin-bottom: 1rem;
    font-size: 0.85rem;
  }

  .detail {
    display: flex;
    flex-direction: column;
  }

  .detail .label {
    color: #94a3b8;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .detail .value {
    color: #e2e8f0;
  }

  .card-actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .btn-edit {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.25rem;
    text-decoration: none;
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    border: 1px solid rgba(34, 197, 94, 0.3);
    padding: 0.5rem;
    border-radius: 6px;
    font-size: 0.85rem;
    transition: all 0.2s;
  }

  .btn-edit:hover {
    background: rgba(34, 197, 94, 0.3);
  }

  .btn-duplicate {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.3);
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-duplicate:hover {
    background: rgba(59, 130, 246, 0.3);
  }

  .btn-delete {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.3);
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-delete:hover {
    background: rgba(239, 68, 68, 0.3);
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
    max-height: 90vh;
    overflow-y: auto;
  }

  .modal h2 {
    color: #22c55e;
    margin: 0 0 1.5rem 0;
    font-size: 1.3rem;
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
    font-size: 0.95rem;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: #22c55e;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .form-row.checkboxes {
    display: flex;
    gap: 1.5rem;
    margin: 1rem 0;
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

  .modal-delete {
    text-align: center;
  }

  .modal-delete p {
    color: #e2e8f0;
    margin: 0.75rem 0;
  }

  .modal-delete .warning {
    color: #f87171;
    font-size: 0.9rem;
  }

  .btn-delete-confirm {
    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
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
    .actions-bar {
      flex-direction: column;
      align-items: stretch;
    }

    .filters {
      flex-direction: column;
    }

    .form-row {
      grid-template-columns: 1fr;
    }

    .competitions-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
