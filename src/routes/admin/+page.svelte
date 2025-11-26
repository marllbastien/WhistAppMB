<script lang="ts">
  import { onMount } from 'svelte';

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';

  // --- Sécurité "light" : petit PIN admin stocké en localStorage ---
  const ADMIN_PIN = '060784'; // TU PEUX LE CHANGER ICI

  let isAdmin = false;
  let pinInput = '';
  let authError = '';

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
  let manches: AdminMancheHeaderDto[] = [];
  let isLoading = false;
  let loadError = '';

  onMount(() => {
    const flag = localStorage.getItem('whist_admin_ok');
    if (flag === 'true') {
      isAdmin = true;
      loadManches();
    }
  });

  async function validatePin() {
    if (pinInput === ADMIN_PIN) {
      isAdmin = true;
      authError = '';
      localStorage.setItem('whist_admin_ok', 'true');
      await loadManches();
    } else {
      authError = 'Code incorrect';
    }
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
    return d.toLocaleString('fr-BE');
  }

  function gotoManche(id: number) {
    window.location.href = `/admin/${id}`;
  }
</script>

<svelte:head>
  <title>Administration – Manches</title>
</svelte:head>

<div class="admin-page">
  <h1>Administration <span class="sep">⟶</span> Gestion des manches</h1>


  {#if !isAdmin}
    <div class="admin-card">
      <h2>Accès réservé</h2>
      <p>Entrez votre code administrateur pour accéder à la gestion.</p>
      <div class="pin-row">
        <input
          type="password"
          bind:value={pinInput}
          placeholder="Code admin"
          on:keydown={(e) => e.key === 'Enter' && validatePin()}
        />
        <button on:click={validatePin}>Valider</button>
      </div>
      {#if authError}
        <p class="error">{authError}</p>
      {/if}
    </div>
  {:else}
    <div class="admin-card">
      <h2>Liste des manches</h2>

      {#if isLoading}
        <p>Chargement…</p>
      {:else if loadError}
        <p class="error">{loadError}</p>
      {:else if manches.length === 0}
        <p>Aucune manche trouvée.</p>
      {:else}
        <table class="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Table</th>
              <th>Manche</th>
              <th>Joueurs</th>
              <th>Donnes</th>
              <th>Début</th>
              <th>Fin</th>
              <th>Statut</th>
            </tr>
          </thead>
          <tbody>
            {#each manches as m}
              <tr class="clickable" on:click={() => gotoManche(m.tableConfigId)}>
                <td>{m.tableConfigId}</td>
                <td>{m.tableName}</td>
                <td>{m.mancheNumber}</td>
                <td>{m.playerCount}</td>
                <td>{m.donnesCount}</td>
                <td>{formatDate(m.startTime)}</td>
                <td>{formatDate(m.endTime)}</td>
                <td>{m.isCompleted ? 'Terminée' : 'En cours'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
    </div>
  {/if}
</div>

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

  .admin-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
    font-size: 0.9rem;
  }

  .admin-table th,
  .admin-table td {
    border: 1px solid rgba(51, 65, 85, 0.9);
    padding: 0.35rem 0.6rem;
    text-align: center;
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
</style>
