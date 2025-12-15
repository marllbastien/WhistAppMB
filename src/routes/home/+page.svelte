<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import ModeToggle from '$lib/components/ModeToggle.svelte';
  import DebugModal from '$lib/components/DebugModal.svelte';

  // 📦 Version de l'app (injectée au build)
  declare const __APP_VERSION__: string;
  declare const __BUILD_TIME__: string;
  const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';
  const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';

  let showDebugInfo = false;

  const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';

  type ApiPlayer = {
  id: number;
  alias: string;
  };


  type NouveauJoueurPayload = {
  lastName: string;
  firstName: string;
  email: string;
  phone: string;
  };
  let showNewPlayerModal = false;
  let newPlayerTargetIndex: number | null = null;
  let newPlayer: NouveauJoueurPayload = {
  lastName: '',
  firstName: '',
  email: '',
  phone: ''
  };
  let isSavingNewPlayer = false;
  let newPlayerError: string | null = null;

  // Gestion des doublons (joueur existant trouvé)
  type ExistingPlayerMatch = {
    id: number;
    alias: string;
    nom: string;
    prenom: string;
    isWhisteux: boolean;
  };
  let existingPlayerMatches: ExistingPlayerMatch[] = [];
  let showExistingPlayerModal = false;
  let isSearchingExisting = false;

  // 🔥 Interface pour les types de compétition depuis l'API
  interface CompetitionTypeInfo {
    id: number;
    name: string;
    shortName: string | null;
    description: string | null;
    isActive: boolean;
    sortOrder: number;
  }

  // 🔢 Type côté front = string "1" | "2" | "3" | "4" | ... (on convertit en number pour l'API)
  type CompetitionTypeCode = '' | string;

  // 🔥 Liste des types de compétition chargés depuis l'API
  let allCompetitionTypes: CompetitionTypeInfo[] = [];
  let isLoadingCompetitionTypes = true;



  type ActiveMancheDto = {
  id: number;
  tableName: string;
  mancheNumber: number;
  playerCount: number;
  gameStatus: number | null;
  startTime: string | null;
  endTime: string | null;
  lockedBy: string | null;
  lockedAt: string | null;
  lastDonneNumber: number | null;
  players: string[];
  playerIds: (number | null)[];
  };

  // 🔐 Reprise de manche existante
  let existingManche: ActiveMancheDto | null = null;
  let showResumeModal = false;
  let isCheckingExisting = false;
  let isCreating = false;
  let showErrorModal = false;
  let errorMessage = '';


  let ready = false;

  // 🔥 NOUVEAU : type / numéro de compétition
  let competitionType: CompetitionTypeCode = '';
  let competitionNumber: number | '' = '';

  let tableName = '';
  let mancheNumber: number | '' = '';
  let playerCount: string | null = null;


  let players: string[] = [];
  let playerIds: (number | null)[] = [];

  let availablePlayers: ApiPlayer[] = [];
  let isLoadingPlayers = true;
  let playersLoadError = '';

  let canContinue = false;
  let perSlotOptions: ApiPlayer[][] = [];


  let playerSelectEls: (HTMLSelectElement | null)[] = [];
  let continueBtn: HTMLButtonElement | null = null;
  // pour le scroll automatique des champs
  let competitionTypeEl: HTMLSelectElement | null = null;
  let competitionNumberEl: HTMLSelectElement | null = null;
  let mancheEl: HTMLInputElement | HTMLSelectElement | null = null;
  let tableEl: HTMLSelectElement | null = null;


  interface CompetitionDefinition {
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
  todayMancheNumbers?: number[] | null;
  // Infos du club organisateur
  clubId: number | null;
  clubName: string | null;
  clubShortName: string | null;
  clubColor: string | null;
  // Logo (priorité: compétition > club)
  logoPath: string | null;
  }

  // 🔥 définitions de compétition pour le type sélectionné (1,2,3,4)
  let competitionDefinitions: CompetitionDefinition[] = [];
  let definitionsTypeLoaded: CompetitionTypeCode | '' = '';

  let libreVariantNumber: string = ''; // toujours utilisé pour le select des libres

  // 🔹 Libellés à passer à la page /annonces (et au PDF)
  let competitionTypeLabel = '';
  let competitionSubtypeLabel = '';

  function getCompetitionTypeLabel(code: CompetitionTypeCode): string {
    if (!code) return '';
    const typeId = Number(code);
    const found = allCompetitionTypes.find(t => t.id === typeId);
    return found?.name ?? '';
  }

  function getCompetitionTypeShortName(code: CompetitionTypeCode): string {
    if (!code) return '';
    const typeId = Number(code);
    const found = allCompetitionTypes.find(t => t.id === typeId);
    return found?.shortName ?? found?.name ?? '';
  }

  // 🔥 Vérifie si le type de compétition sélectionné est "Manche libre"
  function isMancheLibre(code: CompetitionTypeCode): boolean {
    if (!code) return false;
    const typeId = Number(code);
    const found = allCompetitionTypes.find(t => t.id === typeId);
    return found?.name.toLowerCase().includes('libre') ?? false;
  }

  // Variable réactive pour le template
  $: isCurrentTypeMancheLibre = isMancheLibre(competitionType);

  // 🔁 Dès que le type, le numéro ou les définitions changent → recalcul des libellés
  $: {
  competitionTypeLabel = getCompetitionTypeLabel(competitionType);

  if (
  competitionDefinitions.length > 0 &&
    competitionNumber !== '' &&
    competitionNumber !== null
  ) {
    const num = Number(competitionNumber);
    const def = competitionDefinitions.find((d) => d.competitionNumber === num);
    competitionSubtypeLabel = def?.name ?? '';
  } else {
    competitionSubtypeLabel = '';
  }
}

  // 🔥 joueurs autorisés d'après AllowedPlayers
  let allowedPlayersParsed: number[] = [4, 5, 6];   // valeur par défaut

  // SessionId pour la config
  let sessionId = '';

  // ✅ Guard + chargement des données dans UN SEUL onMount
  onMount(async () => {
  const authorized = localStorage.getItem('authorized') === 'true';
  if (!authorized) {
  goto('/');
  return;
  }

  ready = true;

  // ---- ton ancien onMount commence ici ----
  let stored = localStorage.getItem('whistSessionId');
  if (!stored) {
  stored =
  (crypto as any).randomUUID?.() ??
  `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem('whistSessionId', stored);
  }
  sessionId = stored;

  // 🔥 Charger les types de compétition depuis l'API
  try {
    const resTypes = await fetch(`${API_BASE_URL}/api/config/competition-types/active`);
    if (resTypes.ok) {
      allCompetitionTypes = await resTypes.json();
      console.log('Types de compétition chargés :', allCompetitionTypes);
    } else {
      // Fallback si l'API échoue - utiliser les valeurs par défaut
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
    console.warn('Erreur chargement types de compétition, utilisation du fallback:', err);
    allCompetitionTypes = [
      { id: 1, name: 'Championnat', shortName: 'Ch', description: null, isActive: true, sortOrder: 1 },
      { id: 2, name: 'Interclub', shortName: 'IC', description: null, isActive: true, sortOrder: 2 },
      { id: 3, name: 'Manche libre', shortName: 'ML', description: null, isActive: true, sortOrder: 3 },
      { id: 4, name: 'Concours', shortName: 'CC', description: null, isActive: true, sortOrder: 4 },
      { id: 5, name: 'Endurance', shortName: 'EN', description: null, isActive: true, sortOrder: 5 },
      { id: 6, name: 'Funny Games', shortName: 'FG', description: null, isActive: true, sortOrder: 6 },
      { id: 7, name: 'Edition festive', shortName: 'EF', description: null, isActive: true, sortOrder: 7 }
    ];
  } finally {
    isLoadingCompetitionTypes = false;
  }

  try {
  const res = await fetch(`${API_BASE_URL}/api/joueurs`);
  if (!res.ok) {
  throw new Error('HTTP ' + res.status);
  }
  const data = (await res.json()) as ApiPlayer[];
  availablePlayers = data;
  } catch (err) {
  console.error('Erreur chargement joueurs :', err);
  playersLoadError = 'Impossible de charger la liste des joueurs.';
  } finally {
  isLoadingPlayers = false;
  }

  // ---- après le chargement des joueurs ----

  // Manche libre (3) est toujours disponible (type ID=3)
  const mancheLibreType = allCompetitionTypes.find(t => t.name.toLowerCase().includes('libre'));
  const mancheLibreId = mancheLibreType?.id ?? 3;
  availableCompetitionTypes = [String(mancheLibreId)];

  // Vérifier quels types ont des compétitions aujourd'hui
  const typesToCheck: CompetitionTypeCode[] = allCompetitionTypes
    .filter(t => t.id !== mancheLibreId)
    .map(t => String(t.id));

  for (const t of typesToCheck) {
  const ok = await hasCompetitionsToday(t);
  if (ok) {
  // on recrée un nouveau tableau pour déclencher la réactivité Svelte
  availableCompetitionTypes = [...availableCompetitionTypes, t];
  }
  }

  console.log('Types de compétition disponibles aujourd’hui :', availableCompetitionTypes);
  if (!competitionType && availableCompetitionTypes.length === 1) {
  competitionType = availableCompetitionTypes[0];
}


  });

  // 🔁 adapter players / playerIds quand playerCount change
  $: {
  const count = Number(playerCount ?? 0);

  if (count > 0) {
  players = Array(count)
  .fill('')
  .map((_, i) => players[i] ?? '');

  playerIds = Array(count)
  .fill(null)
  .map((_, i) => playerIds[i] ?? null);
  } else {
  players = [];
  playerIds = [];
  }
  }

  // 🔁 canContinue (ajout de la logique compétition)
  $: {
  const count = Number(playerCount ?? 0);
  const manche = mancheNumber === '' ? 0 : Number(mancheNumber);

  const filledPlayers = players
  .slice(0, count)
  .filter((p) => typeof p === 'string' && p.trim() !== '');

    // On a besoin d’un type de compétition
    const hasType = competitionType !== '';

    // Championnat (1) ou Interclub (2) → numéro obligatoire
    const needNumber =
  competitionType === '1' ||
  competitionType === '2' ||
  competitionType === '4';

    const numberOk = !needNumber
      ? true
      : competitionNumber !== '' && Number(competitionNumber) > 0;

    const competitionOk = hasType && numberOk;

    canContinue =
      competitionOk &&
      tableName.trim() !== '' &&
      manche > 0 &&
      count > 0 &&
      filledPlayers.length === count;
  }

  function updatePlayer(index: number, value: string) {
    players[index] = value;

    for (let i = 0; i < players.length; i++) {
      if (i !== index && players[i] === value) {
        players[i] = '';
        playerIds[i] = null;
      }
    }

    const found = availablePlayers.find((p) => p.alias === value);
    playerIds[index] = found ? found.id : null;

    players = [...players];
    playerIds = [...playerIds];

    console.log('Sélection joueur index', index, {
      alias: value,
      id: playerIds[index]
    });

    // 🔽🔽🔽 partie scroll automatique
    if (value && value.trim() !== '') {
      const count = Number(playerCount ?? 0);
      let nextIndex = -1;

      // chercher le prochain joueur vide
      for (let j = index + 1; j < count; j++) {
        if (!players[j] || players[j].trim() === '') {
          nextIndex = j;
          break;
        }
      }

      setTimeout(() => {
        if (nextIndex >= 0) {
          const nextEl = playerSelectEls[nextIndex];
          if (nextEl) {
            nextEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            nextEl.focus();
          }
        } else if (continueBtn) {
          // si tous les joueurs sont remplis → bouton Continuer
          continueBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
    }
  }

  // 🔁 Options filtrées par slot
  $: perSlotOptions = players.map((_, index) => {
    const used = new Set(
      players
        .map((alias, i) => (i === index ? null : alias))
        .filter((p): p is string => !!p && p.trim() !== '')
        );

        return availablePlayers.filter((p) => !used.has(p.alias));
        });



  function buildNavigateParams(
    compTypeInt: number | null,
    compNumberInt: number | null
  ): URLSearchParams {
    const params = new URLSearchParams({
      tableName,
      mancheNumber: String(mancheNumber),
      playerCount: String(playerCount),
      players: JSON.stringify(players),
      playerIds: JSON.stringify(playerIds)
    });

    if (compTypeInt != null) {
      params.set('competitionType', String(compTypeInt));
    }
    if (compNumberInt != null) {
      params.set('competitionNumber', String(compNumberInt));
    }
  if (competitionTypeLabel) {
    params.set('competitionTypeLabel', competitionTypeLabel);
  }
  if (competitionSubtypeLabel) {
    params.set('competitionSubtypeLabel', competitionSubtypeLabel);
  }
  // Trouver le logo pour la compétition sélectionnée (priorité: compétition > club)
  const def = competitionDefinitions.find(d =>
    d.competitionType === compTypeInt &&
    (compNumberInt === null || d.competitionNumber === compNumberInt)
  );
  if (def?.logoPath) {
    params.set('logoPath', def.logoPath);
  }
    return params;
  }



function handlePlayerChange(index: number, value: string) {
  if (value === '__new__') {
    // ouverture de la modale "Inscription nouveau joueur"
    newPlayerTargetIndex = index;
    showNewPlayerModal = true;
    newPlayerError = null;

    // on enlève temporairement la valeur dans le modèle
    players[index] = '';
    playerIds[index] = null;
    players = [...players];
    playerIds = [...playerIds];
    return;
  }

  // cas normal : on utilise ta logique existante
  updatePlayer(index, value);
}


async function tryCheckExistingForCurrentKey() {
  // 1️⃣ Vérifier qu'on a bien toutes les infos : type, numéro (si nécessaire), manche, table
  const hasType = competitionType !== '';

  const needNumber =
    competitionType === '1' ||
    competitionType === '2' ||
    competitionType === '4';

  const numberOk = !needNumber
    ? true
    : competitionNumber !== '' && competitionNumber !== null;

  const mancheOk = mancheNumber !== '' && Number(mancheNumber) > 0;
  const tableOk = tableName.trim() !== '';

  if (!(hasType && numberOk && mancheOk && tableOk)) {
    // pas encore toutes les infos → on ne fait rien
    return;
  }

  const compTypeInt =
    competitionType === '' ? null : Number(competitionType);

  const compNumberInt =
    competitionNumber === '' || competitionNumber === null
      ? null
      : Number(competitionNumber);

  const query = new URLSearchParams({
    tableName,
    mancheNumber: String(mancheNumber)
  });

  if (compTypeInt != null) {
    query.set('competitionType', String(compTypeInt));
  }
  if (compNumberInt != null) {
    query.set('competitionNumber', String(compNumberInt));
  }

  existingManche = null;
  showResumeModal = false;
  isCheckingExisting = true;

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/manches/active?${query.toString()}`
    );

    if (!res.ok) {
      console.error('HTTP non OK /api/manches/active', res.status);
      return;
    }

    const text = await res.text();

    // 🔹 Réponse vide (ex. 204) → aucune manche existante
    if (!text || !text.trim()) {
      return;
    }

    let data: ActiveMancheDto | null = null;
    try {
      data = JSON.parse(text) as ActiveMancheDto | null;
    } catch (parseErr) {
      console.error(
        'JSON invalide renvoyé par /api/manches/active :',
        text
      );
      return;
    }

    if (data && data.id) {
      existingManche = data;
      showResumeModal = true;
    }
  } catch (err) {
    console.error('Erreur /api/manches/active', err);
  } finally {
    isCheckingExisting = false;
  }
}


