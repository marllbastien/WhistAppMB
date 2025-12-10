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
    email: string | null;
    phone?: string | null;
    isWhisteux?: boolean;
    noAffilie?: string | null;
    isProvisional?: boolean;
    bk?: string | null;
    isActif?: boolean;
    type: 'interne' | 'externe';
  }

  let joueursInternes: Joueur[] = [];
  let joueursExternes: Joueur[] = [];
  let isLoading = false;
  let loadError = '';
  let activeTab: 'internes' | 'externes' = 'internes';

  // Filtres
  let searchQuery = '';
  let filterWhisteux: 'all' | 'yes' | 'no' = 'all';
  let filterNoAffilie = '';
  let filterProvisional: 'all' | 'yes' | 'no' = 'no'; // Par défaut: masquer les provisoires

  // Tri
  type SortColumn = 'id' | 'alias' | 'nom' | 'prenom' | 'email' | 'noAffilie' | 'isWhisteux' | 'phone' | 'bk' | 'isProvisional';
  let sortColumn: SortColumn = 'alias';
  let sortDirection: 'asc' | 'desc' = 'asc';

  function toggleSort(column: SortColumn) {
    if (sortColumn === column) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortColumn = column;
      sortDirection = 'asc';
    }
  }

  // Réactif: recalculé à chaque changement de sortColumn ou sortDirection
  $: sortIcons = {
    id: sortColumn === 'id' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    alias: sortColumn === 'alias' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    nom: sortColumn === 'nom' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    prenom: sortColumn === 'prenom' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    email: sortColumn === 'email' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    noAffilie: sortColumn === 'noAffilie' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    isWhisteux: sortColumn === 'isWhisteux' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    phone: sortColumn === 'phone' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    bk: sortColumn === 'bk' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
    isProvisional: sortColumn === 'isProvisional' ? (sortDirection === 'asc' ? '▲' : '▼') : '',
  };

  // Édition
  let editingJoueur: Joueur | null = null;
  let editForm = {
    nom: '',
    prenom: '',
    email: '',
    phone: '',
    alias: '',
    bk: '',
    noAffilie: '',
    isWhisteux: false,
    isProvisional: false,
    isActif: true
  };
  let saving = false;
  let saveMessage = '';

  // Nouveau joueur externe
  let showNewForm = false;
  let newForm = {
    nom: '',
    prenom: '',
    email: '',
    phone: ''
  };
  let creating = false;
  let createMessage = '';

  // Conversion joueur externe → interne
  let showConvertModal = false;
  let convertingJoueur: Joueur | null = null;

  // Fusion joueur externe avec joueur interne
  let showMergeModal = false;
  let mergingJoueur: Joueur | null = null;
  let mergeTargetSearch = '';
  let mergeTargetId: number | null = null;
  let merging = false;
  let mergeMessage = '';
  let convertForm = {
    noAffilie: '',
    bk: '',
    nom: '',
    prenom: '',
    alias: '',
    email: '',
    phone: '',
    club: '',
    dateDebut: '',
    titre: '',
    sexe: '',
    dateNaissance: '',
    facebookGroup: false,
    membre: true,
    whisteux: true,
    actif: true,
    carte2025: false,
    carte2025Delivree: ''
  };
  let converting = false;
  let convertMessage = '';

  async function openConvertModal(joueur: Joueur) {
    convertingJoueur = joueur;
    convertMessage = '';
    converting = false;

    // Charger les infos suggérées depuis l'API
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/joueurs/convert/${joueur.id}/info`);
      if (res.ok) {
        const data = await res.json();
        convertForm = {
          noAffilie: data.suggestedNoAffilie ?? '',
          bk: data.suggestedBk ?? '',
          nom: data.joueur.nom ?? '',
          prenom: data.joueur.prenom ?? '',
          alias: data.joueur.alias ?? '',
          email: data.joueur.email ?? '',
          phone: data.joueur.phone ?? '',
          club: 'Les Amis Réunis',
          dateDebut: new Date().toISOString().split('T')[0], // Format YYYY-MM-DD
          titre: data.joueur.titre ?? '',
          sexe: data.joueur.sexe ?? '',
          dateNaissance: data.joueur.dateNaissance ? data.joueur.dateNaissance.split('T')[0] : '',
          facebookGroup: data.joueur.facebookGroup ?? false,
          membre: data.joueur.membre ?? true,
          whisteux: data.joueur.whisteux ?? true,
          actif: data.joueur.actif ?? true,
          carte2025: data.joueur.carte2025 ?? false,
          carte2025Delivree: data.joueur.carte2025Delivree ? data.joueur.carte2025Delivree.split('T')[0] : ''
        };
      } else {
        convertForm = {
          noAffilie: '',
          bk: '',
          nom: joueur.nom ?? '',
          prenom: joueur.prenom ?? '',
          alias: joueur.alias ?? '',
          email: joueur.email ?? '',
          phone: joueur.phone ?? '',
          club: 'Les Amis Réunis',
          dateDebut: new Date().toISOString().split('T')[0],
          titre: '',
          sexe: '',
          dateNaissance: '',
          facebookGroup: false,
          membre: true,
          whisteux: true,
          actif: true,
          carte2025: false,
          carte2025Delivree: ''
        };
      }
    } catch {
      convertForm = {
        noAffilie: '',
        bk: '',
        nom: joueur.nom ?? '',
        prenom: joueur.prenom ?? '',
        alias: joueur.alias ?? '',
        email: joueur.email ?? '',
        phone: joueur.phone ?? '',
        club: 'Les Amis Réunis',
        dateDebut: new Date().toISOString().split('T')[0],
        titre: '',
        sexe: '',
        dateNaissance: '',
        facebookGroup: false,
        membre: true,
        whisteux: true,
        actif: true,
        carte2025: false,
        carte2025Delivree: ''
      };
    }

    showConvertModal = true;
  }

  function closeConvertModal() {
    showConvertModal = false;
    convertingJoueur = null;
    convertMessage = '';
  }

  async function convertJoueur() {
    if (!convertingJoueur) return;

    converting = true;
    convertMessage = '';

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/joueurs/convert/${convertingJoueur.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          noAffilie: convertForm.noAffilie || null,
          bk: convertForm.bk || null,
          nom: convertForm.nom,
          prenom: convertForm.prenom,
          alias: convertForm.alias || null,
          email: convertForm.email || null,
          phone: convertForm.phone || null,
          dateDebut: convertForm.dateDebut ? new Date(convertForm.dateDebut) : null,
          titre: convertForm.titre || null,
          sexe: convertForm.sexe || null,
          dateNaissance: convertForm.dateNaissance ? new Date(convertForm.dateNaissance) : null,
          facebookGroup: convertForm.facebookGroup,
          membre: convertForm.membre,
          whisteux: convertForm.whisteux,
          actif: convertForm.actif,
          carte2025: convertForm.carte2025,
          carte2025Delivree: convertForm.carte2025Delivree ? new Date(convertForm.carte2025Delivree) : null
        })
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || 'Erreur lors de la conversion');
      }

      const result = await res.json();
      convertMessage = `✅ ${result.message}`;
      await loadJoueurs();
      activeTab = 'internes'; // Basculer vers les internes
      setTimeout(closeConvertModal, 2000);
    } catch (err: any) {
      console.error(err);
      convertMessage = `❌ ${err.message || 'Erreur lors de la conversion'}`;
    } finally {
      converting = false;
    }
  }

  // Fonctions pour la fusion
  function openMergeModal(joueur: Joueur) {
    mergingJoueur = joueur;
    mergeTargetSearch = '';
    mergeTargetId = null;
    mergeMessage = '';
    merging = false;
    showMergeModal = true;
  }

  function closeMergeModal() {
    showMergeModal = false;
    mergingJoueur = null;
    mergeTargetId = null;
    mergeMessage = '';
  }

  // Liste filtrée des joueurs internes pour la sélection de fusion
  $: mergeTargetOptions = joueursInternes.filter((j) => {
    if (!mergeTargetSearch) return true;
    const q = mergeTargetSearch.toLowerCase();
    return (
      j.alias.toLowerCase().includes(q) ||
      j.nom.toLowerCase().includes(q) ||
      j.prenom.toLowerCase().includes(q)
    );
  });

  async function mergeJoueurs() {
    if (!mergingJoueur || !mergeTargetId) {
      mergeMessage = 'Veuillez sélectionner un joueur cible.';
      return;
    }

    const targetJoueur = joueursInternes.find((j) => j.id === mergeTargetId);
    if (!confirm(
      `Fusionner "${mergingJoueur.alias}" (ID=${mergingJoueur.id}) vers "${targetJoueur?.alias}" (ID=${mergeTargetId}) ?\n\n` +
      `⚠️ Cette action est irréversible :\n` +
      `- Toutes les données de score seront transférées\n` +
      `- Le joueur "${mergingJoueur.alias}" sera supprimé`
    )) {
      return;
    }

    merging = true;
    mergeMessage = '';

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/joueurs/merge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceJoueurId: mergingJoueur.id,
          targetJoueurId: mergeTargetId
        })
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || 'Erreur lors de la fusion');
      }

      mergeMessage = `✅ ${result.message}\n` +
        `(Scores: ${result.scoresDonneUpdated}, Partenaires: ${result.partenaireUpdated}, Tables: ${result.tableConfigUpdated})`;
      await loadJoueurs();
      setTimeout(closeMergeModal, 3000);
    } catch (err: any) {
      console.error(err);
      mergeMessage = `❌ ${err.message || 'Erreur lors de la fusion'}`;
    } finally {
      merging = false;
    }
  }

  $: filteredJoueurs = (activeTab === 'internes' ? joueursInternes : joueursExternes)
    .filter((j) => {
      // Recherche texte
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          j.alias.toLowerCase().includes(q) ||
          j.nom.toLowerCase().includes(q) ||
          j.prenom.toLowerCase().includes(q) ||
          (j.email?.toLowerCase().includes(q) ?? false) ||
          (j.bk?.toLowerCase().includes(q) ?? false);
        if (!match) return false;
      }

      // Filtre whisteux (uniquement pour les internes)
      if (activeTab === 'internes' && filterWhisteux !== 'all') {
        if (filterWhisteux === 'yes' && !j.isWhisteux) return false;
        if (filterWhisteux === 'no' && j.isWhisteux) return false;
      }

      // Filtre provisoire (uniquement pour les internes)
      if (activeTab === 'internes' && filterProvisional !== 'all') {
        if (filterProvisional === 'yes' && !j.isProvisional) return false;
        if (filterProvisional === 'no' && j.isProvisional) return false;
      }

      // Filtre N° Affilié (uniquement pour les internes)
      if (activeTab === 'internes' && filterNoAffilie) {
        const noAff = j.noAffilie?.toLowerCase() ?? '';
        if (!noAff.includes(filterNoAffilie.toLowerCase())) return false;
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
        case 'alias':
          aVal = a.alias.toLowerCase();
          bVal = b.alias.toLowerCase();
          break;
        case 'nom':
          aVal = a.nom.toLowerCase();
          bVal = b.nom.toLowerCase();
          break;
        case 'prenom':
          aVal = a.prenom.toLowerCase();
          bVal = b.prenom.toLowerCase();
          break;
        case 'email':
          aVal = (a.email ?? '').toLowerCase();
          bVal = (b.email ?? '').toLowerCase();
          break;
        case 'noAffilie':
          // Tri numérique pour N° Affilié
          aVal = parseInt(a.noAffilie ?? '0', 10) || 0;
          bVal = parseInt(b.noAffilie ?? '0', 10) || 0;
          break;
        case 'isWhisteux':
          aVal = a.isWhisteux ? 1 : 0;
          bVal = b.isWhisteux ? 1 : 0;
          break;
        case 'phone':
          aVal = (a.phone ?? '').toLowerCase();
          bVal = (b.phone ?? '').toLowerCase();
          break;
        case 'bk':
          aVal = (a.bk ?? '').toLowerCase();
          bVal = (b.bk ?? '').toLowerCase();
          break;
        case 'isProvisional':
          aVal = a.isProvisional ? 1 : 0;
          bVal = b.isProvisional ? 1 : 0;
          break;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

  onMount(() => {
    // Vérifier l'authentification
    const flag = localStorage.getItem('whist_admin_ok');
    if (flag !== 'true') {
      window.location.href = '/admin';
      return;
    }
    loadJoueurs();
  });

  async function loadJoueurs() {
    isLoading = true;
    loadError = '';

    try {
      const [resInt, resExt] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/joueurs/internes`),
        fetch(`${API_BASE_URL}/api/admin/joueurs/externes`)
      ]);

      if (!resInt.ok || !resExt.ok) {
        throw new Error('Erreur lors du chargement');
      }

      joueursInternes = await resInt.json();
      joueursExternes = await resExt.json();
    } catch (err: any) {
      console.error(err);
      loadError = 'Impossible de charger les joueurs.';
    } finally {
      isLoading = false;
    }
  }

  function openEdit(joueur: Joueur) {
    editingJoueur = joueur;
    editForm = {
      nom: joueur.nom,
      prenom: joueur.prenom,
      email: joueur.email ?? '',
      phone: joueur.phone ?? '',
      alias: joueur.alias ?? '',
      bk: joueur.bk ?? '',
      noAffilie: joueur.noAffilie ?? '',
      isWhisteux: joueur.isWhisteux ?? false,
      isProvisional: joueur.isProvisional ?? false,
      isActif: joueur.isActif ?? true
    };
    saveMessage = '';
  }

  function closeEdit() {
    editingJoueur = null;
    saveMessage = '';
  }

  async function saveJoueur() {
    if (!editingJoueur) return;

    saving = true;
    saveMessage = '';

    try {
      const endpoint =
        editingJoueur.type === 'interne'
          ? `${API_BASE_URL}/api/admin/joueurs/internes/${editingJoueur.id}`
          : `${API_BASE_URL}/api/admin/joueurs/externes/${editingJoueur.id}`;

      const body =
        editingJoueur.type === 'interne'
          ? {
              nom: editForm.nom,
              prenom: editForm.prenom,
              email: editForm.email || null,
              alias: editForm.alias || null,
              bk: editForm.bk || null,
              noAffilie: editForm.noAffilie || null,
              isWhisteux: editForm.isWhisteux,
              isProvisional: editForm.isProvisional,
              isActif: editForm.isActif
            }
          : {
              nom: editForm.nom,
              prenom: editForm.prenom,
              email: editForm.email || null,
              phone: editForm.phone || null
            };

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error('Erreur lors de la sauvegarde');

      saveMessage = 'Joueur mis à jour ✅';
      await loadJoueurs();
      setTimeout(closeEdit, 1000);
    } catch (err: any) {
      console.error(err);
      saveMessage = 'Erreur lors de la sauvegarde ❌';
    } finally {
      saving = false;
    }
  }

  async function deleteJoueur(joueur: Joueur) {
    if (joueur.type === 'interne') {
      alert('Les joueurs internes ne peuvent pas être supprimés.');
      return;
    }

    if (!confirm(`Supprimer le joueur "${joueur.alias}" ?`)) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/admin/joueurs/externes/${joueur.id}`,
        { method: 'DELETE' }
      );

      if (!res.ok) throw new Error('Erreur lors de la suppression');

      await loadJoueurs();
      closeEdit();
    } catch (err: any) {
      console.error(err);
      alert('Erreur lors de la suppression.');
    }
  }

  function openNewForm() {
    showNewForm = true;
    newForm = { nom: '', prenom: '', email: '', phone: '' };
    createMessage = '';
  }

  function closeNewForm() {
    showNewForm = false;
    createMessage = '';
  }

  async function createJoueur() {
    if (!newForm.nom.trim() || !newForm.prenom.trim()) {
      createMessage = 'Nom et prénom sont obligatoires.';
      return;
    }

    creating = true;
    createMessage = '';

    try {
      const res = await fetch(`${API_BASE_URL}/api/joueurs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastName: newForm.nom,
          firstName: newForm.prenom,
          email: newForm.email || null,
          phone: newForm.phone || null
        })
      });

      if (!res.ok) throw new Error('Erreur lors de la création');

      createMessage = 'Joueur créé ✅';
      await loadJoueurs();
      activeTab = 'externes';
      setTimeout(closeNewForm, 1000);
    } catch (err: any) {
      console.error(err);
      createMessage = 'Erreur lors de la création ❌';
    } finally {
      creating = false;
    }
  }
