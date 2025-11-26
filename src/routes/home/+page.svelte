<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';

  type ApiPlayer = {
  id: number;
  alias: string;
  };

  let ready = false;

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

  // 🔁 canContinue
  $: {
  const count = Number(playerCount ?? 0);
  const manche = mancheNumber === '' ? 0 : Number(mancheNumber);

  const filledPlayers = players
  .slice(0, count)
  .filter((p) => typeof p === 'string' && p.trim() !== '');

  canContinue =
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
  });

  const payload = {
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

  goto(`/annonces?${params.toString()}`);
  }
</script>

{#if ready}
<main class="page">
<div class="top-logo">
  <img src="/Logo_App_Rond.png" alt="WB Scoring" />
</div>

  <section class="card">
    <h2>Configuration de la table</h2>

    <div class="field">
      <label>Nom de la table :</label>
      <select bind:value={tableName}>
        <option value="">-- Choisir --</option>
        {#each ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as letter}
        <option value={letter}>{letter}</option>
        {/each}
      </select>
    </div>

    <div class="field">
      <label>Numéro de la manche :</label>
      <input
        type="number"
        bind:value={mancheNumber}
        min="1"
        placeholder="Ex : 1"
      />
    </div>

    <div class="radio-group">
      <span class="radio-label">Nombre de joueurs :</span>

      <label>
        <input type="radio" name="playerCount" value="4" bind:group={playerCount} />
        4 joueurs
      </label>

      <label>
        <input type="radio" name="playerCount" value="5" bind:group={playerCount} />
        5 joueurs
      </label>

      <label>
        <input type="radio" name="playerCount" value="6" bind:group={playerCount} />
        6 joueurs
      </label>
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
          value={player}
          on:change={(e) =>
          updatePlayer(i, (e.target as HTMLSelectElement).value)
          }
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
      <button on:click={continueToNext} disabled={!canContinue}>
        Continuer
      </button>
    </div>
  </section>
</main>
{/if}


<style>
  .page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;        /* important */
  align-items: center;
  justify-content: flex-start;
  padding: 2.5rem 1.5rem 4rem;
  background: radial-gradient(
  circle at 50% 0%,
  #0b3a18 0%,   /* vert foncé en haut */
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

  margin-top: 6px; /* ⭐ ajouter cette ligne */
  padding-top: 6rem; /* 🟢 Ajoute un gros espace noir au-dessus du titre */
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
  border-color: #f5b942; /* 🟡 Jaune = accent positif */
  box-shadow: 0 0 0 3px rgba(245, 185, 66, 0.35); /* halo jaune doux */
  background-color: #061108; /* même fond qu'avant */
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
  background-color: #f5b942; /* 🟡 JAUNE comme le titre */
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

  /* 🟡 Hover jaune un peu plus clair */
  button:hover:enabled {
  background-color: #ffcf4e;
  transform: translateY(-1px);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.7);
  }

  /* 🟡 Pressé : plus foncé */
  button:active:enabled {
  background-color: #e9aa1d;
  transform: translateY(1px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.7);
  }

  /* Désactivé : gris comme avant */
  button:disabled {
  background-color: #5f5f5f;
  box-shadow: none;
  cursor: not-allowed;
  opacity: 0.7;
  }

  @media (max-width: 600px) {
  .card {
  padding: 2rem 1.6rem;
  }

  h2 {
  font-size: 1.4rem;
  }
  }




  .top-logo {
  width: 160px;
  height: 160px;
  margin: 0 auto;
  margin-bottom: -80px;         /* chevauche la carte */
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



</style>


  