// 🔹 Enregistrer la config + aller sur /annonces
// 🔗 Bouton "Continuer" : d'abord vérifier s'il existe déjà une manche active
async function continueToNext() {
  if (!canContinue) return;
  if (!tableName || mancheNumber === '' || !playerCount) return;

  const compTypeInt =
    competitionType === '' ? null : Number(competitionType);

  const compNumberInt =
    competitionNumber === '' || competitionNumber === null
      ? null
      : Number(competitionNumber);

  // 1️⃣ Vérifier s'il existe déjà une manche active pour cette table / manche / compé
  const query = new URLSearchParams({
    tableName,
    mancheNumber: String(mancheNumber)
  });

  if (compTypeInt != null) {
    query.set('competitionType', String(compTypeInt));
  }
  if (compNumberInt != null) {
    query.set('competitionNumber', String(compNumberInt));
  }

  existingManche = null;
  showResumeModal = false;
  isCheckingExisting = true;

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/manches/active?${query.toString()}`
    );

    if (res.ok) {
      const text = await res.text();

      // 🔹 Réponse vide → aucune manche active
      if (text && text.trim()) {
        let data: ActiveMancheDto | null = null;
        try {
          data = JSON.parse(text) as ActiveMancheDto | null;
        } catch (parseErr) {
          console.error(
            'JSON invalide renvoyé par /api/manches/active (continueToNext) :',
            text
          );
        }

        if (data && data.id) {
          existingManche = data;
          showResumeModal = true;
          return; // on attend le choix dans la modale
        }
      }
    } else {
      console.error('HTTP non OK /api/manches/active', res.status);
      // si 404 etc. → on considérera qu'il n'y a pas de manche active
    }
  } catch (err) {
    console.error('Erreur /api/manches/active', err);
    // en cas d’erreur réseau → on continue comme avant (création nouvelle)
  } finally {
    isCheckingExisting = false;
  }

  // 2️⃣ Aucune manche active trouvée → créer une nouvelle
  await createNewManche(compTypeInt, compNumberInt);
}









  async function createNewManche(
    compTypeInt: number | null,
    compNumberInt: number | null
  ) {
    isCreating = true;

    const payload = {
      competitionType: compTypeInt,
      competitionNumber: compNumberInt,

      tableName,
      mancheNumber: Number(mancheNumber),
      playerCount: Number(playerCount),

      Joueur1: players[0],
      Joueur2: players[1],
      Joueur3: players[2],
      Joueur4: players[3],
      Joueur5: players[4] ?? null,
      Joueur6: players[5] ?? null,

      Joueur1Pk: playerIds[0],
      Joueur2Pk: playerIds[1],
      Joueur3Pk: playerIds[2],
      Joueur4Pk: playerIds[3],
      Joueur5Pk: playerIds[4] ?? null,
      Joueur6Pk: playerIds[5] ?? null,

      SessionId: sessionId,
      CreatedByUserAgent:
        typeof navigator !== 'undefined' ? navigator.userAgent : null
    };

    try {
      const res = await fetch(`${API_BASE_URL}/api/table-config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        console.error('Erreur API /api/table-config', await res.text());
        return;
      }

      const data = (await res.json()) as { tableConfigId: number };
      const tableConfigId = data.tableConfigId;
      // On garde l’Id en local, ça pourra servir plus tard
      localStorage.setItem(
        'wb_current_table_config_id',
        String(data.tableConfigId)
      );

      const params = buildNavigateParams(compTypeInt, compNumberInt);
          params.set('tableConfigId', String(tableConfigId));
      goto(`/annonces?${params.toString()}`);
    } catch (err) {
      console.error('Erreur réseau table-config', err);
    } finally {
      isCreating = false;
    }
  }

  async function resumeExistingManche() {
    if (!existingManche) return;

    const compTypeInt =
      competitionType === '' ? null : Number(competitionType);
    const compNumberInt =
      competitionNumber === '' || competitionNumber === null
        ? null
        : Number(competitionNumber);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/manches/${existingManche.id}/resume`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId })
        }
      );

      if (!res.ok) {
        const msg = await res.text();

        console.error('Erreur /api/manches/resume', msg);

        // 🔥 On ferme la modale "reprendre ?" et on affiche une vraie modale d'erreur
        showResumeModal = false;
        existingManche = null;

        errorMessage =
          msg?.trim() ||
          "Impossible de reprendre cette manche. Elle est peut-être déjà encodée sur un autre terminal.";

        showErrorModal = true;
        return;
      }

      // OK → on continue comme avant
      localStorage.setItem(
        'wb_current_table_config_id',
        String(existingManche.id)
      );

      // 🔥 Utiliser les joueurs de la manche existante au lieu des variables du formulaire
      players = existingManche.players || [];
      playerIds = existingManche.playerIds || [];
      playerCount = existingManche.playerCount;

      const params = buildNavigateParams(compTypeInt, compNumberInt);
      goto(`/annonces?${params.toString()}`);
    } catch (err) {
      console.error('Erreur réseau /resume', err);

      showResumeModal = false;
      existingManche = null;
      errorMessage =
        "Une erreur réseau est survenue lors de la reprise de la manche. Merci de réessayer.";
      showErrorModal = true;
    } finally {
      // on s’assure que la modale de reprise est fermée dans tous les cas d’erreur
      showResumeModal = false;
    }
  }

  async function startNewMancheFromModal() {
    const compTypeInt =
      competitionType === '' ? null : Number(competitionType);
    const compNumberInt =
      competitionNumber === '' || competitionNumber === null
        ? null
        : Number(competitionNumber);

    showResumeModal = false;
    existingManche = null;

    await createNewManche(compTypeInt, compNumberInt);
  }






        function scrollToEl(el: HTMLElement | null) {
        if (!el) return;
        setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        }, 50);
        }

function getTodayIsoDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// Vérifie s'il existe au moins une compétition de ce type pour aujourd'hui
async function hasCompetitionsToday(type: CompetitionTypeCode): Promise<boolean> {
  if (!type) return false;

  const today = getTodayIsoDate();

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/config/competitions?competitionType=${type}&eventDate=${today}`
    );
    if (!res.ok) {
      console.error('Erreur HTTP hasCompetitionsToday', type, res.status);
      return false;
    }

    const data = (await res.json()) as any[];
    return Array.isArray(data) && data.length > 0;
  } catch (err) {
    console.error('Erreur réseau hasCompetitionsToday', type, err);
    return false;
  }
}



