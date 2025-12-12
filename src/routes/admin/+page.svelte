<script lang="ts">
  import { onMount } from 'svelte';
  import JetonPoker from '$lib/components/JetonPoker.svelte';

  const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';

  // PIN admin (utilisé pour les appels API)
  const ADMIN_PIN = '060784';

  const currentYear = new Date().getFullYear();

  // 🔥 Interface pour les types de compétition depuis l'API
  interface CompetitionTypeInfo {
    id: number;
    name: string;
    shortName: string | null;
    description: string | null;
    isActive: boolean;
    sortOrder: number;
  }

  // 🔥 Types de compétition chargés depuis l'API
  let allCompetitionTypes: CompetitionTypeInfo[] = [];

  // Mode d'affichage : 'menu', 'manches' ou 'password'
  let viewMode: 'menu' | 'manches' | 'password' = 'menu';

  // Éléments du menu admin
  const adminMenuItems = [
    {
      id: 'manches',
      title: 'Gestion des tables',
      description: 'Consulter, modifier et supprimer les tables de jeu',
      icon: '♤',
      action: () => { viewMode = 'manches'; }
    },
    {
      id: 'joueurs',
      title: 'Gestion des joueurs',
      description: 'Gérer les joueurs internes et externes',
      icon: '👥',
      href: '/admin/joueurs'
    },
    {
      id: 'clubs',
      title: 'Gestion des clubs',
      description: 'Gérer les clubs et leurs informations',
      icon: '🏛️',
      href: '/admin/clubs'
    },
    {
      id: 'competition-types',
      title: 'Types de compétition',
      description: 'Gérer les types de compétition (Championnat, Interclub, etc.)',
      icon: '🏅',
      href: '/admin/competition-types'
    },
    {
      id: 'archives',
      title: 'Archives PDF',
      description: 'Consulter les feuilles de points archivées',
      icon: '📄',
      href: '/admin/archives'
    },
    {
      id: 'password',
      title: 'Mot de passe utilisateur',
      description: 'Gérer le code d\'accès hebdomadaire',
      icon: '🔐',
      action: () => { viewMode = 'password'; loadCurrentPassword(); }
    },
    {
      id: 'competitions',
      title: 'Configuration compétitions',
      description: 'Gérer les compétitions et leurs paramètres',
      icon: '🏆',
      href: '/admin/competitions'
    },
    {
      id: 'arbitres',
      title: 'Gestion des arbitres',
      description: 'Gérer les arbitres et leurs codes d\'accès',
      icon: '⚖️',
      href: '/admin/arbitres'
    },
    {
      id: 'penalites',
      title: 'Gestion des pénalités',
      description: 'Attribuer des jetons de pénalité aux joueurs',
      icon: 'jeton',
      href: '/admin/penalites'
    },
    {
      id: 'config',
      title: 'Données de référence',
      description: 'Gérer les annonces, jetons et grilles par défaut',
      icon: '⚙️',
      href: '/admin/config'
    }
  ];

  // --- Gestion du mot de passe utilisateur ---
  let currentUserPassword = '';
  let newUserPassword = '';
  let passwordLoading = false;
  let passwordError = '';
  let passwordSuccess = '';

  async function loadCurrentPassword() {
    passwordLoading = true;
    passwordError = '';
    passwordSuccess = '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/user-password`, {
        headers: { 'X-Admin-Pin': ADMIN_PIN }
      });
      if (res.ok) {
        const data = await res.json();
        currentUserPassword = data.password || '';
        newUserPassword = currentUserPassword;
      } else {
        passwordError = 'Erreur lors du chargement du mot de passe';
      }
    } catch (err) {
      passwordError = 'Impossible de contacter le serveur';
    } finally {
      passwordLoading = false;
    }
  }

  async function updateUserPassword() {
    if (!newUserPassword.trim()) {
      passwordError = 'Le mot de passe ne peut pas être vide';
      return;
    }
    passwordLoading = true;
    passwordError = '';
    passwordSuccess = '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/user-password`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminPin: ADMIN_PIN, newPassword: newUserPassword.trim() })
      });
      if (res.ok) {
        currentUserPassword = newUserPassword.trim();
        passwordSuccess = 'Mot de passe mis à jour avec succès !';
      } else {
        const errData = await res.json().catch(() => ({}));
        passwordError = errData.error || 'Erreur lors de la mise à jour';
      }
    } catch (err) {
      passwordError = 'Impossible de contacter le serveur';
    } finally {
      passwordLoading = false;
    }
  }

  interface AdminPlayerDto {
  playerId: number | null;
  alias: string;
  }

  interface AdminFinalScoreDto {
  playerId: number | null;
  alias: string;
  score: number;
  }

  interface AdminDonneScoreDto {
  playerId: number | null;
  alias: string;
  annonce: string | null;
  partenairePk: string | null;   // texte
  plis: number | null;
  resultat: string | null;
  dames: number | null;
  arbitre: boolean | null;
  score: number;
  cumul: number;
  }

  interface AdminDonneSummaryDto {
  donneNumber: number;
  annoncePrincipale: string | null;
  hasArbitre: boolean;
  scores: AdminDonneScoreDto[];
  }

  interface AdminMancheDetailDto {
  tableConfigId: number;
  tableName: string;
  mancheNumber: number;
  playerCount: number;
  startTime: string | null;
  endTime: string | null;
  players: AdminPlayerDto[];
  finalScores: AdminFinalScoreDto[];
  donnes: AdminDonneSummaryDto[];
  }

  interface AdminMancheHeaderDto {
  tableConfigId: number;
  tableName: string;
  mancheNumber: number;
  playerCount: number;
  startTime: string | null;
  endTime: string | null;
  competitionType: number | null;
  competitionNumber: number | null;
  competitionName: string | null;
  donnesCount: number;
  isCompleted: boolean;
  isProtected: boolean;
  }




  let manches: AdminMancheHeaderDto[] = [];
  let isLoading = false;
  let loadError = '';

  // Tri
  type SortKey =
  | 'tableConfigId'
  | 'competitionType'
  | 'competitionNumber'
  | 'tableName'
  | 'mancheNumber'
  | 'playerCount'
  | 'donnesCount'
  | 'startTime'
  | 'endTime'
  | 'isCompleted';

  let sortKey: SortKey | null = null;
  let sortDirection: 'asc' | 'desc' = 'asc';

  function toggleSort(key: SortKey) {
  if (sortKey === key) {
  sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
  sortKey = key;
  sortDirection = 'asc';
  }
  }

  // Sélection multiple pour suppression
  let selectedIds: Set<number> = new Set();
  let deletingManches = false;
  let deleteError = '';
  let deleteSuccess = '';

  // Réactive : manches sélectionnables (non protégées)
  $: selectableManches = filteredSortedManches.filter(m => !m.isProtected);

  // Réactive : tout est sélectionné ? (parmi les sélectionnables)
  $: allSelected = selectableManches.length > 0 &&
    selectableManches.every(m => selectedIds.has(m.tableConfigId));

  function toggleSelectAll() {
    if (allSelected) {
      // Désélectionner tout
      selectedIds = new Set();
    } else {
      // Sélectionner toutes les manches filtrées NON PROTÉGÉES
      selectedIds = new Set(selectableManches.map(m => m.tableConfigId));
    }
  }

  function toggleSelect(id: number) {
    // Ne pas permettre de sélectionner une table protégée
    const manche = manches.find(m => m.tableConfigId === id);
    if (manche?.isProtected) return;

    if (selectedIds.has(id)) {
      selectedIds.delete(id);
    } else {
      selectedIds.add(id);
    }
    selectedIds = selectedIds; // trigger reactivity
  }

  async function deleteSelectedManches() {
    if (selectedIds.size === 0) return;

    const count = selectedIds.size;
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${count} manche(s) ? Cette action est irréversible.`)) {
      return;
    }

    deletingManches = true;
    deleteError = '';
    deleteSuccess = '';

    let successCount = 0;
    let errorCount = 0;

    for (const tableConfigId of selectedIds) {
      try {
        const res = await fetch(`${API_BASE_URL}/api/admin/table/delete`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tableConfigId })
        });
        if (res.ok) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (err) {
        console.error(`Erreur suppression manche ${tableConfigId}:`, err);
        errorCount++;
      }
    }

    if (successCount > 0) {
      deleteSuccess = `${successCount} manche(s) supprimée(s) avec succès.`;
      selectedIds = new Set();
      await loadManches();
    }
    if (errorCount > 0) {
      deleteError = `${errorCount} manche(s) n'ont pas pu être supprimées.`;
    }

    deletingManches = false;
  }

  // Filtres
  let filters = {
  id: '',
  competitionType: '',
  competitionNumber: '',
  tableName: '',
  mancheNumber: '',
  playerCount: '',
  donnesCount: '',
  startTime: '',
  endTime: '',
  statut: '',
  protection: ''  // '', 'protected', 'unprotected'
  };

  // Toggle protection d'une table
  let togglingProtection = false;
  async function toggleProtection(tableConfigId: number, event: Event) {
    event.stopPropagation();
    if (togglingProtection) return;

    togglingProtection = true;
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/manche/${tableConfigId}/protect`, {
        method: 'PUT'
      });
      if (res.ok) {
        const data = await res.json();
        // Mettre à jour localement
        const idx = manches.findIndex(m => m.tableConfigId === tableConfigId);
        if (idx !== -1) {
          manches[idx].isProtected = data.isProtected;
          manches = manches; // trigger reactivity
        }
        // Désélectionner si on vient de protéger
        if (data.isProtected && selectedIds.has(tableConfigId)) {
          selectedIds.delete(tableConfigId);
          selectedIds = selectedIds;
        }
      } else {
        console.error('Erreur toggle protection:', await res.text());
      }
    } catch (err) {
      console.error('Erreur toggle protection:', err);
    } finally {
      togglingProtection = false;
    }
  }

  // Liste des numéros de manches disponibles (triée)
  $: availableMancheNumbers = [...new Set(manches.map(m => m.mancheNumber))].sort((a, b) => a - b);

  $: filteredSortedManches = manches
  // 1) Filtres
  .filter((m) => {
  // ID
  if (
  filters.id &&
      !String(m.tableConfigId).includes(filters.id.trim())
    ) {
      return false;
    }

    // Type de compétition
    if (filters.competitionType) {
      // filters.competitionType = "1" | "2" | ...
      // m.competitionType = number | null
      if (String(m.competitionType ?? '') !== filters.competitionType) {
        return false;
      }
    }

    // Numéro de compétition
    if (
      filters.competitionNumber &&
      !String(m.competitionNumber ?? '')
        .includes(filters.competitionNumber.trim())
    ) {
      return false;
    }

    // Table
    if (
      filters.tableName &&
      !m.tableName.toLowerCase().includes(filters.tableName.toLowerCase())
    ) {
      return false;
    }

    // Manche (comparaison exacte)
    if (filters.mancheNumber && String(m.mancheNumber) !== filters.mancheNumber) {
      return false;
    }

    // Joueurs
    if (
      filters.playerCount &&
      !String(m.playerCount).includes(filters.playerCount.trim())
    ) {
      return false;
    }

    // Donnes
    if (
      filters.donnesCount &&
      !String(m.donnesCount).includes(filters.donnesCount.trim())
    ) {
      return false;
    }

    // Start date filter
    if (filters.startTime && extractDateOnly(m.startTime) !== filters.startTime) {
      return false;
    }

    // End date filter
    if (filters.endTime && extractDateOnly(m.endTime) !== filters.endTime) {
      return false;
    }

    // Statut
    if (filters.statut) {
      const statut = m.isCompleted ? 'terminée' : 'en cours';
      if (statut !== filters.statut) return false;
    }

    // Protection
    if (filters.protection) {
      if (filters.protection === 'protected' && !m.isProtected) return false;
      if (filters.protection === 'unprotected' && m.isProtected) return false;
    }

    return true;
  })
  // 2) Tri
  .sort((a, b) => {
    if (!sortKey) return 0;

    const va = a[sortKey];
    const vb = b[sortKey];

    // cas particulier : dates
    if (sortKey === 'startTime' || sortKey === 'endTime') {
      const ta = va ? new Date(va as string).getTime() : 0;
      const tb = vb ? new Date(vb as string).getTime() : 0;

      if (ta < tb) return sortDirection === 'asc' ? -1 : 1;
      if (ta > tb) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    }

    // booléen (isCompleted)
    if (sortKey === 'isCompleted') {
      const ba = (va as boolean) ? 1 : 0;
      const bb = (vb as boolean) ? 1 : 0;

      if (ba < bb) return sortDirection === 'asc' ? -1 : 1;
      if (ba > bb) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    }

    // numériques (id, manche, joueurs, donnes, n° compète)
    if (
      sortKey === 'tableConfigId' ||
  sortKey === 'mancheNumber' ||
  sortKey === 'playerCount' ||
  sortKey === 'donnesCount' ||
  sortKey === 'competitionNumber' ||
  sortKey === 'competitionType'
    ) {
      const na = (va ?? 0) as number;
      const nb = (vb ?? 0) as number;

      if (na < nb) return sortDirection === 'asc' ? -1 : 1;
      if (na > nb) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    }

    // texte (tableName, competitionName)
    const sa = String(va ?? '').toLowerCase();
    const sb = String(vb ?? '').toLowerCase();

    if (sa < sb) return sortDirection === 'asc' ? -1 : 1;
    if (sa > sb) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });




  onMount(async () => {
    // L'authentification admin est gérée par le layout parent
    
    // 🔥 Charger les types de compétition depuis l'API
    try {
      const resTypes = await fetch(`${API_BASE_URL}/api/config/competition-types`);
      if (resTypes.ok) {
        allCompetitionTypes = await resTypes.json();
        console.log('Types de compétition chargés (admin) :', allCompetitionTypes);
      } else {
        console.warn('API competition-types non disponible, utilisation du fallback');
        allCompetitionTypes = [
          { id: 1, name: 'Championnat', shortName: 'Ch', description: null, isActive: true, sortOrder: 1 },
          { id: 2, name: 'Interclub', shortName: 'IC', description: null, isActive: true, sortOrder: 2 },
          { id: 3, name: 'Manche libre', shortName: 'ML', description: null, isActive: true, sortOrder: 3 },
          { id: 4, name: 'Concours', shortName: 'CC', description: null, isActive: true, sortOrder: 4 },
          { id: 5, name: 'Endurance', shortName: 'EN', description: null, isActive: true, sortOrder: 5 },
          { id: 6, name: 'Funny Games', shortName: 'FG', description: null, isActive: true, sortOrder: 6 },
          { id: 7, name: 'Edition festive', shortName: 'EF', description: null, isActive: true, sortOrder: 7 }
        ];
      }
    } catch (err) {
      console.warn('Erreur chargement types de compétition:', err);
      allCompetitionTypes = [
        { id: 1, name: 'Championnat', shortName: 'Ch', description: null, isActive: true, sortOrder: 1 },
        { id: 2, name: 'Interclub', shortName: 'IC', description: null, isActive: true, sortOrder: 2 },
        { id: 3, name: 'Manche libre', shortName: 'ML', description: null, isActive: true, sortOrder: 3 },
        { id: 4, name: 'Concours', shortName: 'CC', description: null, isActive: true, sortOrder: 4 },
        { id: 5, name: 'Endurance', shortName: 'EN', description: null, isActive: true, sortOrder: 5 },
        { id: 6, name: 'Funny Games', shortName: 'FG', description: null, isActive: true, sortOrder: 6 },
        { id: 7, name: 'Edition festive', shortName: 'EF', description: null, isActive: true, sortOrder: 7 }
      ];
    }
  });

  function goToMenu() {
    viewMode = 'menu';
  }

  async function loadManches() {
    isLoading = true;
    loadError = '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/manches`);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      manches = await res.json();
    } catch (err: any) {
      console.error(err);
      loadError = "Impossible de charger les manches admin.";
    } finally {
      isLoading = false;
    }
  }

  function formatDate(dateStr: string | null) {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('fr-BE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  // Extrait la date au format YYYY-MM-DD pour comparaison avec input date
  function extractDateOnly(dateStr: string | null): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toISOString().split('T')[0];
  }

  function gotoManche(id: number) {
    window.location.href = `/admin/${id}`;
  }
  
  // 🔥 Fonctions pour obtenir les labels depuis les données dynamiques
  function getCompetitionTypeLabel(typeId: number | null): string {
    if (typeId == null) return '-';
    const found = allCompetitionTypes.find(t => t.id === typeId);
    return found?.name ?? `Type ${typeId}`;
  }

  function getCompetitionTypeShortLabel(typeId: number | null): string {
    if (typeId == null) return '-';
    const found = allCompetitionTypes.find(t => t.id === typeId);
    return found?.shortName ?? found?.name?.substring(0, 2) ?? `T${typeId}`;
  }

  // 🔥 Fallback hardcodé utilisé si l'API n'est pas disponible
  const COMP_TYPE_FALLBACK: Record<number, { name: string; shortName: string }> = {
    1: { name: 'Championnat', shortName: 'Ch' },
    2: { name: 'Interclub', shortName: 'IC' },
    3: { name: 'Manche libre', shortName: 'ML' },
    4: { name: 'Concours', shortName: 'CC' }
  };

function formatCompetitionType(m: AdminMancheHeaderDto): string {
  if (m.competitionType == null) return '-';
  // Utiliser les données dynamiques si disponibles, sinon fallback
  if (allCompetitionTypes.length > 0) {
    return getCompetitionTypeShortLabel(m.competitionType);
  }
  return COMP_TYPE_FALLBACK[m.competitionType]?.shortName ?? `T${m.competitionType}`;
}


function formatCompetitionName(m: AdminMancheHeaderDto): string {
  const t = m.competitionType;
  const num = m.competitionNumber;
  const name = m.competitionName;

  if (!t) return "-";

  // Récupérer le nom du type depuis les données dynamiques ou fallback
  const typeName = allCompetitionTypes.length > 0
    ? getCompetitionTypeLabel(t)
    : COMP_TYPE_FALLBACK[t]?.name ?? `Type ${t}`;

  // Si on a un nom de compétition personnalisé, l'afficher
  if (name) return name;

  // Sinon, construire le nom à partir du type et du numéro
  return num ? `${typeName} ${num}` : typeName;
}


        
</script>

<svelte:head>
  <title>Administration</title>
</svelte:head>

<div class="admin-page">
  {#if viewMode === 'menu'}
    <h1>Administration</h1>
  {:else if viewMode === 'manches'}
    <h1>
      <button class="back-link" on:click={goToMenu}>← Administration</button>
      <span class="sep">⟶</span> Gestion des manches
    </h1>
  {:else if viewMode === 'password'}
    <h1>
      <button class="back-link" on:click={goToMenu}>← Administration</button>
      <span class="sep">⟶</span> Mot de passe utilisateur
    </h1>
  {/if}


  {#if viewMode === 'menu'}
    <!-- Menu principal admin -->
    <div class="admin-menu-grid">
      {#each adminMenuItems as item}
        {#if item.href}
          <a href={item.href} class="admin-menu-card">
            <span class="menu-icon">
              {#if item.icon === 'jeton'}
                <JetonPoker color="rouge" size={40} />
              {:else}
                {item.icon}
              {/if}
            </span>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </a>
        {:else}
          <button class="admin-menu-card" on:click={() => { item.action?.(); loadManches(); }}>
            <span class="menu-icon gold">
              {#if item.icon === 'jeton'}
                <JetonPoker color="rouge" size={40} />
              {:else}
                {item.icon}
              {/if}
            </span>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </button>
        {/if}
      {/each}
    </div>
  {:else if viewMode === 'password'}
    <!-- Vue Gestion du mot de passe utilisateur -->
    <div class="admin-card password-card">
      <h2>🔐 Mot de passe utilisateur</h2>
      <p class="password-description">
        Ce mot de passe est demandé aux utilisateurs pour accéder à l'application.
        Changez-le régulièrement pour contrôler l'accès.
      </p>

      {#if passwordLoading}
        <p class="loading">Chargement...</p>
      {:else}
        <div class="password-section">
          <div class="password-current">
            <span class="label-text">Mot de passe actuel :</span>
            <span class="current-password">{currentUserPassword || '(non défini)'}</span>
          </div>

          <div class="password-form">
            <label for="newPassword">Nouveau mot de passe :</label>
            <input 
              type="text" 
              id="newPassword"
              bind:value={newUserPassword} 
              placeholder="Entrez le nouveau mot de passe"
              class="password-input"
            />
            <button 
              class="btn-save-password" 
              on:click={updateUserPassword}
              disabled={passwordLoading || !newUserPassword.trim() || newUserPassword.trim() === currentUserPassword}
            >
              💾 Enregistrer
            </button>
          </div>

          {#if passwordError}
            <p class="error">{passwordError}</p>
          {/if}
          {#if passwordSuccess}
            <p class="success">{passwordSuccess}</p>
          {/if}
        </div>
      {/if}

      <div class="password-info">
        <p><strong>💡 Astuce :</strong> Communiquez le nouveau mot de passe aux participants avant la prochaine session.</p>
        <p><strong>🔄 Fallback :</strong> En cas de problème de connexion, le mot de passe de secours codé dans l'application est : <code>Armani</code></p>
      </div>
    </div>
  {:else if viewMode === 'manches'}
    <!-- Vue Gestion des manches -->
    <div class="admin-card">
      <div class="list-header">
        <h2>Liste des tables</h2>
        <div class="header-actions">
          {#if !isLoading && !loadError && manches.length > 0}
            <span class="result-count">{filteredSortedManches.length} / {manches.length} manches</span>
          {/if}
          {#if selectedIds.size > 0}
            <button 
              class="btn-delete-selected" 
              on:click={deleteSelectedManches}
              disabled={deletingManches}
            >
              {#if deletingManches}
                Suppression...
              {:else}
                🗑️ Supprimer ({selectedIds.size})
              {/if}
            </button>
          {/if}
        </div>
      </div>
      
      {#if deleteSuccess}
        <p class="success">{deleteSuccess}</p>
      {/if}
      {#if deleteError}
        <p class="error">{deleteError}</p>
      {/if}

      {#if isLoading}
        <p>Chargement…</p>
      {:else if loadError}
        <p class="error">{loadError}</p>
      {:else if manches.length === 0}
        <p>Aucune manche trouvée.</p>
      {:else}
        <!-- Filtres desktop -->
        <div class="desktop-filters">
          <div class="filter-row-desktop">
            <div class="filter-item filter-item-small">
              <span class="filter-label">ID</span>
              <input 
                type="text" 
                class="desktop-filter" 
                bind:value={filters.id}
                placeholder="ID"
              />
            </div>
            <div class="filter-item">
              <span class="filter-label">Type</span>
              <select class="desktop-filter" bind:value={filters.competitionType}>
                <option value="">Tous</option>
                {#each allCompetitionTypes as typeInfo}
                  <option value={String(typeInfo.id)}>{typeInfo.name}</option>
                {/each}
                {#if allCompetitionTypes.length === 0}
                  <option value="1">Championnat</option>
                  <option value="2">Interclub</option>
                  <option value="3">Manche libre</option>
                  <option value="4">Concours</option>
                {/if}
              </select>
            </div>
            <div class="filter-item filter-item-small">
              <span class="filter-label">N°</span>
              <input 
                type="text" 
                class="desktop-filter" 
                bind:value={filters.competitionNumber}
                placeholder="N°"
              />
            </div>
            <div class="filter-item">
              <span class="filter-label">Manche</span>
              <select class="desktop-filter" bind:value={filters.mancheNumber}>
                <option value="">Toutes</option>
                {#each availableMancheNumbers as num}
                  <option value={String(num)}>Manche {num}</option>
                {/each}
              </select>
            </div>
            <div class="filter-item">
              <span class="filter-label">Table</span>
              <select class="desktop-filter" bind:value={filters.tableName}>
                <option value="">Toutes</option>
                <option value="A">Table A</option>
                <option value="B">Table B</option>
                <option value="C">Table C</option>
                <option value="D">Table D</option>
                <option value="E">Table E</option>
                <option value="F">Table F</option>
                <option value="G">Table G</option>
                <option value="H">Table H</option>
              </select>
            </div>
            <div class="filter-item">
              <span class="filter-label">Statut</span>
              <select class="desktop-filter" bind:value={filters.statut}>
                <option value="">Tous</option>
                <option value="en cours">En cours</option>
                <option value="terminée">Terminée</option>
              </select>
            </div>
            <div class="filter-item">
              <span class="filter-label">Date</span>
              <input
                type="date"
                class="desktop-filter desktop-filter-date"
                bind:value={filters.startTime}
              />
            </div>
            <div class="filter-item">
              <span class="filter-label">Protection</span>
              <select class="desktop-filter" bind:value={filters.protection}>
                <option value="">Tous</option>
                <option value="protected">🛡️ Protégées</option>
                <option value="unprotected">Non protégées</option>
              </select>
            </div>
          </div>
        </div>

             <table class="admin-table">
  <colgroup>
    <col class="col-checkbox" />
    <col class="col-protect" />
    <col class="col-id" />
    <col class="col-type" />
    <col class="col-compnum" />

    <col class="col-manche" />
    <col class="col-table" />
    <col class="col-joueurs" />
    <col class="col-donnes" />
    <col class="col-debut" />
    <col class="col-fin" />
    <col class="col-statut" />
  </colgroup>

               <thead>
                 <!-- Ligne 1 : en-têtes "généraux" -->
                 <tr>
                   <th class="col-checkbox-header">
                     <input
                       type="checkbox"
                       checked={allSelected}
                       on:change={toggleSelectAll}
                       on:click|stopPropagation
                       title="Tout sélectionner"
                     />
                   </th>
                   <th class="th-protect" title="Protection">🛡️</th>
                   <th class="hide-tablet" on:click={() =>
                     toggleSort('tableConfigId')}>
                     ID {#if sortKey === 'tableConfigId'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>

                   <th class="th-type" on:click={() =>
                     toggleSort('competitionType')}>
                     Type {#if sortKey === 'competitionType'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>
                   <th class="hide-tablet" on:click={() =>
                     toggleSort('competitionNumber')}>
                     N° {#if sortKey === 'competitionNumber'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>

                   <th class="th-manche" on:click={() =>
                     toggleSort('mancheNumber')}>
                     Manche {#if sortKey === 'mancheNumber'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>
                   <th class="th-table" on:click={() =>
                     toggleSort('tableName')}>
                     Table {#if sortKey === 'tableName'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>
                   <th class="hide-mobile" on:click={() =>
                     toggleSort('playerCount')}>
                     Joueurs {#if sortKey === 'playerCount'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>
                   <th class="hide-mobile" on:click={() =>
                     toggleSort('donnesCount')}>
                     Donnes {#if sortKey === 'donnesCount'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>
                   <th class="th-debut" on:click={() =>
                     toggleSort('startTime')}>
                     Début {#if sortKey === 'startTime'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>
                   <th class="hide-mobile" on:click={() =>
                     toggleSort('endTime')}>
                     Fin {#if sortKey === 'endTime'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>
                   <th class="th-statut" on:click={() =>
                     toggleSort('isCompleted')}>
                     Statut {#if sortKey === 'isCompleted'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>
                 </tr>
               </thead>




               <tbody>
    {#each filteredSortedManches as m}
      <tr class="clickable {m.isProtected ? 'row-protected' : ''}" on:click={() => gotoManche(m.tableConfigId)}>
        <td class="cell-checkbox" on:click|stopPropagation>
          <input
            type="checkbox"
            checked={selectedIds.has(m.tableConfigId)}
            on:change={() => toggleSelect(m.tableConfigId)}
            disabled={m.isProtected}
            title={m.isProtected ? 'Table protégée - suppression impossible' : ''}
          />
        </td>
        <td class="cell-protect" on:click|stopPropagation>
          <button
            class="btn-protect {m.isProtected ? 'protected' : ''}"
            on:click={(e) => toggleProtection(m.tableConfigId, e)}
            disabled={togglingProtection}
            title={m.isProtected ? 'Retirer la protection' : 'Protéger cette table'}
          >
            {m.isProtected ? '🛡️' : '🔓'}
          </button>
        </td>
        <td class="cell-id hide-tablet">{m.tableConfigId}</td>
        <td class="cell-type"><span class="badge badge-type type-{m.competitionType ?? 0}">{formatCompetitionType(m)}</span></td>
        <td class="cell-compnum hide-tablet">{m.competitionNumber ?? '-'}</td>
        <td class="cell-manche">{m.mancheNumber}</td>
        <td class="cell-table">{m.tableName}</td>
        <td class="cell-joueurs hide-mobile"><span class="cell-players">👤 {m.playerCount}</span></td>
        <td class="cell-donnes-td hide-mobile"><span class="cell-donnes">{m.donnesCount}</span></td>
        <td class="cell-date cell-debut">{formatDate(m.startTime)}</td>
        <td class="cell-date cell-fin hide-mobile">{formatDate(m.endTime)}</td>
        <td class="cell-statut"><span class="badge {m.isCompleted ? 'badge-success' : 'badge-warning'}">{m.isCompleted ? '✓' : '⏳'}</span></td>
      </tr>
    {/each}
  </tbody>
</table>

        <!-- Vue mobile : filtres + cartes -->
        <div class="mobile-view">
          <!-- Filtres mobiles -->
          <div class="mobile-filters">
            <div class="filter-group">
              <select class="mobile-filter" bind:value={filters.competitionType}>
                <option value="">Type: Tous</option>
                {#each allCompetitionTypes as typeInfo}
                  <option value={String(typeInfo.id)}>{typeInfo.name}</option>
                {/each}
                {#if allCompetitionTypes.length === 0}
                  <option value="1">Championnat</option>
                  <option value="2">Interclub</option>
                  <option value="3">Manche libre</option>
                  <option value="4">Concours</option>
                {/if}
              </select>
              <input 
                type="text" 
                class="mobile-filter mobile-filter-num" 
                bind:value={filters.competitionNumber}
                placeholder="N°"
              />
            </div>
            <div class="filter-group">
              <select class="mobile-filter" bind:value={filters.mancheNumber}>
                <option value="">Manche: Toutes</option>
                {#each availableMancheNumbers as num}
                  <option value={String(num)}>Manche {num}</option>
                {/each}
              </select>
              <select class="mobile-filter" bind:value={filters.tableName}>
                <option value="">Table: Toutes</option>
                <option value="A">Table A</option>
                <option value="B">Table B</option>
                <option value="C">Table C</option>
                <option value="D">Table D</option>
                <option value="E">Table E</option>
                <option value="F">Table F</option>
                <option value="G">Table G</option>
                <option value="H">Table H</option>
              </select>
            </div>
            <div class="filter-group">
              <select class="mobile-filter" bind:value={filters.statut}>
                <option value="">Statut: Tous</option>
                <option value="en cours">En cours</option>
                <option value="terminée">Terminée</option>
              </select>
              <input 
                type="date" 
                class="mobile-filter mobile-filter-date" 
                bind:value={filters.startTime}
                placeholder="Date début"
              />
            </div>
          </div>

          <!-- Cartes -->
          <div class="mobile-cards">
            {#each filteredSortedManches as m}
              <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
              <div class="manche-card {m.isProtected ? 'card-protected' : ''}" on:click={() => gotoManche(m.tableConfigId)}>
                <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
                <div class="card-checkbox" on:click|stopPropagation>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(m.tableConfigId)}
                    on:change={() => toggleSelect(m.tableConfigId)}
                    disabled={m.isProtected}
                  />
                </div>
              <div class="card-content">
                <div class="card-header">
                  {#if m.isProtected}
                    <button
                      class="btn-protect-mobile protected"
                      on:click|stopPropagation={(e) => toggleProtection(m.tableConfigId, e)}
                      title="Retirer la protection"
                    >🛡️</button>
                  {/if}
                  <span class="badge badge-type type-{m.competitionType ?? 0}">{formatCompetitionType(m)}</span>
                  {#if m.competitionNumber}
                    <span class="badge badge-compnum">N°{m.competitionNumber}</span>
                  {/if}
                  <span class="card-manche">Manche {m.mancheNumber}</span>
                  <span class="card-table">Table {m.tableName}</span>
                  <span class="badge {m.isCompleted ? 'badge-success' : 'badge-warning'}">{m.isCompleted ? '✓ Terminée' : '⏳ En cours'}</span>
                </div>
                <div class="card-details">
                  <span class="card-date">📅 {formatDate(m.startTime)}</span>
                  <span class="card-info">👤 {m.playerCount} joueurs • {m.donnesCount} donnes</span>
                </div>
              </div>
            </div>
          {/each}
        </div>
        </div> <!-- fin mobile-view -->

      {/if}
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
  background:
  radial-gradient(circle at top, #125c2a 0%, #04140a 40%, #020506 100%);
  background-attachment: fixed;   /* le gradient reste sur tout l'écran */
  background-repeat: no-repeat;   /* aucune répétition */
  background-color: #020506;      /* même couleur que la fin du gradient */
  color: #ffffff;
  }


  .admin-page {
  max-width: 1100px;
  margin: 2rem auto;
  padding: 1rem;
  color: #f9fafb;
  }

  h1 {
  font-size: 1.8rem;
  margin-bottom: 1rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  }

  .back-link {
  background: none;
  border: none;
  color: #22c55e;
  font-size: 1.2rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  }

  .back-link:hover {
  text-decoration: underline;
  }

  /* Menu Grid */
  .admin-menu-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
  margin-top: 1.5rem;
  }

  @media (max-width: 900px) {
  .admin-menu-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  }

  @media (max-width: 600px) {
  .admin-menu-grid {
    grid-template-columns: 1fr;
  }
  }

  .admin-menu-card {
  display: block;
  background: linear-gradient(135deg, #052e16 0%, #020617 100%);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 16px;
  padding: 1.5rem;
  text-decoration: none;
  color: #f9fafb;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
  width: 100%;
  box-sizing: border-box;
  }

  .admin-menu-card:hover {
  transform: translateY(-4px);
  border-color: rgba(34, 197, 94, 0.6);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.5);
  }

  .admin-menu-card .menu-icon {
  font-size: 2.5rem;
  display: block;
  margin-bottom: 0.75rem;
  }

  .admin-menu-card .menu-icon.gold {
  color: #d4a03a;
  opacity: 0.85;
  }

  .admin-menu-card h2 {
  margin: 0 0 0.5rem 0;
  font-size: 1.25rem;
  color: #22c55e;
  }

  .admin-menu-card p {
  margin: 0;
  font-size: 0.9rem;
  color: #9ca3af;
  }

  .admin-card {
  background: #020617;
  border-radius: 16px;
  padding: 1.5rem;
  border: 1px solid rgba(34, 197, 94, 0.3);
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
  }

  .pin-row {
  display: flex;
  gap: 0.75rem;
  margin-top: 0.75rem;
  }

  input {
  padding: 0.5rem 0.75rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.6);
  background: #020617;
  color: #f9fafb;
  flex: 1;
  }

  button {
  padding: 0.5rem 1rem;
  border-radius: 999px;
  border: none;
  background: #22c55e;
  color: #020617;
  font-weight: 600;
  cursor: pointer;
  }

  button:hover {
  filter: brightness(1.05);
  }

  .error {
  color: #f97373;
  margin-top: 0.75rem;
  }

  /* Filtres desktop */
  .desktop-filters {
    background: linear-gradient(135deg, rgba(5, 46, 22, 0.6) 0%, rgba(2, 6, 23, 0.8) 100%);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 12px;
    padding: 1rem 1.25rem;
    margin-bottom: 1rem;
  }

  .filter-row-desktop {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: flex-end;
  }

  .filter-item {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    min-width: 120px;
  }

  .filter-item-small {
    min-width: 60px;
    max-width: 80px;
  }

  .filter-item .filter-label {
    font-size: 0.75rem;
    color: #9ca3af;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .desktop-filter {
    background: rgba(0, 0, 0, 0.4);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 8px;
    color: #e5e7eb;
    padding: 0.5rem 0.75rem;
    font-size: 0.85rem;
    transition: all 0.2s ease;
  }

  .desktop-filter:focus {
    outline: none;
    border-color: #22c55e;
    box-shadow: 0 0 0 2px rgba(34, 197, 94, 0.2);
  }

  .desktop-filter-date {
    color-scheme: dark;
  }

  .admin-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  font-size: 0.9rem;
  table-layout: fixed; /* on garde, c'est bien */
  }

  /* Largeurs des colonnes – total ≈ 100% */

  .col-checkbox {
  width: 3%;
  }

  .col-id {
  width: 5%;
  }

  .col-type {
  width: 8%;
  }

  .col-compnum {
  width: 6%;
  }

  .col-compname {
  width: 11%;
  }

  .col-table {
  width: 7%;
  }

  .col-manche {
  width: 7%;
  }

  .col-joueurs {
  width: 8%;
  }

  .col-donnes {
  width: 8%;
  }

  .col-debut {
  width: 15%;
  }

  .col-fin {
  width: 15%;
  }

  .col-statut {
  width: 10%;
  }

  .th-group {
  text-align: center;
  font-weight: 600;
  }

  .admin-table th {
  background: linear-gradient(to bottom, #14532d, #052e16);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.78rem;
  }

  .admin-table tbody tr:nth-child(even) {
  background: #020b06;
  }

  .admin-table tbody tr:nth-child(odd) {
  background: #020617;
  }

  .clickable {
  cursor: pointer;
  }

  .clickable:hover {
  background: #064e3b;
  }

  .sep {
  opacity: 0.9;
  margin: 0 0.4rem;
  }

  .copyright {
  position: fixed;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);

  font-size: 0.8rem;
  color: #d9d9d9;
  opacity: 0.9;
  font-family: 'Poppins', system-ui, -apple-system, BlinkMacSystemFont,
  'Segoe UI', sans-serif;
  white-space: nowrap;
  z-index: 9999;

  /* 🔥 Le fond noir semi-opaque pour éviter la superposition */
  background: rgba(0, 0, 0, 0.8);
  padding: 4px 10px;
  border-radius: 10px;
  backdrop-filter: blur(4px); /* optionnel : joli effet verre dépoli */
  }

  /* Pour éviter de cacher la dernière ligne */
  :global(body) {
  padding-bottom: 50px;
  }

  @media (max-width: 480px) {
  .copyright {
  font-size: 0.7rem;
  padding: 3px 8px;
  }
  }



  .filter-input {
  width: 100%;
  box-sizing: border-box;
  padding: 0.2rem 0.35rem;
  border-radius: 999px;
  border: 1px solid rgba(75, 85, 99, 0.8);
  background: #020617;
  color: #e5e7eb;
  font-size: 0.75rem;
  }

  .filter-input::placeholder {
  color: rgba(148, 163, 184, 0.7);
  }

  .admin-table th {
  cursor: pointer;
  }

  .admin-table th:hover {
  background: linear-gradient(to bottom, #15803d, #052e16);
  }


  .admin-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  font-size: 0.9rem;
  table-layout: fixed; /* important pour respecter les largeurs ci-dessous */
  }

  .col-type {
  width: 6%;
  }

  .col-compnum {
  width: 6%;
  }

  /* on saute col-compname, supprimée */

  .col-table {
  width: 9%;
  }

  .col-manche {
  width: 8%;
  }

  .col-joueurs {
  width: 9%;
  }

  .col-donnes {
  width: 9%;
  }

  .col-debut {
  width: 18%;
  }

  .col-fin {
  width: 18%;
  }

  .col-statut {
  width: 12%;
  }



  /* Centrer tout le contenu des colonnes */
  .admin-table th,
  .admin-table td {
  text-align: center;
  }

  /* Centrer le texte dans les inputs */
  .filter-input {
  text-align: center;
  }

  /* Header avec compteur */
  .list-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .list-header h2 {
    margin: 0;
  }

  .result-count {
    background: rgba(34, 197, 94, 0.15);
    color: #22c55e;
    padding: 0.35rem 0.8rem;
    border-radius: 999px;
    font-size: 0.85rem;
    font-weight: 500;
  }

  /* Bouton de suppression multiple */
  .btn-delete-selected {
    background: linear-gradient(to bottom, #dc2626, #b91c1c);
    color: #fff;
    border: 1px solid #ef4444;
    padding: 0.4rem 0.9rem;
    font-size: 0.85rem;
    font-weight: 600;
    border-radius: 999px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-delete-selected:hover:not(:disabled) {
    background: linear-gradient(to bottom, #ef4444, #dc2626);
    box-shadow: 0 4px 12px rgba(220, 38, 38, 0.4);
  }

  .btn-delete-selected:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Checkbox dans le tableau */
  .col-checkbox-header,
  .col-checkbox-filter,
  .cell-checkbox {
    text-align: center;
    width: 40px;
  }

  .cell-checkbox input[type="checkbox"],
  .col-checkbox-header input[type="checkbox"] {
    width: 16px;
    height: 16px;
    cursor: pointer;
    accent-color: #22c55e;
  }

  .success {
    color: #4ade80;
    margin-top: 0.5rem;
    margin-bottom: 0.5rem;
  }

  /* Badges de statut */
  .badge {
    display: inline-block;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 600;
    white-space: nowrap;
  }

  .badge-success {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.4);
  }

  .badge-warning {
    background: rgba(251, 191, 36, 0.2);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.4);
  }

  /* Badges de type de compétition */
  .badge-type {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    font-weight: 700;
    letter-spacing: 0.03em;
  }

  .type-1 { /* Championnat */
    background: rgba(168, 85, 247, 0.25);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.5);
  }

  .type-2 { /* Interclub */
    background: rgba(59, 130, 246, 0.25);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.5);
  }

  .type-3 { /* Manche libre */
    background: rgba(107, 114, 128, 0.25);
    color: #9ca3af;
    border: 1px solid rgba(107, 114, 128, 0.5);
  }

  .type-4 { /* Concours */
    background: rgba(251, 191, 36, 0.25);
    color: #fbbf24;
    border: 1px solid rgba(251, 191, 36, 0.5);
  }

  .type-0 { /* Non défini */
    background: rgba(75, 85, 99, 0.25);
    color: #6b7280;
    border: 1px solid rgba(75, 85, 99, 0.5);
  }

  /* Badge numéro de compétition */
  .badge-compnum {
    background: rgba(20, 184, 166, 0.25);
    color: #2dd4bf;
    border: 1px solid rgba(20, 184, 166, 0.5);
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    font-weight: 700;
  }

  /* Cellules spéciales */
  .cell-id {
    font-weight: 600;
    color: #9ca3af;
  }

  .cell-table {
    font-weight: 600;
    color: #22c55e;
  }

  .cell-players {
    color: #60a5fa;
  }

  .cell-donnes {
    background: rgba(34, 197, 94, 0.1);
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .cell-date {
    font-size: 0.8rem;
    color: #9ca3af;
  }

  /* Animation sur les lignes */
  .admin-table tbody tr {
    transition: all 0.15s ease;
  }

  .clickable:hover td {
    color: #ffffff;
  }

  .clickable:hover .cell-date {
    color: #e5e7eb;
  }

  /* --- Styles pour la section Mot de passe --- */
  .password-card {
    max-width: 600px;
  }

  .password-description {
    color: #9ca3af;
    margin-bottom: 1.5rem;
    font-size: 0.95rem;
  }

  .password-section {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .password-current {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 1rem;
    background: rgba(34, 197, 94, 0.1);
    border-radius: 8px;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .password-current .label-text {
    font-weight: 600;
    color: #9ca3af;
  }

  .current-password {
    font-size: 1.3rem;
    font-weight: 700;
    color: #22c55e;
    font-family: monospace;
  }

  .password-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .password-form label {
    font-weight: 600;
    color: #e5e7eb;
  }

  .password-input {
    padding: 0.75rem 1rem;
    font-size: 1.1rem;
    border-radius: 8px;
    border: 1px solid #374151;
    background: #1f2937;
    color: #f9fafb;
  }

  .password-input:focus {
    outline: none;
    border-color: #22c55e;
    box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.2);
  }

  .btn-save-password {
    align-self: flex-start;
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 600;
    background: linear-gradient(135deg, #22c55e, #16a34a);
    color: #fff;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .btn-save-password:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);
  }

  .btn-save-password:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .password-info {
    margin-top: 2rem;
    padding: 1rem;
    background: rgba(59, 130, 246, 0.1);
    border-radius: 8px;
    border: 1px solid rgba(59, 130, 246, 0.3);
    font-size: 0.9rem;
  }

  .password-info p {
    margin: 0.5rem 0;
    color: #9ca3af;
  }

  .password-info code {
    background: rgba(34, 197, 94, 0.2);
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    color: #22c55e;
    font-weight: 600;
  }

  .success {
    color: #22c55e;
    font-weight: 600;
    padding: 0.5rem;
    background: rgba(34, 197, 94, 0.1);
    border-radius: 6px;
  }

  .loading {
    color: #9ca3af;
    font-style: italic;
  }

  /* ====================== RESPONSIVE MOBILE ====================== */

  /* Vue mobile - cachée par défaut sur desktop */
  .mobile-view {
    display: none;
  }

  /* Tablettes */
  @media (max-width: 900px) {
    .admin-page {
      padding: 0.5rem;
      margin: 1rem auto;
    }

    h1 {
      font-size: 1.4rem;
      flex-wrap: wrap;
    }

    .admin-card {
      padding: 1rem;
    }

    /* Masquer les colonnes tablet */
    .hide-tablet {
      display: none !important;
    }

    .admin-table {
      font-size: 0.8rem;
    }

    .admin-table th,
    .admin-table td {
      padding: 0.35rem 0.2rem;
    }

    .filter-input {
      font-size: 0.7rem;
      padding: 0.15rem 0.2rem;
    }

    .badge {
      font-size: 0.65rem;
      padding: 0.15rem 0.4rem;
    }

    .cell-date {
      font-size: 0.7rem;
    }
  }

  /* Mobile - afficher les cartes, masquer le tableau */
  @media (max-width: 700px) {
    .admin-page {
      padding: 0.5rem;
      margin: 0.5rem auto;
    }

    h1 {
      font-size: 1.2rem;
    }

    .back-link {
      font-size: 1rem;
    }

    .sep {
      display: none;
    }

    .list-header {
      flex-direction: column;
      align-items: stretch;
      gap: 0.75rem;
    }

    .list-header h2 {
      font-size: 1.1rem;
    }

    .header-actions {
      width: 100%;
      justify-content: space-between;
    }

    .result-count {
      font-size: 0.8rem;
      padding: 0.3rem 0.7rem;
    }

    .btn-delete-selected {
      font-size: 0.8rem;
      padding: 0.4rem 0.8rem;
    }

    /* Masquer le tableau sur mobile */
    .admin-table {
      display: none !important;
    }

    /* Masquer les filtres desktop sur mobile */
    .desktop-filters {
      display: none !important;
    }

    /* Afficher la vue mobile */
    .mobile-view {
      display: block;
    }

    /* Filtres mobiles */
    .mobile-filters {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin-bottom: 0.75rem;
      padding: 0.75rem;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 10px;
      border: 1px solid rgba(34, 197, 94, 0.2);
    }

    .filter-group {
      display: flex;
      gap: 0.5rem;
    }

    .mobile-filter {
      flex: 1;
      padding: 0.5rem 0.6rem;
      border-radius: 8px;
      border: 1px solid rgba(75, 85, 99, 0.8);
      background: #020617;
      color: #e5e7eb;
      font-size: 0.85rem;
    }

    .mobile-filter:focus {
      outline: none;
      border-color: #22c55e;
    }

    .mobile-filter-date {
      color-scheme: dark;
    }

    .mobile-filter-num {
      max-width: 60px;
      text-align: center;
    }

    /* Cartes */
    .mobile-cards {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }

    .manche-card {
      display: flex;
      align-items: stretch;
      background: linear-gradient(135deg, #052e16 0%, #020617 100%);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 10px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .manche-card:hover {
      border-color: rgba(34, 197, 94, 0.6);
      transform: translateX(2px);
    }

    .card-checkbox {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0.75rem;
      background: rgba(0, 0, 0, 0.3);
      border-right: 1px solid rgba(34, 197, 94, 0.2);
    }

    .card-checkbox input[type="checkbox"] {
      width: 18px;
      height: 18px;
      cursor: pointer;
      accent-color: #22c55e;
    }

    .card-content {
      flex: 1;
      padding: 0.6rem 0.75rem;
      display: flex;
      flex-direction: column;
      gap: 0.4rem;
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .card-table {
      font-weight: 600;
      color: #9ca3af;
      font-size: 0.9rem;
    }

    .card-manche {
      font-weight: 700;
      color: #22c55e;
      font-size: 1rem;
    }

    .card-details {
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
      font-size: 0.8rem;
      color: #9ca3af;
    }

    .card-date {
      color: #e5e7eb;
    }

    .card-info {
      font-size: 0.75rem;
    }

    /* Admin card */
    .admin-card {
      padding: 0.75rem;
      border-radius: 12px;
    }
  }

  /* Très petits écrans */
  @media (max-width: 400px) {
    .filter-group {
      flex-direction: column;
    }

    .mobile-filter {
      font-size: 0.8rem;
      padding: 0.45rem 0.5rem;
    }

    .card-header {
      gap: 0.35rem;
    }

    .card-manche {
      font-size: 0.9rem;
    }

    .badge {
      font-size: 0.6rem;
      padding: 0.1rem 0.3rem;
    }

    .card-details {
      font-size: 0.75rem;
    }

    .card-info {
      font-size: 0.7rem;
    }
  }

  /* ====================== STYLES PROTECTION ====================== */

  .col-protect {
    width: 4%;
  }

  .th-protect {
    cursor: default !important;
  }

  .cell-protect {
    text-align: center;
    padding: 0.2rem !important;
  }

  .btn-protect {
    background: transparent;
    border: 1px solid rgba(107, 114, 128, 0.4);
    border-radius: 50%;
    width: 28px;
    height: 28px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    color: #6b7280;
  }

  .btn-protect:hover:not(:disabled) {
    border-color: #22c55e;
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
  }

  .btn-protect.protected {
    background: rgba(251, 191, 36, 0.15);
    border-color: rgba(251, 191, 36, 0.5);
    color: #fbbf24;
  }

  .btn-protect.protected:hover:not(:disabled) {
    background: rgba(251, 191, 36, 0.25);
    border-color: #fbbf24;
  }

  .btn-protect:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Ligne protégée */
  .row-protected {
    background: rgba(251, 191, 36, 0.05) !important;
  }

  .row-protected:hover {
    background: rgba(251, 191, 36, 0.1) !important;
  }

  /* Checkbox désactivée pour tables protégées */
  .cell-checkbox input[type="checkbox"]:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  /* Carte protégée (mobile) */
  .card-protected {
    border-color: rgba(251, 191, 36, 0.4) !important;
    background: linear-gradient(135deg, rgba(251, 191, 36, 0.08) 0%, #020617 100%) !important;
  }

  .btn-protect-mobile {
    background: rgba(251, 191, 36, 0.15);
    border: 1px solid rgba(251, 191, 36, 0.5);
    border-radius: 4px;
    padding: 0.1rem 0.3rem;
    font-size: 0.75rem;
    cursor: pointer;
  }

</style>
