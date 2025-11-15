<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';


  const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';


  let tableName = '';
  let mancheNumber: number | '' = '';
  let playerCount: string | null = null; // "4" | "5" | "6"
  let players: string[] = [];

  let availablePlayers: string[] = [];
  let isLoadingPlayers = true;
  let playersLoadError = '';

  let canContinue = false;

  onMount(async () => {
  try {
  const res = await fetch("${API_BASE_URL}/api/joueurs");

  if (!res.ok) {
  throw new Error('HTTP ' + res.status);
  }
  availablePlayers = await res.json();
  } catch (err) {
  console.error('Erreur chargement joueurs :', err);
  playersLoadError = 'Impossible de charger la liste des joueurs.';
  } finally {
  isLoadingPlayers = false;
  }
  });

  // Adapter la taille du tableau players quand le nombre de joueurs change
  $: {
  const count = Number(playerCount ?? 0);
  if (count > 0) {
  players = Array(count)
  .fill('')
  .map((_, i) => players[i] ?? '');
  } else {
  players = [];
  }
  }

  // Calcul de canContinue
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
  players = [...players]; // force la réactivité
  }

  function continueToNext() {
  if (!canContinue) return;

  const params = new URLSearchParams({
  tableName,
  mancheNumber: String(mancheNumber),
  playerCount: String(playerCount),
  players: JSON.stringify(players)
  });

  goto(`/annonces?${params.toString()}`);
  }
</script>

<main class="page">
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
          {#each availablePlayers as name}
          <option value={name}>{name}</option>
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

<style>
  .page {
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 3rem 1.5rem 4rem;
  /* même esprit que la page d’accueil */
  background: radial-gradient(circle at top, #125c2a 0%, #04140a 40%, #020506 100%);
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
  font-family: 'Poppins', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
  sans-serif;
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
  transition: border-color 0.15s ease, box-shadow 0.15s ease,
  background-color 0.15s ease;
  }

  input[type='number']::placeholder {
  color: #9ea9a3;
  }

  input[type='number']:focus,
  select:focus {
  border-color: #c62828;
  box-shadow: 0 0 0 3px rgba(198, 40, 40, 0.25);
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
  background-color: #c62828;
  color: #ffffff;
  font-size: 0.95rem;
  border: none;
  border-radius: 999px;
  cursor: pointer;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.65);
  transition: background-color 0.15s ease, transform 0.12s ease,
  box-shadow 0.12s ease;
  }

  button:hover:enabled {
  background-color: #e53935;
  transform: translateY(-1px);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.7);
  }

  button:active:enabled {
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
  padding: 2rem 1.6rem;
  }

  h2 {
  font-size: 1.4rem;
  }
  }
</style>