async function loadDefinitionsForType(type: CompetitionTypeCode) {
  if (!type) return;
  if (definitionsTypeLoaded === type) return; // tu peux garder ou enlever ce cache si tu veux

  try {
    const today = getTodayIsoDate();

    const res = await fetch(
      `${API_BASE_URL}/api/config/competitions?competitionType=${type}&eventDate=${today}`
    );
    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }

    const raw = (await res.json()) as any[];

    competitionDefinitions = raw.map((d) => {
      const rawToday = d.todayMancheNumbers ?? d.TodayMancheNumbers ?? null;

      let todayMancheNumbers: number[] | null = null;
      if (rawToday && typeof rawToday === 'string') {
        todayMancheNumbers = rawToday
          .split(';')
          .map((p: string) => parseInt(p.trim(), 10))
          .filter((n) => !Number.isNaN(n));
      }

      return {
        id: d.id ?? d.Id,
        competitionType: d.competitionType ?? d.CompetitionType,
        competitionNumber: d.competitionNumber ?? d.CompetitionNumber ?? null,
        name: d.name ?? d.Name ?? '',
        allowedPlayers: d.allowedPlayers ?? d.AllowedPlayers ?? null,
        manchesCount: d.manchesCount ?? d.ManchesCount ?? null,
        nbreToursPerManche:
          d.nbreToursPerManche ?? d.NbreToursPerManche ?? null,
        scoringGridCode: d.scoringGridCode ?? d.ScoringGridCode ?? null,
        usesArbitre: d.usesArbitre ?? d.UsesArbitre ?? false,
        isActive: d.isActive ?? d.IsActive ?? true,
        todayMancheNumbers,
        // Infos du club organisateur
        clubId: d.clubId ?? d.ClubId ?? null,
        clubName: d.clubName ?? d.ClubName ?? null,
        clubShortName: d.clubShortName ?? d.ClubShortName ?? null,
        clubColor: d.clubColor ?? d.ClubColor ?? null,
        // Logo (priorité: compétition > club)
        logoPath: d.logoPath ?? d.LogoPath ?? null
      } as CompetitionDefinition;
    });

    definitionsTypeLoaded = type;

    console.log('Defs du jour pour type', type, competitionDefinitions);



    // 🔥 Auto-sélection ici : une seule compétition pour ce type aujourd’hui
    const isNumberType =
      type === '1' || type === '2' || type === '4';

    if (
      isNumberType &&
      competitionType === type &&              // on est toujours sur ce type
      competitionNumber === '' &&             // pas encore choisi
      competitionDefinitions.length === 1
    ) {
      const only = competitionDefinitions[0];

      if (only.competitionNumber != null) {
        competitionNumber = only.competitionNumber;

        setTimeout(() => {
          scrollToEl(mancheEl);
        }, 50);
      }
    }

  } catch (err) {
    console.error('Erreur chargement competitions :', err);
  }
}


