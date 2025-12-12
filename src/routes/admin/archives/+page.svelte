<script lang="ts">
  import { onMount } from 'svelte';

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';

  const currentYear = new Date().getFullYear();

  interface ArchiveFile {
    name: string;
    fileName: string;
    size: number;
    lastModified: string;
    url: string;
    // Métadonnées
    competitionType: string | null;
    competitionNumber: number | null;
    playerCount: number | null;
    manche: number | null;
    table: number | null;
    // Nouvelles métadonnées
    tableConfigId: number | null;
    tableName: string | null;
    players: string | null;
  }

  interface CompetitionDefinition {
    id: number;
    competitionType: number;
    competitionNumber: number | null;
    name: string;
    allowedPlayers: string | null;
  }

  interface CompetitionType {
    id: number;
    name: string;
    shortName: string | null;
    description: string | null;
    isActive: boolean;
    sortOrder: number;
  }

  let archives: ArchiveFile[] = [];
  let isLoading = false;
  let loadError = '';

  // Filtres par date
  let filterYear = String(currentYear);
  let filterMonth = '';

  // Filtres par métadonnées
  let filterCompetitionType = '';
  let filterCompetitionNumber = '';
  let filterPlayerCount = '';
  let filterManche = '';
  let filterTable = '';
  let filterTableConfigId = '';

  // Données dynamiques pour les filtres
  let competitionDefinitions: CompetitionDefinition[] = [];
  let availableCompetitionNumbers: { value: string; label: string }[] = [];
  let availablePlayerCounts: number[] = [4, 5];

  // Années disponibles (10 dernières années)
  const availableYears = Array.from({ length: 10 }, (_, i) => String(currentYear - i));
  const months = [
    { value: '', label: 'Tous les mois' },
    { value: '01', label: 'Janvier' },
    { value: '02', label: 'Février' },
    { value: '03', label: 'Mars' },
    { value: '04', label: 'Avril' },
    { value: '05', label: 'Mai' },
    { value: '06', label: 'Juin' },
    { value: '07', label: 'Juillet' },
    { value: '08', label: 'Août' },
    { value: '09', label: 'Septembre' },
    { value: '10', label: 'Octobre' },
    { value: '11', label: 'Novembre' },
    { value: '12', label: 'Décembre' }
  ];

  // Types de compétition (chargés dynamiquement depuis l'API)
  let competitionTypes: { value: string; label: string; code: number }[] = [];

  // Recherche par nom
  let searchQuery = '';

  // Charger les types de compétition depuis l'API
  async function loadCompetitionTypes() {
    try {
      const res = await fetch(`${API_BASE_URL}/api/config/competition-types/active`);
      if (!res.ok) {
        console.error('Erreur chargement types de compétition', res.status);
        return;
      }

      const data: CompetitionType[] = await res.json();

      // Transformer en format pour le select (avec option "Tous" en premier)
      competitionTypes = [
        { value: '', label: 'Tous les types', code: 0 },
        ...data.map((t) => ({
          value: t.name,
          label: t.name,
          code: t.id
        }))
      ];
    } catch (err) {
      console.error('Erreur réseau loadCompetitionTypes', err);
      // Fallback sur les types par défaut si l'API échoue
      competitionTypes = [
        { value: '', label: 'Tous les types', code: 0 },
        { value: 'Championnat', label: 'Championnat', code: 1 },
        { value: 'Interclubs', label: 'Interclubs', code: 2 },
        { value: 'Manche libre', label: 'Manche libre', code: 3 },
        { value: 'Concours', label: 'Concours', code: 4 }
      ];
    }
  }

  // Charger les définitions de compétition pour le type sélectionné
  async function loadCompetitionDefinitions(typeCode: number | null) {
    if (!typeCode) {
      competitionDefinitions = [];
      availableCompetitionNumbers = [];
      return;
    }

    try {
      // includeAll=true pour avoir TOUTES les compétitions (pas seulement celles d'aujourd'hui)
      const res = await fetch(
        `${API_BASE_URL}/api/config/competitions?competitionType=${typeCode}&includeAll=true`
      );
      if (!res.ok) {
        console.error('Erreur chargement competitions', res.status);
        return;
      }

      const data = await res.json();
      competitionDefinitions = data.map((d: any) => ({
        id: d.id ?? d.Id,
        competitionType: d.competitionType ?? d.CompetitionType,
        competitionNumber: d.competitionNumber ?? d.CompetitionNumber ?? null,
        name: d.name ?? d.Name ?? '',
        allowedPlayers: d.allowedPlayers ?? d.AllowedPlayers ?? null
      }));

      // Construire la liste des numéros de compétition disponibles
      availableCompetitionNumbers = competitionDefinitions
        .filter((d) => d.competitionNumber != null)
        .map((d) => ({
          value: String(d.competitionNumber),
          label: `N° ${d.competitionNumber} – ${d.name}`
        }));

      // Extraire les nombres de joueurs autorisés
      const playerSet = new Set<number>();
      for (const def of competitionDefinitions) {
        if (def.allowedPlayers) {
          const nums = def.allowedPlayers
            .split(';')
            .map((p) => parseInt(p.trim(), 10))
            .filter((n) => !Number.isNaN(n));
          nums.forEach((n) => playerSet.add(n));
        }
      }
      if (playerSet.size > 0) {
        availablePlayerCounts = Array.from(playerSet).sort((a, b) => a - b);
      } else {
        availablePlayerCounts = [4, 5];
      }

    } catch (err) {
      console.error('Erreur réseau loadCompetitionDefinitions', err);
    }
  }

  // Réagir au changement de type de compétition
  $: {
    const selectedType = competitionTypes.find((t) => t.value === filterCompetitionType);
    const code = (selectedType as any)?.code ?? null;
    loadCompetitionDefinitions(code);
    // Reset le numéro de compétition quand le type change
    if (filterCompetitionType === '') {
      filterCompetitionNumber = '';
    }
  }

  // Grouper par jour
  $: groupedArchives = groupByDay(
    archives.filter((a) => {
      if (!searchQuery) return true;
      return a.fileName.toLowerCase().includes(searchQuery.toLowerCase());
    })
  );

  function groupByDay(files: ArchiveFile[]): Record<string, ArchiveFile[]> {
    const groups: Record<string, ArchiveFile[]> = {};

    for (const file of files) {
      // Extraire la date du path (format: yyyy/MM/dd/...)
      const parts = file.name.split('/');
      if (parts.length >= 3) {
        const day = `${parts[0]}/${parts[1]}/${parts[2]}`;
        if (!groups[day]) groups[day] = [];
        groups[day].push(file);
      } else {
        if (!groups['Autres']) groups['Autres'] = [];
        groups['Autres'].push(file);
      }
    }

    // Trier les groupes par date décroissante
    const sortedKeys = Object.keys(groups).sort((a, b) => b.localeCompare(a));
    const sorted: Record<string, ArchiveFile[]> = {};
    for (const key of sortedKeys) {
      sorted[key] = groups[key];
    }

    return sorted;
  }

  function formatDate(dateStr: string): string {
    const parts = dateStr.split('/');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // dd/MM/yyyy
  }

  function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function formatLastModified(dateStr: string): string {
    const d = new Date(dateStr);
    return d.toLocaleString('fr-BE');
  }

  onMount(() => {
    // Vérifier l'authentification
    const flag = localStorage.getItem('whist_admin_ok');
    if (flag !== 'true') {
      window.location.href = '/admin';
      return;
    }
    // Charger les types de compétition et les archives en parallèle
    loadCompetitionTypes();
    loadArchives();
  });

  async function loadArchives() {
    isLoading = true;
    loadError = '';
    archives = [];

    try {
      let url = `${API_BASE_URL}/api/admin/archives`;
      const params = new URLSearchParams();

      if (filterYear) params.append('year', filterYear);
      if (filterMonth) params.append('month', filterMonth);
      if (filterCompetitionType) params.append('competitionType', filterCompetitionType);
      if (filterCompetitionNumber) params.append('competitionNumber', filterCompetitionNumber);
      if (filterPlayerCount) params.append('playerCount', filterPlayerCount);
      if (filterManche) params.append('manche', filterManche);
      if (filterTable) params.append('table', filterTable);
      if (filterTableConfigId) params.append('tableConfigId', filterTableConfigId);

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      archives = await res.json();
    } catch (err: any) {
      console.error(err);
      loadError = 'Impossible de charger les archives.';
    } finally {
      isLoading = false;
    }
  }

  async function downloadFile(file: ArchiveFile) {
    try {
      // Passer par le backend pour télécharger le fichier (évite le problème d'accès public)
      const res = await fetch(`${API_BASE_URL}/api/admin/archives/download?path=${encodeURIComponent(file.name)}`);
      
      if (!res.ok) {
        throw new Error(`Erreur HTTP ${res.status}`);
      }

      // Vérifier le Content-Type de la réponse
      const contentType = res.headers.get('Content-Type');
      console.log('Content-Type reçu:', contentType);
      console.log('Content-Length:', res.headers.get('Content-Length'));

      const blob = await res.blob();
      console.log('Blob size:', blob.size, 'type:', blob.type);
      
      // Forcer le type MIME correct pour le PDF
      const pdfBlob = new Blob([blob], { type: 'application/pdf' });
      
      const url = window.URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erreur téléchargement:', err);
      alert('Erreur lors du téléchargement du fichier.');
    }
  }

  async function deleteFile(file: ArchiveFile) {
    if (!confirm(`Supprimer définitivement "${file.fileName}" ?\n\nCette action est irréversible.`)) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/archives/delete?path=${encodeURIComponent(file.name)}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        throw new Error(`Erreur HTTP ${res.status}`);
      }

      // Recharger la liste
      await loadArchives();
    } catch (err) {
      console.error('Erreur suppression:', err);
      alert('Erreur lors de la suppression du fichier.');
    }
  }

  function clearFilters() {
    filterYear = String(currentYear);
    filterMonth = '';
    filterCompetitionType = '';
    filterCompetitionNumber = '';
    filterPlayerCount = '';
    filterManche = '';
    filterTable = '';
    filterTableConfigId = '';
    searchQuery = '';
    loadArchives();
  }

  function getCompetitionTypeBadgeClass(type: string | null): string {
    if (!type) return 'badge-unknown';
    switch (type.toLowerCase()) {
      case 'championnat': return 'badge-championnat';
      case 'interclub':
      case 'interclubs': return 'badge-interclub';
      case 'manche libre': return 'badge-libre';
      case 'concours': return 'badge-concours';
      default: return 'badge-unknown';
    }
  }

  // Récharger quand les filtres changent
  $: {
    // Déclencher le rechargement quand year ou month change
    // (après le premier mount)
    if (filterYear !== undefined) {
      // On utilise un petit délai pour éviter les appels multiples
    }
  }
