<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { page } from '$app/stores';
  import jsPDF from 'jspdf';
  import autoTable from 'jspdf-autotable';


  let editDonneSection: HTMLDivElement | null = null;


  const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';

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
  partenairePk: string | null;
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



  interface ScorePreviewLine {
  playerId: number | null;
  alias: string;
  scoreDonne: number; // score de la donne APRÈS
  cumul: number;      // cumul APRÈS
  }

  let previewInitial: ScorePreviewLine[] = [];      // scores/cumuls AVANT modif
  let previewResult: ScorePreviewLine[] | null = null; // scores/cumuls APRÈS recalcul
  let previewLoading = false;
  let previewError = '';

  interface AnnonceConfigDto {
  code: string;
  label: string | null;
  templateResult: number;
  requirePartner: boolean;
  requirePlis: boolean;
  requireArbitre: boolean;
  }

  interface GrilleConfigDto {
  code: string;
  kind: string; // 'plis' ou 'etat'
  nbJoueursDedans: number;
  plisFaits: number | null;
  etat: string | null;
  }

  let annoncesConfig: AnnonceConfigDto[] = [];
  let grilleConfig: GrilleConfigDto[] = [];
  let configError = '';

  let showFeuillePoints = false;
  let feuilleLoading = false;
  let feuilleError = '';


  const currentYear = new Date().getFullYear();

  let finalScoresByAlias: Record<string, number> = {};
let finalLeaderScore = 0;