let availableMancheNumbers: number[] = [];
let mancheNumberStr = ''; // pour le <select>


// 🔥 Calcul des manches disponibles pour le type sélectionné
$: {
  // reset par défaut
  availableMancheNumbers = [];

  const isListType = competitionType === '1' || competitionType === '2';

  // On ne gère les listes que pour Championnat / Interclub
  if (
    isListType &&
    competitionNumber !== '' &&
    competitionNumber !== null
  ) {
    const num = Number(competitionNumber);
    const def = competitionDefinitions.find(
      (d) => d.competitionNumber === num
    );

    if (def) {
      if (competitionType === '1') {
        // Championnat : on préfère les manches du jour
        if (def.todayMancheNumbers && def.todayMancheNumbers.length > 0) {
          availableMancheNumbers = def.todayMancheNumbers;
        } else if (def.manchesCount && def.manchesCount > 0) {
          availableMancheNumbers = Array.from(
            { length: def.manchesCount },
            (_, i) => i + 1
          );
        }
      } else if (competitionType === '2') {
        // Interclub
        if (def.manchesCount && def.manchesCount > 0) {
          availableMancheNumbers = Array.from(
            { length: def.manchesCount },
            (_, i) => i + 1
          );
        } else {
          availableMancheNumbers = [1];
        }
      }
    }
  }

  // 🔒 On NE reset la manche que pour les types à liste (1/2)
  if (
    isListType &&
    mancheNumber !== '' &&
    !availableMancheNumbers.includes(Number(mancheNumber))
  ) {
    mancheNumber = '';
  }

  console.log('Manches dispo pour', {
    competitionType,
    competitionNumber,
    availableMancheNumbers
  });
}




// 🔁 dès qu’on choisit un type, on charge les définitions correspondantes
// 🔁 dès qu’on change de type, on adapte le reset + le chargement
$: {
  if (competitionType === '') {
    // ↩️ L'utilisateur revient sur "— Choisir —"
    // → on nettoie les champs dépendants, MAIS on ne touche pas
    // aux définitions (competitionDefinitions reste comme avant)

    competitionNumber = '';
    libreVariantNumber = '';
    allowedPlayersParsed = [4, 5, 6];
    playerCount = null;

    players = [];
    playerIds = [];
    availableMancheNumbers = [];
    mancheNumber = '';
  } else {
    // 🟢 Type réel choisi : 1 / 2 / 3 / 4
    competitionNumber = '';
    libreVariantNumber = '';
    allowedPlayersParsed = [4, 5, 6];
    playerCount = null;

    players = [];
    playerIds = [];
    competitionDefinitions = [];
    availableMancheNumbers = [];
    mancheNumber = '';

    void loadDefinitionsForType(competitionType);
  }



  // 🟢 Ici : competitionType = 1,2,3,4 → traitement normal
  competitionNumber = '';
  libreVariantNumber = '';
  allowedPlayersParsed = [4, 5, 6];
  playerCount = null;

  players = [];
  playerIds = [];
  competitionDefinitions = [];
  availableMancheNumbers = [];
  mancheNumber = '';

  void loadDefinitionsForType(competitionType);
}



        // 🔗 quand on est en manche libre, CompetitionNumber = numéro de la variante
        $: if (isCurrentTypeMancheLibre) {
        if (libreVariantNumber === '') {
        competitionNumber = '';
        } else {
        const n = Number(libreVariantNumber);
        competitionNumber = Number.isNaN(n) ? '' : n;
        }
        }