</script>

<svelte:head>
  <title>Administration – Joueurs</title>
</svelte:head>

<div class="admin-page">
  <h1>
    <a href="/admin" class="back-link">← Administration</a>
    <span class="sep">⟶</span> Gestion des joueurs
  </h1>

  <div class="admin-card">
    <!-- Tabs -->
    <div class="tabs-row">
      <button
        class="tab-btn"
        class:active={activeTab === 'internes'}
        on:click={() => (activeTab = 'internes')}
      >
        👥 Joueurs internes ({joueursInternes.length})
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'externes'}
        on:click={() => (activeTab = 'externes')}
      >
        🌍 Joueurs externes ({joueursExternes.length})
      </button>
    </div>

    <!-- Filtres -->
    <div class="filters-row">
      <input
        type="text"
        class="search-input"
        placeholder="Rechercher un joueur..."
        bind:value={searchQuery}
      />

      {#if activeTab === 'internes'}
        <input
          type="text"
          class="filter-input"
          placeholder="N° Affilié..."
          bind:value={filterNoAffilie}
        />
        <select class="filter-select" bind:value={filterProvisional} title="Filtrer par statut provisoire">
          <option value="no">Affiliés uniquement</option>
          <option value="all">Tous</option>
          <option value="yes">Provisoires uniquement</option>
        </select>
        <select class="filter-select" bind:value={filterWhisteux}>
          <option value="all">Tous</option>
          <option value="yes">Whisteux uniquement</option>
          <option value="no">Non-whisteux</option>
        </select>
      {/if}

      {#if activeTab === 'externes'}
        <button class="btn-add" on:click={openNewForm}>
          + Nouveau joueur
        </button>
      {/if}
    </div>

    <!-- Contenu -->
    {#if isLoading}
      <p>Chargement…</p>
    {:else if loadError}
      <p class="error">{loadError}</p>
    {:else if filteredJoueurs.length === 0}
      <p>Aucun joueur trouvé.</p>
    {:else}
      <!-- Vue desktop: tableau -->
      <div class="desktop-view">
        <table class="joueurs-table">
          <thead>
            <tr>
              <th class="sortable" on:click={() => toggleSort('id')}>ID <span class="sort-icon">{sortIcons.id}</span></th>
              <th class="sortable" on:click={() => toggleSort('alias')}>Alias <span class="sort-icon">{sortIcons.alias}</span></th>
              <th class="sortable" on:click={() => toggleSort('nom')}>Nom <span class="sort-icon">{sortIcons.nom}</span></th>
              <th class="sortable" on:click={() => toggleSort('prenom')}>Prénom <span class="sort-icon">{sortIcons.prenom}</span></th>
              <th class="sortable" on:click={() => toggleSort('email')}>Email <span class="sort-icon">{sortIcons.email}</span></th>
              {#if activeTab === 'internes'}
                <th class="sortable" on:click={() => toggleSort('bk')}>Bk <span class="sort-icon">{sortIcons.bk}</span></th>
                <th class="sortable" on:click={() => toggleSort('noAffilie')}>N° Affilié <span class="sort-icon">{sortIcons.noAffilie}</span></th>
                <th class="sortable" on:click={() => toggleSort('isProvisional')}>Prov. <span class="sort-icon">{sortIcons.isProvisional}</span></th>
                <th class="sortable" on:click={() => toggleSort('isWhisteux')}>Whisteux <span class="sort-icon">{sortIcons.isWhisteux}</span></th>
              {:else}
                <th class="sortable" on:click={() => toggleSort('phone')}>Téléphone <span class="sort-icon">{sortIcons.phone}</span></th>
              {/if}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredJoueurs as joueur}
              <tr class:provisional-row={joueur.isProvisional}>
                <td>{joueur.id}</td>
                <td class="alias-cell">{joueur.alias}</td>
                <td>{joueur.nom}</td>
                <td>{joueur.prenom}</td>
                <td>{joueur.email ?? '-'}</td>
                {#if activeTab === 'internes'}
                  <td class="bk-cell">{joueur.bk ?? '-'}</td>
                  <td>{joueur.noAffilie ?? '-'}</td>
                  <td class="center">
                    {#if joueur.isProvisional}
                      <span class="badge-provisional" title="Joueur provisoire">⏳</span>
                    {:else}
                      <span class="badge-affiliated" title="Joueur affilié">✓</span>
                    {/if}
                  </td>
                  <td class="center">
                    {#if joueur.isWhisteux}
                      <span class="badge-yes">✓</span>
                    {:else}
                      <span class="badge-no">✗</span>
                    {/if}
                  </td>
                {:else}
                  <td>{joueur.phone ?? '-'}</td>
                {/if}
                <td class="actions-cell">
                  <button class="btn-edit" on:click={() => openEdit(joueur)} title="Modifier">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  </button>
                  {#if activeTab === 'externes' || joueur.isProvisional}
                    <button class="btn-convert" on:click={() => openConvertModal(joueur)} title="Convertir en joueur affilié">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </button>
                  {/if}
                  {#if activeTab === 'externes'}
                    <button class="btn-merge" on:click={() => openMergeModal(joueur)} title="Fusionner avec un joueur interne">
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
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
          {#each filteredJoueurs as joueur}
            <div class="joueur-card" class:provisional-card={joueur.isProvisional}>
              <div class="card-header">
                <span class="card-alias">{joueur.alias}</span>
                <div class="card-header-right">
                  {#if joueur.isProvisional}
                    <span class="badge-provisional" title="Provisoire">⏳</span>
                  {/if}
                  <span class="card-id">#{joueur.id}</span>
                </div>
              </div>
              <div class="card-body">
                <div class="card-name">{joueur.prenom} {joueur.nom}</div>
                {#if joueur.email}
                  <div class="card-info">
                    <span class="card-label">📧</span>
                    <span class="card-value">{joueur.email}</span>
                  </div>
                {/if}
                {#if activeTab === 'internes'}
                  {#if joueur.bk}
                    <div class="card-info">
                      <span class="card-label">Bk:</span>
                      <span class="card-value bk-value">{joueur.bk}</span>
                    </div>
                  {/if}
                  {#if joueur.noAffilie}
                    <div class="card-info">
                      <span class="card-label">N° Affilié:</span>
                      <span class="card-value">{joueur.noAffilie}</span>
                    </div>
                  {/if}
                  <div class="card-info">
                    <span class="card-label">Whisteux:</span>
                    {#if joueur.isWhisteux}
                      <span class="badge-yes">✓ Oui</span>
                    {:else}
                      <span class="badge-no">✗ Non</span>
                    {/if}
                  </div>
                {:else if joueur.phone}
                  <div class="card-info">
                    <span class="card-label">📱</span>
                    <span class="card-value">{joueur.phone}</span>
                  </div>
                {/if}
              </div>
              <div class="card-actions">
                <button class="btn-edit" on:click={() => openEdit(joueur)} title="Modifier">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                  <span>Modifier</span>
                </button>
                {#if activeTab === 'externes' || joueur.isProvisional}
                  <button class="btn-convert" on:click={() => openConvertModal(joueur)} title="Convertir en joueur affilié">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    <span>Affilier</span>
                  </button>
                {/if}
                {#if activeTab === 'externes'}
                  <button class="btn-merge" on:click={() => openMergeModal(joueur)} title="Fusionner">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
                    <span>Fusionner</span>
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </div>

  <!-- Modal édition -->
  {#if editingJoueur}
    <div class="modal-backdrop" on:click={closeEdit} role="presentation">
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
      <div class="modal" on:click|stopPropagation role="dialog" tabindex="-1">
        <h2>Modifier le joueur</h2>
        <p class="modal-subtitle">{editingJoueur.alias}</p>

        {#if editingJoueur.type === 'interne'}
          <div class="form-row">
            <div class="form-group">
              <label for="edit-alias">Alias</label>
              <input id="edit-alias" type="text" bind:value={editForm.alias} />
            </div>
            <div class="form-group">
              <label for="edit-bk">Code Bk</label>
              <input id="edit-bk" type="text" bind:value={editForm.bk} />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="edit-nom">Nom</label>
              <input id="edit-nom" type="text" bind:value={editForm.nom} />
            </div>
            <div class="form-group">
              <label for="edit-prenom">Prénom</label>
              <input id="edit-prenom" type="text" bind:value={editForm.prenom} />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="edit-noAffilie">N° Affilié</label>
              <input id="edit-noAffilie" type="text" bind:value={editForm.noAffilie} />
            </div>
            <div class="form-group">
              <label for="edit-email">Email</label>
              <input id="edit-email" type="email" bind:value={editForm.email} />
            </div>
          </div>
          <div class="form-row checkbox-row">
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={editForm.isWhisteux} />
              <span>Whisteux</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={editForm.isProvisional} />
              <span>Provisoire</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" bind:checked={editForm.isActif} />
              <span>Actif</span>
            </label>
          </div>
        {:else}
          <div class="form-row">
            <div class="form-group">
              <label for="edit-nom">Nom</label>
              <input id="edit-nom" type="text" bind:value={editForm.nom} />
            </div>
            <div class="form-group">
              <label for="edit-prenom">Prénom</label>
              <input id="edit-prenom" type="text" bind:value={editForm.prenom} />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="edit-email">Email</label>
              <input id="edit-email" type="email" bind:value={editForm.email} />
            </div>
            <div class="form-group">
              <label for="edit-phone">Téléphone</label>
              <input id="edit-phone" type="text" bind:value={editForm.phone} />
            </div>
          </div>
        {/if}

        {#if saveMessage}
          <p class={saveMessage.includes('✅') ? 'success' : 'error'}>{saveMessage}</p>
        {/if}

        <div class="modal-actions">
          <button class="btn-cancel" on:click={closeEdit}>Annuler</button>
          {#if editingJoueur.type === 'externe'}
            <button class="btn-danger" on:click={() => deleteJoueur(editingJoueur!)}>
              Supprimer
            </button>
          {/if}
          <button class="btn-save" on:click={saveJoueur} disabled={saving}>
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Modal nouveau joueur -->
  {#if showNewForm}
    <div class="modal-backdrop" on:click={closeNewForm} role="presentation">
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
      <div class="modal" on:click|stopPropagation role="dialog" tabindex="-1">
        <h2>Nouveau joueur externe</h2>

        <div class="form-row">
          <div class="form-group">
            <label for="new-prenom">Prénom *</label>
            <input id="new-prenom" type="text" bind:value={newForm.prenom} />
          </div>
          <div class="form-group">
            <label for="new-nom">Nom *</label>
            <input id="new-nom" type="text" bind:value={newForm.nom} />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="new-email">Email</label>
            <input id="new-email" type="email" bind:value={newForm.email} />
          </div>
          <div class="form-group">
            <label for="new-phone">Téléphone</label>
            <input id="new-phone" type="text" bind:value={newForm.phone} />
          </div>
        </div>

        {#if createMessage}
          <p class={createMessage.includes('✅') ? 'success' : 'error'}>{createMessage}</p>
        {/if}

        <div class="modal-actions">
          <button class="btn-cancel" on:click={closeNewForm}>Annuler</button>
          <button class="btn-save" on:click={createJoueur} disabled={creating}>
            {creating ? 'Création...' : 'Créer le joueur'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Modal conversion joueur externe vers interne -->
  {#if showConvertModal && convertingJoueur}
    <div class="modal-backdrop" on:click={closeConvertModal} role="presentation">
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
      <div class="modal modal-convert" on:click|stopPropagation role="dialog" tabindex="-1">
        <h2>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          Affilier le joueur
        </h2>
        <p class="modal-subtitle">Convertir <strong>{convertingJoueur.alias}</strong> en joueur interne affilié</p>

        <div class="convert-info">
          <p>Ce joueur externe va devenir un membre affilié du club. Veuillez compléter les informations d'affiliation.</p>
        </div>

        <!-- Section Affiliation -->
        <h3 class="section-title">📋 Affiliation</h3>
        <div class="form-row">
          <div class="form-group">
            <label for="convert-noAffilie">N° Affiliation *</label>
            <input id="convert-noAffilie" type="text" bind:value={convertForm.noAffilie} placeholder="Ex: 12345" />
            <span class="hint">Prochain n° suggéré</span>
          </div>
          <div class="form-group">
            <label for="convert-bk">Code Bk *</label>
            <input id="convert-bk" type="text" bind:value={convertForm.bk} placeholder="Ex: JP, JP2..." />
            <span class="hint">Initiales uniques (modifiable)</span>
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="convert-club">Club</label>
            <input id="convert-club" type="text" bind:value={convertForm.club} placeholder="Ex: Les Amis Réunis" />
          </div>
          <div class="form-group">
            <label for="convert-titre">Titre</label>
            <select id="convert-titre" bind:value={convertForm.titre}>
              <option value="">-- Aucun --</option>
              <option value="Mr.">Mr.</option>
              <option value="Mme">Mme</option>
              <option value="Mlle">Mlle</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="convert-dateDebut">Date début affiliation</label>
          <input id="convert-dateDebut" type="date" bind:value={convertForm.dateDebut} />
        </div>

        <!-- Section Identité -->
        <h3 class="section-title">👤 Identité</h3>
        <div class="form-row">
          <div class="form-group">
            <label for="convert-nom">Nom *</label>
            <input id="convert-nom" type="text" bind:value={convertForm.nom} placeholder="Nom de famille" />
          </div>
          <div class="form-group">
            <label for="convert-prenom">Prénom *</label>
            <input id="convert-prenom" type="text" bind:value={convertForm.prenom} placeholder="Prénom" />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="convert-alias">Alias</label>
            <input id="convert-alias" type="text" bind:value={convertForm.alias} placeholder="Pseudo / Alias" />
          </div>
          <div class="form-group">
            <label for="convert-sexe">Sexe</label>
            <select id="convert-sexe" bind:value={convertForm.sexe}>
              <option value="">-- Non spécifié --</option>
              <option value="M">Masculin</option>
              <option value="F">Féminin</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label for="convert-dateNaissance">Date de naissance</label>
          <input id="convert-dateNaissance" type="date" bind:value={convertForm.dateNaissance} />
        </div>

        <!-- Section Contact -->
        <h3 class="section-title">📞 Contact</h3>
        <div class="form-row">
          <div class="form-group">
            <label for="convert-email">Email</label>
            <input id="convert-email" type="email" bind:value={convertForm.email} placeholder="email@exemple.com" />
          </div>
          <div class="form-group">
            <label for="convert-phone">Téléphone</label>
            <input id="convert-phone" type="text" bind:value={convertForm.phone} placeholder="Ex: 0470 12 34 56" />
          </div>
        </div>

        <!-- Section Statuts -->
        <h3 class="section-title">🏷️ Statuts</h3>
        <div class="form-row checkbox-row">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={convertForm.membre} />
            <span>Membre</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={convertForm.whisteux} />
            <span>Whisteux</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={convertForm.actif} />
            <span>Actif</span>
          </label>
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={convertForm.facebookGroup} />
            <span>Groupe Facebook</span>
          </label>
        </div>

        <!-- Section Carte 2025 -->
        <h3 class="section-title">💳 Carte 2025</h3>
        <div class="form-row">
          <label class="checkbox-label">
            <input type="checkbox" bind:checked={convertForm.carte2025} />
            <span>Carte 2025</span>
          </label>
          <div class="form-group" style="flex: 1;">
            <label for="convert-carte2025Delivree">Date de délivrance</label>
            <input id="convert-carte2025Delivree" type="date" bind:value={convertForm.carte2025Delivree} disabled={!convertForm.carte2025} />
          </div>
        </div>

        {#if convertMessage}
          <p class={convertMessage.includes('✅') ? 'success' : 'error'}>{convertMessage}</p>
        {/if}

        <div class="modal-actions">
          <button class="btn-cancel" on:click={closeConvertModal}>Annuler</button>
          <button class="btn-convert-confirm" on:click={convertJoueur} disabled={converting}>
            {converting ? 'Conversion...' : 'Affilier le joueur'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Modal fusion joueur externe avec interne -->
  {#if showMergeModal && mergingJoueur}
    <div class="modal-backdrop" on:click={closeMergeModal} role="presentation">
      <!-- svelte-ignore a11y_no_noninteractive_element_interactions a11y_click_events_have_key_events -->
      <div class="modal modal-merge" on:click|stopPropagation role="dialog" tabindex="-1">
        <h2>
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>
          Fusionner un joueur
        </h2>
        <p class="modal-subtitle">Transférer les données de <strong>{mergingJoueur.alias}</strong> vers un joueur interne</p>

        <div class="merge-warning">
          <p><strong>Attention :</strong> Cette action est irréversible. Toutes les données (scores, partenaires, tables) seront transférées vers le joueur cible, puis le joueur externe sera supprimé.</p>
        </div>

        <div class="merge-source">
          <h3>Joueur source (externe)</h3>
          <div class="merge-player-info">
            <span class="merge-alias">{mergingJoueur.alias}</span>
            <span class="merge-id">ID: {mergingJoueur.id}</span>
            <span class="merge-name">{mergingJoueur.prenom} {mergingJoueur.nom}</span>
          </div>
        </div>

        <div class="merge-arrow">→</div>

        <div class="merge-target">
          <h3>Joueur cible (interne)</h3>
          <input
            type="text"
            class="merge-search"
            placeholder="Rechercher un joueur interne..."
            bind:value={mergeTargetSearch}
          />
          <div class="merge-player-list">
            {#each mergeTargetOptions.slice(0, 10) as joueur}
              <button
                class="merge-player-option"
                class:selected={mergeTargetId === joueur.id}
                on:click={() => (mergeTargetId = joueur.id)}
              >
                <span class="option-alias">{joueur.alias}</span>
                <span class="option-name">{joueur.prenom} {joueur.nom}</span>
                <span class="option-id">ID: {joueur.id}</span>
                {#if mergeTargetId === joueur.id}
                  <span class="option-check">✓</span>
                {/if}
              </button>
            {/each}
            {#if mergeTargetOptions.length === 0}
              <p class="no-results">Aucun joueur trouvé</p>
            {/if}
            {#if mergeTargetOptions.length > 10}
              <p class="more-results">... et {mergeTargetOptions.length - 10} autres</p>
            {/if}
          </div>
        </div>

        {#if mergeMessage}
          <p class={mergeMessage.includes('✅') ? 'success' : 'error'} style="white-space: pre-line;">{mergeMessage}</p>
        {/if}

        <div class="modal-actions">
          <button class="btn-cancel" on:click={closeMergeModal}>Annuler</button>
          <button class="btn-merge-confirm" on:click={mergeJoueurs} disabled={merging || !mergeTargetId}>
            {merging ? 'Fusion...' : 'Fusionner'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<footer class="copyright">
  © {currentYear} Wb-Scoring — Tous droits réservés
</footer>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
  }

  :global(body) {
    font-family: 'Poppins', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: radial-gradient(circle at top, #125c2a 0%, #04140a 40%, #020506 100%);
    background-attachment: fixed;
    background-repeat: no-repeat;
    background-color: #020506;
    color: #ffffff;
    padding-bottom: 50px;
  }

  .admin-page {
    max-width: 1200px;
    margin: 2rem auto;
    padding: 1rem;
    color: #f9fafb;
    box-sizing: border-box;
    overflow-x: hidden;
  }

  h1 {
    font-size: 1.8rem;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .back-link {
    color: #22c55e;
    text-decoration: none;
    font-size: 1.2rem;
    font-weight: 600;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  .sep {
    opacity: 0.9;
    margin: 0 0.4rem;
  }

  .admin-card {
    background: #020617;
    border-radius: 16px;
    padding: 1.5rem;
    border: 1px solid rgba(34, 197, 94, 0.3);
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
  }

  .tabs-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .tab-btn {
    padding: 0.6rem 1.2rem;
    border: 1px solid rgba(34, 197, 94, 0.3);
    background: transparent;
    color: #9ca3af;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    border-color: rgba(34, 197, 94, 0.6);
  }

  .tab-btn.active {
    background: linear-gradient(135deg, #14532d, #052e16);
    color: #f9fafb;
    border-color: #22c55e;
  }

  .filters-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
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

  .filter-input {
    width: 120px;
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

  .joueurs-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
    font-size: 0.9rem;
  }

  .joueurs-table th,
  .joueurs-table td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid rgba(51, 65, 85, 0.9);
    text-align: left;
  }

  .joueurs-table th {
    background: linear-gradient(to bottom, #14532d, #052e16);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.78rem;
  }

  .joueurs-table th.sortable {
    cursor: pointer;
    user-select: none;
    transition: background 0.2s;
  }

  .joueurs-table th.sortable:hover {
    background: linear-gradient(to bottom, #166534, #14532d);
  }

  .sort-icon {
    font-size: 0.7rem;
    opacity: 0.7;
    margin-left: 0.3rem;
  }

  .joueurs-table tbody tr:nth-child(even) {
    background: #020b06;
  }

  .joueurs-table tbody tr:hover {
    background: #064e3b;
  }

  .alias-cell {
    font-weight: 600;
    color: #22c55e;
  }

  .center {
    text-align: center;
  }

  .badge-yes {
    color: #22c55e;
    font-weight: bold;
  }

  .badge-no {
    color: #6b7280;
  }

  .badge-provisional {
    color: #f59e0b;
    font-weight: bold;
  }

  .badge-affiliated {
    color: #22c55e;
    font-weight: bold;
  }

  .provisional-row {
    background: rgba(245, 158, 11, 0.05);
  }

  .provisional-row:hover {
    background: rgba(245, 158, 11, 0.1) !important;
  }

  .bk-cell {
    font-family: monospace;
    font-weight: 600;
    color: #60a5fa;
  }

  .btn-edit {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.7rem;
    border-radius: 6px;
    border: 1px solid rgba(34, 197, 94, 0.5);
    background: transparent;
    color: #22c55e;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .btn-edit svg {
    flex-shrink: 0;
  }

  .btn-edit:hover {
    background: rgba(34, 197, 94, 0.1);
  }

  .actions-cell {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  .btn-convert {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.7rem;
    border-radius: 6px;
    border: 1px solid rgba(59, 130, 246, 0.5);
    background: transparent;
    color: #60a5fa;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .btn-convert:hover {
    background: rgba(59, 130, 246, 0.1);
  }

  .btn-convert svg {
    flex-shrink: 0;
  }

  .btn-merge {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.7rem;
    border-radius: 6px;
    border: 1px solid rgba(249, 115, 22, 0.5);
    background: transparent;
    color: #f97316;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .btn-merge:hover {
    background: rgba(249, 115, 22, 0.1);
  }

  .btn-merge svg {
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
  }

  .form-group label {
    font-size: 0.85rem;
    color: #9ca3af;
  }

  .form-group input[type='text'],
  .form-group input[type='email'] {
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(75, 85, 99, 0.8);
    background: #020617;
    color: #e5e7eb;
  }

  .form-group input[type='checkbox'] {
    margin-right: 0.5rem;
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

  .btn-danger {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: none;
    background: #dc2626;
    color: white;
    cursor: pointer;
  }

  .error {
    color: #f97373;
  }

  .success {
    color: #22c55e;
  }

  /* Modal conversion */
  .modal-convert {
    max-height: 85vh;
    overflow-y: auto;
    max-width: 600px;
  }

  .modal-convert h2 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #60a5fa;
  }

  .modal-convert h2 svg {
    flex-shrink: 0;
  }

  .modal-convert h3.section-title {
    font-size: 0.95rem;
    color: #22c55e;
    margin: 1rem 0 0.5rem 0;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid rgba(34, 197, 94, 0.3);
  }

  .convert-info {
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
  }

  .convert-info p {
    margin: 0;
    color: #9ca3af;
    font-size: 0.85rem;
  }

  .checkbox-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    margin-bottom: 0.5rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    color: #e5e7eb;
    font-size: 0.9rem;
  }

  .checkbox-label input[type='checkbox'] {
    width: 18px;
    height: 18px;
    accent-color: #22c55e;
    cursor: pointer;
  }

  .form-group select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(75, 85, 99, 0.8);
    background: #020617;
    color: #e5e7eb;
    font-size: 0.9rem;
  }

  .form-group input[type='date'] {
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(75, 85, 99, 0.8);
    background: #020617;
    color: #e5e7eb;
  }

  .form-group input:disabled,
  .form-group select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .hint {
    font-size: 0.75rem;
    color: #6b7280;
  }

  .btn-convert-confirm {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: none;
    background: #3b82f6;
    color: white;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-convert-confirm:hover {
    filter: brightness(1.1);
  }

  .btn-convert-confirm:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Modal merge */
  .modal-merge {
    max-height: 85vh;
    overflow-y: auto;
    max-width: 550px;
  }

  .modal-merge h2 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #f97316;
  }

  .modal-merge h2 svg {
    flex-shrink: 0;
  }

  .modal-merge h3 {
    font-size: 0.9rem;
    color: #9ca3af;
    margin: 0 0 0.5rem 0;
  }

  .merge-warning {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
  }

  .merge-warning p {
    margin: 0;
    color: #fca5a5;
    font-size: 0.85rem;
  }

  .merge-source {
    background: rgba(75, 85, 99, 0.2);
    border-radius: 8px;
    padding: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .merge-player-info {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  .merge-alias {
    font-weight: 700;
    color: #f97316;
    font-size: 1rem;
  }

  .merge-id {
    font-size: 0.75rem;
    color: #6b7280;
    background: rgba(75, 85, 99, 0.4);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
  }

  .merge-name {
    color: #9ca3af;
    font-size: 0.85rem;
  }

  .merge-arrow {
    text-align: center;
    font-size: 1.5rem;
    color: #f97316;
    margin: 0.5rem 0;
  }

  .merge-target {
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 8px;
    padding: 0.75rem;
    margin-bottom: 1rem;
  }

  .merge-search {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(75, 85, 99, 0.8);
    background: #020617;
    color: #e5e7eb;
    margin-bottom: 0.5rem;
    box-sizing: border-box;
  }

  .merge-player-list {
    max-height: 200px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .merge-player-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    border-radius: 6px;
    border: 1px solid rgba(75, 85, 99, 0.5);
    background: transparent;
    color: #e5e7eb;
    cursor: pointer;
    text-align: left;
    font-size: 0.85rem;
    transition: all 0.15s;
  }

  .merge-player-option:hover {
    background: rgba(34, 197, 94, 0.1);
    border-color: rgba(34, 197, 94, 0.5);
  }

  .merge-player-option.selected {
    background: rgba(34, 197, 94, 0.2);
    border-color: #22c55e;
  }

  .option-alias {
    font-weight: 600;
    color: #22c55e;
  }

  .option-name {
    flex: 1;
    color: #9ca3af;
    font-size: 0.8rem;
  }

  .option-id {
    font-size: 0.7rem;
    color: #6b7280;
  }

  .option-check {
    color: #22c55e;
    font-weight: bold;
  }

  .no-results,
  .more-results {
    color: #6b7280;
    font-size: 0.8rem;
    text-align: center;
    padding: 0.5rem;
  }

  .btn-merge-confirm {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: none;
    background: #f97316;
    color: white;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-merge-confirm:hover {
    filter: brightness(1.1);
  }

  .btn-merge-confirm:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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

  /* Responsive: desktop vs mobile */
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

    .tabs-row {
      flex-direction: column;
    }

    .tab-btn {
      width: 100%;
      text-align: center;
    }

    .filters-row {
      flex-direction: column;
    }

    .search-input {
      width: 100%;
      min-width: unset;
      box-sizing: border-box;
    }

    .filter-input {
      width: 100%;
      box-sizing: border-box;
    }

    .filter-select {
      width: 100%;
      box-sizing: border-box;
    }

    .btn-add {
      width: 100%;
      box-sizing: border-box;
    }

    .admin-card {
      padding: 1rem;
      overflow-x: hidden;
    }

    /* Cartes joueurs - version compacte */
    .mobile-cards {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .joueur-card {
      background: linear-gradient(135deg, #0f172a 0%, #020617 100%);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 10px;
      padding: 0.5rem 0.65rem;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
    }

    .joueur-card.provisional-card {
      border-color: rgba(245, 158, 11, 0.5);
      background: linear-gradient(135deg, #1e1a0f 0%, #0a0805 100%);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.25rem;
      padding-bottom: 0.25rem;
      border-bottom: 1px solid rgba(51, 65, 85, 0.4);
    }

    .card-header-right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .card-alias {
      font-size: 0.95rem;
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
      gap: 0.15rem;
    }

    .card-name {
      font-size: 0.85rem;
      font-weight: 500;
      color: #e5e7eb;
    }

    .card-info {
      display: flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.8rem;
      color: #9ca3af;
    }

    .card-label {
      font-size: 0.75rem;
    }

    .card-value {
      color: #d1d5db;
      word-break: break-all;
      font-size: 0.8rem;
    }

    .bk-value {
      font-family: monospace;
      font-weight: 600;
      color: #60a5fa;
    }

    .card-actions {
      margin-top: 0.4rem;
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    .card-actions .btn-edit,
    .card-actions .btn-convert,
    .card-actions .btn-merge {
      padding: 0.3rem 0.8rem;
      font-size: 0.75rem;
    }

    /* Modal responsive */
    .modal {
      max-width: 95%;
      padding: 1rem;
    }

    .form-row {
      flex-direction: column;
      gap: 0.5rem;
    }

    .modal-actions {
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .modal-actions button {
      flex: 1;
      min-width: 80px;
    }
  }

  @media (max-width: 400px) {
    .admin-page {
      margin: 1rem auto;
      padding: 0.5rem;
    }

    .admin-card {
      padding: 0.75rem;
      border-radius: 12px;
    }

    .joueur-card {
      padding: 0.6rem;
    }

    .card-alias {
      font-size: 1rem;
    }
  }
</style>
