<script lang="ts">
  import { onMount } from 'svelte';

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';

  const currentYear = new Date().getFullYear();

  interface JetonType {
    code: string;
    label: string;
    color: string;
    defaultValeur: number;
    sortOrder: number;
    isActive: boolean;
  }

  interface TableConfig {
    tableConfigId: number;
    tableName: string;
    mancheNumber: number;
    playerCount: number;
    startTime: string | null;
    competitionName: string | null;
    competitionType: number | null;
    competitionNumber: number | null;
    donnesCount: number;
    isCompleted: boolean;
  }

  interface Joueur {
    playerId: number;
    alias: string;
  }

  interface Penalite {
    id: number;
    tableConfigId: number;
    donneNumber: number;
    joueurId: number;
    joueurAlias: string;
    jetonTypeCode: string;
    jetonLabel: string;
    jetonColor: string;
    valeur: number;
    motif: string | null;
    arbitreId: number;
    arbitreAlias: string;
    createdAt: string;
  }

  // Données
  let jetonTypes: JetonType[] = [];
  let tables: TableConfig[] = [];
  let selectedTableId: number | null = null;
  let joueurs: Joueur[] = [];
  let penalites: Penalite[] = [];
  let donnesCount = 0;

  // Filtres de compétition
  let selectedCompetitionType: string = '';
  let selectedCompetitionNumber: string = '';
  let selectedDateFilter: string = '';

  // États
  let isLoading = false;
  let loadError = '';
  let arbitreCode = '';
  let arbitreValidated = false;
  let arbitreAlias = '';

  // Formulaire nouvelle pénalité
  let showNewForm = false;
  let newPenalite = {
    donneNumber: 1,
    joueurId: 0,
    jetonTypeCode: 'BLEU',
    valeur: 0,
    motif: ''
  };
  let creating = false;
  let createMessage = '';

  // Modal édition
  let editingPenalite: Penalite | null = null;
  let editForm = {
    jetonTypeCode: '',
    valeur: 0,
    motif: ''
  };
  let saving = false;
  let saveMessage = '';

  // Filtres
  let filterDonne: string = '';
  let filterJoueur: string = '';
  let filterJeton: string = '';

  // Mapping des types de compétition
  const competitionTypeLabels: Record<number, string> = {
    1: 'Championnat',
    2: 'Interclub',
    3: 'Manche Libre',
    4: 'Concours'
  };

  // Options de type de compétition disponibles
  $: availableCompetitionTypes = [...new Set(tables.map(t => t.competitionType))].sort((a, b) => {
    if (a === null) return 1;
    if (b === null) return -1;
    return a - b;
  });

  // Tables filtrées par type de compétition
  $: tablesFilteredByType = selectedCompetitionType === ''
    ? tables
    : tables.filter(t => {
        if (selectedCompetitionType === 'libre') return t.competitionType === null || t.competitionType === 3;
        return t.competitionType === parseInt(selectedCompetitionType);
      });

  // Options de compétitions disponibles (basées sur le type sélectionné) avec leur nom
  $: availableCompetitions = (() => {
    const competitionsMap = new Map<number, string>();
    tablesFilteredByType
      .filter(t => t.competitionNumber !== null && t.competitionName !== null)
      .forEach(t => {
        if (!competitionsMap.has(t.competitionNumber!)) {
          competitionsMap.set(t.competitionNumber!, t.competitionName!);
        }
      });
    return [...competitionsMap.entries()]
      .map(([num, name]) => ({ number: num, name }))
      .sort((a, b) => b.number - a.number);
  })();

  // Tables filtrées par type ET numéro de compétition
  $: tablesFilteredByTypeAndNumber = selectedCompetitionNumber === ''
    ? tablesFilteredByType
    : tablesFilteredByType.filter(t => t.competitionNumber === parseInt(selectedCompetitionNumber));

  // Options de dates disponibles (dates uniques des tables filtrées)
  $: availableDates = (() => {
    const datesSet = new Set<string>();
    tablesFilteredByTypeAndNumber
      .filter(t => t.startTime !== null)
      .forEach(t => {
        const dateStr = t.startTime!.split('T')[0];
        datesSet.add(dateStr);
      });
    return [...datesSet].sort((a, b) => b.localeCompare(a));
  })();

  // Tables filtrées par type, numéro ET date
  $: tablesFilteredFinal = selectedDateFilter === ''
    ? tablesFilteredByTypeAndNumber
    : tablesFilteredByTypeAndNumber.filter(t => {
        if (!t.startTime) return false;
        const tableDate = t.startTime.split('T')[0];
        return tableDate === selectedDateFilter;
      });

  // Réinitialiser les sélections en cascade
  function onCompetitionTypeChange() {
    selectedCompetitionNumber = '';
    selectedDateFilter = '';
    selectedTableId = null;
    joueurs = [];
    penalites = [];
  }

  function onCompetitionNumberChange() {
    selectedDateFilter = '';
    selectedTableId = null;
    joueurs = [];
    penalites = [];
  }

  function onDateFilterChange() {
    selectedTableId = null;
    joueurs = [];
    penalites = [];
  }

  $: filteredPenalites = penalites.filter((p) => {
    if (filterDonne && String(p.donneNumber) !== filterDonne) return false;
    if (filterJoueur && String(p.joueurId) !== filterJoueur) return false;
    if (filterJeton && p.jetonTypeCode !== filterJeton) return false;
    return true;
  });

  $: selectedTable = tables.find(t => t.tableConfigId === selectedTableId);

  $: donneOptions = selectedTable ? Array.from({ length: selectedTable.donnesCount }, (_, i) => i + 1) : [];

  onMount(() => {
    const flag = localStorage.getItem('whist_admin_ok');
    if (flag !== 'true') {
      window.location.href = '/admin';
      return;
    }
    loadInitialData();
  });

  async function loadInitialData() {
    isLoading = true;
    loadError = '';

    try {
      const [resJetons, resTables] = await Promise.all([
        fetch(`${API_BASE_URL}/api/config/jetons`),
        fetch(`${API_BASE_URL}/api/admin/manches`)
      ]);

      if (!resJetons.ok || !resTables.ok) {
        throw new Error('Erreur lors du chargement');
      }

      jetonTypes = await resJetons.json();
      tables = await resTables.json();

      // Trier les tables par date décroissante
      tables.sort((a, b) => {
        const dateA = a.startTime ? new Date(a.startTime).getTime() : 0;
        const dateB = b.startTime ? new Date(b.startTime).getTime() : 0;
        return dateB - dateA;
      });

      // Initialiser la valeur par défaut du jeton
      if (jetonTypes.length > 0) {
        newPenalite.jetonTypeCode = jetonTypes[0].code;
        newPenalite.valeur = jetonTypes[0].defaultValeur;
      }
    } catch (err: any) {
      console.error(err);
      loadError = 'Impossible de charger les données.';
    } finally {
      isLoading = false;
    }
  }

  async function loadTableData() {
    if (!selectedTableId) {
      joueurs = [];
      penalites = [];
      donnesCount = 0;
      return;
    }

    isLoading = true;
    loadError = '';

    try {
      // Charger les détails de la manche pour avoir les joueurs
      const resDetail = await fetch(`${API_BASE_URL}/api/admin/manches/${selectedTableId}`);
      if (!resDetail.ok) throw new Error('Erreur chargement manche');

      const detail = await resDetail.json();
      joueurs = detail.players
        .filter((p: any) => p.playerId !== null)
        .map((p: any) => ({ playerId: p.playerId, alias: p.alias }));
      donnesCount = detail.donnes?.length ?? 0;

      // Charger les pénalités
      const resPenalites = await fetch(`${API_BASE_URL}/api/tables/${selectedTableId}/penalites`);
      if (!resPenalites.ok) throw new Error('Erreur chargement pénalités');

      penalites = await resPenalites.json();

      // Initialiser le formulaire avec le premier joueur
      if (joueurs.length > 0) {
        newPenalite.joueurId = joueurs[0].playerId;
      }
    } catch (err: any) {
      console.error(err);
      loadError = 'Erreur lors du chargement des données de la table.';
    } finally {
      isLoading = false;
    }
  }

  async function validateArbitre() {
    if (!arbitreCode.trim()) {
      loadError = 'Veuillez entrer un code arbitre.';
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/arbitres/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: arbitreCode.trim() })
      });

      const data = await res.json();
      if (data.isValid) {
        arbitreValidated = true;
        arbitreAlias = data.joueurAlias;
        loadError = '';
      } else {
        loadError = data.message || 'Code arbitre invalide';
      }
    } catch (err) {
      loadError = 'Erreur de connexion au serveur';
    }
  }

  function formatDate(dateStr: string | null): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleDateString('fr-FR') + ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  }

  function getJetonStyle(code: string): string {
    const jeton = jetonTypes.find(j => j.code === code);
    if (!jeton) return '';
    return `background-color: ${jeton.color}; color: ${code === 'NOIR' ? 'white' : 'white'};`;
  }

  function onJetonChange() {
    const jeton = jetonTypes.find(j => j.code === newPenalite.jetonTypeCode);
    if (jeton) {
      newPenalite.valeur = jeton.defaultValeur;
    }
  }

  function openNewForm() {
    showNewForm = true;
    newPenalite = {
      donneNumber: 1,
      joueurId: joueurs[0]?.playerId ?? 0,
      jetonTypeCode: jetonTypes[0]?.code ?? 'BLEU',
      valeur: jetonTypes[0]?.defaultValeur ?? 0,
      motif: ''
    };
    createMessage = '';
  }

  function closeNewForm() {
    showNewForm = false;
    createMessage = '';
  }

  async function createPenalite() {
    if (!newPenalite.joueurId) {
      createMessage = 'Veuillez sélectionner un joueur.';
      return;
    }

    creating = true;
    createMessage = '';

    try {
      const res = await fetch(`${API_BASE_URL}/api/tables/${selectedTableId}/penalites`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Arbitre-Code': arbitreCode
        },
        body: JSON.stringify({
          tableConfigId: selectedTableId,
          donneNumber: newPenalite.donneNumber,
          joueurId: newPenalite.joueurId,
          jetonTypeCode: newPenalite.jetonTypeCode,
          valeur: newPenalite.valeur,
          motif: newPenalite.motif || null
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erreur lors de la création');
      }

      createMessage = 'Pénalité créée ✅';
      await loadTableData();
      setTimeout(closeNewForm, 1000);
    } catch (err: any) {
      console.error(err);
      createMessage = err.message || 'Erreur ❌';
    } finally {
      creating = false;
    }
  }

  function openEditModal(penalite: Penalite) {
    editingPenalite = penalite;
    editForm = {
      jetonTypeCode: penalite.jetonTypeCode,
      valeur: penalite.valeur,
      motif: penalite.motif ?? ''
    };
    saveMessage = '';
  }

  function closeEditModal() {
    editingPenalite = null;
    saveMessage = '';
  }

  async function savePenalite() {
    if (!editingPenalite) return;

    saving = true;
    saveMessage = '';

    try {
      const res = await fetch(`${API_BASE_URL}/api/tables/${selectedTableId}/penalites/${editingPenalite.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-Arbitre-Code': arbitreCode
        },
        body: JSON.stringify({
          jetonTypeCode: editForm.jetonTypeCode,
          valeur: editForm.valeur,
          motif: editForm.motif || null
        })
      });

      if (!res.ok) throw new Error('Erreur lors de la mise à jour');

      saveMessage = 'Pénalité mise à jour ✅';
      await loadTableData();
      setTimeout(closeEditModal, 1000);
    } catch (err: any) {
      console.error(err);
      saveMessage = 'Erreur ❌';
    } finally {
      saving = false;
    }
  }

  async function deletePenalite(penalite: Penalite) {
    if (!confirm(`Supprimer la pénalité de ${penalite.joueurAlias} (donne ${penalite.donneNumber}) ?`)) return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/tables/${selectedTableId}/penalites/${penalite.id}`, {
        method: 'DELETE',
        headers: { 'X-Arbitre-Code': arbitreCode }
      });

      if (!res.ok) throw new Error('Erreur lors de la suppression');

      await loadTableData();
    } catch (err: any) {
      console.error(err);
      alert('Erreur lors de la suppression.');
    }
  }
</script>

<svelte:head>
  <title>Administration – Pénalités</title>
</svelte:head>

<div class="admin-page">
  <h1>
    <a href="/admin" class="back-link">← Administration</a>
    <span class="sep">⟶</span> Gestion des pénalités
  </h1>

  {#if !arbitreValidated}
    <!-- Authentification arbitre -->
    <div class="admin-card auth-card">
      <h2>⚖️ Authentification arbitre</h2>
      <p>Entrez votre code arbitre pour accéder à la gestion des pénalités.</p>

      <div class="auth-form">
        <input
          type="text"
          bind:value={arbitreCode}
          placeholder="Code arbitre"
          on:keydown={(e) => e.key === 'Enter' && validateArbitre()}
        />
        <button class="btn-validate" on:click={validateArbitre}>Valider</button>
      </div>

      {#if loadError}
        <p class="error">{loadError}</p>
      {/if}
    </div>
  {:else}
    <!-- Interface principale -->
    <div class="admin-card">
      <div class="arbitre-header">
        <span class="arbitre-badge">⚖️ Arbitre: <strong>{arbitreAlias}</strong></span>
        <button class="btn-logout" on:click={() => { arbitreValidated = false; arbitreCode = ''; }}>
          Déconnexion
        </button>
      </div>

      <!-- Filtres de compétition -->
      <div class="competition-filters">
        <div class="filter-group">
          <label for="competition-type">Type de compétition:</label>
          <select id="competition-type" bind:value={selectedCompetitionType} on:change={onCompetitionTypeChange}>
            <option value="">-- Tous les types --</option>
            {#each availableCompetitionTypes as compType}
              <option value={compType === null || compType === 3 ? 'libre' : String(compType)}>
                {compType === null ? 'Sans type' : (competitionTypeLabels[compType] || `Type ${compType}`)}
              </option>
            {/each}
          </select>
        </div>

        {#if selectedCompetitionType && selectedCompetitionType !== 'libre' && availableCompetitions.length > 0}
          <div class="filter-group">
            <label for="competition-number">Compétition:</label>
            <select id="competition-number" bind:value={selectedCompetitionNumber} on:change={onCompetitionNumberChange}>
              <option value="">-- Toutes --</option>
              {#each availableCompetitions as comp}
                <option value={String(comp.number)}>
                  {comp.name}
                </option>
              {/each}
            </select>
          </div>
        {/if}

        {#if availableDates.length > 1}
          <div class="filter-group">
            <label for="date-filter">Date:</label>
            <select id="date-filter" bind:value={selectedDateFilter} on:change={onDateFilterChange}>
              <option value="">-- Toutes les dates --</option>
              {#each availableDates as dateStr}
                <option value={dateStr}>
                  {new Date(dateStr).toLocaleDateString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' })}
                </option>
              {/each}
            </select>
          </div>
        {/if}
      </div>

      <!-- Sélection de la table -->
      <div class="table-selector">
        <label for="table-select">Sélectionner une table:</label>
        <select id="table-select" bind:value={selectedTableId} on:change={loadTableData}>
          <option value={null}>-- Choisir une table --</option>
          {#each tablesFilteredFinal as table}
            <option value={table.tableConfigId}>
              Manche {table.mancheNumber} - Table {table.tableName}
              {table.competitionName ? `(${table.competitionName})` : '(Manche Libre)'}
              {table.startTime ? `- ${formatDate(table.startTime).split(' ')[0]}` : ''}
            </option>
          {/each}
        </select>
      </div>

      {#if selectedTableId}
        <!-- Info table sélectionnée -->
        {#if selectedTable}
          <div class="table-info">
            <span>🎴 {selectedTable.donnesCount} donnes</span>
            <span>👥 {joueurs.length} joueurs</span>
            <span>📌 {penalites.length} pénalité(s)</span>
          </div>
        {/if}

        <!-- Bouton ajouter -->
        <div class="actions-row">
          <button class="btn-add" on:click={openNewForm}>
            + Nouvelle pénalité
          </button>
        </div>

        <!-- Filtres -->
        {#if penalites.length > 0}
          <div class="filters-row">
            <select class="filter-select" bind:value={filterDonne}>
              <option value="">Toutes les donnes</option>
              {#each donneOptions as d}
                <option value={String(d)}>Donne {d}</option>
              {/each}
            </select>

            <select class="filter-select" bind:value={filterJoueur}>
              <option value="">Tous les joueurs</option>
              {#each joueurs as j}
                <option value={String(j.playerId)}>{j.alias}</option>
              {/each}
            </select>

            <select class="filter-select" bind:value={filterJeton}>
              <option value="">Tous les jetons</option>
              {#each jetonTypes as jt}
                <option value={jt.code}>{jt.label}</option>
              {/each}
            </select>
          </div>
        {/if}

        <!-- Liste des pénalités -->
        {#if isLoading}
          <p>Chargement…</p>
        {:else if loadError}
          <p class="error">{loadError}</p>
        {:else if filteredPenalites.length === 0}
          <p class="empty-message">Aucune pénalité pour cette manche.</p>
        {:else}
          <!-- Vue desktop: tableau -->
          <div class="desktop-view">
            <table class="penalites-table">
              <thead>
                <tr>
                  <th>Donne</th>
                  <th>Joueur</th>
                  <th>Jeton</th>
                  <th>Points</th>
                  <th>Motif</th>
                  <th>Par</th>
                  <th>Date</th>
                  <th class="center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {#each filteredPenalites as penalite}
                  <tr>
                    <td class="center">{penalite.donneNumber}</td>
                    <td class="joueur-cell">{penalite.joueurAlias}</td>
                    <td>
                      <span class="jeton-badge" style={getJetonStyle(penalite.jetonTypeCode)}>
                        {penalite.jetonLabel}
                      </span>
                    </td>
                    <td class="points-cell">-{penalite.valeur}</td>
                    <td class="motif-cell">{penalite.motif ?? '-'}</td>
                    <td>{penalite.arbitreAlias}</td>
                    <td class="date-cell">{formatDate(penalite.createdAt)}</td>
                    <td class="center">
                      <button class="btn-edit" on:click={() => openEditModal(penalite)}>✏️</button>
                      <button class="btn-delete" on:click={() => deletePenalite(penalite)}>🗑️</button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <!-- Vue mobile: cartes -->
          <div class="mobile-view">
            <div class="mobile-cards">
              {#each filteredPenalites as penalite}
                <div class="penalite-card">
                  <div class="card-header">
                    <span class="card-donne">Donne {penalite.donneNumber}</span>
                    <span class="jeton-badge" style={getJetonStyle(penalite.jetonTypeCode)}>
                      {penalite.jetonLabel}
                    </span>
                  </div>
                  <div class="card-body">
                    <div class="card-joueur">{penalite.joueurAlias}</div>
                    <div class="card-points">-{penalite.valeur} points</div>
                    {#if penalite.motif}
                      <div class="card-motif">{penalite.motif}</div>
                    {/if}
                    <div class="card-meta">Par {penalite.arbitreAlias}</div>
                  </div>
                  <div class="card-actions">
                    <button class="btn-edit" on:click={() => openEditModal(penalite)}>✏️</button>
                    <button class="btn-delete" on:click={() => deletePenalite(penalite)}>🗑️</button>
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {:else}
        <p class="empty-message">Sélectionnez une manche pour voir et gérer les pénalités.</p>
      {/if}
    </div>
  {/if}

  <footer class="copyright">
    © {currentYear} Wb-Scoring — Tous droits réservés
  </footer>
</div>

<!-- Modal nouvelle pénalité -->
{#if showNewForm}
  <div class="modal-backdrop" on:click={closeNewForm} role="button" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && closeNewForm()}>
    <div class="modal" on:click|stopPropagation on:keydown={() => {}} role="dialog" tabindex="0">
      <h2>Nouvelle pénalité</h2>
      <p class="modal-subtitle">{selectedTable?.tableName} - Manche {selectedTable?.mancheNumber}</p>

      <div class="form-row">
        <div class="form-group">
          <label for="donne">Donne</label>
          <select id="donne" bind:value={newPenalite.donneNumber}>
            {#each donneOptions as d}
              <option value={d}>Donne {d}</option>
            {/each}
          </select>
        </div>

        <div class="form-group">
          <label for="joueur">Joueur</label>
          <select id="joueur" bind:value={newPenalite.joueurId}>
            {#each joueurs as j}
              <option value={j.playerId}>{j.alias}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="form-row">
        <div class="form-group">
          <label for="jeton">Type de jeton</label>
          <select id="jeton" bind:value={newPenalite.jetonTypeCode} on:change={onJetonChange}>
            {#each jetonTypes as jt}
              <option value={jt.code}>{jt.label} (-{jt.defaultValeur} pts)</option>
            {/each}
          </select>
        </div>

        <div class="form-group">
          <label for="valeur">Points déduits</label>
          <input type="number" id="valeur" bind:value={newPenalite.valeur} min="0" />
        </div>
      </div>

      <div class="form-group">
        <label for="motif">Motif (optionnel)</label>
        <input type="text" id="motif" bind:value={newPenalite.motif} placeholder="Ex: Annonce incorrecte" />
      </div>

      {#if createMessage}
        <p class={createMessage.includes('✅') ? 'success' : 'error'}>{createMessage}</p>
      {/if}

      <div class="modal-actions">
        <button class="btn-cancel" on:click={closeNewForm}>Annuler</button>
        <button class="btn-save" on:click={createPenalite} disabled={creating}>
          {creating ? 'Création...' : 'Créer'}
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Modal édition -->
{#if editingPenalite}
  <div class="modal-backdrop" on:click={closeEditModal} role="button" tabindex="-1" on:keydown={(e) => e.key === 'Escape' && closeEditModal()}>
    <div class="modal" on:click|stopPropagation on:keydown={() => {}} role="dialog" tabindex="0">
      <h2>Modifier la pénalité</h2>
      <p class="modal-subtitle">Donne {editingPenalite.donneNumber} - {editingPenalite.joueurAlias}</p>

      <div class="form-row">
        <div class="form-group">
          <label for="edit-jeton">Type de jeton</label>
          <select id="edit-jeton" bind:value={editForm.jetonTypeCode}>
            {#each jetonTypes as jt}
              <option value={jt.code}>{jt.label}</option>
            {/each}
          </select>
        </div>

        <div class="form-group">
          <label for="edit-valeur">Points déduits</label>
          <input type="number" id="edit-valeur" bind:value={editForm.valeur} min="0" />
        </div>
      </div>

      <div class="form-group">
        <label for="edit-motif">Motif</label>
        <input type="text" id="edit-motif" bind:value={editForm.motif} placeholder="Ex: Annonce incorrecte" />
      </div>

      {#if saveMessage}
        <p class={saveMessage.includes('✅') ? 'success' : 'error'}>{saveMessage}</p>
      {/if}

      <div class="modal-actions">
        <button class="btn-cancel" on:click={closeEditModal}>Annuler</button>
        <button class="btn-save" on:click={savePenalite} disabled={saving}>
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </button>
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

  .auth-card {
    max-width: 400px;
    margin: 2rem auto;
    text-align: center;
  }

  .auth-card h2 {
    margin-bottom: 0.5rem;
  }

  .auth-card p {
    color: #9ca3af;
    margin-bottom: 1.5rem;
  }

  .auth-form {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
  }

  .auth-form input {
    padding: 0.75rem 1rem;
    border-radius: 8px;
    border: 1px solid rgba(34, 197, 94, 0.5);
    background: #020617;
    color: #f9fafb;
    font-size: 1rem;
    text-align: center;
    width: 150px;
  }

  .btn-validate {
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    border: none;
    background: #22c55e;
    color: #020617;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-validate:hover {
    filter: brightness(1.1);
  }

  .arbitre-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(34, 197, 94, 0.3);
  }

  .arbitre-badge {
    color: #22c55e;
    font-size: 0.9rem;
  }

  .btn-logout {
    padding: 0.25rem 0.75rem;
    border-radius: 6px;
    border: 1px solid rgba(239, 68, 68, 0.5);
    background: transparent;
    color: #ef4444;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .btn-logout:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .competition-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: rgba(34, 197, 94, 0.05);
    border: 1px solid rgba(34, 197, 94, 0.2);
    border-radius: 8px;
  }

  .filter-group {
    flex: 1;
    min-width: 200px;
  }

  .filter-group label {
    display: block;
    margin-bottom: 0.5rem;
    color: #22c55e;
    font-size: 0.85rem;
    font-weight: 500;
  }

  .filter-group select {
    width: 100%;
    padding: 0.6rem 0.75rem;
    border-radius: 6px;
    border: 1px solid rgba(34, 197, 94, 0.4);
    background: #020617;
    color: #f9fafb;
    font-size: 0.9rem;
  }

  .filter-group select:focus {
    outline: none;
    border-color: #22c55e;
    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
  }

  .table-selector {
    margin-bottom: 1rem;
  }

  .table-selector label {
    display: block;
    margin-bottom: 0.5rem;
    color: #9ca3af;
    font-size: 0.9rem;
  }

  .table-selector select {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.6);
    background: #020617;
    color: #f9fafb;
  }

  .table-info {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
    background: rgba(34, 197, 94, 0.1);
    border-radius: 8px;
    font-size: 0.9rem;
  }

  .actions-row {
    margin-bottom: 1rem;
  }

  .btn-add {
    padding: 0.5rem 1rem;
    border-radius: 999px;
    border: none;
    background: #dc2626;
    color: white;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-add:hover {
    filter: brightness(1.1);
  }

  .filters-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .filter-select {
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.6);
    background: #020617;
    color: #f9fafb;
    font-size: 0.85rem;
  }

  .empty-message {
    text-align: center;
    color: #9ca3af;
    padding: 2rem;
  }

  .penalites-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }

  .penalites-table th,
  .penalites-table td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid rgba(51, 65, 85, 0.9);
    text-align: left;
  }

  .penalites-table th {
    background: linear-gradient(to bottom, #7f1d1d, #450a0a);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.78rem;
  }

  .penalites-table tbody tr:nth-child(even) {
    background: rgba(127, 29, 29, 0.1);
  }

  .penalites-table tbody tr:hover {
    background: rgba(127, 29, 29, 0.2);
  }

  .joueur-cell {
    font-weight: 600;
    color: #f9fafb;
  }

  .points-cell {
    font-weight: bold;
    color: #ef4444;
  }

  .motif-cell {
    color: #9ca3af;
    font-style: italic;
    max-width: 150px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .date-cell {
    font-size: 0.8rem;
    color: #9ca3af;
  }

  .center {
    text-align: center;
  }

  .jeton-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
  }

  .btn-edit {
    padding: 0.3rem 0.5rem;
    border-radius: 6px;
    border: 1px solid rgba(59, 130, 246, 0.5);
    background: transparent;
    color: #3b82f6;
    cursor: pointer;
    font-size: 0.8rem;
    margin-right: 0.25rem;
  }

  .btn-edit:hover {
    background: rgba(59, 130, 246, 0.1);
  }

  .btn-delete {
    padding: 0.3rem 0.5rem;
    border-radius: 6px;
    border: 1px solid rgba(239, 68, 68, 0.5);
    background: transparent;
    color: #ef4444;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .btn-delete:hover {
    background: rgba(239, 68, 68, 0.1);
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
    border: 1px solid rgba(239, 68, 68, 0.4);
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
    color: #ef4444;
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
  .form-group input[type='number'],
  .form-group select {
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(75, 85, 99, 0.8);
    background: #020617;
    color: #e5e7eb;
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
    background: #dc2626;
    color: white;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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

    .table-info {
      flex-direction: column;
      gap: 0.5rem;
    }

    .filters-row {
      flex-direction: column;
    }

    .filter-select {
      width: 100%;
    }

    .admin-card {
      padding: 1rem;
    }

    .arbitre-header {
      flex-direction: column;
      gap: 0.5rem;
      text-align: center;
    }

    .mobile-cards {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .penalite-card {
      background: linear-gradient(135deg, #1c1917 0%, #0c0a09 100%);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 10px;
      padding: 0.75rem;
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .card-donne {
      font-weight: 600;
      color: #f9fafb;
    }

    .card-body {
      margin-bottom: 0.5rem;
    }

    .card-joueur {
      font-size: 1rem;
      font-weight: 700;
      color: #f9fafb;
      margin-bottom: 0.25rem;
    }

    .card-points {
      color: #ef4444;
      font-weight: bold;
    }

    .card-motif {
      color: #9ca3af;
      font-style: italic;
      font-size: 0.85rem;
    }

    .card-meta {
      font-size: 0.75rem;
      color: #6b7280;
      margin-top: 0.25rem;
    }

    .card-actions {
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
  }
</style>