// 🧮 Déterminer quels nombres de joueurs sont autorisés (4/5/6)
$: {
  let allowed: number[] = [4, 5, 6]; // valeur par défaut

  let def: CompetitionDefinition | undefined;

  if (competitionDefinitions.length > 0) {
    if (competitionNumber !== '' && competitionNumber !== null) {
      const num = Number(competitionNumber);
      def = competitionDefinitions.find((d) => d.competitionNumber === num);
    }

    // fallback si pas trouvé ou pas de numéro (ex: manche libre sans choix)
    if (!def) {
      def = competitionDefinitions[0];
    }
  }

  if (def && def.allowedPlayers) {
    allowed = def.allowedPlayers
      .split(';')
      .map((p) => parseInt(p.trim(), 10))
      .filter((n) => !Number.isNaN(n));
  }

  allowedPlayersParsed = allowed;

  const current = Number(playerCount ?? 0);

  // si la valeur actuelle n'est pas autorisée → on la reset
  if (current && !allowedPlayersParsed.includes(current)) {
    playerCount = null;
  }

  // ✅ auto-sélection si une seule valeur possible (ex: [4])
  if (!playerCount && allowedPlayersParsed.length === 1) {
    playerCount = String(allowedPlayersParsed[0]);
  }
}


// synchro entre modèle number ('mancheNumber') et valeur string du <select>
$: if (competitionType === '1' || competitionType === '2') {
  mancheNumberStr = mancheNumber === '' ? '' : String(mancheNumber);
}



// petit helper pour le template (à garder)
const isPlayerCountAllowed = (n: number) =>
  allowedPlayersParsed.includes(n);


// 🔥 Types de compétition disponibles aujourd'hui
let availableCompetitionTypes: CompetitionTypeCode[] = [];

let libreVariantEl: HTMLSelectElement | null = null;



async function saveNewPlayer() {
  newPlayerError = null;

  if (!newPlayer.lastName.trim() || !newPlayer.firstName.trim()) {
    newPlayerError = 'Nom et prénom sont obligatoires.';
    return;
  }

  if (newPlayerTargetIndex === null) {
    // sécurité : on ne sait pas pour quel slot → on ferme juste
    showNewPlayerModal = false;
    return;
  }

  isSearchingExisting = true;

  try {
    // 1️⃣ D'abord, vérifier si un joueur existe déjà avec ce nom/prénom
    const searchRes = await fetch(
      `${API_BASE_URL}/api/joueurs/search?nom=${encodeURIComponent(newPlayer.lastName.trim())}&prenom=${encodeURIComponent(newPlayer.firstName.trim())}`
    );

    if (searchRes.ok) {
      const matches: ExistingPlayerMatch[] = await searchRes.json();
      if (matches.length > 0) {
        // Joueur(s) existant(s) trouvé(s) → proposer de l'utiliser
        existingPlayerMatches = matches;
        showExistingPlayerModal = true;
        isSearchingExisting = false;
        return;
      }
    }

    // 2️⃣ Pas de doublon → créer le joueur externe
    await createExternalPlayer();
  } catch (err: any) {
    console.error(err);
    newPlayerError =
      err?.message ?? 'Erreur inconnue lors de la recherche du joueur.';
  } finally {
    isSearchingExisting = false;
  }
}

// Créer un joueur externe (appelé si pas de doublon ou si l'utilisateur refuse d'utiliser l'existant)
async function createExternalPlayer() {
  isSavingNewPlayer = true;
  newPlayerError = null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/joueurs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPlayer)
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || 'Erreur lors de la création du joueur.');
    }

    const created: ApiPlayer = await res.json();

    // 1️⃣ on ajoute le joueur dans la liste globale
    availablePlayers = [...availablePlayers, created].sort((a, b) =>
      a.alias.localeCompare(b.alias, 'fr')
    );

    // 2️⃣ on l'affecte au slot qui avait demandé "Nouveau"
    if (newPlayerTargetIndex !== null) {
      players[newPlayerTargetIndex] = created.alias;
      playerIds[newPlayerTargetIndex] = created.id;
      players = [...players];
      playerIds = [...playerIds];
    }

    // 3️⃣ reset & close
    newPlayer = { lastName: '', firstName: '', email: '', phone: '' };
    newPlayerTargetIndex = null;
    showNewPlayerModal = false;
    showExistingPlayerModal = false;
  } catch (err: any) {
    console.error(err);
    newPlayerError =
      err?.message ?? 'Erreur inconnue lors de la création du joueur.';
  } finally {
    isSavingNewPlayer = false;
  }
}