$: if (detail?.finalScores) {
  finalScoresByAlias = {};
  finalLeaderScore = 0;

  for (const fs of detail.finalScores) {
    const score = fs.score ?? 0;
    finalScoresByAlias[fs.alias] = score;
    if (score > finalLeaderScore) finalLeaderScore = score;
  }
}

  
  let feuillePlayers: string[] = [];
  let feuillePoints: {
  donneNumber: number;
  annonce: string;
  scores: Record<string, { score: number; cumul: number }>
    ;
    }[] = [];

    let detail: AdminMancheDetailDto | null = null;
    let isLoading = false;
    let loadError = '';

    // --- Edition de donne ---
    let selectedDonne: AdminDonneSummaryDto | null = null;
    let editAnnonce = '';
    let editHasArbitre = false;


    let isNewDonne = false;
    
    
    let saving = false;
    let saveMessage = '';

    // Récupère l'id dynamique dans l'URL /admin/38, etc.
    $: tableConfigId = Number($page.params.tableConfigId);

    function formatDate(d: string | null) {
    if (!d) return '-';
    return new Date(d).toLocaleString('fr-BE');
    }

    onMount(() => {
    loadDetail();
    loadConfig();
    });

    async function loadDetail() {
    isLoading = true;
    loadError = '';
    saveMessage = '';
    selectedDonne = null;

    try {
    const res = await fetch(`${API_BASE_URL}/api/admin/manches/${tableConfigId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    detail = await res.json();
    } catch (err: any) {
    console.error(err);
    loadError = "Impossible de charger le détail de la manche.";
    } finally {
    isLoading = false;
    }
    }

    function getEtatsForAnnonce(code: string | null): string[] {
    if (!code) return [];
    const set = new Set<string>();
  for (const g of grilleConfig) {
    if (g.code === code && g.kind === 'etat' && g.etat) {
      set.add(g.etat);
    }
  }
  return Array.from(set);
}

function getPlisBoundsForAnnonce(code: string | null): { min: number; max: number } | null {
  if (!code) return null;

  const values = grilleConfig
    .filter((g) => g.code === code && g.kind === 'plis' && g.plisFaits != null)
    .map((g) => g.plisFaits as number);

  if (!values.length) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  return { min, max };
}

function getPlisOptionsForAnnonce(code: string | null): number[] {
  if (!code) return [];

  const values = grilleConfig
    .filter((g) => g.code === code && g.kind === 'plis' && g.plisFaits != null)
    .map((g) => g.plisFaits as number);

  // valeurs distinctes, triées
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

function exportFeuillePointsPdf() {
  if (!detail || !feuillePoints.length) return;

  const doc = new jsPDF({ orientation: 'landscape' });

  const title = `Feuille de points - Table ${detail.tableName} - Manche ${detail.mancheNumber}`;
  doc.setFontSize(14);
  doc.text(title, 14, 14);

  // Construction de l’en-tête comme dans ta page annonce
  const headRow1 = ['Donne', 'Annonce'];
  feuillePlayers.forEach((p) => {
    headRow1.push(p, '');
  });

  const headRow2 = ['', ''];
  feuillePlayers.forEach(() => {
    headRow2.push('Score', 'Cumul');
  });

  const body: any[] = [];

  feuillePoints.forEach((ligne, idx) => {
    const row: any[] = [ligne.donneNumber, ligne.annonce];

    feuillePlayers.forEach((p) => {
      const s = ligne.scores[p] || { score: 0, cumul: 0 };
      row.push(s.score, s.cumul);
    });

    body.push(row);
  });

  autoTable(doc, {
    head: [headRow1, headRow2],
    body,
    startY: 20,
    styles: { fontSize: 8 }
  });

  doc.save(`Feuille_points_Table_${detail.tableName}_M${detail.mancheNumber}.pdf`);
}


async function openEdit(donne: AdminDonneSummaryDto) {
  if (!donne || !donne.scores) return;

  // 1) Clone + normalisation
  let clonedScores = donne.scores.map((s: any) => ({
    playerId: s.playerId ?? null,
    alias: s.alias ?? '',
    annonce: s.annonce ?? '',
    partenairePk: s.partenairePk ?? s.PartenairePk ?? s.partenaire ?? null,
    plis: s.plis ?? null,
    resultat: s.resultat ?? '',
    dames: s.dames ?? null,
    arbitre: s.arbitre ?? false,
    score: s.score ?? 0,
    cumul: s.cumul ?? 0
  }));

  // 2) Réordonner selon l'ordre de detail.players
  if (detail && detail.players?.length) {
    clonedScores = detail.players.map((p) => {
      const found = clonedScores.find((x) => x.playerId === p.playerId);

      return (
        found ?? {
          playerId: p.playerId,
          alias: p.alias,
          annonce: '',
          partenairePk: null,
          plis: null,
          resultat: '',
          dames: null,
          arbitre: false,
          score: 0,
          cumul: 0
        }
      );
    });
  }

  selectedDonne = {
    ...donne,
    scores: clonedScores
  };

  editAnnonce = selectedDonne.annoncePrincipale ?? '';
  editHasArbitre = selectedDonne.hasArbitre;

  previewInitial = clonedScores.map((s) => ({
    playerId: s.playerId,
    alias: s.alias,
    scoreDonne: s.score,
    cumul: s.cumul
  }));

  previewResult = null;
  previewError = '';
  saveMessage = '';

  // 🔽 attendre que le DOM se mette à jour, puis scroller
  await tick();
  if (editDonneSection) {
    editDonneSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

  function createEmptyDonne(donneNumber: number): AdminDonneSummaryDto {
    if (!detail) {
      throw new Error('Impossible de créer une donne sans détail de manche');
    }

    const scores = detail.players.map((p) => ({
      playerId: p.playerId,
      alias: p.alias,
      annonce: '',
      partenairePk: '',
      plis: null,
      resultat: '',
      dames: null,
      arbitre: false,
      score: 0,
      cumul: 0
    }));

    return {
      donneNumber,
      annoncePrincipale: '',
      hasArbitre: false,
      scores
    };
  }



  async function startAddDonne() {
    if (!detail) return;

    // on se met en mode création
    isNewDonne = true;

    // par défaut, on propose "après la dernière"
    const nextNumber = (detail.donnes?.length ?? 0) + 1;

    selectedDonne = createEmptyDonne(nextNumber);

    editAnnonce = '';
    editHasArbitre = false;
    saveMessage = '';
    previewError = '';

    // prévisualisation initiale = scores à 0
    previewInitial = detail.players.map((p) => ({
      playerId: p.playerId,
      alias: p.alias,
      scoreDonne: 0,
      cumul: 0
    }));
    previewResult = null;

    await tick();
    if (editDonneSection) {
      editDonneSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }




async function openFeuillePoints() {
  if (!detail) return;

  showFeuillePoints = true;
  feuilleLoading = true;
  feuilleError = '';
  feuillePlayers = [];
  feuillePoints = [];

  try {
    // 👉 API admin à créer (voir plus bas, partie C#)
    const res = await fetch(
      `${API_BASE_URL}/api/admin/manche/${detail.tableConfigId}/feuille-points`
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();   // { players, lignes }

    feuillePlayers = data.players;

    // On enrichit avec l’annonce principale depuis detail.donnes
    feuillePoints = data.lignes.map((l) => {
      const donne = detail.donnes.find(
        (d) => d.donneNumber === l.donneNumber
      );
      return {
        donneNumber: l.donneNumber,
        annonce: donne?.annoncePrincipale ?? '',
        scores: l.scores // { [alias]: { score, cumul } }
      };
    });
  } catch (err) {
    console.error(err);
    feuilleError = "Erreur lors du chargement de la feuille de points.";
  } finally {
    feuilleLoading = false;
  }
}

function closeFeuillePoints() {
  showFeuillePoints = false;
}


async function loadConfig() {
  configError = '';
  try {
    const [resAnnonces, resGrille] = await Promise.all([
      fetch(`${API_BASE_URL}/api/config/annonces`),
      fetch(`${API_BASE_URL}/api/config/grille`)
    ]);

    if (!resAnnonces.ok || !resGrille.ok) {
      throw new Error(`Config HTTP ${resAnnonces.status} / ${resGrille.status}`);
    }

    annoncesConfig = await resAnnonces.json();
    grilleConfig = await resGrille.json();
  } catch (err) {
    console.error(err);
    configError = 'Impossible de charger la configuration des annonces.';
  }
}


function closeEdit() {
  selectedDonne = null;
  isNewDonne = false; 
  previewInitial = [];
  previewResult = null;
  previewError = '';
  saveMessage = '';
}

async function deleteDonne() {
  if (!detail || !selectedDonne) return;

  if (!confirm(`Supprimer la donne n° ${selectedDonne.donneNumber} ?`)) {
    return;
  }

  try {
    // 1) Suppression en DB
    let res = await fetch(`${API_BASE_URL}/api/admin/donne/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableConfigId: detail.tableConfigId,
        mancheNumber: detail.mancheNumber,
        donneNumber: selectedDonne.donneNumber
      })
    });

    if (!res.ok) {
      throw new Error(`Delete donne HTTP ${res.status}`);
    }

    // 2) Recalcule les cumuls de la manche
    res = await fetch(`${API_BASE_URL}/api/admin/donne/recalc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tableConfigId: detail.tableConfigId,
        mancheNumber: detail.mancheNumber,
        donneNumber: selectedDonne.donneNumber
      })
    });

    if (!res.ok) {
      throw new Error(`Recalc donne HTTP ${res.status}`);
    }

    // 3) Recharge l’écran + ferme le panneau d’édition
    await loadDetail();
    closeEdit();
    saveMessage = 'Donne supprimée et scores recalculés ✅';
  } catch (err) {
    console.error(err);
    alert("Erreur lors de la suppression de la donne.");
  }
}

function requiresPartner(code: string | null): boolean {
  if (!code) return false;
  const a = annoncesConfig.find((x) => x.code === code);
  return !!a?.requirePartner;
}

function getAnnonceRow(donne: AdminDonneSummaryDto | null) {
  if (!donne || !donne.scores) return null;

  return donne.scores.find(
    (s) => s && s.annonce && s.annonce !== ''
  ) ?? null;
}


function getPartnerAliasForRow(row) {
  if (!row || !row.partenairePk) return '';

  const pkNum = Number(row.partenairePk);
  const p = detail?.players.find((pl) => pl.playerId === pkNum);
  return p?.alias ?? '';
}


function onAnnonceChange(rowIndex: number) {
  if (!selectedDonne) return;

  const copy = {
    ...selectedDonne,
    scores: selectedDonne.scores.map((row, idx) => {
      const updated = { ...row };
      if (idx !== rowIndex) return updated;

      // 1) Partenaire : si l’annonce ne nécessite pas de partenaire, on nettoie
      if (!requiresPartner(updated.annonce)) {
        updated.partenairePk = '';
      }

      // 2) Dames : si ce n'est PAS une annonce D, on remet à null
      if (!isDamesAnnonce(updated.annonce)) {
        updated.dames = null;
      }

      // 3) Plis / Résultat selon Kind
      const kind = getKindForAnnonce(updated.annonce);
      if (kind !== 'plis') {
        updated.plis = null;
      }
      if (kind !== 'etat') {
        updated.resultat = '';
      }

      return updated;
    })
  } as AdminDonneSummaryDto;

  // 4) Si on vient de choisir "D" sur cette ligne, on force "D" partout
  const current = copy.scores[rowIndex];
  if (isDamesAnnonce(current.annonce)) {
    copy.scores = copy.scores.map((row) => ({
      ...row,
      annonce: 'D'
    }));
  }

  selectedDonne = copy;
}



function isDamesAnnonce(code: string | null): boolean {
  return code?.toUpperCase() === 'D';
}

type AnnonceKind = 'plis' | 'etat' | 'none';

function getKindForAnnonce(code: string | null): AnnonceKind {
  if (!code) return 'none';

  // Cas spécial Dames : on désactive Plis et Résultat
  if (isDamesAnnonce(code)) return 'none';

  const hasPlis = grilleConfig.some(
    (g) => g.code === code && g.kind.toLowerCase() === 'plis'
  );
  const hasEtat = grilleConfig.some(
    (g) => g.code === code && g.kind.toLowerCase() === 'etat'
  );

  if (hasPlis && !hasEtat) return 'plis';
  if (hasEtat && !hasPlis) return 'etat';

  // Si jamais les deux existent (cas théorique), on laisse les deux actifs
  if (hasPlis && hasEtat) return 'none';

  return 'none';
}



async function previewDonne() {
  if (!detail || !selectedDonne) return;

  previewLoading = true;
  previewError = '';
  previewResult = null;

  const payload = {
    tableConfigId: detail.tableConfigId,
    mancheNumber: detail.mancheNumber,
    donneNumber: selectedDonne.donneNumber,
    annoncePrincipale: editAnnonce || null,
    hasArbitre: editHasArbitre,
    scores: selectedDonne.scores.map((s) => ({
      joueurPk: s.playerId,
      annonce: s.annonce,

      // 🔥 IMPORTANT : envoyer un nombre ou null, pas une string
      partenairePk:
        s.partenairePk === '' || s.partenairePk == null
          ? null
          : Number(s.partenairePk),

      plis: s.plis === '' || s.plis == null ? null : Number(s.plis),
      resultat: s.resultat,
      dames: s.dames === '' || s.dames == null ? null : Number(s.dames),
      arbitre: !!s.arbitre
    }))
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/admin/donne/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    console.log('Preview raw data', data);

    const raw = (data.scores ?? data) as any[];

    previewResult = raw.map((r) => ({
      playerId: r.playerId ?? r.joueurPk ?? null,
      alias: r.alias ?? '',
      scoreDonne: r.scoreDonneApres ?? 0,
      cumul: r.cumulApres ?? 0
    }));
  } catch (err) {
    console.error(err);
    previewError = "Impossible de prévisualiser les scores.";
  } finally {
    previewLoading = false;
  }
}



  async function saveDonne() {
    if (!detail || !selectedDonne) return;

    saving = true;
    saveMessage = '';

    // construction commune des scores
    const scoresPayload = selectedDonne.scores.map((s) => {
      const partenairePkNum =
        s.partenairePk === '' || s.partenairePk == null
          ? null
          : Number(s.partenairePk);

      const partner = detail.players.find((p) => p.playerId === partenairePkNum);

      return {
        joueurPk: s.playerId,
        alias: s.alias,
        annonce: s.annonce || null,
        partenairePk: partenairePkNum != null ? String(partenairePkNum) : null,
        partenaireAlias: partner ? partner.alias : null,
        plis: s.plis === '' || s.plis == null ? null : Number(s.plis),
        resultat: s.resultat || null,
        dames: s.dames === '' || s.dames == null ? null : Number(s.dames),
        arbitre: !!s.arbitre
      };
    });

    try {
      let res: Response;

    if (isNewDonne) {
  const payloadInsert = {
    tableConfigId: detail.tableConfigId,
    TableName : detail.tableName,
    mancheNumber: detail.mancheNumber,
    insertionDonneNumber: selectedDonne.donneNumber,   // 🔥 numéro choisi
    annoncePrincipale: editAnnonce || null,
    hasArbitre: editHasArbitre,
    scores: selectedDonne.scores.map((s) => {
      const partenairePkNum =
        s.partenairePk === '' || s.partenairePk == null
          ? null
          : Number(s.partenairePk);

      const partner = detail.players.find((p) => p.playerId === partenairePkNum);

      return {
        joueurPk: s.playerId,
        alias: s.alias,    // 🔥 utilisé pour la colonne Joueur
        annonce: s.annonce || null,
        partenairePk: partenairePkNum != null ? String(partenairePkNum) : null,
        partenaireAlias: partner ? partner.alias : null,
        plis: s.plis === '' || s.plis == null ? null : Number(s.plis),
        resultat: s.resultat || null,
        dames: s.dames === '' || s.dames == null ? null : Number(s.dames),
        arbitre: !!s.arbitre
      };
    })
  };

  await fetch(`${API_BASE_URL}/api/admin/donne/insert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadInsert)
  });

  // puis recalc complet de la manche via ton endpoint existant
  await fetch(`${API_BASE_URL}/api/admin/donne/recalc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tableConfigId: detail.tableConfigId,
      mancheNumber: detail.mancheNumber,
      donneNumber: selectedDonne.donneNumber
    })
  });

  saveMessage = 'Nouvelle donne ajoutée et scores recalculés ✅';
}

      // 3) Rechargement du détail (scores finaux + donnes)
      await loadDetail();
      // on peut rester sur l’écran, mais on n’est plus en "nouvelle"
      isNewDonne = false;
    } catch (err) {
      console.error(err);
      saveMessage = "Erreur lors de l'enregistrement.";
    } finally {
      saving = false;
    }
  }










function getChangeClass(after: number, before: number) {
  if (after > before) return 'changed-up';
  if (after < before) return 'changed-down';
  return 'no-change';
}


  async function deleteTable() {
    if (!detail) return;
    if (
      !confirm(
        `Supprimer TOUTE la table ${detail.tableName} – manche ${detail.mancheNumber} ? (donnes + scores)`
      )
    )
      return;

    try {
      const res = await fetch(`${API_BASE_URL}/api/admin/table/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableConfigId: detail.tableConfigId })
      });
      if (!res.ok) throw new Error(`Delete table HTTP ${res.status}`);

      alert('Table supprimée ✅');
      window.location.href = '/admin';
    } catch (err) {
      console.error(err);
      alert('Erreur lors de la suppression de la table.');
    }
  }





