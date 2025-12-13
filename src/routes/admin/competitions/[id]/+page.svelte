<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import JetonPoker from '$lib/components/JetonPoker.svelte';

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

  interface CompetitionAnnonce {
    competitionDefinitionId: number;
    annonceCode: string;
    annonceLabel: string;
    annonceType: string;
    modeJeu: string;
    sortOrder: number;
    isActive: boolean;
    requireArbitre: boolean;
  }

  interface CompetitionJeton {
    competitionDefinitionId: number;
    jetonTypeCode: string;
    jetonLabel: string;
    jetonColor: string;
    valeur: number;
    isActive: boolean;
  }

  interface CompetitionResultat {
    competitionDefinitionId: number;
    grilleResultatId: number;
    annonceCode: string;
    annonceLabel: string;
    annonceType: string | null;
    kind: string;
    nbJoueursDedans: number;
    plisFaits: number | null;
    etat: string | null;
    defaultResultatInd: number;
    defaultResultatJeu: number;
    overrideResultatInd: number | null;
    overrideResultatJeu: number | null;
    effectiveResultatInd: number;
    effectiveResultatJeu: number;
  }

  interface ScheduleEntry {
    id: number | null;
    mancheNumber: number;
    eventDate: string;
    isCancelled: boolean;
    isClosedForEncoding: boolean;
  }

  // État
  let competitionId: number;
  let competition: Competition | null = null;
  let clubs: Club[] = [];
  let annonces: CompetitionAnnonce[] = [];
  let jetons: CompetitionJeton[] = [];
  let grille: CompetitionResultat[] = [];
  let schedule: ScheduleEntry[] = [];
  
  let loading = true;
  let saving = false;
  let error = '';
  let successMessage = '';

  // Filtres pour les annonces
  let filterType: string = '';
  let filterModeJeu: string = '';
  let filterActiveOnly: boolean = false;

  // Filtres pour la grille
  let grilleFilterAnnonce: string = '';
  let grilleFilterAnnonceType: string = '';
  let grilleFilterKind: string = '';
  let grilleFilterNbJoueurs: string = '';
  let grilleShowOverridesOnly: boolean = false;
  
  // Tri pour la grille
  let grilleSortColumn: string = '';
  let grilleSortAsc: boolean = true;

  // Drag & Drop
  let draggedIndex: number | null = null;

  // Onglet actif
  let activeTab: 'general' | 'annonces' | 'jetons' | 'grille' | 'calendrier' = 'general';

  const competitionTypes: Record<number, string> = {
    1: 'Championnat',
    2: 'Interclub',
    3: 'Manche Libre',
    4: 'Concours'
  };

  // Labels pour les types d'annonces
  const annonceTypeLabels: Record<string, string> = {
    'EMBALLAGE': 'Emballage',
    'SOLO': 'Solo',
    'MISERE': 'Misère',
    'ABONDANCE': 'Abondance',
    'TROU': 'Trou',
    'AUTRE': 'Autre'
  };

  // Labels pour les modes de jeu
  const modeJeuLabels: Record<string, string> = {
    'ATOUT': 'Atout',
    'SANS_ATOUT': 'Sans Atout',
    'TOUT_ATOUT': 'Tout Atout'
  };

  // Mapping des codes de jeton vers les couleurs du composant JetonPoker
  function mapJetonColor(jetonTypeCode: string): 'rouge' | 'bleu' | 'noir' {
    const code = jetonTypeCode?.toUpperCase() || '';
    if (code.includes('ROUGE') || code === 'R') return 'rouge';
    if (code.includes('BLEU') || code === 'B') return 'bleu';
    if (code.includes('NOIR') || code === 'N') return 'noir';
    // Par défaut rouge
    return 'rouge';
  }

  // Liste des types et modes disponibles (calculés dynamiquement)
  $: availableTypes = [...new Set(annonces.map(a => a.annonceType))].filter(Boolean).sort();
  $: availableModes = [...new Set(annonces.map(a => a.modeJeu))].filter(Boolean).sort();

  // Annonces filtrées
  $: filteredAnnonces = annonces.filter(a => {
    if (filterType && a.annonceType !== filterType) return false;
    if (filterModeJeu && a.modeJeu !== filterModeJeu) return false;
    if (filterActiveOnly && !a.isActive) return false;
    return true;
  });

  // Options disponibles pour les filtres de grille
  $: grilleAvailableAnnonces = [...new Set(grille.map(g => g.annonceLabel))].sort();
  $: grilleAvailableAnnonceTypes = [...new Set(grille.map(g => g.annonceType).filter(Boolean))].sort() as string[];
  $: grilleAvailableKinds = [...new Set(grille.map(g => g.kind))].filter(Boolean).sort();
  $: grilleAvailableNbJoueurs = [...new Set(grille.map(g => g.nbJoueursDedans))].sort((a, b) => a - b);

  // Labels pour les types d'annonces dans la grille
  const grilleAnnonceTypeLabels: Record<string, string> = {
    'EMBALLAGE': 'Emballage',
    'SOLO': 'Solo',
    'MISERE': 'Misère',
    'ABONDANCE': 'Abondance',
    'TROU': 'Trou',
    'AUTRE': 'Autre'
  };

  // Grille filtrée et triée avec index de groupe pour le regroupement visuel
  // Note: on retourne les objets originaux pour que les bindings fonctionnent
  $: filteredGrille = (() => {
    let result = grille.filter(item => {
      if (grilleFilterAnnonce && item.annonceLabel !== grilleFilterAnnonce) return false;
      if (grilleFilterAnnonceType && item.annonceType !== grilleFilterAnnonceType) return false;
      if (grilleFilterKind && item.kind !== grilleFilterKind) return false;
      if (grilleFilterNbJoueurs && item.nbJoueursDedans !== parseInt(grilleFilterNbJoueurs)) return false;
      if (grilleShowOverridesOnly && item.overrideResultatInd === null && item.overrideResultatJeu === null) return false;
      return true;
    });

    if (grilleSortColumn) {
      result = [...result].sort((a, b) => {
        let valA: any, valB: any;
        switch (grilleSortColumn) {
          case 'annonce': valA = a.annonceLabel; valB = b.annonceLabel; break;
          case 'type': valA = a.annonceType; valB = b.annonceType; break;
          case 'kind': valA = a.kind; valB = b.kind; break;
          case 'joueurs': valA = a.nbJoueursDedans; valB = b.nbJoueursDedans; break;
          case 'plis': valA = a.kind === 'plis' ? a.plisFaits : a.etat; valB = b.kind === 'plis' ? b.plisFaits : b.etat; break;
          case 'defaultInd': valA = a.defaultResultatInd; valB = b.defaultResultatInd; break;
          case 'defaultJeu': valA = a.defaultResultatJeu; valB = b.defaultResultatJeu; break;
          case 'overrideInd': valA = a.overrideResultatInd ?? -Infinity; valB = b.overrideResultatInd ?? -Infinity; break;
          case 'overrideJeu': valA = a.overrideResultatJeu ?? -Infinity; valB = b.overrideResultatJeu ?? -Infinity; break;
          default: return 0;
        }
        if (valA == null) valA = '';
        if (valB == null) valB = '';
        if (valA < valB) return grilleSortAsc ? -1 : 1;
        if (valA > valB) return grilleSortAsc ? 1 : -1;
        return 0;
      });
    }

    return result;
  })();

  // Calculer le groupe d'annonce pour le regroupement visuel (utilisé par annonceType)
  // Retourne un index de groupe basé sur le type d'annonce (0 ou 1 pour alternance)
  function getAnnonceGroupIndex(items: CompetitionResultat[], currentIndex: number): number {
    if (currentIndex === 0) return 0;
    const currentAnnonce = items[currentIndex].annonceLabel;
    const previousAnnonce = items[currentIndex - 1].annonceLabel;
    if (currentAnnonce === previousAnnonce) {
      // Même groupe que le précédent
      return getAnnonceGroupIndex(items, currentIndex - 1);
    } else {
      // Nouveau groupe, alterner
      return (getAnnonceGroupIndex(items, currentIndex - 1) + 1) % 2;
    }
  }

  // Fonction pour trier par colonne
  function sortGrilleBy(column: string) {
    if (grilleSortColumn === column) {
      grilleSortAsc = !grilleSortAsc;
    } else {
      grilleSortColumn = column;
      grilleSortAsc = true;
    }
  }

  // Réinitialiser les filtres de grille
  function resetGrilleFilters() {
    grilleFilterAnnonce = '';
    grilleFilterAnnonceType = '';
    grilleFilterKind = '';
    grilleFilterNbJoueurs = '';
    grilleShowOverridesOnly = false;
    grilleSortColumn = '';
    grilleSortAsc = true;
  }

  // Drag & Drop handlers
  function handleDragStart(index: number) {
    draggedIndex = index;
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
  }

  function handleDrop(targetIndex: number) {
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    
    // Réorganiser le tableau
    const items = [...annonces];
    const [draggedItem] = items.splice(draggedIndex, 1);
    items.splice(targetIndex, 0, draggedItem);
    
    // Mettre à jour les sortOrder
    items.forEach((item, i) => {
      item.sortOrder = (i + 1) * 10;
    });
    
    annonces = items;
    draggedIndex = null;
  }

  function handleDragEnd() {
    draggedIndex = null;
  }

  // Charger les données
  async function loadCompetition() {
    loading = true;
    error = '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/competitions/${competitionId}`);
      if (res.ok) {
        const data = await res.json();
        // Formater eventDate au format yyyy-MM-dd pour l'input date
        if (data.eventDate) {
          data.eventDate = data.eventDate.split('T')[0];
        }
        competition = data;
      } else {
        error = 'Compétition non trouvée';
      }
    } catch (err) {
      error = 'Impossible de contacter le serveur';
    } finally {
      loading = false;
    }
  }

  async function loadClubs() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/clubs/active`);
      if (res.ok) {
        clubs = await res.json();
      }
    } catch (err) {
      console.error('Erreur chargement clubs:', err);
    }
  }

  // Fonction pour déduire le type depuis le code de l'annonce
  function inferAnnonceType(code: string): string {
    if (!code) return 'AUTRE';
    const prefix = code.charAt(0).toUpperCase();
    const codeUpper = code.toUpperCase();
    
    // Emballage: E8, E9, E10, etc.
    if (prefix === 'E' && /^E\d+/.test(codeUpper)) return 'EMBALLAGE';
    
    // Solo: SOLO, S1, S2, SOLO_SANSATOUT, etc.
    if (codeUpper.startsWith('SOLO') || (prefix === 'S' && /^S\d*/.test(codeUpper))) return 'SOLO';
    
    // Misère: MIS, MISERE, M1, etc.
    if (codeUpper.startsWith('MIS') || codeUpper.startsWith('MISERE') || (prefix === 'M' && /^M\d*/.test(codeUpper))) return 'MISERE';
    
    // Abondance: ABO, ABONDANCE, A1, etc.
    if (codeUpper.startsWith('ABO') || codeUpper.startsWith('ABOND') || (prefix === 'A' && /^A\d*/.test(codeUpper))) return 'ABONDANCE';
    
    // Trou: TROU, T1, etc.
    if (codeUpper.startsWith('TROU') || (prefix === 'T' && /^T\d*/.test(codeUpper))) return 'TROU';
    
    // Petit chelem, grand chelem
    if (codeUpper.includes('CHELEM') || codeUpper === 'PC' || codeUpper === 'GC') return 'ABONDANCE';
    
    return 'AUTRE';
  }

  // Fonction pour déduire le mode de jeu depuis le code
  function inferModeJeu(code: string): string {
    if (!code) return 'ATOUT';
    const codeUpper = code.toUpperCase();
    
    if (codeUpper.includes('SANSATOUT') || codeUpper.includes('SA') || codeUpper.endsWith('_SA')) return 'SANS_ATOUT';
    if (codeUpper.includes('TOUTATOUT') || codeUpper.includes('TA') || codeUpper.endsWith('_TA')) return 'TOUT_ATOUT';
    
    return 'ATOUT';
  }

  async function loadAnnonces() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/competitions/${competitionId}/annonces`);
      if (res.ok) {
        const data = await res.json();
        // Enrichir les données si annonceType ou modeJeu sont manquants
        annonces = data.map((a: CompetitionAnnonce) => ({
          ...a,
          annonceType: a.annonceType || inferAnnonceType(a.annonceCode),
          modeJeu: a.modeJeu || inferModeJeu(a.annonceCode)
        }));
      }
    } catch (err) {
      console.error('Erreur chargement annonces', err);
    }
  }

  async function loadJetons() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/competitions/${competitionId}/jetons`);
      if (res.ok) {
        jetons = await res.json();
      }
    } catch (err) {
      console.error('Erreur chargement jetons', err);
    }
  }

  async function loadGrille() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/competitions/${competitionId}/grille`);
      if (res.ok) {
        grille = await res.json();
      }
    } catch (err) {
      console.error('Erreur chargement grille', err);
    }
  }

  async function loadSchedule() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/competitions/${competitionId}/schedule`);
      if (res.ok) {
        const data = await res.json();
        schedule = data.map((s: any) => ({
          id: s.id,
          mancheNumber: s.mancheNumber,
          eventDate: s.eventDate.split('T')[0], // Format YYYY-MM-DD pour input date
          isCancelled: s.isCancelled,
          isClosedForEncoding: s.isClosedForEncoding
        }));
      }
    } catch (err) {
      console.error('Erreur chargement calendrier', err);
    }
  }

  // Mettre à jour la liste des joueurs autorisés
  function updateAllowedPlayers(playerCount: number, checked: boolean) {
    if (!competition) return;
    
    // Parser la valeur actuelle
    let current: number[] = [];
    if (competition.allowedPlayers) {
      current = competition.allowedPlayers
        .split(';')
        .map(p => parseInt(p.trim(), 10))
        .filter(n => !isNaN(n));
    }
    
    if (checked && !current.includes(playerCount)) {
      current.push(playerCount);
    } else if (!checked) {
      current = current.filter(n => n !== playerCount);
    }
    
    // Trier et reformater
    current.sort((a, b) => a - b);
    competition.allowedPlayers = current.length > 0 ? current.join(';') : null;
  }

  // Sauvegarder les données générales
  async function saveGeneral() {
    if (!competition) return;
    saving = true;
    error = '';
    successMessage = '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/competitions/${competitionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          competitionType: competition.competitionType,
          competitionNumber: competition.competitionNumber,
          name: competition.name,
          allowedPlayers: competition.allowedPlayers,
          manchesCount: competition.manchesCount,
          nbreToursPerManche: competition.nbreToursPerManche,
          scoringGridCode: competition.scoringGridCode,
          usesArbitre: competition.usesArbitre,
          isActive: competition.isActive,
          eventDate: competition.eventDate,
          logoPath: competition.logoPath,
          reglementText: competition.reglementText,
          clubId: competition.clubId
        })
      });
      if (res.ok) {
        successMessage = 'Modifications enregistrées';
        setTimeout(() => successMessage = '', 3000);
      } else {
        error = 'Erreur lors de la sauvegarde';
      }
    } catch (err) {
      error = 'Impossible de contacter le serveur';
    } finally {
      saving = false;
    }
  }

  // Sauvegarder les annonces
  async function saveAnnonces() {
    saving = true;
    error = '';
    successMessage = '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/competitions/${competitionId}/annonces`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          annonces: annonces.map(a => ({
            annonceCode: a.annonceCode,
            sortOrder: a.sortOrder,
            isActive: a.isActive,
            requireArbitre: a.requireArbitre
          }))
        })
      });
      if (res.ok) {
        successMessage = 'Configuration des annonces enregistrée';
        setTimeout(() => successMessage = '', 3000);
      } else {
        error = 'Erreur lors de la sauvegarde';
      }
    } catch (err) {
      error = 'Impossible de contacter le serveur';
    } finally {
      saving = false;
    }
  }

  // Sauvegarder les jetons
  async function saveJetons() {
    saving = true;
    error = '';
    successMessage = '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/competitions/${competitionId}/jetons`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jetons: jetons.map(j => ({
            jetonTypeCode: j.jetonTypeCode,
            valeur: j.valeur,
            isActive: j.isActive
          }))
        })
      });
      if (res.ok) {
        successMessage = 'Configuration des jetons enregistrée';
        setTimeout(() => successMessage = '', 3000);
      } else {
        error = 'Erreur lors de la sauvegarde';
      }
    } catch (err) {
      error = 'Impossible de contacter le serveur';
    } finally {
      saving = false;
    }
  }

  // Sauvegarder la grille
  async function saveGrille() {
    saving = true;
    error = '';
    successMessage = '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/competitions/${competitionId}/grille`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resultats: grille
            .filter(g => g.overrideResultatInd !== null || g.overrideResultatJeu !== null)
            .map(g => ({
              grilleResultatId: g.grilleResultatId,
              resultatInd: g.overrideResultatInd,
              resultatJeu: g.overrideResultatJeu
            }))
        })
      });
      if (res.ok) {
        successMessage = 'Grille de scoring enregistrée';
        setTimeout(() => successMessage = '', 3000);
        await loadGrille(); // Recharger pour voir les valeurs effectives
      } else {
        error = 'Erreur lors de la sauvegarde';
      }
    } catch (err) {
      error = 'Impossible de contacter le serveur';
    } finally {
      saving = false;
    }
  }

  // Sauvegarder le calendrier
  async function saveSchedule() {
    saving = true;
    error = '';
    successMessage = '';
    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/competitions/${competitionId}/schedule`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entries: schedule.map(s => ({
            id: s.id,
            mancheNumber: s.mancheNumber,
            eventDate: s.eventDate,
            isCancelled: s.isCancelled,
            isClosedForEncoding: s.isClosedForEncoding
          }))
        })
      });
      if (res.ok) {
        successMessage = 'Calendrier enregistré';
        setTimeout(() => successMessage = '', 3000);
        await loadSchedule();
      } else {
        error = 'Erreur lors de la sauvegarde du calendrier';
      }
    } catch (err) {
      error = 'Impossible de contacter le serveur';
    } finally {
      saving = false;
    }
  }

  // Ajouter une entrée au calendrier
  function addScheduleEntry() {
    const lastManche = schedule.length > 0 ? Math.max(...schedule.map(s => s.mancheNumber)) : 0;
    schedule = [...schedule, {
      id: null,
      mancheNumber: lastManche + 1,
      eventDate: new Date().toISOString().split('T')[0],
      isCancelled: false,
      isClosedForEncoding: false
    }];
  }

  // Supprimer une entrée du calendrier
  function removeScheduleEntry(index: number) {
    schedule = schedule.filter((_, i) => i !== index);
  }

  // Réinitialiser une valeur de grille au défaut
  function resetGrilleItem(item: CompetitionResultat) {
    item.overrideResultatInd = null;
    item.overrideResultatJeu = null;
    grille = [...grille];
  }

  // Gérer le changement d'onglet
  function switchTab(tab: typeof activeTab) {
    activeTab = tab;
    if (tab === 'annonces' && annonces.length === 0) loadAnnonces();
    if (tab === 'jetons' && jetons.length === 0) loadJetons();
    if (tab === 'grille' && grille.length === 0) loadGrille();
    if (tab === 'calendrier' && schedule.length === 0) loadSchedule();
  }

  onMount(() => {
    competitionId = parseInt($page.params.id);
    loadCompetition();
    loadClubs();
  });
</script>

<svelte:head>
  <title>{competition?.name || 'Compétition'} - Configuration</title>
</svelte:head>

<div class="admin-container">
  <header class="admin-header">
    <a href="/admin/competitions" class="back-btn">← Retour</a>
    <h1>⚙️ {competition?.name || 'Configuration'}</h1>
  </header>

  {#if error}
    <div class="error-message">{error}</div>
  {/if}

  {#if successMessage}
    <div class="success-message">{successMessage}</div>
  {/if}

  {#if loading}
    <div class="loading">Chargement...</div>
  {:else if competition}
    <!-- Onglets -->
    <div class="tabs">
      <button class="tab" class:active={activeTab === 'general'} on:click={() => switchTab('general')}>
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
        </svg>
        Général
      </button>
      <button class="tab" class:active={activeTab === 'calendrier'} on:click={() => switchTab('calendrier')}>
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        Calendrier
      </button>
      <button class="tab" class:active={activeTab === 'annonces'} on:click={() => switchTab('annonces')}>
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
        Annonces
      </button>
      <button class="tab" class:active={activeTab === 'jetons'} on:click={() => switchTab('jetons')}>
        <JetonPoker color="rouge" size={20} />
        Jetons
      </button>
      <button class="tab" class:active={activeTab === 'grille'} on:click={() => switchTab('grille')}>
        <svg class="tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
        </svg>
        Grille
      </button>
    </div>

    <!-- Contenu des onglets -->
    <div class="tab-content">
      {#if activeTab === 'general'}
        <div class="panel">
          <h2>Informations générales</h2>
          <form on:submit|preventDefault={saveGeneral}>
            <div class="form-row">
              <div class="form-group">
                <label for="type">Type de compétition</label>
                <select id="type" bind:value={competition.competitionType}>
                  {#each Object.entries(competitionTypes) as [value, label]}
                    <option value={parseInt(value)}>{label}</option>
                  {/each}
                </select>
              </div>
              <div class="form-group">
                <label for="number">Numéro</label>
                <input id="number" type="number" bind:value={competition.competitionNumber} />
              </div>
            </div>

            <div class="form-group">
              <label for="name">Nom de la compétition</label>
              <input id="name" type="text" bind:value={competition.name} required />
            </div>

            {#if competition.competitionType !== 3}
              <div class="form-group">
                <label for="clubId">Club organisateur</label>
                <select id="clubId" bind:value={competition.clubId}>
                  <option value={null}>-- Aucun club --</option>
                  {#each clubs as club}
                    <option value={club.id}>{club.name}</option>
                  {/each}
                </select>
                {#if competition.clubId && competition.clubColor}
                  <div class="club-info-preview" style="margin-top: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                    <span class="club-color-indicator" style="width: 16px; height: 16px; border-radius: 50%; background-color: {competition.clubColor};"></span>
                    <span style="color: var(--text-secondary); font-size: 0.875rem;">{competition.clubShortName || competition.clubName}</span>
                  </div>
                {/if}
              </div>
            {/if}

            <div class="form-row">
              <div class="form-group">
                <label for="manches">Nombre de manches</label>
                <input id="manches" type="number" bind:value={competition.manchesCount} />
              </div>
              <div class="form-group">
                <label for="tours">Tours par manche</label>
                <input id="tours" type="number" bind:value={competition.nbreToursPerManche} />
              </div>
            </div>

            <div class="form-row">
              <div class="form-group">
                <label for="eventDate">Date de l'événement</label>
                <input id="eventDate" type="date" bind:value={competition.eventDate} />
              </div>
              <div class="form-group">
                <label for="scoringGrid">Code grille de scoring</label>
                <input id="scoringGrid" type="text" bind:value={competition.scoringGridCode} placeholder="STANDARD" />
              </div>
            </div>

            <fieldset class="form-group form-fieldset">
              <legend>Tables autorisées (nombre de joueurs)</legend>
              <div class="player-count-checkboxes">
                <label class="checkbox-label">
                  <input type="checkbox" 
                    checked={competition.allowedPlayers?.includes('4')} 
                    on:change={(e) => updateAllowedPlayers(4, e.currentTarget.checked)} />
                  4 joueurs
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" 
                    checked={competition.allowedPlayers?.includes('5')} 
                    on:change={(e) => updateAllowedPlayers(5, e.currentTarget.checked)} />
                  5 joueurs
                </label>
                <label class="checkbox-label">
                  <input type="checkbox" 
                    checked={competition.allowedPlayers?.includes('6')} 
                    on:change={(e) => updateAllowedPlayers(6, e.currentTarget.checked)} />
                  6 joueurs
                </label>
              </div>
            </fieldset>

            <div class="form-group">
              <label for="logoPath">Chemin du logo</label>
              <input id="logoPath" type="text" bind:value={competition.logoPath} placeholder="/logos/competition.png" />
            </div>

            <div class="form-group">
              <label for="reglement">Règlement</label>
              <textarea id="reglement" bind:value={competition.reglementText} rows="4" placeholder="Texte du règlement ou lien..."></textarea>
            </div>

            <div class="form-row checkboxes">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={competition.usesArbitre} />
                Utilise un arbitre
              </label>
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={competition.isActive} />
                Compétition active
              </label>
            </div>

            <div class="form-actions">
              <button type="submit" class="btn-save" disabled={saving}>
                {saving ? 'Enregistrement...' : '💾 Enregistrer'}
              </button>
            </div>
          </form>
        </div>

      {:else if activeTab === 'annonces'}
        <div class="panel">
          <h2>Configuration des annonces</h2>
          <p class="hint">Glissez-déposez pour réorganiser l'ordre. Utilisez les filtres pour trouver rapidement une annonce.</p>
          
          <!-- Filtres -->
          <div class="annonces-filters">
            <div class="filter-group">
              <label for="filter-type">Type</label>
              <select id="filter-type" bind:value={filterType}>
                <option value="">Tous les types</option>
                {#each availableTypes as type}
                  <option value={type}>{annonceTypeLabels[type] || type}</option>
                {/each}
              </select>
            </div>
            <div class="filter-group">
              <label for="filter-mode">Mode de jeu</label>
              <select id="filter-mode" bind:value={filterModeJeu}>
                <option value="">Tous les modes</option>
                {#each availableModes as mode}
                  <option value={mode}>{modeJeuLabels[mode] || mode}</option>
                {/each}
              </select>
            </div>
            <label class="checkbox-label filter-checkbox">
              <input type="checkbox" bind:checked={filterActiveOnly} />
              Activées uniquement
            </label>
            <span class="filter-count">{filteredAnnonces.length} / {annonces.length}</span>
          </div>
          
          {#if annonces.length === 0}
            <div class="loading">Chargement des annonces...</div>
          {:else}
            <div class="annonces-list" role="list">
              {#each filteredAnnonces as annonce, i (annonce.annonceCode)}
                <div 
                  class="annonce-item" 
                  class:inactive={!annonce.isActive}
                  class:dragging={draggedIndex === annonces.indexOf(annonce)}
                  draggable="true"
                  role="listitem"
                  on:dragstart={() => handleDragStart(annonces.indexOf(annonce))}
                  on:dragover={handleDragOver}
                  on:drop={() => handleDrop(annonces.indexOf(annonce))}
                  on:dragend={handleDragEnd}
                >
                  <div class="annonce-drag-handle" title="Glisser pour réorganiser">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                      <circle cx="9" cy="6" r="1.5"/>
                      <circle cx="15" cy="6" r="1.5"/>
                      <circle cx="9" cy="12" r="1.5"/>
                      <circle cx="15" cy="12" r="1.5"/>
                      <circle cx="9" cy="18" r="1.5"/>
                      <circle cx="15" cy="18" r="1.5"/>
                    </svg>
                  </div>
                  <div class="annonce-info">
                    <span class="annonce-order">{annonce.sortOrder}</span>
                    <span class="annonce-code">{annonce.annonceCode}</span>
                    <span class="annonce-label">{annonce.annonceLabel}</span>
                    <span class="annonce-type-badge">{annonceTypeLabels[annonce.annonceType] || annonce.annonceType}</span>
                  </div>
                  <div class="annonce-controls">
                    <label class="checkbox-label small">
                      <input type="checkbox" bind:checked={annonce.isActive} />
                      Activée
                    </label>
                    <label class="checkbox-label small">
                      <input type="checkbox" bind:checked={annonce.requireArbitre} disabled={!annonce.isActive} />
                      ⚖️ Arbitre
                    </label>
                  </div>
                </div>
              {/each}
            </div>
            <div class="form-actions">
              <button class="btn-save" on:click={saveAnnonces} disabled={saving}>
                {saving ? 'Enregistrement...' : '💾 Enregistrer les annonces'}
              </button>
            </div>
          {/if}
        </div>

      {:else if activeTab === 'jetons'}
        <div class="panel">
          <h2>Configuration des jetons (pénalités)</h2>
          <p class="hint">Définissez la valeur de déduction pour chaque type de jeton.</p>
          
          {#if jetons.length === 0}
            <div class="loading">Chargement des jetons...</div>
          {:else}
            <div class="jetons-list">
              {#each jetons as jeton}
                <div class="jeton-item" class:inactive={!jeton.isActive}>
                  <JetonPoker color={mapJetonColor(jeton.jetonTypeCode)} size={50} />
                  <div class="jeton-info">
                    <span class="jeton-label">{jeton.jetonLabel}</span>
                    <span class="jeton-code-small">{jeton.jetonTypeCode}</span>
                  </div>
                  <div class="jeton-controls">
                    <label class="checkbox-label small">
                      <input type="checkbox" bind:checked={jeton.isActive} />
                      Actif
                    </label>
                    <div class="valeur-input-group">
                      <label for="valeur-{jeton.jetonTypeCode}">Points déduits:</label>
                      <input 
                        id="valeur-{jeton.jetonTypeCode}"
                        type="number" 
                        class="valeur-input" 
                        bind:value={jeton.valeur} 
                        min="0"
                        disabled={!jeton.isActive}
                      />
                    </div>
                  </div>
                </div>
              {/each}
            </div>
            <div class="form-actions">
              <button class="btn-save" on:click={saveJetons} disabled={saving}>
                {saving ? 'Enregistrement...' : '💾 Enregistrer les jetons'}
              </button>
            </div>
          {/if}
        </div>

      {:else if activeTab === 'grille'}
        <div class="panel">
          <h2>Grille de scoring</h2>
          <p class="hint">Surchargez les valeurs de scoring par défaut pour cette compétition. Laissez vide pour utiliser les valeurs par défaut.</p>
          
          {#if grille.length === 0}
            <div class="loading">Chargement de la grille...</div>
          {:else}
            <!-- Filtres de la grille -->
            <div class="grille-filters">
              <div class="filter-group">
                <label for="grille-filter-annonce">Annonce</label>
                <select id="grille-filter-annonce" bind:value={grilleFilterAnnonce}>
                  <option value="">Toutes</option>
                  {#each grilleAvailableAnnonces as annonce}
                    <option value={annonce}>{annonce}</option>
                  {/each}
                </select>
              </div>
              <div class="filter-group">
                <label for="grille-filter-kind">Type</label>
                <select id="grille-filter-kind" bind:value={grilleFilterKind}>
                  <option value="">Tous</option>
                  {#each grilleAvailableKinds as kind}
                    <option value={kind}>{kind}</option>
                  {/each}
                </select>
              </div>
              <div class="filter-group">
                <label for="grille-filter-joueurs">Joueurs</label>
                <select id="grille-filter-joueurs" bind:value={grilleFilterNbJoueurs}>
                  <option value="">Tous</option>
                  {#each grilleAvailableNbJoueurs as nb}
                    <option value={nb}>{nb}</option>
                  {/each}
                </select>
              </div>
              <div class="filter-group">
                <label for="grille-filter-annonce-type">Catégorie</label>
                <select id="grille-filter-annonce-type" bind:value={grilleFilterAnnonceType}>
                  <option value="">Toutes</option>
                  {#each grilleAvailableAnnonceTypes as annonceType}
                    <option value={annonceType}>{annonceType}</option>
                  {/each}
                </select>
              </div>
              <label class="checkbox-label filter-checkbox">
                <input type="checkbox" bind:checked={grilleShowOverridesOnly} />
                Surcharges uniquement
              </label>
              <button class="btn-reset-filters" on:click={resetGrilleFilters} title="Réinitialiser les filtres">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
                Reset
              </button>
              <span class="filter-count">{filteredGrille.length} / {grille.length} lignes</span>
            </div>

            <div class="grille-table-container">
              <table class="grille-table">
                <thead>
                  <tr>
                    <th class="sortable" class:sorted={grilleSortColumn === 'annonce'} on:click={() => sortGrilleBy('annonce')}>
                      Annonce {grilleSortColumn === 'annonce' ? (grilleSortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th class="sortable" class:sorted={grilleSortColumn === 'kind'} on:click={() => sortGrilleBy('kind')}>
                      Type {grilleSortColumn === 'kind' ? (grilleSortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th class="sortable" class:sorted={grilleSortColumn === 'joueurs'} on:click={() => sortGrilleBy('joueurs')}>
                      Joueurs {grilleSortColumn === 'joueurs' ? (grilleSortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th class="sortable" class:sorted={grilleSortColumn === 'plis'} on:click={() => sortGrilleBy('plis')}>
                      Plis/État {grilleSortColumn === 'plis' ? (grilleSortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th class="sortable" class:sorted={grilleSortColumn === 'defaultInd'} on:click={() => sortGrilleBy('defaultInd')}>
                      Ind (défaut) {grilleSortColumn === 'defaultInd' ? (grilleSortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th class="sortable" class:sorted={grilleSortColumn === 'defaultJeu'} on:click={() => sortGrilleBy('defaultJeu')}>
                      Jeu (défaut) {grilleSortColumn === 'defaultJeu' ? (grilleSortAsc ? '▲' : '▼') : ''}
                    </th>
                    <th>Ind (custom)</th>
                    <th>Jeu (custom)</th>
                  </tr>
                </thead>
                <tbody>
                  {#each filteredGrille as item, idx}
                    <tr class:overridden={item.overrideResultatInd !== null || item.overrideResultatJeu !== null} class:row-even={idx % 2 === 0} class:row-odd={idx % 2 === 1}>
                      <td class="annonce-cell">
                        <span class="annonce-name">{item.annonceLabel}</span>
                        <span class="annonce-tags">
                          <span class="annonce-badge-type" data-type={item.annonceType}>{item.annonceType}</span>
                          <span class="annonce-badge-code" data-code={item.annonceCode}>{item.annonceCode}</span>
                        </span>
                      </td>
                      <td>{item.kind}</td>
                      <td>{item.nbJoueursDedans}</td>
                      <td>{item.kind === 'plis' ? item.plisFaits : item.etat}</td>
                      <td class="default-value">{item.defaultResultatInd}</td>
                      <td class="default-value">{item.defaultResultatJeu}</td>
                      <td>
                        <input 
                          type="number" 
                          class="grille-input" 
                          bind:value={item.overrideResultatInd}
                          placeholder="-"
                        />
                      </td>
                      <td>
                        <input 
                          type="number" 
                          class="grille-input" 
                          bind:value={item.overrideResultatJeu}
                          placeholder="-"
                        />
                        {#if item.overrideResultatInd !== null || item.overrideResultatJeu !== null}
                          <button class="btn-reset-inline" on:click={() => resetGrilleItem(item)} title="Réinitialiser">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                              <path d="M3 3v5h5"/>
                            </svg>
                          </button>
                        {/if}
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
            <div class="form-actions">
              <button class="btn-save" on:click={saveGrille} disabled={saving}>
                {saving ? 'Enregistrement...' : '💾 Enregistrer la grille'}
              </button>
            </div>
          {/if}
        </div>
      {/if}

      {#if activeTab === 'calendrier'}
        <div class="panel">
          <h2>Calendrier des manches</h2>
          <p class="panel-hint">
            Définissez les dates pour chaque manche de cette compétition.
            {#if competition.competitionType === 3}
              <em>(Non applicable pour les manches libres)</em>
            {/if}
          </p>

          {#if competition.competitionType === 3}
            <div class="empty-state">
              Les manches libres n'ont pas de calendrier prédéfini.
            </div>
          {:else}
            <div class="schedule-header">
              <span class="schedule-col-manche">Manche</span>
              <span class="schedule-col-date">Date</span>
              <span class="schedule-col-status">Statut</span>
              <span class="schedule-col-encoding">Encodage</span>
              <span class="schedule-col-action"></span>
            </div>
            <div class="schedule-list">
              {#each schedule as entry, index}
                <div class="schedule-entry" class:cancelled={entry.isCancelled} class:closed-encoding={entry.isClosedForEncoding}>
                  <input
                    type="number"
                    bind:value={entry.mancheNumber}
                    min="1"
                    class="manche-input"
                    title="Numéro de manche"
                  />
                  <input
                    type="date"
                    bind:value={entry.eventDate}
                    class="date-input"
                  />
                  <label class="checkbox-inline">
                    <input type="checkbox" bind:checked={entry.isCancelled} />
                    <span class="cancelled-label">Annulée</span>
                  </label>
                  <label class="checkbox-inline closed-checkbox" title="Fermer cette manche à l'encodage">
                    <input type="checkbox" bind:checked={entry.isClosedForEncoding} disabled={entry.isCancelled} />
                    <span class="closed-label">Fermé</span>
                  </label>
                  <button class="btn-remove-small" on:click={() => removeScheduleEntry(index)} title="Supprimer">
                    ✕
                  </button>
                </div>
              {/each}

              {#if schedule.length === 0}
                <div class="empty-state">
                  Aucune date programmée. Ajoutez des entrées au calendrier.
                </div>
              {/if}
            </div>

            <div class="schedule-actions">
              <button class="btn-add" on:click={addScheduleEntry}>
                ➕ Ajouter une manche
              </button>
            </div>

            <div class="form-actions">
              <button class="btn-save" on:click={saveSchedule} disabled={saving}>
                {saving ? 'Enregistrement...' : '💾 Enregistrer le calendrier'}
              </button>
            </div>
          {/if}
        </div>
      {/if}
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
    font-family: 'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  * {
    box-sizing: border-box;
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
    font-size: 1.4rem;
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

  .loading {
    text-align: center;
    padding: 2rem;
    color: #94a3b8;
  }

  /* Onglets */
  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }

  .tab {
    background: #020617;
    color: #94a3b8;
    border: 1px solid rgba(34, 197, 94, 0.2);
    padding: 0.75rem 1.25rem;
    border-radius: 8px 8px 0 0;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .tab-icon {
    width: 18px;
    height: 18px;
    stroke: #d4a017;
    fill: none;
  }

  .tab.active .tab-icon {
    stroke: #fbbf24;
  }

  .tab:hover {
    color: #e2e8f0;
    border-color: rgba(34, 197, 94, 0.4);
  }

  .tab.active {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    border-color: #22c55e;
    border-bottom-color: transparent;
  }

  .tab-content {
    background: #020617;
    border: 1px solid rgba(34, 197, 94, 0.2);
    border-radius: 0 8px 8px 8px;
    min-height: 400px;
  }

  .panel {
    padding: 1.5rem;
  }

  .panel h2 {
    color: #22c55e;
    font-size: 1.2rem;
    margin: 0 0 0.5rem 0;
  }

  .hint {
    color: #64748b;
    font-size: 0.85rem;
    margin-bottom: 1.5rem;
  }

  /* Formulaires */
  .form-group {
    margin-bottom: 1rem;
  }

  .form-fieldset {
    border: none;
    padding: 0;
    margin: 0 0 1rem 0;
  }

  .form-fieldset legend {
    color: #94a3b8;
    font-size: 0.85rem;
    margin-bottom: 0.3rem;
  }

  .form-group label {
    display: block;
    color: #94a3b8;
    font-size: 0.85rem;
    margin-bottom: 0.3rem;
  }

  .form-group input,
  .form-group select,
  .form-group textarea {
    width: 100%;
    background: #0f172a;
    color: #e2e8f0;
    border: 1px solid rgba(34, 197, 94, 0.3);
    padding: 0.6rem 0.8rem;
    border-radius: 8px;
    font-size: 0.95rem;
    font-family: inherit;
  }

  .form-group input:focus,
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #22c55e;
  }

  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    margin-bottom: 1.25rem;
  }

  .form-row .form-group {
    margin-bottom: 0;
    min-width: 0;
  }

  .form-row.checkboxes {
    display: flex;
    gap: 2rem;
    margin: 1.5rem 0;
  }

  .player-count-checkboxes {
    display: flex;
    gap: 2rem;
    margin-top: 0.5rem;
  }

  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #e2e8f0;
    cursor: pointer;
  }

  .checkbox-label.small {
    font-size: 0.85rem;
  }

  .checkbox-label input[type="checkbox"] {
    width: 18px;
    height: 18px;
    accent-color: #22c55e;
  }

  .form-actions {
    margin-top: 1.5rem;
    display: flex;
    justify-content: flex-end;
  }

  .btn-save {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.95rem;
    transition: transform 0.2s;
  }

  .btn-save:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Liste des annonces */
  .annonces-filters,
  .grille-filters {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
    background: rgba(34, 197, 94, 0.05);
    border-radius: 8px;
    flex-wrap: wrap;
    max-width: 850px;
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
    letter-spacing: 0.05em;
  }

  .filter-group select {
    background: #020617;
    color: #e2e8f0;
    border: 1px solid rgba(34, 197, 94, 0.3);
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    font-size: 0.85rem;
    min-width: 140px;
  }

  .filter-checkbox {
    margin-left: 0.5rem;
    align-self: flex-end;
    padding-bottom: 0.3rem;
  }

  .filter-count {
    margin-left: auto;
    font-size: 0.8rem;
    color: #64748b;
    background: rgba(34, 197, 94, 0.1);
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
  }

  .annonces-list {
    display: flex;
    flex-direction: column;
    gap: 0;
    max-width: 850px;
    scrollbar-width: thin;
    scrollbar-color: rgba(34, 197, 94, 0.3) transparent;
  }

  .annonces-list::-webkit-scrollbar {
    width: 6px;
  }

  .annonces-list::-webkit-scrollbar-track {
    background: transparent;
  }

  .annonces-list::-webkit-scrollbar-thumb {
    background: rgba(34, 197, 94, 0.3);
    border-radius: 3px;
  }

  .annonces-list::-webkit-scrollbar-thumb:hover {
    background: rgba(34, 197, 94, 0.5);
  }

  .annonce-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background: #0f172a;
    padding: 0.5rem 0.75rem;
    border-radius: 0;
    border: none;
    border-bottom: 1px solid rgba(34, 197, 94, 0.1);
    cursor: grab;
    transition: all 0.15s ease;
  }

  .annonce-item:nth-child(even) {
    background: #0a1120;
  }

  .annonce-item:hover {
    background: rgba(34, 197, 94, 0.08);
    border-color: rgba(34, 197, 94, 0.3);
  }

  .annonce-item.dragging {
    opacity: 0.5;
    background: rgba(34, 197, 94, 0.15);
  }

  .annonce-item.inactive {
    opacity: 0.5;
  }

  .annonce-drag-handle {
    color: #4b5563;
    cursor: grab;
    padding: 0.25rem;
    display: flex;
    align-items: center;
  }

  .annonce-drag-handle:hover {
    color: #22c55e;
  }

  .annonce-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .annonce-order {
    background: rgba(34, 197, 94, 0.2);
    color: #22c55e;
    min-width: 32px;
    height: 22px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    font-weight: 600;
  }

  .annonce-code {
    font-family: monospace;
    color: #64748b;
    font-size: 0.75rem;
    min-width: 35px;
  }

  .annonce-label {
    color: #e2e8f0;
    font-size: 0.9rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .annonce-type-badge {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
    padding: 0.15rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  .annonce-controls {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-shrink: 0;
    margin-left: auto;
  }

  /* Liste des jetons */
  .jetons-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 850px;
  }

  .jeton-item {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: #0f172a;
    padding: 1rem;
    border-radius: 8px;
    border: 1px solid rgba(34, 197, 94, 0.1);
  }

  .jeton-item.inactive {
    opacity: 0.5;
  }

  .jeton-info {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .jeton-label {
    color: #e2e8f0;
    font-weight: 500;
  }

  .jeton-code-small {
    color: #64748b;
    font-size: 0.8rem;
    font-family: monospace;
  }

  .jeton-controls {
    display: flex;
    align-items: center;
    gap: 1.5rem;
  }

  .valeur-input-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .valeur-input-group label {
    color: #94a3b8;
    font-size: 0.85rem;
  }

  .valeur-input {
    width: 70px;
    background: #020617;
    color: #e2e8f0;
    border: 1px solid rgba(34, 197, 94, 0.3);
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    text-align: center;
    font-size: 1rem;
  }

  .valeur-input:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* Grille de scoring */
  .grille-filters {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    margin-bottom: 1rem;
    padding: 1rem;
    background: rgba(34, 197, 94, 0.05);
    border-radius: 8px;
    max-width: 850px;
  }

  .grille-filters .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .grille-filters .filter-group label {
    font-size: 0.75rem;
    color: #94a3b8;
  }

  .grille-filters select {
    background: #020617;
    color: #e2e8f0;
    border: 1px solid rgba(34, 197, 94, 0.3);
    padding: 0.4rem 0.6rem;
    border-radius: 4px;
    font-size: 0.85rem;
    min-width: 120px;
  }

  .grille-filters .filter-checkbox {
    margin-left: auto;
  }

  .grille-filters .btn-reset-filters {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    background: rgba(100, 116, 139, 0.2);
    color: #94a3b8;
    border: 1px solid rgba(100, 116, 139, 0.3);
    padding: 0.4rem 0.8rem;
    border-radius: 4px;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .grille-filters .btn-reset-filters:hover {
    background: rgba(100, 116, 139, 0.3);
    color: #e2e8f0;
  }

  .grille-filters .filter-count {
    font-size: 0.8rem;
    color: #64748b;
    margin-left: 0.5rem;
  }

  .grille-table-container {
    overflow-x: auto;
    margin-bottom: 1rem;
    max-width: 850px;
  }

  .grille-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
  }

  .grille-table th,
  .grille-table td {
    padding: 0.5rem;
    border: 1px solid rgba(34, 197, 94, 0.1);
    text-align: center;
  }

  .grille-table th {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    font-weight: 500;
  }

  .grille-table th.sortable {
    cursor: pointer;
    user-select: none;
    transition: background 0.2s;
  }

  .grille-table th.sortable:hover {
    background: rgba(34, 197, 94, 0.2);
  }

  .grille-table th.sorted {
    background: rgba(34, 197, 94, 0.25);
  }

  .grille-table tbody tr.row-even {
    background: rgba(0, 0, 0, 0.2);
  }

  .grille-table tbody tr.row-odd {
    background: rgba(34, 197, 94, 0.03);
  }

  .grille-table tbody tr:hover {
    background: rgba(34, 197, 94, 0.1);
  }

  .grille-table tr.overridden {
    background: rgba(59, 130, 246, 0.15) !important;
  }

  .grille-table tr.overridden:hover {
    background: rgba(59, 130, 246, 0.25) !important;
  }

  .annonce-cell {
    text-align: left;
    font-weight: 500;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 0.75rem;
    padding: 0.5rem 0.75rem !important;
  }

  .annonce-name {
    flex: 0 1 auto;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 180px;
  }

  .annonce-tags {
    display: flex;
    gap: 0.35rem;
    flex-shrink: 0;
    align-items: center;
  }

  /* Badge pour le type/catégorie */
  .annonce-badge-type {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    white-space: nowrap;
    min-width: 60px;
    text-align: center;
  }

  /* Badge pour le code - couleurs basées sur le type et la parité de ligne */
  .annonce-badge-code {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    font-size: 0.65rem;
    font-weight: 700;
    font-family: 'Consolas', 'Monaco', monospace;
    white-space: nowrap;
    min-width: 35px;
    text-align: center;
  }

  /* === BADGES TYPE (catégorie) === */
  /* Emballage - Vert */
  .annonce-badge-type[data-type="Emballage"] {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.4);
  }
  /* Solo - Bleu */
  .annonce-badge-type[data-type="Solo"] {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.4);
  }
  /* Misère - Violet */
  .annonce-badge-type[data-type="Misère"],
  .annonce-badge-type[data-type="Misere"] {
    background: rgba(168, 85, 247, 0.2);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.4);
  }
  /* Abondance - Orange */
  .annonce-badge-type[data-type="Abondance"] {
    background: rgba(249, 115, 22, 0.2);
    color: #fb923c;
    border: 1px solid rgba(249, 115, 22, 0.4);
  }
  /* Chelem - Rouge */
  .annonce-badge-type[data-type="Chelem"] {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.4);
  }
  /* Trou - Jaune */
  .annonce-badge-type[data-type="Trou"] {
    background: rgba(234, 179, 8, 0.2);
    color: #facc15;
    border: 1px solid rgba(234, 179, 8, 0.4);
  }
  /* Dames - Rose */
  .annonce-badge-type[data-type="Dames"] {
    background: rgba(236, 72, 153, 0.2);
    color: #f472b6;
    border: 1px solid rgba(236, 72, 153, 0.4);
  }
  /* Picolo - Cyan */
  .annonce-badge-type[data-type="Picolo"] {
    background: rgba(6, 182, 212, 0.2);
    color: #22d3ee;
    border: 1px solid rgba(6, 182, 212, 0.4);
  }
  /* Défaut pour types non reconnus */
  .annonce-badge-type:not([data-type]),
  .annonce-badge-type[data-type=""] {
    background: rgba(100, 116, 139, 0.2);
    color: #94a3b8;
    border: 1px solid rgba(100, 116, 139, 0.4);
  }

  /* === BADGES CODE (chaque code a sa couleur très distincte) === */
  /* Couleurs très contrastées pour distinguer facilement chaque code */
  
  /* E8 - Vert lime vif */
  .annonce-badge-code[data-code="E8"] {
    background: rgba(132, 204, 22, 0.6);
    color: #ecfccb;
    border: 2px solid #84cc16;
  }
  /* E9 - Vert émeraude */
  .annonce-badge-code[data-code="E9"] {
    background: rgba(16, 185, 129, 0.6);
    color: #a7f3d0;
    border: 2px solid #10b981;
  }
  /* E10 - Vert forêt foncé */
  .annonce-badge-code[data-code="E10"] {
    background: rgba(21, 128, 61, 0.7);
    color: #bbf7d0;
    border: 2px solid #16a34a;
  }
  /* E11 - Teal/Sarcelle */
  .annonce-badge-code[data-code="E11"] {
    background: rgba(20, 184, 166, 0.6);
    color: #ccfbf1;
    border: 2px solid #14b8a6;
  }
  /* E12 - Vert olive */
  .annonce-badge-code[data-code="E12"] {
    background: rgba(101, 163, 13, 0.65);
    color: #d9f99d;
    border: 2px solid #65a30d;
  }
  /* E13 - Vert menthe foncé */
  .annonce-badge-code[data-code="E13"] {
    background: rgba(4, 120, 87, 0.7);
    color: #6ee7b7;
    border: 2px solid #059669;
  }

  /* S6 - Bleu ciel */
  .annonce-badge-code[data-code="S6"] {
    background: rgba(56, 189, 248, 0.6);
    color: #e0f2fe;
    border: 2px solid #38bdf8;
  }
  /* S7 - Bleu roi */
  .annonce-badge-code[data-code="S7"] {
    background: rgba(59, 130, 246, 0.6);
    color: #dbeafe;
    border: 2px solid #3b82f6;
  }
  /* S8 - Bleu marine */
  .annonce-badge-code[data-code="S8"] {
    background: rgba(37, 99, 235, 0.65);
    color: #bfdbfe;
    border: 2px solid #2563eb;
  }
  /* S8_D - Indigo profond */
  .annonce-badge-code[data-code="S8_D"] {
    background: rgba(99, 102, 241, 0.65);
    color: #c7d2fe;
    border: 2px solid #6366f1;
  }

  /* PM - Violet lavande */
  .annonce-badge-code[data-code="PM"] {
    background: rgba(167, 139, 250, 0.6);
    color: #ede9fe;
    border: 2px solid #a78bfa;
  }
  /* PM2 - Violet orchidée */
  .annonce-badge-code[data-code="PM2"] {
    background: rgba(232, 121, 249, 0.6);
    color: #fae8ff;
    border: 2px solid #e879f9;
  }
  /* PME - Violet améthyste */
  .annonce-badge-code[data-code="PME"] {
    background: rgba(168, 85, 247, 0.6);
    color: #e9d5ff;
    border: 2px solid #a855f7;
  }
  /* PME2 - Magenta */
  .annonce-badge-code[data-code="PME2"] {
    background: rgba(217, 70, 239, 0.6);
    color: #f5d0fe;
    border: 2px solid #d946ef;
  }
  /* GM - Pourpre royal */
  .annonce-badge-code[data-code="GM"] {
    background: rgba(139, 92, 246, 0.6);
    color: #ddd6fe;
    border: 2px solid #8b5cf6;
  }
  /* GM2 - Fuchsia */
  .annonce-badge-code[data-code="GM2"] {
    background: rgba(192, 38, 211, 0.6);
    color: #f0abfc;
    border: 2px solid #c026d3;
  }
  /* GME - Violet foncé */
  .annonce-badge-code[data-code="GME"] {
    background: rgba(126, 34, 206, 0.65);
    color: #c4b5fd;
    border: 2px solid #7e22ce;
  }
  /* GME2 - Prune */
  .annonce-badge-code[data-code="GME2"] {
    background: rgba(134, 25, 143, 0.65);
    color: #e9d5ff;
    border: 2px solid #86198f;
  }

  /* A9 - Orange vif */
  .annonce-badge-code[data-code="A9"] {
    background: rgba(251, 146, 60, 0.6);
    color: #ffedd5;
    border: 2px solid #fb923c;
  }
  /* A10 - Orange foncé */
  .annonce-badge-code[data-code="A10"] {
    background: rgba(249, 115, 22, 0.6);
    color: #fed7aa;
    border: 2px solid #f97316;
  }
  /* A11 - Orange brûlé */
  .annonce-badge-code[data-code="A11"] {
    background: rgba(234, 88, 12, 0.65);
    color: #fdba74;
    border: 2px solid #ea580c;
  }
  /* A12 - Ambre doré */
  .annonce-badge-code[data-code="A12"] {
    background: rgba(245, 158, 11, 0.6);
    color: #fef3c7;
    border: 2px solid #f59e0b;
  }
  /* A13 - Cuivre/Rouille */
  .annonce-badge-code[data-code="A13"] {
    background: rgba(180, 83, 9, 0.65);
    color: #fcd34d;
    border: 2px solid #b45309;
  }

  /* TR - Jaune or */
  .annonce-badge-code[data-code="TR"] {
    background: rgba(234, 179, 8, 0.6);
    color: #fef9c3;
    border: 2px solid #eab308;
  }

  /* PC/P - Cyan brillant */
  .annonce-badge-code[data-code="PC"],
  .annonce-badge-code[data-code="P"] {
    background: rgba(6, 182, 212, 0.6);
    color: #cffafe;
    border: 2px solid #06b6d4;
  }
  /* P2 - Bleu turquoise */
  .annonce-badge-code[data-code="P2"] {
    background: rgba(14, 165, 233, 0.6);
    color: #e0f2fe;
    border: 2px solid #0ea5e9;
  }

  /* CH - Rouge vif */
  .annonce-badge-code[data-code="CH"] {
    background: rgba(239, 68, 68, 0.6);
    color: #fee2e2;
    border: 2px solid #ef4444;
  }

  /* D - Rose bonbon */
  .annonce-badge-code[data-code="D"] {
    background: rgba(236, 72, 153, 0.6);
    color: #fce7f3;
    border: 2px solid #ec4899;
  }

  /* Défaut pour codes non reconnus */
  .annonce-badge-code:not([data-code]),
  .annonce-badge-code[data-code=""] {
    background: rgba(100, 116, 139, 0.5);
    color: #e2e8f0;
    border: 2px solid #64748b;
  }

  .default-value {
    color: #64748b;
  }

  .grille-input {
    width: 60px;
    background: #020617;
    color: #e2e8f0;
    border: 1px solid rgba(34, 197, 94, 0.3);
    padding: 0.3rem;
    border-radius: 4px;
    text-align: center;
  }

  .grille-input::placeholder {
    color: #4b5563;
  }

  .btn-reset-inline {
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #ef4444;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    margin-left: 0.5rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    vertical-align: middle;
    transition: all 0.2s;
  }

  .btn-reset-inline:hover {
    background: rgba(239, 68, 68, 0.25);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .btn-reset-inline svg {
    display: block;
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

    .tabs {
      flex-direction: column;
    }

    .tab {
      border-radius: 8px;
    }

    .annonce-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.75rem;
    }

    .annonce-controls {
      width: 100%;
      justify-content: space-between;
    }

    .jeton-item {
      flex-wrap: wrap;
    }

    .jeton-controls {
      width: 100%;
      justify-content: space-between;
      margin-top: 0.5rem;
    }

    .grille-table {
      font-size: 0.75rem;
    }

    .grille-input {
      width: 50px;
    }

    .schedule-entry {
      flex-direction: column;
      gap: 0.75rem;
    }

    .schedule-header {
      display: none;
    }

    .schedule-entry {
      grid-template-columns: 60px 1fr 70px 70px 28px;
    }
  }

  /* Styles pour le calendrier - version compacte */
  .schedule-header {
    display: grid;
    grid-template-columns: 70px 1fr 100px 100px 32px;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid rgba(34, 197, 94, 0.2);
  }

  .schedule-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0.5rem 0;
    max-height: 500px;
    overflow-y: auto;
  }

  .schedule-entry {
    display: grid;
    grid-template-columns: 70px 1fr 100px 100px 32px;
    align-items: center;
    gap: 0.5rem;
    background: rgba(34, 197, 94, 0.03);
    padding: 0.4rem 0.75rem;
    border-radius: 4px;
    border: 1px solid rgba(34, 197, 94, 0.1);
  }

  .schedule-entry:hover {
    background: rgba(34, 197, 94, 0.08);
  }

  .schedule-entry.cancelled {
    opacity: 0.6;
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.2);
  }

  .schedule-entry.closed-encoding:not(.cancelled) {
    background: rgba(234, 179, 8, 0.1);
    border-color: rgba(234, 179, 8, 0.3);
  }

  .manche-input {
    width: 60px;
    padding: 0.35rem 0.5rem;
    background: #020617;
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 4px;
    color: #e2e8f0;
    font-size: 0.85rem;
    text-align: center;
  }

  .date-input {
    padding: 0.35rem 0.5rem;
    background: #020617;
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 4px;
    color: #e2e8f0;
    font-size: 0.85rem;
  }

  .checkbox-inline {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    cursor: pointer;
    font-size: 0.8rem;
    color: #94a3b8;
  }

  .checkbox-inline input[type="checkbox"] {
    accent-color: #ef4444;
    width: 14px;
    height: 14px;
  }

  .cancelled-label,
  .closed-label {
    display: none;
  }

  @media (min-width: 600px) {
    .cancelled-label,
    .closed-label {
      display: inline;
    }
  }

  .closed-checkbox input[type="checkbox"] {
    accent-color: #eab308;
  }

  .closed-checkbox input[type="checkbox"]:disabled {
    opacity: 0.4;
  }

  .btn-remove-small {
    background: transparent;
    border: none;
    cursor: pointer;
    color: #64748b;
    font-size: 0.9rem;
    padding: 0.25rem;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .btn-remove-small:hover {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }



  .schedule-actions {
    margin: 1rem 0;
  }

  .btn-add {
    background: rgba(34, 197, 94, 0.1);
    color: #22c55e;
    border: 1px dashed rgba(34, 197, 94, 0.5);
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .btn-add:hover {
    background: rgba(34, 197, 94, 0.2);
    border-style: solid;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #64748b;
    font-style: italic;
  }

  .panel-hint {
    font-size: 0.85rem;
    color: #94a3b8;
    margin-bottom: 1rem;
  }

  .panel-hint em {
    color: #f59e0b;
  }
</style>