// Utiliser un joueur existant (activer Whisteux = 1)
async function useExistingPlayer(player: ExistingPlayerMatch) {
  isSavingNewPlayer = true;
  newPlayerError = null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/joueurs/${player.id}/activate`, {
      method: 'PUT'
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || 'Erreur lors de l\'activation du joueur.');
    }

    const activated: ApiPlayer = await res.json();

    // 1️⃣ Ajouter le joueur dans la liste s'il n'y est pas déjà
    if (!availablePlayers.some((p) => p.id === activated.id)) {
      availablePlayers = [...availablePlayers, activated].sort((a, b) =>
        a.alias.localeCompare(b.alias, 'fr')
      );
    }

    // 2️⃣ Affecter au slot
    if (newPlayerTargetIndex !== null) {
      players[newPlayerTargetIndex] = activated.alias;
      playerIds[newPlayerTargetIndex] = activated.id;
      players = [...players];
      playerIds = [...playerIds];
    }

    // 3️⃣ Reset & close
    newPlayer = { lastName: '', firstName: '', email: '', phone: '' };
    newPlayerTargetIndex = null;
    showNewPlayerModal = false;
    showExistingPlayerModal = false;
    existingPlayerMatches = [];
  } catch (err: any) {
    console.error(err);
    newPlayerError =
      err?.message ?? 'Erreur inconnue lors de l\'activation du joueur.';
  } finally {
    isSavingNewPlayer = false;
  }
}

      </script>

{#if ready}
<main class="page">
  <div class="top-logo">
    <img src="/Logo_App_Rond.png" alt="WB Scoring" />
  </div>

  <section class="card">
    <h2>Configuration de la table</h2>

    <!-- 🔥 Type de compétition -->
    <div class="field">
      <label>Type de compétition :</label>
<select
  bind:this={competitionTypeEl}
  bind:value={competitionType}
  on:change={() => {
    if (isMancheLibre(competitionType)) {
      // Manche libre → 2e box = mode de manche libre
      scrollToEl(libreVariantEl);
    } else if (competitionType !== '') {
      // Championnat / Interclub / Concours → 2e box = (Compétition/Concours du jour)
      scrollToEl(competitionNumberEl);
    }
  }}
>

  <option value="">-- Choisir --</option>

  {#each allCompetitionTypes as typeInfo}
    {#if availableCompetitionTypes.includes(String(typeInfo.id))}
      <option value={String(typeInfo.id)}>{typeInfo.name}</option>
    {/if}
  {/each}
</select>

    </div>
    
    
{#if competitionType && allCompetitionTypes.find(t => t.id === Number(competitionType))?.name.toLowerCase().includes('libre')}
  <div class="field">
    <label>Mode de manche libre :</label>
    <select
      bind:this={libreVariantEl}
      bind:value={libreVariantNumber}
      on:change={() => {
        // après avoir choisi le mode → on passe au numéro de manche
        scrollToEl(mancheEl);
      }}
    >
      <option value="">-- Choisir --</option>
      {#each competitionDefinitions as def}
        <option value={def.competitionNumber ?? ''}>
          {def.name}
        </option>
      {/each}
    </select>
  </div>
{/if}


    
    
    
    

    <!-- 🔥 Numéro de la compétition (obligatoire pour Championnat/Interclub, optionnel pour Concours) -->
  {#if competitionType === '1' || competitionType === '2'}
  <div class="field">
    <label>Compétition du jour :</label>
    <select
      bind:this={competitionNumberEl}
      bind:value={competitionNumber}
      on:change={() => {
        if (competitionNumber !== '') scrollToEl(mancheEl);
      }}
    >
      <option value="">-- Choisir une compétition --</option>
      {#each competitionDefinitions as def}
        <option value={def.competitionNumber ?? ''}>
          {#if def.competitionNumber}
            N° {def.competitionNumber} – {def.name}
          {:else}
            {def.name}
          {/if}
        </option>
      {/each}
    </select>
    {#if competitionDefinitions.length === 0}
      <p class="info">
        Aucune compétition de ce type n'est planifiée pour aujourd'hui.
      </p>
    {/if}
  </div>
{:else if competitionType === '4'}
  <div class="field">
    <label>Concours du jour :</label>
    <select
         bind:this={competitionNumberEl}
         bind:value={competitionNumber}
      on:change={() => {
        if (competitionNumber !== '') scrollToEl(mancheEl);
      }}
    >
      <option value="">-- Choisir un concours --</option>
      {#each competitionDefinitions as def}
        <option value={def.competitionNumber ?? ''}>
          {#if def.competitionNumber}
            N° {def.competitionNumber} – {def.name}
          {:else}
            {def.name}
          {/if}
        </option>
      {/each}
    </select>
    {#if competitionDefinitions.length === 0}
      <p class="info">
        Aucun concours n'est planifié pour aujourd'hui.
      </p>
    {/if}
  </div>
{/if}


  {#if competitionType === '1' || competitionType === '2'}
  <!-- 🔥 Championnat / Interclub : menu déroulant -->
  <div class="field">
    <label>Numéro de la manche :</label>
    <select
      bind:this={mancheEl}
      bind:value={mancheNumberStr}
      on:change={() => {
        // on met à jour le modèle num
        mancheNumber =
          mancheNumberStr === '' ? '' : Number(mancheNumberStr);
        scrollToEl(tableEl);
      }}
    >
      <option value="">-- Choisir --</option>
      {#each availableMancheNumbers as n}
        <option value={String(n)}>Manche {n}</option>
      {/each}
    </select>
  </div>
{:else}
  <!-- Manche libre / Concours : encodage manuel -->
  <div class="field">
    <label>Numéro de la manche :</label>
    <input
      bind:this={mancheEl}
      type="number"
      bind:value={mancheNumber}
      min="1"
      placeholder="Ex : 1"
      on:blur={() => {
        if (mancheNumber !== '') scrollToEl(tableEl);
      }}
    />
  </div>
{/if}


    <div class="field">
      <label>Nom de la table :</label>
           <select 
        bind:this={tableEl}
        bind:value={tableName}
        on:change={() => {
          // dès qu'on a une table, on essaie de voir si une manche existe déjà
          void tryCheckExistingForCurrentKey();

          // on scrollera vers le premier select joueur si présent
          scrollToEl(playerSelectEls[0]);
        }}>


        <option value="">-- Choisir --</option>
        {#each ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as letter}
          <option value={letter}>{letter}</option>
        {/each}
      </select>
    </div>

<div class="radio-group">
  <span class="radio-label">Nombre de joueurs :</span>

  {#each allowedPlayersParsed as n}
    <label>
      <input
        type="radio"
        name="playerCount"
        value={String(n)}
        bind:group={playerCount}
        on:change={() => scrollToEl(playerSelectEls[0])}
      />
      {n} joueurs
    </label>
  {/each}
</div>




    {#if playerCount}
      {#if isLoadingPlayers}
        <p class="info">Chargement de la liste des joueurs...</p>
      {:else if playersLoadError}
        <p class="error">{playersLoadError}</p>
      {:else}
        <div class="players">
          {#each players as player, i}
            <div class="field">
              <label>
      Joueur {i + 1}
      {#if i === 0} / Chef de table{/if} :
    </label>
            <select
  bind:this={playerSelectEls[i]}
  bind:value={players[i]}
  on:change={(e) =>
    handlePlayerChange(i, (e.target as HTMLSelectElement).value)}
>
  <option value="">-- Sélectionner un joueur --</option>

  {#each perSlotOptions[i] ?? [] as p}
    <option value={p.alias}>{p.alias}</option>
  {/each}

  <!-- 🔥 Option spéciale -->
  <option value="__new__">➕ Nouveau joueur…</option>
</select>

            </div>
          {/each}
        </div>
      {/if}
    {/if}

    <!-- Mode d'encodage -->
    <ModeToggle showDescription={true} />

    <div class="button-container">
      <button
        bind:this={continueBtn}
        on:click={continueToNext}
        disabled={!canContinue}
      >
        Continuer
      </button>
    </div>
  </section>
  
  
  
        {#if showResumeModal && existingManche}
      <div class="modal-backdrop">
        <div class="modal">
          <h3>Partie déjà en cours</h3>
          <p>
            Une manche existe déjà pour la table
            <strong>{existingManche.tableName}</strong>,
            manche <strong>{existingManche.mancheNumber}</strong>.
          </p>

          <p>
            Dernière donne encodée :
            <strong>
              {existingManche.lastDonneNumber ?? 'aucune (début de manche)'}
            </strong>
          </p>

          <div class="modal-actions">
            <button on:click={resumeExistingManche}>
              Reprendre l'encodage
            </button>
            <button class="secondary" on:click={startNewMancheFromModal}>
              Commencer une nouvelle manche
            </button>
            <button
              class="ghost"
              on:click={() => {
                showResumeModal = false;
                existingManche = null;
              }}
            >
              Annuler
            </button>
          </div>
        </div>
      </div>
  {/if}
     {#if showErrorModal}
      <div class="modal-backdrop">
        <div class="modal">
          <h3>Impossible de reprendre la manche</h3>
          <p>{errorMessage}</p>

          <div class="modal-actions">
            <button
              on:click={() => {
                showErrorModal = false;
              }}
            >
              OK
            </button>
          </div>
        </div>
      </div>
  {/if}


{#if showNewPlayerModal}
  <div class="modal-backdrop" on:click={() => (showNewPlayerModal = false)}>
     <div class="modal new-player-modal" on:click|stopPropagation>
      <h3>Inscription nouveau joueur</h3>

      {#if newPlayerError}
        <p class="error">{newPlayerError}</p>
      {/if}

      <div class="players new-player-form">
        <div class="field">
          <label>Nom *</label>
          <input
            type="text"
            bind:value={newPlayer.lastName}
            placeholder="Ex : Dupont"
          />
        </div>

        <div class="field">
          <label>Prénom *</label>
          <input
            type="text"
            bind:value={newPlayer.firstName}
            placeholder="Ex : Marie"
          />
        </div>

        <div class="field">
          <label>Email</label>
          <input
            type="email"
            bind:value={newPlayer.email}
            placeholder="Ex : marie.dupont@example.com"
          />
        </div>

        <div class="field">
          <label>Téléphone</label>
          <input
            type="tel"
            bind:value={newPlayer.phone}
            placeholder="Ex : +32 ..."
          />
        </div>
      </div>

      <div class="modal-actions">
        <button
          class="secondary"
          type="button"
          on:click={() => (showNewPlayerModal = false)}
        >
          Annuler
        </button>
        <button
          class="primary"
          type="button"
          on:click={saveNewPlayer}
          disabled={isSavingNewPlayer || isSearchingExisting}
        >
          {#if isSearchingExisting}Recherche...{:else if isSavingNewPlayer}Enregistrement...{:else}Enregistrer{/if}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if showExistingPlayerModal}
  <div class="modal-backdrop" on:click={() => (showExistingPlayerModal = false)}>
    <div class="modal existing-player-modal" on:click|stopPropagation>
      <h3>Joueur existant trouvé</h3>

      <p class="existing-player-info">
        Un ou plusieurs joueurs correspondent à "<strong>{newPlayer.firstName} {newPlayer.lastName}</strong>".
        Voulez-vous utiliser un joueur existant ?
      </p>

      {#if newPlayerError}
        <p class="error">{newPlayerError}</p>
      {/if}

      <div class="existing-players-list">
        {#each existingPlayerMatches as player}
          <div class="existing-player-item">
            <div class="player-info">
              <span class="player-alias">{player.alias}</span>
              <span class="player-name">({player.prenom} {player.nom})</span>
              {#if !player.isWhisteux}
                <span class="player-badge">Non-whisteux</span>
              {/if}
            </div>
            <button
              class="primary use-player-btn"
              type="button"
              on:click={() => useExistingPlayer(player)}
              disabled={isSavingNewPlayer}
            >
              Utiliser
            </button>
          </div>
        {/each}
      </div>

      <div class="modal-actions">
        <button
          class="secondary"
          type="button"
          on:click={() => { showExistingPlayerModal = false; existingPlayerMatches = []; }}
        >
          Annuler
        </button>
        <button
          class="warning"
          type="button"
          on:click={createExternalPlayer}
          disabled={isSavingNewPlayer}
        >
          {#if isSavingNewPlayer}Création...{:else}Créer quand même{/if}
        </button>
      </div>
    </div>
  </div>
{/if}




<footer class="copyright">
  <span
    class="copyright-text"
    on:click={() => showDebugInfo = true}
    role="button"
    tabindex="0"
    on:keydown={(e) => e.key === 'Enter' && (showDebugInfo = true)}
  >
    © 2025 WB-Scoring
  </span>
  — Tous droits réservés —
  <a href="/legal">Mentions légales</a>
</footer>

<DebugModal
  bind:show={showDebugInfo}
  appVersion={APP_VERSION}
  buildTime={BUILD_TIME}
/>

</main>
{/if}

<style>
  .page {
  min-height: 100vh;
  display: flex;
  flex-direction: column; /* important */
  align-items: center;
  justify-content: flex-start;
  padding: 2.5rem 1.5rem 4rem;
  background: radial-gradient(
  circle at 50% 0%,
  #0b3a18 0%,
  #04140a 45%,
  #020506 100%
  );
  }

  .card {
  background: rgba(2, 8, 4, 0.92);
  border-radius: 18px;
  padding: 2.5rem 3rem;
  width: 100%;
  max-width: 540px;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.06);
  color: #f7f7f7;
  font-family: 'Poppins', system-ui, -apple-system, BlinkMacSystemFont,
  'Segoe UI', sans-serif;

  margin-top: 6px;
  padding-top: 6rem;
  }

  h2 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: #f5b942;
  font-size: 1.7rem;
  text-align: center;
  }

  .field {
  display: flex;
  flex-direction: column;
  width: 100%;
  gap: 0.35rem;
  margin-bottom: 0.9rem;
  }

  label {
  font-weight: 500;
  font-size: 0.95rem;
  color: #f2f2f2;
  }

  /* mêmes styles pour tous les champs du formulaire */
  input[type='number'],
  input[type='text'],
  input[type='email'],
  input[type='tel'],
  select {
  padding: 0.6rem 0.8rem;
  font-size: 0.95rem;
  border-radius: 999px;
  border: 1px solid #1b5e20;
  background-color: #07150a;
  color: #f7f7f7;
  outline: none;
  transition:
  border-color 0.15s ease,
  box-shadow 0.15s ease,
  background-color 0.15s ease;
  }

  input[type='number']::placeholder,
  input[type='text']::placeholder,
  input[type='email']::placeholder,
  input[type='tel']::placeholder {
  color: #9ea9a3;
  }

  input[type='number']:focus,
  input[type='text']:focus,
  input[type='email']:focus,
  input[type='tel']:focus,
  select:focus {
  border-color: #f5b942;
  box-shadow: 0 0 0 3px rgba(245, 185, 66, 0.35);
  background-color: #061108;
  }


  .radio-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.8rem 1.5rem;
  margin: 1rem 0 1.2rem;
  font-size: 0.95rem;
  color: #f2f2f2;
  }

  .radio-label {
  font-weight: 500;
  margin-right: 0.5rem;
  }

  .radio-group label {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 400;
  }

  .players {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  margin-top: 0.5rem;
  }

  .info {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: #e0e0e0;
  }

  .error {
  margin-top: 0.5rem;
  font-size: 0.9rem;
  color: #ff6b6b;
  }

  .button-container {
  margin-top: 1.8rem;
  display: flex;
  justify-content: center;
  }

  button {
  padding: 0.85rem 2.4rem;
  background-color: #f5b942;
  color: #0c0c0c;
  font-size: 0.95rem;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.65);
  transition:
  background-color 0.15s ease,
  transform 0.12s ease,
  box-shadow 0.12s ease;
  }

  button:hover:enabled {
  background-color: #ffcf4e;
  transform: translateY(-1px);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.7);
  }

  button:active:enabled {
  background-color: #e9aa1d;
  transform: translateY(1px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.7);
  }

  button:disabled {
  background-color: #5f5f5f;
  box-shadow: none;
  cursor: not-allowed;
  opacity: 0.7;
  }

  @media (max-width: 600px) {
  .card {
  padding: 4.5rem 1.6rem 2rem;
  }

  h2 {
  font-size: 1.4rem;
  }
  }

  .top-logo {
  width: 160px;
  height: 160px;
  margin: 0 auto;
  margin-bottom: -80px;
  z-index: 10;
  display: flex;
  justify-content: center;
  align-items: center;
  }

  .top-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
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

  background: rgba(0, 0, 0, 0.8);
  padding: 4px 10px;
  border-radius: 10px;
  backdrop-filter: blur(4px);
  }




  .modal {
  background: rgba(2, 12, 7, 0.96);
  color: var(--text-main);
  padding: 1.8rem 1.8rem 1.6rem;
  border-radius: 1.2rem;
  max-width: 450px;
  width: 92%;
  text-align: center;

  /* ✨ Halo doré doux, sans bordure */
  border: none;
  box-shadow:
  0 0 18px rgba(245, 197, 107, 0.18),   /* halo large */
  0 0 8px rgba(245, 197, 107, 0.25) inset; /* léger halo intérieur */

  max-height: 85vh;
  overflow-y: auto;
  }

  /* Titre simple et élégant */
  .modal h3 {
  margin: 0 0 1.1rem;
  font-size: 1.15rem;
  font-weight: 600;
  color: #f5c56b;
  }

  /* Texte lisible, équilibré */
  .modal p {
  font-size: 1rem;
  line-height: 1.4;
  margin: 0.4rem 0 1rem;
  }

  /* Boutons centrés */
  .modal-actions {
  margin-top: 1.3rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.8rem;
  }

  /* Boutons dorés plus doux */
  .modal-actions button {
  width: 100%;
  max-width: 260px;
  padding: 0.65rem 1.4rem;
  font-size: 0.9rem;
  font-weight: 700;
  border-radius: 999px;
  cursor: pointer;

  background: linear-gradient(145deg, #f2c46a, #e0a948);
  color: #04140a;
  border: none;

  box-shadow: 0 0 6px rgba(245, 197, 107, 0.35);

  transition: transform 0.12s ease, box-shadow 0.12s ease;
  }

  .modal-actions button:hover {
  transform: translateY(-1px);
  box-shadow: 0 0 10px rgba(245, 197, 107, 0.55);
  }

  /* Bouton Annuler, style clean et léger */
  .modal-actions .ghost {
  background: transparent !important;
  color: #f2c46a;
  border: 1px solid rgba(245, 197, 107, 0.4);
  box-shadow: none;
  }

  .modal-actions .ghost:hover {
  background: rgba(245, 197, 107, 0.08);
  box-shadow: 0 0 6px rgba(245, 197, 107, 0.3);
  }

  .modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(3, 7, 18, 0.65);
  display: flex;
  justify-content: center;
  align-items: center;   /* 👈 centre vertical pile au milieu */
  z-index: 1100;
  }


  /* Modale "Nouveau joueur" un peu plus large et travaillée */
  .modal.new-player-modal {
  max-width: 520px;
  padding: 2.2rem 2.4rem 2rem;
  }

  .modal.new-player-modal h3 {
  font-size: 1.3rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #f5c56b;
  }


  /* Formulaire interne */
  .new-player-form {
  margin-top: 0.8rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  }

  .new-player-form .field {
  margin-bottom: 0; /* on gère l'espacement via gap */
  }

  .new-player-form .field label {
  font-size: 0.9rem;
  font-weight: 500;
  color: #f7f7f7;
  text-align: left;
  }

  /* Juste pour cette modale : inputs un peu plus larges et fluides */
  .new-player-form .field input {
  width: 100%;
  }

  /* Boutons alignés côte à côte dans cette modale */
  .new-player-modal .modal-actions {
  margin-top: 1.6rem;
  flex-direction: row;
  justify-content: center;
  gap: 1rem;
  }

  .new-player-modal .modal-actions button {
  max-width: 190px;
  }

  /* Sur mobile on repasse en colonne pour l'ergonomie */
  @media (max-width: 480px) {
  .new-player-modal .modal-actions {
  flex-direction: column;
  align-items: stretch;
  }

  .new-player-modal .modal-actions button {
  max-width: 100%;
  }
  }

  /* La modale utilise la même police que la carte principale */
  .modal,
  .modal * {
  font-family: 'Poppins', system-ui, -apple-system, BlinkMacSystemFont,
  'Segoe UI', sans-serif;
  }

  /* Modal joueur existant trouvé */
  .modal.existing-player-modal {
    max-width: 520px;
    padding: 2rem 2.4rem;
  }

  .modal.existing-player-modal h3 {
    font-size: 1.3rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #f5c56b;
    margin-bottom: 1rem;
  }

  .existing-player-info {
    color: #e0e0e0;
    font-size: 0.95rem;
    margin-bottom: 1.2rem;
  }

  .existing-players-list {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    margin-bottom: 1.5rem;
  }

  .existing-player-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.8rem 1rem;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 8px;
    border: 1px solid rgba(255, 255, 255, 0.15);
  }

  .existing-player-item .player-info {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .existing-player-item .player-alias {
    font-weight: 600;
    color: #22c55e;
  }

  .existing-player-item .player-name {
    color: #9ca3af;
    font-size: 0.9rem;
  }

  .existing-player-item .player-badge {
    background: #f59e0b;
    color: #1a1a1a;
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
  }

  .existing-player-item .use-player-btn {
    padding: 0.4rem 1rem;
    font-size: 0.85rem;
    min-width: 80px;
  }

  .existing-player-modal .modal-actions {
    margin-top: 1.2rem;
    flex-direction: row;
    justify-content: center;
    gap: 1rem;
  }

  .existing-player-modal .modal-actions button {
    max-width: 180px;
  }

  .existing-player-modal .modal-actions button.warning {
    background: #f59e0b;
    color: #1a1a1a;
  }

  .existing-player-modal .modal-actions button.warning:hover {
    background: #d97706;
  }

  @media (max-width: 480px) {
    .existing-player-item {
      flex-direction: column;
      align-items: stretch;
      gap: 0.6rem;
    }

    .existing-player-item .use-player-btn {
      width: 100%;
    }

    .existing-player-modal .modal-actions {
      flex-direction: column;
      align-items: stretch;
    }

    .existing-player-modal .modal-actions button {
      max-width: 100%;
    }
  }

  /* Footer global */
  .copyright {
  position: fixed;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);

  background: rgba(0, 0, 0, 0.8);
  padding: 4px 12px;
  border-radius: 10px;
  backdrop-filter: blur(4px);

  font-family: 'Poppins', sans-serif;
  font-size: 0.8rem;
  color: #d9d9d9;
  white-space: nowrap;
  z-index: 9999;

  opacity: 0.9;
  }

  /* Tous les liens du footer : doré + propre */
  .copyright a,
  .footer-mail {
  color: #f5b942 !important;  /* doré premium */
  text-decoration: none;
  }

  .copyright a:hover,
  .footer-mail:hover {
  text-decoration: underline;
  }

  /* Couleur visitée toujours dorée aussi */
  .copyright a:visited,
  .footer-mail:visited {
  color: #f5b942 !important;
  }

  /* Copyright cliquable pour debug */
  .copyright-text {
    cursor: pointer;
  }

  /* Adaptation mobile */
  @media (max-width: 480px) {
  .copyright {
  font-size: 0.7rem;
  padding: 3px 8px;
  }
  }

</style>
