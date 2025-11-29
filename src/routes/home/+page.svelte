<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';

  type ApiPlayer = {
  id: number;
  alias: string;
  };

  // 🔢 Type côté front = string "1" | "2" | "3" | "4" (on convertit en number pour l'API)
  type CompetitionTypeCode = '' | '1' | '2' | '3' | '4';

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
  let competitionNumberEl: HTMLInputElement | null = null;
  let mancheEl: HTMLInputElement | null = null;
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
  }

// 🔥 définitions de compétition pour le type sélectionné (1,2,3,4)
let competitionDefinitions: CompetitionDefinition[] = [];
let definitionsTypeLoaded: CompetitionTypeCode | '' = '';

let libreVariantNumber: string = ''; // toujours utilisé pour le select des libres


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
    const needNumber = competitionType === '1' || competitionType === '2';
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

        // 🔹 Enregistrer la config + aller sur /annonces
async function continueToNext() {
  if (!canContinue) return;

  const params = new URLSearchParams({
    tableName,
    mancheNumber: String(mancheNumber),
    playerCount: String(playerCount),
    players: JSON.stringify(players),
    playerIds: JSON.stringify(playerIds)
    // on pourra ajouter competitionType/Number dans l'URL plus tard si besoin
  });

  // 🔢 conversions propres
  const compTypeInt =
    competitionType === '' ? null : Number(competitionType);

  const compNumberInt =
    competitionNumber === '' || competitionNumber === null
      ? null
      : Number(competitionNumber);

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
    }
  } catch (err) {
    console.error('Erreur réseau table-config', err);
  }

// après avoir construit tableName, mancheNumber, playerCount, players, etc.
params.set('competitionType', compTypeInt != null ? String(compTypeInt) : '');
params.set('competitionNumber', compNumberInt != null ? String(compNumberInt) : '');

  goto(`/annonces?${params.toString()}`);
}




        function scrollToEl(el: HTMLElement | null) {
        if (!el) return;
        setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        }, 50);
        }


async function loadDefinitionsForType(type: CompetitionTypeCode) {
  if (!type) return;
  if (definitionsTypeLoaded === type) return; // déjà chargé pour ce type

  try {
    const res = await fetch(
      `${API_BASE_URL}/api/config/competitions?competitionType=${type}`
    );
    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }

    const raw = (await res.json()) as any[];

    // 🔥 Normalisation PascalCase -> camelCase
    competitionDefinitions = raw.map((d) => ({
      id: d.id ?? d.Id,
      competitionType: d.competitionType ?? d.CompetitionType,
      competitionNumber:
        d.competitionNumber ?? d.CompetitionNumber ?? null,
      name: d.name ?? d.Name ?? '',
      allowedPlayers: d.allowedPlayers ?? d.AllowedPlayers ?? null,
      manchesCount: d.manchesCount ?? d.ManchesCount ?? null,
      nbreToursPerManche:
        d.nbreToursPerManche ?? d.NbreToursPerManche ?? null,
      scoringGridCode: d.scoringGridCode ?? d.ScoringGridCode ?? null,
      usesArbitre: d.usesArbitre ?? d.UsesArbitre ?? false,
      isActive: d.isActive ?? d.IsActive ?? true
    }));

    definitionsTypeLoaded = type;

    console.log('Defs normalisées pour type', type, competitionDefinitions);
  } catch (err) {
    console.error('Erreur chargement competitions :', err);
  }
}


// 🔁 dès qu’on choisit un type, on charge les définitions correspondantes
$: if (competitionType !== '') {
  void loadDefinitionsForType(competitionType);
}


        // 🔗 quand on est en manche libre, CompetitionNumber = numéro de la variante
        $: if (competitionType === '3') {
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


// petit helper pour le template (à garder)
const isPlayerCountAllowed = (n: number) =>
  allowedPlayersParsed.includes(n);



$: console.log(
  'TYPE=', competitionType,
  'NUM=', competitionNumber,
  'allowedPlayersParsed =', allowedPlayersParsed
);


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
      <select bind:this={competitionTypeEl} bind:value={competitionType}
  on:change={() => {
    // s’il faut un numéro → scroll vers ce champ
    if (competitionType === '1' || competitionType === '2') {
      scrollToEl(competitionNumberEl);
    } else {
      scrollToEl(mancheEl);
    }
  }}>

        <option value="">-- Choisir --</option>
        <option value="1">Championnat</option>
        <option value="2">Interclub</option>
        <option value="3">Manche libre</option>
        <option value="4">Concours</option>
      </select>
    </div>
    
    
    {#if competitionType === '3'}
  <div class="field">
    <label>Mode de manche libre :</label>
    <select
      bind:value={libreVariantNumber}
      on:change={() => {
        // on peut éventuellement scroller vers le numéro de manche
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
        <label>Numéro de la compétition :</label>
       <input
  bind:this={competitionNumberEl}
  type="number"
  min="1"
  bind:value={competitionNumber}
  placeholder="Ex : 28"
  on:blur={() => {
    if (competitionNumber !== '') scrollToEl(mancheEl);
  }}
/>

      </div>
    {:else if competitionType === '4'}
      <div class="field">
        <label>Numéro / édition du concours (optionnel) :</label>
        <input
          type="number"
          min="1"
          bind:value={competitionNumber}
          placeholder="Ex : 1"
        />
      </div>
    {/if}

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

    <div class="field">
      <label>Nom de la table :</label>
      <select 
  bind:this={tableEl}
  bind:value={tableName}
  on:change={() =>
        {
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
              <label>Joueur {i + 1} :</label>
              <select
                bind:this={playerSelectEls[i]}
                value={player}
                on:change={(e) =>
                  updatePlayer(i, (e.target as HTMLSelectElement).value)}
              >
                <option value="">-- Sélectionner un joueur --</option>
                {#each perSlotOptions[i] ?? [] as p}
                  <option value={p.alias}>{p.alias}</option>
                {/each}
              </select>
            </div>
          {/each}
        </div>
      {/if}
    {/if}

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
  <footer class="copyright">
    © 2025 Wb-Scoring — Tous droits réservés
  </footer>
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

  input[type='number'],
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

  input[type='number']::placeholder {
  color: #9ea9a3;
  }

  input[type='number']:focus,
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


  @media (max-width: 480px) {
  .copyright {
  font-size: 0.7rem;
  padding: 3px 8px;
  }
  }




</style>