</script>

<svelte:head>
  <title>Administration – Archives PDF</title>
</svelte:head>

<div class="admin-page">
  <h1>
    <a href="/admin" class="back-link">← Administration</a>
    <span class="sep">⟶</span> Archives PDF
  </h1>

  <div class="admin-card">
    <!-- Filtres -->
    <div class="filters-section">
      <div class="filters-row">
        <div class="filter-group">
          <label for="filter-year">Année</label>
          <select id="filter-year" bind:value={filterYear} on:change={loadArchives}>
            {#each availableYears as year}
              <option value={year}>{year}</option>
            {/each}
          </select>
        </div>

        <div class="filter-group">
          <label for="filter-month">Mois</label>
          <select id="filter-month" bind:value={filterMonth} on:change={loadArchives}>
            {#each months as m}
              <option value={m.value}>{m.label}</option>
            {/each}
          </select>
        </div>

        <div class="filter-group">
          <label for="filter-competition-type">Type compét.</label>
          <select id="filter-competition-type" bind:value={filterCompetitionType} on:change={() => { filterCompetitionNumber = ''; loadArchives(); }}>
            {#each competitionTypes as ct}
              <option value={ct.value}>{ct.label}</option>
            {/each}
          </select>
        </div>

        <div class="filter-group">
          <label for="filter-competition-number">N° compét.</label>
          <select 
            id="filter-competition-number" 
            bind:value={filterCompetitionNumber} 
            on:change={loadArchives}
            disabled={availableCompetitionNumbers.length === 0}
          >
            <option value="">Tous</option>
            {#each availableCompetitionNumbers as cn}
              <option value={cn.value}>{cn.label}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="filters-row">
        <div class="filter-group">
          <label for="filter-player-count">Nb joueurs</label>
          <select id="filter-player-count" bind:value={filterPlayerCount} on:change={loadArchives}>
            <option value="">Tous</option>
            {#each availablePlayerCounts as pc}
              <option value={String(pc)}>{pc} joueurs</option>
            {/each}
          </select>
        </div>

        <div class="filter-group">
          <label for="filter-manche">Manche</label>
          <input 
            type="number" 
            id="filter-manche" 
            class="filter-input"
            placeholder="Toutes"
            bind:value={filterManche} 
            on:change={loadArchives}
            min="1"
          />
        </div>

        <div class="filter-group">
          <label for="filter-table">Table</label>
          <select id="filter-table" bind:value={filterTable} on:change={loadArchives}>
            <option value="">Toutes</option>
            {#each ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as letter, i}
              <option value={String(i + 1)}>{letter}</option>
            {/each}
          </select>
        </div>

        <div class="filter-group">
          <label for="filter-table-config-id">ID Table</label>
          <input
            type="number"
            id="filter-table-config-id"
            class="filter-input"
            placeholder="Tous"
            bind:value={filterTableConfigId}
            on:change={loadArchives}
            min="1"
          />
        </div>

        <input
          type="text"
          class="search-input"
          placeholder="Rechercher par nom..."
          bind:value={searchQuery}
        />

        <button class="btn-refresh" on:click={loadArchives}>
          🔄 Actualiser
        </button>

        <button class="btn-clear-filters" on:click={clearFilters} title="Réinitialiser les filtres">
          ✕ Réinit.
        </button>
      </div>
    </div>

    <!-- Contenu -->
    {#if isLoading}
      <div class="loading">
        <p>Chargement des archives…</p>
      </div>
    {:else if loadError}
      <p class="error">{loadError}</p>
    {:else if archives.length === 0}
      <div class="empty-state">
        <span class="empty-icon">📂</span>
        <p>Aucune archive trouvée pour cette période.</p>
      </div>
    {:else}
      <div class="archives-count">
        {archives.length} fichier{archives.length > 1 ? 's' : ''} trouvé{archives.length > 1 ? 's' : ''}
      </div>

      {#each Object.entries(groupedArchives) as [day, files]}
        <div class="day-group">
          <h3 class="day-header">
            📅 {formatDate(day)}
            <span class="day-count">({files.length} fichier{files.length > 1 ? 's' : ''})</span>
          </h3>

          <div class="files-grid">
            {#each files as file}
              <div class="file-card">
                <div class="file-icon">📄</div>
                <div class="file-info">
                  <div class="file-name" title={file.fileName}>{file.fileName}</div>
                  <div class="file-meta">
                    <span>{formatFileSize(file.size)}</span>
                    <span>•</span>
                    <span>{formatLastModified(file.lastModified)}</span>
                    {#if file.tableConfigId}
                      <span>•</span>
                      <span class="meta-id">ID: {file.tableConfigId}</span>
                    {/if}
                  </div>
                  {#if file.competitionType || file.manche || file.table || file.playerCount || file.tableName}
                    <div class="file-badges">
                      {#if file.competitionType}
                        <span class="badge {getCompetitionTypeBadgeClass(file.competitionType)}">
                          {file.competitionType}
                          {#if file.competitionNumber}#{file.competitionNumber}{/if}
                        </span>
                      {/if}
                      {#if file.manche}
                        <span class="badge badge-manche">M{file.manche}</span>
                      {/if}
                      {#if file.tableName}
                        <span class="badge badge-table">{file.tableName}</span>
                      {:else if file.table}
                        <span class="badge badge-table">T{file.table}</span>
                      {/if}
                      {#if file.playerCount}
                        <span class="badge badge-players">{file.playerCount}J</span>
                      {/if}
                    </div>
                  {/if}
                  {#if file.players}
                    <div class="file-players">
                      <span class="players-label">Joueurs:</span> {file.players}
                    </div>
                  {/if}
                </div>
                <div class="file-actions">
                  <button class="btn-download" on:click={() => downloadFile(file)} title="Télécharger">
                    ⬇️
                  </button>
                  <button class="btn-delete" on:click={() => deleteFile(file)} title="Supprimer">
                    🗑️
                  </button>
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/each}
    {/if}
  </div>
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

  .filters-section {
    margin-bottom: 1.5rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(51, 65, 85, 0.5);
  }

  .filters-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .filters-row:last-child {
    margin-bottom: 0;
  }

  .filter-group {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .filter-group label {
    font-size: 0.8rem;
    color: #9ca3af;
  }

  .filter-input {
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.6);
    background: #020617;
    color: #f9fafb;
    width: 80px;
  }

  .btn-clear-filters {
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(239, 68, 68, 0.5);
    background: transparent;
    color: #ef4444;
    cursor: pointer;
    font-size: 0.85rem;
  }

  .btn-clear-filters:hover {
    background: rgba(239, 68, 68, 0.1);
  }

  .filter-group select {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.6);
    background: #020617;
    color: #f9fafb;
    min-width: 120px;
  }

  .search-input {
    flex: 1;
    min-width: 200px;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid rgba(148, 163, 184, 0.6);
    background: #020617;
    color: #f9fafb;
  }

  .btn-refresh {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid rgba(34, 197, 94, 0.5);
    background: transparent;
    color: #22c55e;
    cursor: pointer;
    font-size: 0.9rem;
  }

  .btn-refresh:hover {
    background: rgba(34, 197, 94, 0.1);
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: #9ca3af;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
  }

  .empty-icon {
    font-size: 3rem;
    display: block;
    margin-bottom: 1rem;
  }

  .empty-state p {
    color: #6b7280;
  }

  .archives-count {
    font-size: 0.9rem;
    color: #9ca3af;
    margin-bottom: 1rem;
  }

  .day-group {
    margin-bottom: 1.5rem;
  }

  .day-header {
    font-size: 1rem;
    color: #22c55e;
    margin: 0 0 0.75rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid rgba(34, 197, 94, 0.2);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .day-count {
    font-size: 0.8rem;
    color: #6b7280;
    font-weight: normal;
  }

  .files-grid {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .file-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: rgba(15, 23, 42, 0.6);
    border: 1px solid rgba(51, 65, 85, 0.5);
    border-radius: 10px;
    transition: all 0.2s;
  }

  .file-card:hover {
    background: rgba(15, 23, 42, 0.9);
    border-color: rgba(34, 197, 94, 0.3);
  }

  .file-icon {
    font-size: 1.5rem;
  }

  .file-info {
    flex: 1;
    min-width: 0;
  }

  .file-name {
    font-weight: 500;
    color: #f9fafb;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .file-meta {
    font-size: 0.8rem;
    color: #6b7280;
    display: flex;
    gap: 0.5rem;
    margin-top: 0.25rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .meta-id {
    color: #22c55e;
    font-weight: 500;
  }

  .file-players {
    font-size: 0.75rem;
    color: #9ca3af;
    margin-top: 0.3rem;
    font-style: italic;
  }

  .players-label {
    color: #6b7280;
    font-style: normal;
  }

  .file-badges {
    display: flex;
    gap: 0.4rem;
    margin-top: 0.35rem;
    flex-wrap: wrap;
  }

  .badge {
    font-size: 0.7rem;
    padding: 0.15rem 0.5rem;
    border-radius: 4px;
    font-weight: 500;
  }

  .badge-championnat {
    background: rgba(234, 179, 8, 0.2);
    color: #fcd34d;
    border: 1px solid rgba(234, 179, 8, 0.4);
  }

  .badge-interclub {
    background: rgba(59, 130, 246, 0.2);
    color: #60a5fa;
    border: 1px solid rgba(59, 130, 246, 0.4);
  }

  .badge-libre {
    background: rgba(168, 85, 247, 0.2);
    color: #c084fc;
    border: 1px solid rgba(168, 85, 247, 0.4);
  }

  .badge-concours {
    background: rgba(20, 184, 166, 0.2);
    color: #5eead4;
    border: 1px solid rgba(20, 184, 166, 0.4);
  }

  .badge-unknown {
    background: rgba(107, 114, 128, 0.2);
    color: #9ca3af;
    border: 1px solid rgba(107, 114, 128, 0.4);
  }

  .badge-manche {
    background: rgba(34, 197, 94, 0.2);
    color: #4ade80;
    border: 1px solid rgba(34, 197, 94, 0.4);
  }

  .badge-table {
    background: rgba(236, 72, 153, 0.2);
    color: #f472b6;
    border: 1px solid rgba(236, 72, 153, 0.4);
  }

  .badge-players {
    background: rgba(251, 146, 60, 0.2);
    color: #fdba74;
    border: 1px solid rgba(251, 146, 60, 0.4);
  }

  .btn-download {
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(34, 197, 94, 0.5);
    background: transparent;
    color: #22c55e;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .btn-download:hover {
    background: rgba(34, 197, 94, 0.15);
    transform: scale(1.05);
  }

  .file-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-delete {
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(239, 68, 68, 0.5);
    background: transparent;
    color: #ef4444;
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s;
  }

  .btn-delete:hover {
    background: rgba(239, 68, 68, 0.15);
    transform: scale(1.05);
  }

  .error {
    color: #f97373;
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
</style>
