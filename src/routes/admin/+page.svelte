<script lang="ts">
  import { onMount } from 'svelte';

  const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';

  // --- Sécurité "light" : petit PIN admin stocké en localStorage ---
  const ADMIN_PIN = '060784'; // TU PEUX LE CHANGER ICI

  let isAdmin = false;
  let pinInput = '';
  let authError = '';
  const currentYear = new Date().getFullYear();

  // Mode d'affichage : 'menu' ou 'manches'
  let viewMode: 'menu' | 'manches' = 'menu';

  // Éléments du menu admin
  const adminMenuItems = [
    {
      id: 'manches',
      title: 'Gestion des manches',
      description: 'Consulter, modifier et supprimer les manches de jeu',
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
      id: 'archives',
      title: 'Archives PDF',
      description: 'Consulter les feuilles de points archivées',
      icon: '📄',
      href: '/admin/archives'
    }
  ];
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
  statut: ''
  };

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

    // Manche
    if (
      filters.mancheNumber &&
      !String(m.mancheNumber).includes(filters.mancheNumber.trim())
    ) {
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

    // Début (valeur brute de l’API)
    if (
      filters.startTime &&
      !(m.startTime ?? '')
        .toLowerCase()
        .includes(filters.startTime.toLowerCase())
    ) {
      return false;
    }

    // Fin
    if (
      filters.endTime &&
      !(m.endTime ?? '')
        .toLowerCase()
        .includes(filters.endTime.toLowerCase())
    ) {
      return false;
    }

    // Statut
    if (filters.statut) {
      const statut = m.isCompleted ? 'terminée' : 'en cours';
      if (statut !== filters.statut) return false;
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




  onMount(() => {
    const flag = localStorage.getItem('whist_admin_ok');
    if (flag === 'true') {
      isAdmin = true;
      // On ne charge plus les manches automatiquement, on reste sur le menu
    }
  });

  async function validatePin() {
    if (pinInput === ADMIN_PIN) {
      isAdmin = true;
      authError = '';
      localStorage.setItem('whist_admin_ok', 'true');
      // On reste sur le menu après validation
    } else {
      authError = 'Code incorrect';
    }
  }

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
    return d.toLocaleString('fr-BE');
  }

  function gotoManche(id: number) {
    window.location.href = `/admin/${id}`;
  }
  
        
        const COMP_TYPE_LABEL: Record<number, string> = {
  1: 'Championnat',
  2: 'Interclub',
  3: 'Manche libre',
  4: 'Concours'
};

const COMP_TYPE_LABEL_SHORT: Record<number, string> = {
  1: 'Ch',  // Championnat
  2: 'IC',  // Interclub
  3: 'ML',  // Manche libre
  4: 'CC'   // Concours
};

function formatCompetitionType(m: AdminMancheHeaderDto): string {
  if (m.competitionType == null) return '-';
  return COMP_TYPE_LABEL_SHORT[m.competitionType] ?? `T${m.competitionType}`;
}


function formatCompetitionName(m: AdminMancheHeaderDto): string {
  const t = m.competitionType;
  const num = m.competitionNumber;
  const name = m.competitionName;

  if (!t) return "-";

  switch (t) {
    case 1:
      // Championnat
      return num ? `Championnat ${num}` : "Championnat";

    case 2:
      // Interclub
      return num ? `Interclub ${num}` : "Interclub";

    case 3:
      // Manche libre → on affiche directement le nom
      return name ?? "Manche libre";

    case 4:
      // Concours
      return num ? `Concours ${num}` : "Concours";

    default:
      return "-";
  }
}


        
</script>

<svelte:head>
  <title>Administration</title>
</svelte:head>

<div class="admin-page">
  {#if viewMode === 'menu'}
    <h1>Administration</h1>
  {:else}
    <h1>
      <button class="back-link" on:click={goToMenu}>← Administration</button>
      <span class="sep">⟶</span> Gestion des manches
    </h1>
  {/if}


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
  {:else if viewMode === 'menu'}
    <!-- Menu principal admin -->
    <div class="admin-menu-grid">
      {#each adminMenuItems as item}
        {#if item.href}
          <a href={item.href} class="admin-menu-card">
            <span class="menu-icon">{item.icon}</span>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </a>
        {:else}
          <button class="admin-menu-card" on:click={() => { item.action?.(); loadManches(); }}>
            <span class="menu-icon gold">{item.icon}</span>
            <h2>{item.title}</h2>
            <p>{item.description}</p>
          </button>
        {/if}
      {/each}
    </div>
  {:else}
    <!-- Vue Gestion des manches -->
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
  <colgroup>
    <col class="col-id" />
    <col class="col-type" />
    <col class="col-compnum" />

    <col class="col-table" />
    <col class="col-manche" />
    <col class="col-joueurs" />
    <col class="col-donnes" />
    <col class="col-debut" />
    <col class="col-fin" />
    <col class="col-statut" />
  </colgroup>

               <thead>
                 <!-- Ligne 1 : en-têtes "généraux" -->
                 <tr>
                   <th on:click={() =>
                     toggleSort('tableConfigId')}>
                     ID {#if sortKey === 'tableConfigId'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>

                   <th  on:click={() =>
                     toggleSort('competitionType')}>
                     Type {#if sortKey === 'competitionType'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>
                   <th  on:click={() =>
                     toggleSort('competitionNumber')}>
                     N° comp. {#if sortKey === 'competitionNumber'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>

                   <th  on:click={() =>
                     toggleSort('tableName')}>
                     Table {#if sortKey === 'tableName'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>
                   <th  on:click={() =>
                     toggleSort('mancheNumber')}>
                     Manche {#if sortKey === 'mancheNumber'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>
                   <th  on:click={() =>
                     toggleSort('playerCount')}>
                     Joueurs {#if sortKey === 'playerCount'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>
                   <th  on:click={() =>
                     toggleSort('donnesCount')}>
                     Donnes {#if sortKey === 'donnesCount'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>
                   <th  on:click={() =>
                     toggleSort('startTime')}>
                     Début {#if sortKey === 'startTime'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>
                   <th  on:click={() =>
                     toggleSort('endTime')}>
                     Fin {#if sortKey === 'endTime'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>
                   <th  on:click={() =>
                     toggleSort('isCompleted')}>
                     Statut {#if sortKey === 'isCompleted'}{sortDirection === 'asc' ? '▲' : '▼'}{/if}
                   </th>
                 </tr>

                 <!-- Ligne 3 : filtres -->
                 <tr class="filter-row">
                   <th>
                     <input
                       class="filter-input"
                       type="text"
                       placeholder="Filtrer..."
                       bind:value={filters.id}
                       on:click|stopPropagation
      />
                   </th>
                   <th>
                     <select
                       class="filter-input"
                       bind:value={filters.competitionType}
                       on:click|stopPropagation
      >
                       <option value="">Tous</option>
                       <option value="1">Championnat</option>
                       <option value="2">Interclub</option>
                       <option value="3">Manche libre</option>
                       <option value="4">Concours</option>
                     </select>
                   </th>
                   <th>
                     <input
                       class="filter-input"
                       type="text"
                       placeholder="N°..."
                       bind:value={filters.competitionNumber}
                       on:click|stopPropagation
      />
                   </th>
          
                   <th>
                     <input
                       class="filter-input"
                       type="text"
                       placeholder="Filtrer..."
                       bind:value={filters.tableName}
                       on:click|stopPropagation
      />
                   </th>
                   <th>
                     <input
                       class="filter-input"
                       type="text"
                       placeholder="Filtrer..."
                       bind:value={filters.mancheNumber}
                       on:click|stopPropagation
      />
                   </th>
                   <th>
                     <input
                       class="filter-input"
                       type="text"
                       placeholder="Filtrer..."
                       bind:value={filters.playerCount}
                       on:click|stopPropagation
      />
                   </th>
                   <th>
                     <input
                       class="filter-input"
                       type="text"
                       placeholder="Filtrer..."
                       bind:value={filters.donnesCount}
                       on:click|stopPropagation
      />
                   </th>
                   <th>
                     <input
                       class="filter-input"
                       type="text"
                       placeholder="Filtrer..."
                       bind:value={filters.startTime}
                       on:click|stopPropagation
      />
                   </th>
                   <th>
                     <input
                       class="filter-input"
                       type="text"
                       placeholder="Filtrer..."
                       bind:value={filters.endTime}
                       on:click|stopPropagation
      />
                   </th>
                   <th>
                     <select
                       class="filter-input"
                       bind:value={filters.statut}
                       on:click|stopPropagation
      >
                       <option value="">Tous</option>
                       <option value="en cours">En cours</option>
                       <option value="terminée">Terminée</option>
                     </select>
                   </th>
                 </tr>
               </thead>




               <tbody>
    {#each filteredSortedManches as m}
      <tr class="clickable" on:click={() => gotoManche(m.tableConfigId)}>
        <td>{m.tableConfigId}</td>
        <td>{formatCompetitionType(m)}</td>
        <td>{m.competitionNumber ?? '-'}</td>
   
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

  .admin-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
  font-size: 0.9rem;
  table-layout: fixed; /* on garde, c'est bien */
  }

  /* Largeurs des colonnes – total ≈ 100% */

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



  .filter-row th {
  background: #020617;
  border-bottom: 1px solid rgba(51, 65, 85, 0.9);
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

  /* Centrer le contenu des selects aussi */
  .filter-input option {
  text-align: center;
  }



</style>