</script>
<svelte:head>
  <title>Administration – Détail manche</title>
</svelte:head>

<div class="admin-page">
  <button class="back-btn" on:click={() => (window.location.href = '/admin')}>
    ⬅ Retour à la liste
  </button>

  {#if isLoading}
    <p>Chargement…</p>
  {:else if loadError}
    <p class="error">{loadError}</p>
  {:else if !detail}
    <p>Aucune donnée.</p>
  {:else}
    <h1>
      Table {detail.tableName} — Manche {detail.mancheNumber}
    </h1>

    <p class="meta">
      Joueurs :
      {#each detail.players as p, i}
        {p.alias}{#if i < detail.players.length - 1}, {/if}
      {/each}
    </p>

    <p class="meta">
      Début : {formatDate(detail.startTime)} — Fin : {formatDate(detail.endTime)}
    </p>

    <div class="actions-row">
      <button on:click={deleteTable} class="danger">
        Supprimer toute la table
      </button>
        <button on:click={openFeuillePoints}>
    Feuille de points
  </button>
    </div>

    <!-- Scores finaux -->
<div class="card">
  <h2>Résultats finaux</h2>

  <table class="players-table">
    <thead>
      <tr>
        <th></th>
        {#each detail.players as p}
          <th
            class:leader={
              finalLeaderScore !== 0 &&
              finalScoresByAlias[p.alias] === finalLeaderScore
            }
          >
            {p.alias}
          </th>
        {/each}
      </tr>
    </thead>
    <tbody>
      <tr>
        <td class="label-cell">Résultats</td>
        {#each detail.players as p}
          <td
            class:leader={
              finalLeaderScore !== 0 &&
              finalScoresByAlias[p.alias] === finalLeaderScore
            }
          >
            {finalScoresByAlias[p.alias] ?? 0}
          </td>
        {/each}
      </tr>
    </tbody>
  </table>
</div>


    <!-- Liste des donnes -->
  <!-- Donnes de la manche -->
<div class="card">
  <div class="card-header-row">
    <h2>Donnes de la manche</h2>

    <!-- 🔥 Nouveau bouton d’ajout -->
    <button type="button" on:click={startAddDonne}>
      ➕ Ajouter une donne
    </button>
  </div>

  <table class="donnes-table compact-donnes-table">

    <thead>
      <tr>
        <th>#</th>
        <th>Annonce</th>
        <th>Joueur</th>
        <th>Partenaire</th>
        <th>Plis</th>
        <th>Résultat</th>
        <th>Dames</th>
        <th>Arbitre</th>
        <th>Action</th>
      </tr>
    </thead>

   <tbody>
  {#each detail.donnes as d}
    {#if getAnnonceRow(d)}
      <tr>
        <td>{d.donneNumber}</td>

        <!-- Annonce -->
        <td>{getAnnonceRow(d).annonce}</td>

        <!-- Joueur (celui qui a annoncé) -->
        <td>{getAnnonceRow(d).alias}</td>

        

        <!-- Partenaire (nom) -->
        <td>{getPartnerAliasForRow(getAnnonceRow(d))}</td>

        <!-- Plis / Résultat / Dames -->
        <td>{getAnnonceRow(d).plis ?? ''}</td>
        <td>{getAnnonceRow(d).resultat ?? ''}</td>
        <td>{getAnnonceRow(d).dames ?? ''}</td>

        <!-- Arbitre -->
        <td style="text-align:center;">
          {#if getAnnonceRow(d).arbitre}
            ✓
          {/if}
        </td>

        <!-- Action -->
        <td>
          <button on:click={() => openEdit(d)}>Modifier</button>
        </td>
      </tr>
    {/if}
  {/each}
</tbody>

  </table>
</div>


 
  
<!-- Édition d’une donne -->
{#if selectedDonne}
   <div class="card edit-donne-card" bind:this={editDonneSection}>
    <div class="edit-donne-header">
      <div>
        <h2>
          {#if isNewDonne}
            Nouvelle donne
          {:else}
            Éditer donne n° {selectedDonne.donneNumber}
          {/if}
        </h2>
        <div class="edit-donne-meta">
          <span>Table {detail?.tableName}</span>
          <span>Manche {detail?.mancheNumber}</span>
        </div>

        {#if isNewDonne}
          <!-- 🔥 choix du numéro de la nouvelle donne -->
          <div class="edit-donne-insert-row">
            <label>
              Numéro de la nouvelle donne :
              <input
                type="number"
                min="1"
                max={(detail?.donnes?.length ?? 0) + 1}
                bind:value={selectedDonne.donneNumber}
              />
            </label>
            <p class="hint">
              Les donnes à partir de ce numéro seront décalées vers le bas
              et les scores cumulés de la manche seront recalculés.
            </p>
          </div>
        {/if}
      </div>



      <!-- Donne arbitrée à droite -->
    
    </div>

    <div class="donne-editor">
      <table class="admin-table edit-donne-table">
        <thead>
          <tr>
            <th class="col-joueur">Joueur</th>
            <th class="col-annonce">Annonce</th>
            <th class="col-partenaire">Part.</th>
            <th class="col-plis">Plis</th>
            <th class="col-resultat">Résultat</th>
            <th class="col-dames">Dames</th>
            <th class="col-score">Score</th>
            <th class="col-cumul">Cumul</th>
            <th class="col-arbitre">Arbitre</th>
          </tr>
        </thead>

        <tbody>
          {#each selectedDonne.scores as s, i}
            <tr>
              <!-- Joueur -->
              <td class="col-joueur">{s.alias}</td>

              <!-- Annonce -->
              <td class="col-annonce">
                <select bind:value={s.annonce} on:change={() => onAnnonceChange(i)}>
                  <option value="">--</option>
                  {#each annoncesConfig as a}
                    <option value={a.code}>
                      {a.code}{a.label ? ` – ${a.label}` : ''}
                    </option>
                  {/each}
                </select>
              </td>

              <!-- Partenaire -->
              <td class="col-partenaire">
                <select
                  bind:value={s.partenairePk}
                  disabled={!requiresPartner(s.annonce)}
                >
                  <option value="">Partenaire</option>
                  {#each detail.players as p}
                    <option value={p.playerId}>{p.alias}</option>
                  {/each}
                </select>
              </td>

              <!-- Plis -->
              <td class="numeric col-plis">
                {#if getKindForAnnonce(s.annonce) === 'plis'}
                  <select bind:value={s.plis}>
                    <option value="">--</option>
                    {#each getPlisOptionsForAnnonce(s.annonce) as plisValue}
                      <option value={plisValue}>{plisValue}</option>
                    {/each}
                  </select>
                {:else}
                  <select disabled>
                    <option value="">--</option>
                  </select>
                {/if}
              </td>

              <!-- Résultat -->
              <td class="col-resultat">
                {#if getKindForAnnonce(s.annonce) === 'etat'}
                  <select bind:value={s.resultat}>
                    <option value="">--</option>
                    {#each getEtatsForAnnonce(s.annonce) as etat}
                      <option value={etat}>{etat}</option>
                    {/each}
                  </select>
                {:else}
                  <select disabled>
                    <option value="">--</option>
                  </select>
                {/if}
              </td>

              <!-- Dames -->
              <td class="numeric col-dames">
                <input
                  type="number"
                  min="0"
                  max="4"
                  bind:value={s.dames}
                  disabled={!isDamesAnnonce(s.annonce)}
                />
              </td>

              <!-- Score / Cumul -->
              <td class="numeric col-score score-cell">
                <input
                  class="score-input"
                  type="number"
                  bind:value={s.score}
                  readonly
                />
              </td>

              <td class="numeric col-cumul cumul-cell">
                <input
                  class="cumul-input"
                  type="number"
                  bind:value={s.cumul}
                  readonly
                />
              </td>

              <!-- Arbitre -->
              <td class="center col-arbitre col-arbitre-checkbox">
                <input type="checkbox" bind:checked={s.arbitre} />
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    <div class="actions-row edit-donne-actions">
      <button on:click={saveDonne} disabled={saving}>
        {saving ? 'Enregistrement…' : 'Enregistrer la donne'}
      </button>
      <button on:click={deleteDonne} class="danger" disabled={saving}>
        Supprimer cette donne
      </button>
      <button on:click={closeEdit}>Annuler</button>
    </div>

    {#if saveMessage}
      <p class="info">{saveMessage}</p>
    {/if}
  </div>
{/if}

<!-- Carte de prévisualisation -->
<div class="card preview-card">
  <div class="preview-row">
    <button
      type="button"
      on:click={previewDonne}
      disabled={previewLoading}
    >
      {previewLoading ? 'Calcul en cours…' : 'Prévisualiser les scores'}
    </button>
  </div>

  <h3>Prévisualisation des scores</h3>

  {#if previewError}
    <p class="error">{previewError}</p>
  {:else}
    <table class="preview-table">
      <thead>
        <tr>
          <th>Joueur</th>
          <th>Score AVANT</th>
          <th>Cumul AVANT</th>
          <th>Score APRÈS</th>
          <th>Cumul APRÈS</th>
        </tr>
      </thead>
      <tbody>
        {#each previewInitial as init}
          {#if previewResult}
            {#each previewResult as res (res.playerId)}
              {#if res.playerId === init.playerId}
                <tr>
                  <td>{init.alias}</td>
                  <td>{init.scoreDonne}</td>
                  <td>{init.cumul}</td>
                  <td class={getChangeClass(res.scoreDonne, init.scoreDonne)}>
                    {res.scoreDonne}
                  </td>
                  <td class={getChangeClass(res.cumul, init.cumul)}>
                    {res.cumul}
                  </td>
                </tr>
              {/if}
            {/each}
          {:else}
            <tr>
              <td>{init.alias}</td>
              <td>{init.scoreDonne}</td>
              <td>{init.cumul}</td>
              <td>-</td>
              <td>-</td>
            </tr>
          {/if}
        {/each}
    </tbody>
  </table>
{/if}
</div>  <!-- fin .card.preview-card -->
 {#if showFeuillePoints}
  <div class="modal-backdrop" on:click={closeFeuillePoints}>
    <div class="modal feuille-points-modal" on:click|stopPropagation>
      <h3>Feuille de points</h3>

      {#if feuilleLoading}
        <p>Chargement…</p>
      {:else if feuilleError}
        <p class="error">{feuilleError}</p>
      {:else if !feuillePoints.length}
        <p>Aucune donne encodée pour l'instant.</p>
      {:else}
        <table class="feuille-table">
          <thead>
            <tr>
              <th rowspan="2" class="col-donne">Donne</th>
              <th rowspan="2" class="col-annonce">Annonce</th>
              {#each feuillePlayers as p}
                <th colspan="2" class="col-player">{p}</th>
              {/each}
            </tr>
            <tr>
              {#each feuillePlayers as _}
                <th class="col-score">Score</th>
                <th class="col-cumul">Cumul</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each feuillePoints as ligne, idx}
              <tr class:total-row={idx === feuillePoints.length - 1}>
                <td class="cell-donne">{ligne.donneNumber}</td>
                <td class="cell-annonce">{ligne.annonce}</td>

                {#each feuillePlayers as p}
                  <td class="cell-score">
                    {ligne.scores[p]?.score ?? 0}
                  </td>
                  <td
                    class="cell-cumul"
                    class:cell-cumul-final={idx === feuillePoints.length - 1}
                  >
                    {ligne.scores[p]?.cumul ?? 0}
                  </td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}

      <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:0.8rem;">
        <button on:click={exportFeuillePointsPdf}>
          Exporter en PDF
        </button>
        <button on:click={closeFeuillePoints}>
          Fermer
        </button>
      </div>
    </div>
  </div>
{/if}
{/if}   <!-- fin du bloc {#if isLoading / {:else if ...} / {:else} -->
</div>  <!-- fin .admin-page -->

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
    margin-bottom: 0.5rem;
  }

  .meta {
    font-size: 0.9rem;
    color: #9ca3af;
  }

  .back-btn {
    margin-bottom: 1rem;
    border-radius: 999px;
    border: none;
    padding: 0.35rem 0.9rem;
    background: #111827;
    color: #e5e7eb;
    cursor: pointer;
  }

  .back-btn:hover {
    background: #1f2933;
  }

  .card {
    background: #020617;
    border-radius: 16px;
    padding: 1.25rem;
    border: 1px solid rgba(34, 197, 94, 0.3);
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
    margin-top: 1.2rem;
  }

  .simple-table,
  .donnes-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 0.75rem;
    font-size: 0.9rem;
  }

  .simple-table th,
  .simple-table td,
  .donnes-table th,
  .donnes-table td {
    border: 1px solid rgba(51, 65, 85, 0.9);
    padding: 0.35rem 0.6rem;
    text-align: center;
  }

  .simple-table th,
  .donnes-table th {
    background: linear-gradient(to bottom, #14532d, #052e16);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.78rem;
  }

  .actions-row {
    display: flex;
    gap: 0.75rem;
    margin-top: 0.9rem;
    flex-wrap: wrap;
  }

  button {
    padding: 0.45rem 0.9rem;
    border-radius: 999px;
    border: none;
    background: #22c55e;
    color: #020617;
    font-weight: 600;
    cursor: pointer;
    font-size: 0.85rem;
  }

  button:hover {
    filter: brightness(1.05);
  }

  .danger {
    background: #dc2626;
    color: #fee2e2;
  }

  .danger:hover {
    filter: brightness(1.05);
  }

  .error {
    color: #f97373;
  }

  .info {
    margin-top: 0.6rem;
    color: #a7f3d0;
  }

  .edit-grid {
    display: flex;
    gap: 1rem;
    align-items: center;
    margin-top: 0.6rem;
    flex-wrap: wrap;
  }

  .edit-grid input[type='text'] {
    padding: 0.4rem 0.6rem;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.6);
    background: #020617;
    color: #f9fafb;
  }

  .chk {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .score-input {
    width: 5rem;
    padding: 0.25rem 0.4rem;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.6);
    background: #020617;
    color: #f9fafb;
    text-align: right;
  }

  .admin-table th,
  .admin-table td {
    padding: 0.35rem 0.6rem;
    text-align: center;
  }

  .admin-table td.numeric {
    text-align: right;
    padding-right: 1rem;
  }

  .center {
    text-align: center;
  }

  .preview-card {
  margin-top: 1.2rem;
  padding-top: 1rem;
}

.preview-row {
  margin-bottom: 0.75rem;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.preview-table th,
.preview-table td {
  padding: 0.35rem 0.6rem;
  border: 1px solid rgba(51, 65, 85, 0.9);
  text-align: center;
}

.preview-table th {
  background: linear-gradient(to bottom, #14532d, #052e16);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.78rem;
}

.preview-table tr:nth-child(even) {
  background: #020b16;
}


.preview-table td.changed-up {
  background: rgba(34, 197, 94, 0.28);  /* vert */
  color: #bbf7d0;
  font-weight: 600;
  transition: background 0.2s ease, transform 0.15s ease;
}

.preview-table td.changed-down {
  background: rgba(220, 38, 38, 0.32); /* rouge */
  color: #fecaca;
  font-weight: 600;
  transition: background 0.2s ease, transform 0.15s ease;
}

.preview-table td.no-change {
  opacity: 0.6;
}

/* petit effet de focus quand ça change */
.preview-table td.changed-up,
.preview-table td.changed-down {
  transform: scale(1.02);
}


.admin-table input[readonly] {
  background: #020617;
  opacity: 0.7;
  cursor: default;
}

.admin-table select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.admin-table input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}


.admin-table select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Colonnes compactes */
.score-cell,
.cumul-cell {
  width: 80px;               /* réduit la largeur */
  padding: 0 4px;
}

/* Inputs lisibles */
.score-input,
.cumul-input {
  width: 100%;
  padding: 4px 6px;
  background: #020b06;                 /* fond sombre (cohérent) */
  border: 1px solid rgba(55,65,81,0.8); /* gris foncé */
  border-radius: 4px;

  color: #fef9c3;                       /* texte jaune clair lisible */
  font-weight: 600;
  font-size: 0.85rem;

  text-align: right;                    /* alignement numérique */
}

/* Empêcher le Chrome jaune moche sur readonly */
.score-input[readonly],
.cumul-input[readonly] {
  -webkit-text-fill-color: #fef9c3;
  opacity: 1;
}
/* Carte d’édition de donne */
.edit-donne-card {
  margin-top: 1.5rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(34, 197, 94, 0.35);
  background: radial-gradient(circle at top left, #052e16 0, #020617 45%, #020617 100%);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.6);
}

/* En-tête : titre + infos + "Donne arbitrée" */
.edit-donne-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 0.75rem;
}

.edit-donne-header h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #f9fafb;
}

.edit-donne-meta {
  margin-top: 0.25rem;
  font-size: 0.8rem;
  color: #9ca3af;
  display: flex;
  gap: 0.75rem;
}

.inline-checkbox {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
  color: #e5e7eb;
}

/* Tableau d’édition */
.edit-donne-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.88rem;
  margin-top: 0.25rem;
}

.edit-donne-table th,
.edit-donne-table td {
  padding: 0.35rem 0.5rem;
  border-bottom: 1px solid rgba(15, 23, 42, 0.7);
}

.edit-donne-table th {
  background: linear-gradient(to bottom, #14532d, #052e16);
  color: #e5e7eb;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.72rem;
}

.edit-donne-table tbody tr:nth-child(even) {
  background-color: rgba(15, 23, 42, 0.55);
}

/* Largeurs de colonnes (compactes) */
.edit-donne-table .col-joueur    { width: 16%; }
.edit-donne-table .col-annonce   { width: 24%; }
.edit-donne-table .col-partenaire{ width: 13%; }
.edit-donne-table .col-plis,
.edit-donne-table .col-resultat,
.edit-donne-table .col-dames,
.edit-donne-table .col-score,
.edit-donne-table .col-cumul,
.edit-donne-table .col-arbitre   { width: 7%; text-align: center; }

/* Inputs & selects dans la table */
  .edit-donne-table input,
  .edit-donne-table select {
  width: 100%;
  font-size: 0.85rem;
  padding: 0.22rem 0.4rem;
  border-radius: 0.35rem;
  border: 1px solid rgba(30, 64, 175, 0.5);
  background-color: #020617;
  color: #e5e7eb;
  }

  /* Score / Cumul : plus lisibles */
  .score-cell .score-input,
  .cumul-cell .cumul-input {
  background: #020617;
  color: #facc15;      /* jaune vif */
  font-weight: 600;
  text-align: center;
  }

  .edit-donne-table .col-score,
  .edit-donne-table .col-cumul {
  width: 70px;
  }

  /* Case arbitre */
  .col-arbitre-checkbox {
  text-align: center;
  }

  .col-arbitre-checkbox input[type='checkbox'] {
  transform: scale(1.1);
  }

  /* Ligne des boutons */
  .edit-donne-actions {
  margin-top: 0.9rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: flex-start;
  }

  .edit-donne-actions button {
  min-width: 11rem;
  }


  .feuille-points-modal {
  max-width: 900px;
  width: 95%;
  }

  .feuille-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  margin-top: 0.5rem;
  background: #020b06;
  }

  .feuille-table th,
  .feuille-table td {
  border: 1px solid rgba(55, 65, 81, 0.9);
  padding: 0.3rem 0.45rem;
  text-align: center;
  }

  .feuille-table th {
  background: #0b2814;
  color: var(--text-main);
  }

  /* Lignes verticales dorées entre les joueurs (après chaque Cumul) */
  .feuille-table th.col-cumul,
  .feuille-table td.cell-cumul {
  border-right: 3px solid rgba(245, 185, 66, 0.35);
  }

  /* Mais pour le tout dernier joueur, on remet une bordure "normale" */
  .feuille-table th.col-cumul:last-child,
  .feuille-table td.cell-cumul:last-child {
  border-right: 1px solid rgba(55, 65, 81, 0.9);
  }

  /* Ligne bleue verticale entre Annonce et les joueurs */
  .feuille-table th.col-annonce,
  .feuille-table td.cell-annonce {
  border-right: 3px solid rgba(55, 65, 81, 0.9) !important;
  }

  /* Lignes verticales dorées entre les joueurs */
  .feuille-table td.cumul-col,
  .feuille-table th.cumul-col {
  border-right: 3px solid rgba(245, 185, 66, 0.35);
  }

  .feuille-table tbody tr:nth-child(even) {
  background: #04140b;
  }

  /* Noms des joueurs : plus visibles */
  .feuille-table th.col-player {
  background: linear-gradient(to bottom, #14532d, #052e16);
  color: #fef9c3;
  font-size: 0.95rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  border-bottom: 2px solid #facc15;
  }

  /* Ligne "Score / Cumul" un peu plus discrète pour faire ressortir les noms */
  .feuille-table thead tr:nth-child(2) th {
  background: #04130b;
  font-size: 0.75rem;
  color: #9ca3af;
  font-weight: 500;
  }

  /* Séparateur vertical entre les joueurs */
  .feuille-table th.col-player,
  .feuille-table td:nth-child(4),
  .feuille-table td:nth-child(6),
  .feuille-table td:nth-child(8),
  .feuille-table td:nth-child(10) {
  border-left: 1.3px solid rgba(250, 204, 21, 0.35) !important;
  }

  /* Renforce un peu la séparation mais très discret */
  .feuille-table th.col-player {
  border-right: 2px solid rgba(250, 204, 21, 0.25) !important;
  }

  /* Dernière ligne de la feuille de points (totaux) */


  /* Cellules "cumul" de la dernière ligne : encore plus lisibles */
  .feuille-table tr.total-row td.cell-cumul-final {
  background: radial-gradient(
  circle at top,
  #fff7cf 0%,
  #ffd46a 45%,
  #f59e0b 100%
  ) !important;
  color: #111 !important;
  font-weight: 900;
  font-size: 0.98rem;
  border: 2px solid #fbbf24;
  box-shadow:
  0 0 0 1px #78350f inset,
  0 0 10px rgba(250, 204, 21, 0.55);
  }

  /* Tous les textes de la dernière ligne : bien foncés */
  .feuille-table tr.total-row td,
  .feuille-table tr.total-row th {
  color: #000 !important;
  }


  /* Si pas déjà défini ailleurs */
  .modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  }

  .modal {
  background: #020617;
  border-radius: 1rem;
  padding: 1rem 1.25rem;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.75);
  }

  /* Dernière ligne : fond or très lumineux + texte noir */
  .feuille-table tr.total-row {
  background: linear-gradient(
  to bottom,
  #ffe28a 0%,
  #facc15 40%,
  #eab308 100%
  ) !important;
  color: #000 !important;
  font-weight: 800;
  border-top: 2px solid #fbbf24;
  border-bottom: 2px solid #fbbf24;
  }

  /* Cellules "Cumul" de la dernière ligne */
  .feuille-table tr.total-row td.cell-cumul-final {
  background: radial-gradient(circle at top, #fffbe6 0%, #ffd75a 45%, #f59e0b 100%) !important;
  color: #000 !important;
  font-weight: 900;
  font-size: 0.95rem;
  border: 2px solid #fbbf24 !important;
  box-shadow:
  0 0 0 1px #78350f inset,
  0 0 10px rgba(250, 204, 21, 0.55);
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



  /* Tableau type "annonce" pour les résultats finaux */
  .players-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 0.75rem;
  font-size: 0.95rem;
  background: #020b06;
  }

  .players-table th,
  .players-table td {
  padding: 0.45rem 0.8rem;
  text-align: center;
  border: 1px solid rgba(22, 163, 74, 0.35);
  }

  /* Ligne d'en-tête (noms des joueurs) */
  .players-table thead th {
  background: linear-gradient(to bottom, #14532d, #052e16);
  color: #fef9c3;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.78rem;
  }

  /* Cellule "Résultats" à gauche */
  .players-table .label-cell {
  text-align: left;
  font-weight: 600;
  padding-left: 1.2rem;
  }

  /* Ligne des scores */
  .players-table tbody td {
  background: #020617;
  }

  /* Joueur leader (meilleur score) – discret */
  .players-table .leader {
  font-weight: 700;
  color: #facc15;
  }

  .card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.75rem;
  }


  .edit-donne-insert-row {
  margin-top: 0.6rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  }

  .edit-donne-insert-row input[type='number'] {
  width: 80px;
  margin-left: 0.5rem;
  }

  .edit-donne-insert-row .hint {
  font-size: 0.8rem;
  opacity: 0.7;
  }



</style>
