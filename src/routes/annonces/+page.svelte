<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import jsPDF from 'jspdf';
  import autoTable from 'jspdf-autotable';


  const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';

  // --- Gestion des brouillons ("draft") ---
  const DRAFT_STORAGE_PREFIX = 'whist-draft';

  import { goto, beforeNavigate } from '$app/navigation';
  import { browser } from '$app/environment';

  let draftSaveTimer: number | null = null;
  let isHydratingFromDraft = false; // pour ne pas re-sauvegarder pendant un load

  let tableName = '';
  let mancheNumber = '';
  let players: string[] = [];
  let playerCount = 0;
  let rows = 0;
  let donneNumber = 1; // numéro de la donne actuelle
  let playerIds: (number | null)[] = [];

  let competitionType: number | null = null;
  let competitionNumber: number | null = null;
  // Libellés lisibles reçus depuis /home
  let competitionTypeLabel = '';
  let competitionSubtypeLabel = '';
  
  

  let SessionId = '';
  function scrollToEmballage(player: string) {
  if (!browser) return;

  const el = document.getElementById(`emballage-${player}`) as HTMLSelectElement | null;
  if (el) {
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  el.focus();
  }
  }

  let tableConfigId: number | null = null;

// Empêcher les doubles clics sur "Valider la donne"
let isSubmittingDonne = false;

// File d’attente des donnes à envoyer au backend
type PendingDonne = {
  clientDonneId: string;
  donneNumber: number;
  donnePayload: any;
  scoresPayload: any;
};

let pendingDonnes: PendingDonne[] = [];
let isFlushingPending = false;

// Génère un identifiant unique pour chaque donne côté client
function generateClientDonneId(): string {
  return (crypto as any).randomUUID?.()
    ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// Clé de stockage local pour la file d’attente
function getPendingKey() {
  const typePart = competitionType ?? 'none';
  const numPart = competitionNumber ?? 'none';
  return `${DRAFT_STORAGE_PREFIX}-pending-${tableName}-t${typePart}-n${numPart}-m${mancheNumber}`;
}

function savePendingToLocalStorage() {
  if (typeof window === 'undefined') return;
  const key = getPendingKey();
  localStorage.setItem(key, JSON.stringify(pendingDonnes));
}

function loadPendingFromLocalStorage() {
  if (typeof window === 'undefined') return;
  const key = getPendingKey();
  const raw = localStorage.getItem(key);
  if (!raw) {
    pendingDonnes = [];
    return;
  }
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      pendingDonnes = parsed;
    } else {
      pendingDonnes = [];
    }
  } catch {
    pendingDonnes = [];
  }
}

// Essaie d'envoyer toutes les donnes en attente dans l'ordre
async function flushPendingDonnes() {
  if (isFlushingPending) return;
  if (!pendingDonnes.length) return;

  console.log('[PENDING] Début flush – nb donnes en attente :', pendingDonnes.length);
  
  
  isFlushingPending = true;
  try {
    const stillPending: PendingDonne[] = [];

    for (const item of pendingDonnes) {
      try {
        // 1) Envoi de la donne
        const resDonne = await fetch(`${API_BASE_URL}/api/donne`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.donnePayload)
        });

        if (!resDonne.ok) {
          // On arrête tout, on garde cette donne et les suivantes en attente
          stillPending.push(item);
          break;
        }

        // 2) Envoi des scores
        const resScores = await fetch(`${API_BASE_URL}/api/scores`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(item.scoresPayload)
        });

        if (!resScores.ok) {
          stillPending.push(item);
          break;
        }


        // Si tout va bien → cette donne est synchronisée, on passe à la suivante
        
        console.log(
  '[PENDING] Donne synchronisée avec succès',
  { donneNumber: item.donneNumber, clientDonneId: item.clientDonneId }
);
        
      } catch (e) {
        console.error('Erreur réseau lors du flush des donnes pendantes', e);
        stillPending.push(item);
        break; // on n'essaie pas les suivantes, on attendra le prochain flush
      }
    }

    // On ajoute les donnes qui n'ont pas encore été traitées
    const indexFirstUnsynced = stillPending.length
      ? pendingDonnes.findIndex(p => p.clientDonneId === stillPending[0].clientDonneId)
      : -1;

    if (indexFirstUnsynced >= 0) {
      // On garde la première non synchronisée + toutes les suivantes
      pendingDonnes = pendingDonnes.slice(indexFirstUnsynced);
    } else if (stillPending.length === 0) {
      // Tout a été synchronisé ✅
      pendingDonnes = [];
    }

    savePendingToLocalStorage();
  } finally {
    isFlushingPending = false;
    
    console.log('[PENDING] Fin flush – donnes encore en attente :', pendingDonnes.length);

  }
}




  let soloPlayer: string | null = null;

  let showConfetti = false;

  let showAnnonceOrder = false; // Permet d'afficher la latte des annonces
  let showHistorique = false; // Permet d'afficher le tableau des scores complet
  let showFeuillePoints = false;
  let showArbitreModal = false;
  let arbitreMessage = "";
  let mancheTerminee = false;

  // 🔐 Manche en cours : protège la navigation (flèche arrière, changement de page)
  let hasUnsavedManche = false;

  // ⚠️ Modale "quitter la manche"
  let showLeaveModal = false;
  let pendingNav: any = null;    // navigation en attente (back, lien, etc.)
  let ignoreNextNav = false;     // pour ne pas rebloquer après validation



  function markMancheDirty() {
  if (!mancheTerminee) {
  hasUnsavedManche = true;
  }
  }

  function markMancheClean() {
  hasUnsavedManche = false;
  }
  // 🔁 Interception de la navigation (flèche arrière, liens, goto, etc.)
  if (browser) {
  beforeNavigate((nav) => {
  console.log('beforeNavigate', nav);

  // Rien à protéger
  if (!hasUnsavedManche) return;

  // Navigation déclenchée par notre propre goto après confirmation
  if (ignoreNextNav) {
  ignoreNextNav = false;
  return;
  }

  // Cas spécial : on quitte complètement l'app (reload, fermer l'onglet, changer d'URL)
  // → on garde le confirm natif, c'est le seul truc fiable ici
  if (nav.type === 'leave') {
  const ok = confirm(
  "Voulez-vous vraiment quitter l'encodage de la manche en cours ?\n\n" +
  "(Cette fenêtre ou cet onglet va être fermée.)"
  );
  if (!ok) nav.cancel();
  return;
  }

  // Pour toutes les navigations internes (back, liens, goto...) → jolie modale
  nav.cancel();              // on bloque
  pendingNav = nav;          // on mémorise où on voulait aller
  showLeaveModal = true;     // on ouvre la modale
  });
  }


  function cancelLeave() {
  showLeaveModal = false;
  pendingNav = null;
  }


  // 🧠 Mettre la manche en PAUSE côté serveur
  async function pauseMancheOnServer() {
  if (!tableConfigId || !SessionId) {
  console.warn('Impossible de mettre en pause : tableConfigId ou SessionId manquant.');
  return;
  }

  try {
  await fetch(`${API_BASE_URL}/api/manches/${tableConfigId}/pause`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
  sessionId: SessionId
  })
  });
  } catch (e) {
  console.error('Erreur lors de la mise en pause de la manche :', e);
  // on ne bloque pas la navigation même si ça plante
  }
  }

  async function handlePauseClick() {
  await pauseMancheOnServer(); // ta fonction déjà prête
  markMancheClean();           // tu l’as déjà aussi
  goto('/');                   // retour accueil ou une autre page
  }


  // ⚠ Quitter quand même (on laisse partir la navigation qui était prévue)
  function confirmLeave() {
  if (!pendingNav) {
  showLeaveModal = false;
  return;
  }

  const nav = pendingNav;
  pendingNav = null;
  showLeaveModal = false;



  hasUnsavedManche = false;

  void pauseMancheOnServer();

  ignoreNextNav = true;

  // Types de navigation internes : link / form / goto
  if (nav.to?.url) {
  const u = nav.to.url;
  const href = `${u.pathname}${u.search}${u.hash}`;
  goto(href, { replaceState: nav.replaceState });
  } else if (nav.type === 'popstate') {
  // L'utilisateur avait cliqué sur "Retour" du navigateur
  history.back();
  }
  }



  let showEndOfMancheModal = false;
  let resultatSectionEl: HTMLDivElement | null = null;
  let mancheStartTime: string | null = null;

  let mancheEndTime: string | null = null; // heure de Fin de la manche
  let dureeManche: string | null = null;
  // Dates complètes (pour la DB)
  let mancheStartDate: string | null = null; // ISO string
  let mancheEndDate: string | null = null;   // ISO string
  let duree: string | null = null; // 🔥 pour l’affichage "⏱ 32 min"

  function scrollToResultSection() {
  if (typeof window === 'undefined') return;

  if (resultatSectionEl) {
  resultatSectionEl.scrollIntoView({
  behavior: 'smooth',
  block: 'start'
  });
  }
  }

  let previewSectionEl: HTMLDivElement | null = null;

  function scrollToPreviewScores() {
  if (typeof window === 'undefined') return;

  if (previewSectionEl) {
  previewSectionEl.scrollIntoView({
  behavior: 'smooth',
  block: 'start'
  });
  }
  }




  function formatHeure(date: Date): string {
  return date.toLocaleTimeString('fr-FR', {
  hour: '2-digit',
  minute: '2-digit'
  });
  }


  // Validation de la manche par joueur
  let validations: Record<string, boolean>
    = {};

    // Tous les joueurs ont-ils validé ?
    $: allPlayersValidated =
    players.length > 0 && players.every((p) => validations[p]);

    // Réinitialiser les validations quand le modal s’ouvre
    $: if (showEndOfMancheModal) {
    validations = {};
    for (const row of classementFinal) {
    validations[row.nom] = false;
    }
    }


    const couleurs = [
    { nom: 'Pique', symbole: '♠', couleur: 'black' },
    { nom: 'Trèfle', symbole: '♣', couleur: 'black' },
    { nom: 'Carreau', symbole: '♦', couleur: 'red' },
    { nom: 'Coeur', symbole: '♥', couleur: 'red' }
    ];





    // Le joueur 2 (index 1) distribue au départ
    $: currentDealer = (donneNumber) % players.length;

    // 🔹 Renvoie les joueurs qui NE jouent PAS cette donne
    function getInactivePlayersForDonne(donne: number, allPlayers: string[]): string[] {
    const n = allPlayers.length;
    if (n <= 4) return []; // à 4, tout le monde joue

  // Même logique que currentDealer : dealer = index du donneur
  const dealerIndex = donne % n;

  if (n === 5) {
  // À 5 : seul le donneur ne joue pas
  return [allPlayers[dealerIndex]];
  }

  if (n === 6) {
  // À 6 : le donneur ET le 3ᵉ joueur après lui ne jouent pas
  const otherIndex = (dealerIndex + 3) % n;
  return [allPlayers[dealerIndex], allPlayers[otherIndex]];
  }

  // Autres cas non prévus → tout le monde joue
  return [];
  }


 function getDealerAliasForDonne(donneNumber: number, allPlayers: string[]): string {
    const n = allPlayers.length;
    if (!n) return '';

    // même logique que currentDealer
    const dealerIndex = donneNumber % n;
    return allPlayers[dealerIndex] ?? '';
    }

  // 🔹 Liste réactive des joueurs inactifs pour la donne courante
  $: inactivePlayersCurrentDonne = getInactivePlayersForDonne(donneNumber, players);

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


function getInactivePlayersForDonneFeuille(donneNumber: number) {
  return getInactivePlayersForDonne(donneNumber, players);
}
function nextDonne() {
  // Si on est déjà à la dernière donne, on ne va pas plus loin
  if (donneNumber >= rows) {
    mancheTerminee = true;
    showEndOfMancheModal = true;
    return;
  }

  donneNumber++;
  resetDonneState();
  saveDraftLocallyAndRemotely(); // on sauvegarde l'état "vide" de la nouvelle donne
  scrollToTop();
}





  let annonces = [
  { code: 'E8', label: 'Emballage 8 plis', templateResult: 2 },
  { code: 'E9', label: 'Emballage 9 plis', templateResult: 2 },
  { code: 'S6', label: 'Seul 6 plis', templateResult: 1 },
  { code: 'E10', label: 'Emballage 10 plis', templateResult: 2 },
  { code: 'S7', label: 'Seul 7 plis', templateResult: 1 },
  { code: 'E11', label: 'Emballage 11 plis', templateResult: 2 },
  { code: 'PM', label: 'Petite misère', templateResult: 3 },
  { code: 'PM2', label: 'Petite misère 2 joueurs', templateResult: 4 },
  { code: 'E12', label: 'Emballage 12 plis', templateResult: 2 },
  { code: 'S8', label: 'Seul 8 plis', templateResult: 1 },
  { code: 'S8_D', label: 'Seul 8 plis direct', templateResult: 1 },
  { code: 'P', label: 'Picolo', templateResult: 3 },
  { code: 'P2', label: 'Picolo 2 joueurs', templateResult: 4 },
  { code: 'PME', label: 'Petite misère étalée', templateResult: 3 },
  { code: 'PME2', label: 'Petite misère étalée 2 joueurs', templateResult: 4 },
  { code: 'E13', label: 'Emballage 13 plis', templateResult: 2 },
  { code: 'A9', label: 'Abondance 9 plis', templateResult: 3 },
  { code: 'TR', label: 'Trou', templateResult: 5 },
  { code: 'GM', label: 'Grande misère', templateResult: 3 },
  { code: 'GM2', label: 'Grande misère 2 joueurs', templateResult: 4 },
  { code: 'A10', label: 'Abondance 10 plis', templateResult: 3 },
  { code: 'A11', label: 'Abondance 11 plis', templateResult: 3 },
  { code: 'GME', label: 'Grande misère étalée', templateResult: 3 },
  { code: 'GME2', label: 'Grande misère étalée 2 joueurs', templateResult: 4 },
  { code: 'PC', label: 'Petit chelem', templateResult: 3 },
  { code: 'CH', label: 'Chelem', templateResult: 3 },
  { code: 'D', label: 'Dames', templateResult: 6 }
  ];

  const ANNONCES_AVEC_ARBITRE = new Set([
  'GM', 'A10', 'A11', 'GME', 'PC', 'CH', 'GM2', 'GME2'
  ]);

  let annonceByPlayer: Record<string, string> = {};
	let emballes: Record<string, string> = {};
	let currentTemplate = 0;

// Sous-ensemble : les solos qui se jugent au nombre de plis
const JEUX_SOLOS_PLIS = new Set(['S6','S7','S8','S8_D']);

type Annonce = {
    code: string;
    label: string;
    templateResult: number;
};

// Pour chaque joueur, la liste d'annonces autorisées dans le menu déroulant
let annoncesParJoueur: Record<string, Annonce[]> = {};

// 🔁 Se recalcule automatiquement dès que `annonceByPlayer` ou `players` change
$: annoncesParJoueur = (() => {
    const map: Record<string, Annonce[]> = {};

    // On regarde s'il existe déjà un jeu à 2 joueurs (template 4)
    const firstTemplate4Entry = Object.entries(annonceByPlayer)
        .find(([_, c]) => getTemplateForAnnonce(c) === 4);

    const lockedCode = firstTemplate4Entry ? firstTemplate4Entry[1] : null;

    for (const p of players) {
        const currentCode = annonceByPlayer[p];

        if (!lockedCode) {
            // Aucun jeu 2 joueurs encore choisi → on montre toutes les annonces
            map[p] = annonces;
        } else if (!currentCode || getTemplateForAnnonce(currentCode) === 4) {
            // Ce joueur n'a rien choisi OU est aussi sur un jeu à 2 joueurs
            // → on ne lui propose QUE le jeu déjà choisi (P2, PM2, PME2, GM2 ou GME2)
            map[p] = annonces.filter(a => a.code === lockedCode);
        } else {
            // Ce joueur a déjà une annonce d'un autre type (solo, emballage, trou, dames…)
            // → on lui laisse la liste complète
            map[p] = annonces;
        }
    }

    return map;
})();



	let plis: Record<string, number> = {};
	let resultats: Record<string, string> = {};
	let dames: Record<string, number> = {};
  
  let previewScores: Record<string, number> = {};


  
  
  type JoueurHistorique = {
    nom: string;
    annonce: string | null;
    emballageAvec: string | null;
    plis: number | null;
    resultat: string | null;
    dames: number | null;
    arbitre: boolean;
};

type DonneHistorique = {
    donneNumber: number;
    joueurs: JoueurHistorique[];
};

let history: DonneHistorique[] = [];


// --- Appel à l'arbitre ---



// Jeux nécessitant TOUJOURS l'arbitre
const ARBITRE_CODES = new Set([
    'E11','E12','E13','GM', 'GM2', 'A10', 'A11', 'GME', 'GME2', 'PC', 'CH'
]);

// Tous les jeux "individuels" concernés par la règle des 2 ratés
const JEUX_SOLOS_CODES = new Set([
    'S6', 'S7', 'S8', 'S8_D',
    'PM', 'PM2', 'P', 'P2',
    'PME', 'PME2',
    'GM', 'GM2', 'GME', 'GME2',
    'A9', 'A10', 'A11',
    'PC', 'CH'
]);


// Compte combien de fois ce joueur a déjà RATÉ un jeu individuel
function countSoloFails(player: string): number {
    let count = 0;

    for (const donne of history) {
        for (const j of donne.joueurs) {
            if (j.nom !== player || !j.annonce) continue;

            const code = j.annonce;

            // On ne regarde que les jeux concernés par la règle
            if (!JEUX_SOLOS_CODES.has(code)) continue;

            // --- Cas 1 : solos S6 / S7 / S8 / S8_D -> échec en fonction des PLIS ---
            if (JEUX_SOLOS_PLIS.has(code)) {
                if (typeof j.plis === 'number' && isSoloFail(code, j.plis)) {
                    count++;
                }
            }
            // --- Cas 2 : tous les autres jeux -> échec si résultat = "Raté" ---
            else {
                if (j.resultat === 'Raté') {
                    count++;
                }
            }
        }
    }

    return count;
}


// Vérifie si l'annonce choisie impose un appel à l'arbitre
function isArbitreRequis(
    code: string | null | undefined,
    player: string
) {
    if (!code) {
        return { required: false, fails: 0, byCode: false, byHistory: false };
    }

    const mustByCode = ARBITRE_CODES.has(code);

    let fails = 0;
    let mustByHistory = false;

    if (JEUX_SOLOS_CODES.has(code)) {
        fails = countSoloFails(player);   // basé sur l’historique précédent
        mustByHistory = fails >= 2;
    }

    return {
        required: mustByCode || mustByHistory,
        fails,
        byCode: mustByCode,
        byHistory: mustByHistory
    };
}

function checkArbitreRequirement(code: string, player: string) {
    const info = isArbitreRequis(code, player);
    if (!info.required) return;

    let msg = `L'annonce ${code} choisie par ${player} nécessite un appel à l'arbitre.`;

    if (info.byHistory) {
        msg += `\n\n${player} a déjà raté ${info.fails} fois un jeu individuel (solo / misère / abondance / chelem).`;
    }

    arbitreMessage = msg;
    showArbitreModal = true;
}


  
  
  
  
function getDisplayName(p: string): string {
    const code = annonceByPlayer[p];
    if (!code) return p; // aucune annonce

    // Emballage OU Trou : on affiche p & partenaire
    if ((getTemplateForAnnonce(code) === 2 || code === 'TR') && emballes[p]) {
        return `${p} & ${emballes[p]} (${code})`;
    }

    // Cas normal : un seul joueur
    return `${p} (${code})`;
    }





    function resetDonneState() {
    annonceByPlayer = {};
    emballes = {};
    plis = {};
    resultats = {};
    dames = {};
    soloPlayer = null;

    saveDraftLocallyAndRemotely();
    }


    // --- Types pour la grille de résultats ---

    type EtatJeu = 'Réussi' | 'Raté' | 'Capot' | 'RéussiRaté';


    type GrilleRowPlis = {
    kind: 'plis';
    code: string;             // E8, S6, A9, ...
    nbJoueursDedans: number;  // 1 = solo, 2 = emballage, etc.
    plisFaits: number;        // Nb de plis réalisés (8+ -> 8)
    resultatInd: number;      // GR_ResultatInd_Qt
    resultatJeu: number;      // GR_ResultatJeu_Qt
    };

    type GrilleRowEtat = {
    kind: 'etat';
    code: string;             // PM, PM2, GM, GM2, TR, ...
    nbJoueursDedans: number;  // 1 ou 2
    etat: EtatJeu;            // Réussi / Raté / Capot / RéussiRaté
    resultatInd: number;      // GR_ResultatInd_Qt
    resultatJeu: number;      // GR_ResultatJeu_Qt
    };

    type GrilleRow = GrilleRowPlis | GrilleRowEtat;

    const GRILLE_RESULTATS: GrilleRow[] = [
    // --- EXEMPLES JEUX À PLIS ---

    // Emballage E8
    { kind: 'plis', code: 'E8', nbJoueursDedans: 2, plisFaits: 4, resultatInd: -19, resultatJeu: 0 },
    { kind: 'plis', code: 'E8', nbJoueursDedans: 2, plisFaits: 5, resultatInd: -16, resultatJeu: 0 },
    { kind: 'plis', code: 'E8', nbJoueursDedans: 2, plisFaits: 6, resultatInd: -13, resultatJeu: 0 },
    { kind: 'plis', code: 'E8', nbJoueursDedans: 2, plisFaits: 7, resultatInd: -10, resultatJeu: 0 },
    { kind: 'plis', code: 'E8', nbJoueursDedans: 2, plisFaits: 8, resultatInd: 7,   resultatJeu: 14 },
    { kind: 'plis', code: 'E8', nbJoueursDedans: 2, plisFaits: 9, resultatInd: 10,  resultatJeu: 20 },
    { kind: 'plis', code: 'E8', nbJoueursDedans: 2, plisFaits: 10, resultatInd: 13,  resultatJeu: 26 },
    { kind: 'plis', code: 'E8', nbJoueursDedans: 2, plisFaits: 11, resultatInd: 16,  resultatJeu: 32 },
    { kind: 'plis', code: 'E8', nbJoueursDedans: 2, plisFaits: 12, resultatInd: 19,  resultatJeu: 38 },
    { kind: 'plis', code: 'E8', nbJoueursDedans: 2, plisFaits: 13, resultatInd: 30,  resultatJeu: 60 },

    // Emballage E9
    { kind: 'plis', code: 'E9', nbJoueursDedans: 2, plisFaits: 5, resultatInd: -22, resultatJeu: 0 },
    { kind: 'plis', code: 'E9', nbJoueursDedans: 2, plisFaits: 6, resultatInd: -19, resultatJeu: 0 },
    { kind: 'plis', code: 'E9', nbJoueursDedans: 2, plisFaits: 7, resultatInd: -16, resultatJeu: 0 },
    { kind: 'plis', code: 'E9', nbJoueursDedans: 2, plisFaits: 8, resultatInd: -13,   resultatJeu: 0 },
    { kind: 'plis', code: 'E9', nbJoueursDedans:2, plisFaits: 9, resultatInd: 10,  resultatJeu: 20 },
    { kind: 'plis', code: 'E9', nbJoueursDedans: 2, plisFaits: 10, resultatInd: 13,  resultatJeu: 26 },
    { kind: 'plis', code: 'E9', nbJoueursDedans: 2, plisFaits: 11, resultatInd: 16,  resultatJeu: 32 },
    { kind: 'plis', code: 'E9', nbJoueursDedans: 2, plisFaits: 12, resultatInd: 19,  resultatJeu: 38 },
    { kind: 'plis', code: 'E9', nbJoueursDedans: 2, plisFaits: 13, resultatInd: 30,  resultatJeu: 60 },


    // Emballage E10
    { kind: 'plis', code: 'E10', nbJoueursDedans: 2, plisFaits: 6, resultatInd: -25, resultatJeu: 0 },
    { kind: 'plis', code: 'E10', nbJoueursDedans: 2, plisFaits: 7, resultatInd: -22, resultatJeu: 0 },
    { kind: 'plis', code: 'E10', nbJoueursDedans: 2, plisFaits: 8, resultatInd: -19,   resultatJeu: 0 },
    { kind: 'plis', code: 'E10', nbJoueursDedans: 2, plisFaits: 9, resultatInd: -16,  resultatJeu: 0 },
    { kind: 'plis', code: 'E10', nbJoueursDedans: 2, plisFaits: 10, resultatInd: 13,  resultatJeu: 26 },
    { kind: 'plis', code: 'E10', nbJoueursDedans: 2, plisFaits: 11, resultatInd: 16,  resultatJeu: 32 },
    { kind: 'plis', code: 'E10', nbJoueursDedans: 2, plisFaits: 12, resultatInd: 19,  resultatJeu: 38 },
    { kind: 'plis', code: 'E10', nbJoueursDedans: 2, plisFaits: 13, resultatInd: 30,  resultatJeu: 60 },


    // Emballage E11
    { kind: 'plis', code: 'E11', nbJoueursDedans: 2, plisFaits: 7, resultatInd: -28, resultatJeu: 0 },
    { kind: 'plis', code: 'E11', nbJoueursDedans: 2, plisFaits: 8, resultatInd: -25,   resultatJeu: 0 },
    { kind: 'plis', code: 'E11', nbJoueursDedans: 2, plisFaits: 9, resultatInd: -22,  resultatJeu: 0 },
    { kind: 'plis', code: 'E11', nbJoueursDedans: 2, plisFaits: 10, resultatInd: -19,  resultatJeu: 0 },
    { kind: 'plis', code: 'E11', nbJoueursDedans: 2, plisFaits: 11, resultatInd: 16,  resultatJeu: 32 },
    { kind: 'plis', code: 'E11', nbJoueursDedans: 2, plisFaits: 12, resultatInd: 19,  resultatJeu: 38 },
    { kind: 'plis', code: 'E11', nbJoueursDedans: 2, plisFaits: 13, resultatInd: 30,  resultatJeu: 60 },


    // Emballage E12

    { kind: 'plis', code: 'E12', nbJoueursDedans: 2, plisFaits: 8, resultatInd: -31,   resultatJeu: 0 },
    { kind: 'plis', code: 'E12', nbJoueursDedans: 2, plisFaits: 9, resultatInd: -28,  resultatJeu: 0 },
    { kind: 'plis', code: 'E12', nbJoueursDedans: 2, plisFaits: 10, resultatInd: -25,  resultatJeu: 0 },
    { kind: 'plis', code: 'E12', nbJoueursDedans: 2, plisFaits: 11, resultatInd: -22,  resultatJeu: 0 },
    { kind: 'plis', code: 'E12', nbJoueursDedans: 2, plisFaits: 12, resultatInd: 19,  resultatJeu: 38 },
    { kind: 'plis', code: 'E12', nbJoueursDedans: 2, plisFaits: 13, resultatInd: 30,  resultatJeu: 60 },


    // Emballage E13

    { kind: 'plis', code: 'E13', nbJoueursDedans: 2, plisFaits: 9, resultatInd: -34,  resultatJeu: 0 },
    { kind: 'plis', code: 'E13', nbJoueursDedans: 2, plisFaits: 10, resultatInd: -31,  resultatJeu: 0 },
    { kind: 'plis', code: 'E13', nbJoueursDedans: 2, plisFaits: 11, resultatInd: -28,  resultatJeu: 0 },
    { kind: 'plis', code: 'E13', nbJoueursDedans: 2, plisFaits: 12, resultatInd: -25,  resultatJeu: 0 },
    { kind: 'plis', code: 'E13', nbJoueursDedans: 2, plisFaits: 13, resultatInd: 30,  resultatJeu: 60 },


    // Solo S6
    { kind: 'plis', code: 'S6', nbJoueursDedans: 1, plisFaits: 3, resultatInd: -21, resultatJeu: 21 },
    { kind: 'plis', code: 'S6', nbJoueursDedans: 1, plisFaits: 4, resultatInd: -18, resultatJeu: 18 },
    { kind: 'plis', code: 'S6', nbJoueursDedans: 1, plisFaits: 5, resultatInd: -15, resultatJeu: 15 },
    { kind: 'plis', code: 'S6', nbJoueursDedans: 1, plisFaits: 6, resultatInd: 12,  resultatJeu: 12 },
    { kind: 'plis', code: 'S6', nbJoueursDedans: 1, plisFaits: 7, resultatInd: 15,  resultatJeu: 15 },
    { kind: 'plis', code: 'S6', nbJoueursDedans: 1, plisFaits: 8, resultatInd: 18,  resultatJeu: 18 }, // 8+ -> 8


    // Solo S7
    { kind: 'plis', code: 'S7', nbJoueursDedans: 1, plisFaits: 4, resultatInd: -24, resultatJeu: 24 },
    { kind: 'plis', code: 'S7', nbJoueursDedans: 1, plisFaits: 5, resultatInd: -21, resultatJeu: 21 },
    { kind: 'plis', code: 'S7', nbJoueursDedans: 1, plisFaits: 6, resultatInd: -18, resultatJeu: 18 },
    { kind: 'plis', code: 'S7', nbJoueursDedans: 1, plisFaits: 7, resultatInd: 15,  resultatJeu: 15 },
    { kind: 'plis', code: 'S7', nbJoueursDedans: 1, plisFaits: 8, resultatInd: 18,  resultatJeu: 18 }, // 8+ -> 8


    // Solo S8
    { kind: 'plis', code: 'S8', nbJoueursDedans: 1, plisFaits: 5, resultatInd: -30, resultatJeu: 30 },
    { kind: 'plis', code: 'S8', nbJoueursDedans: 1, plisFaits: 6, resultatInd: -27, resultatJeu: 27 },
    { kind: 'plis', code: 'S8', nbJoueursDedans: 1, plisFaits: 7, resultatInd: -24,  resultatJeu: 24 },
    { kind: 'plis', code: 'S8', nbJoueursDedans: 1, plisFaits: 8, resultatInd: 18,  resultatJeu: 18 }, // 8+ -> 8

    // Solo S8
    { kind: 'plis', code: 'S8_D', nbJoueursDedans: 1, plisFaits: 5, resultatInd: -30, resultatJeu: 30 },
    { kind: 'plis', code: 'S8_D', nbJoueursDedans: 1, plisFaits: 6, resultatInd: -27, resultatJeu: 27 },
    { kind: 'plis', code: 'S8_D', nbJoueursDedans: 1, plisFaits: 7, resultatInd: -24,  resultatJeu: 24 },
    { kind: 'plis', code: 'S8_D', nbJoueursDedans: 1, plisFaits: 8, resultatInd: 21,  resultatJeu: 21 }, // 8+ -> 8


    // --- EXEMPLES JEUX À ÉTAT SIMPLES (1 joueur dedans) ---

    // Petite misère (PM) : Réussi / Raté
    { kind: 'etat', code: 'PM', nbJoueursDedans: 1, etat: 'Réussi', resultatInd: 18,  resultatJeu: 18 },
    { kind: 'etat', code: 'PM', nbJoueursDedans: 1, etat: 'Raté',   resultatInd: -18, resultatJeu: 18 },


    // Grande misère (GM) : Réussi / Raté
    { kind: 'etat', code: 'GM', nbJoueursDedans: 1, etat: 'Réussi', resultatInd: 36,  resultatJeu: 36 },
    { kind: 'etat', code: 'GM', nbJoueursDedans: 1, etat: 'Raté',   resultatInd: -36, resultatJeu: 36 },


    // Petite misère étalée (PME) : Réussi / Raté
    { kind: 'etat', code: 'PME', nbJoueursDedans: 1, etat: 'Réussi', resultatInd: 27,  resultatJeu: 27 },
    { kind: 'etat', code: 'PME', nbJoueursDedans: 1, etat: 'Raté',   resultatInd: -27, resultatJeu: 27 },


    // Grande misère étalée (GME) : Réussi / Raté
    { kind: 'etat', code: 'GME', nbJoueursDedans: 1, etat: 'Réussi', resultatInd: 75,  resultatJeu: 75 },
    { kind: 'etat', code: 'GME', nbJoueursDedans: 1, etat: 'Raté',   resultatInd: -75, resultatJeu: 75 },


    // Picolo (P) : Réussi / Raté
    { kind: 'etat', code: 'P', nbJoueursDedans: 1, etat: 'Réussi', resultatInd: 24,  resultatJeu: 24 },
    { kind: 'etat', code: 'P', nbJoueursDedans: 1, etat: 'Raté',   resultatInd: -24, resultatJeu: 24 },


    // Abondance 9 (A9) : Réussi / Raté
    { kind: 'etat', code: 'A9', nbJoueursDedans: 1, etat: 'Réussi', resultatInd: 30,  resultatJeu: 30 },
    { kind: 'etat', code: 'A9', nbJoueursDedans: 1, etat: 'Raté',   resultatInd: -30, resultatJeu: 30 },

    // Abondance 10 (A10) : Réussi / Raté
    { kind: 'etat', code: 'A10', nbJoueursDedans: 1, etat: 'Réussi', resultatInd: 42,  resultatJeu: 42 },
    { kind: 'etat', code: 'A10', nbJoueursDedans: 1, etat: 'Raté',   resultatInd: -42, resultatJeu: 42 },

    // Abondance 11 (A11) : Réussi / Raté
    { kind: 'etat', code: 'A11', nbJoueursDedans: 1, etat: 'Réussi', resultatInd: 60,  resultatJeu: 60 },
    { kind: 'etat', code: 'A11', nbJoueursDedans: 1, etat: 'Raté',   resultatInd: -60, resultatJeu: 60 },

    // Petit Chelem (PC) : Réussi / Raté
    { kind: 'etat', code: 'PC', nbJoueursDedans: 1, etat: 'Réussi', resultatInd: 100,  resultatJeu: 100 },
    { kind: 'etat', code: 'PC', nbJoueursDedans: 1, etat: 'Raté',   resultatInd: -100, resultatJeu: 50 },

    // Chelem (CH) : Réussi / Raté
    { kind: 'etat', code: 'CH', nbJoueursDedans: 1, etat: 'Réussi', resultatInd: 200,  resultatJeu: 200 },
    { kind: 'etat', code: 'CH', nbJoueursDedans: 1, etat: 'Raté',   resultatInd: -200, resultatJeu: 40 },

    // Trou simple (TR)
    { kind: 'etat', code: 'TR', nbJoueursDedans: 2, etat: 'Réussi', resultatInd: 16, resultatJeu: 32 },
    { kind: 'etat', code: 'TR', nbJoueursDedans: 2, etat: 'Raté',   resultatInd: 0,  resultatJeu: 32 },
    { kind: 'etat', code: 'TR', nbJoueursDedans: 2, etat: 'Capot',  resultatInd: 30, resultatJeu: 60 },

    // --- EXEMPLES JEUX À 2 JOUEURS AVEC CAS MIXTE ---



    // Petite misère 2 joueurs (PM2)
    // les valeurs viennent directement de ton CSV :
    // PM2_18  => Réussi/Réussi (18, 36)
    // PM2_-18 => Raté/Raté    (-18, 0)
    // PM2_24  => Réussi/Raté  (18, 24)
    { kind: 'etat', code: 'PM2', nbJoueursDedans: 2, etat: 'Réussi',     resultatInd: 18, resultatJeu: 36 },
    { kind: 'etat', code: 'PM2', nbJoueursDedans: 2, etat: 'Raté',       resultatInd: -18, resultatJeu: 0 },
    { kind: 'etat', code: 'PM2', nbJoueursDedans: 2, etat: 'RéussiRaté', resultatInd: 18, resultatJeu: 24 },

    // Picolo 2 joueurs (P2)
    { kind: 'etat', code: 'P2', nbJoueursDedans: 2, etat: 'Réussi',     resultatInd: 24, resultatJeu: 48 },
    { kind: 'etat', code: 'P2', nbJoueursDedans: 2, etat: 'Raté',       resultatInd: -24, resultatJeu: 0 },
    { kind: 'etat', code: 'P2', nbJoueursDedans: 2, etat: 'RéussiRaté', resultatInd: 24, resultatJeu: 32 },

    // Grande misère 2 joueurs (GM2)
    { kind: 'etat', code: 'GM2', nbJoueursDedans: 2, etat: 'Réussi',     resultatInd: 36, resultatJeu: 72 },
    { kind: 'etat', code: 'GM2', nbJoueursDedans: 2, etat: 'Raté',       resultatInd: -36, resultatJeu: 0 },
    { kind: 'etat', code: 'GM2', nbJoueursDedans: 2, etat: 'RéussiRaté', resultatInd: 36, resultatJeu: 48 },

    { kind: 'etat', code: 'PME2', nbJoueursDedans: 2, etat: 'Réussi',     resultatInd: 27, resultatJeu: 54 },
    { kind: 'etat', code: 'PME2', nbJoueursDedans: 2, etat: 'Raté',       resultatInd: -27, resultatJeu: 0 },
    { kind: 'etat', code: 'PME2', nbJoueursDedans: 2, etat: 'RéussiRaté', resultatInd: 27, resultatJeu: 36 },

    // Grande misère étalée 2 joueurs (GME2)
    { kind: 'etat', code: 'GME2', nbJoueursDedans: 2, etat: 'Réussi',     resultatInd: 75, resultatJeu: 150 },
    { kind: 'etat', code: 'GME2', nbJoueursDedans: 2, etat: 'Raté',       resultatInd: -75, resultatJeu: 0 },
    { kind: 'etat', code: 'GME2', nbJoueursDedans: 2, etat: 'RéussiRaté', resultatInd: 75, resultatJeu: 100 },

    ];

    onMount(() => {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);

    // --- paramètres de base ---
    tableName = url.searchParams.get('tableName') ?? 'A';
    mancheNumber = Number(url.searchParams.get('mancheNumber') ?? '1') as any;
    playerCount = Number(url.searchParams.get('playerCount') ?? '4');
    donneNumber = Number(url.searchParams.get('donneNumber') ?? '1');


    // 👉 récupérer le type et le numéro de compétition
    const compTypeParam = url.searchParams.get('competitionType');
    competitionType = compTypeParam ? Number(compTypeParam) : null;

    const compNumParam = url.searchParams.get('competitionNumber');
    competitionNumber = compNumParam ? Number(compNumParam) : null;

    // Libellés lisibles (envoyés par la page d'accueil)
    const typeLabelParam = url.searchParams.get('competitionTypeLabel');
    competitionTypeLabel = typeLabelParam ?? '';

    const subtypeLabelParam = url.searchParams.get('competitionSubtypeLabel');
    competitionSubtypeLabel = subtypeLabelParam ?? '';


    const tcfgParam =
    url.searchParams.get('tableConfigId') ??
    localStorage.getItem('wb_current_table_config_id');

    tableConfigId = tcfgParam ? Number(tcfgParam) : null;



    // --- joueurs (alias) ---
    const playersParam = url.searchParams.get('players');
    players = playersParam
    ? JSON.parse(playersParam)
    : ['Alice', 'Bob', 'Claire', 'David'];

    // --- IDs (PK) alignés sur players ---
    const playerIdsParam = url.searchParams.get('playerIds');
    playerIds = playerIdsParam
    ? JSON.parse(playerIdsParam)
    : players.map(() => null);

    // --- nombre de donnes max ---
    rows = playerCount === 4 ? 16 : playerCount === 5 ? 20 : 24;

    // --- SessionId : identifiant unique côté navigateur ---
    let storedId = localStorage.getItem('whistSessionId');
    if (!storedId) {
    storedId =
    (crypto as any).randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem('whistSessionId', storedId);
    }
    SessionId = storedId;

    // --- tenter de restaurer un brouillon pour cette donne ---
    loadDraft();

    // --- restaurer les donnes en attente (file d’attente locale) ---
    loadPendingFromLocalStorage();

    // --- tenter un flush au démarrage (si la connexion est OK) ---
    flushPendingDonnes().catch((e) =>
    console.error('Erreur lors du flush des donnes pendantes au démarrage', e)
    );

    });


    function getDraftStorageKey() {
    const typePart = competitionType ?? 'none';
    const numPart = competitionNumber ?? 'none';

    return `${DRAFT_STORAGE_PREFIX}-${tableName}-t${typePart}-n${numPart}-m${mancheNumber}`;
    }



    // Ce qu'on stocke comme "état de la donne"
    function buildDraftPayload() {
    return {
    tableName,
    mancheNumber,
    donneNumber,
    playerCount,
    players,
    playerIds,
    annonceByPlayer,
    emballes,
    plis,
    resultats,
    dames,
    history,
    mancheStartTime,
    mancheStartDate,
    mancheEndTime,
    mancheEndDate,
    dureeManche,
    competitionType,
    competitionNumber
    };
    }


    // Appliquer un brouillon sur l'écran
    function applyDraft(payload: any) {
    if (!payload) return;

    try {
    isHydratingFromDraft = true;

    if (payload.tableName !== undefined) tableName = payload.tableName;
    if (payload.mancheNumber !== undefined) mancheNumber = payload.mancheNumber as any;
    if (payload.donneNumber !== undefined) donneNumber = payload.donneNumber;
    if (payload.competitionType !== undefined) {
    competitionType = payload.competitionType ?? null;
    }
    if (payload.competitionNumber !== undefined) {
    competitionNumber = payload.competitionNumber ?? null;
    }
    if (payload.playerCount !== undefined) {
    playerCount = payload.playerCount;


    // 👉 IMPORTANT : recalcul du nombre total de donnes
    rows = playerCount === 4 ? 16 : playerCount === 5 ? 20 : 24;
    }

    // 🔥 Restaurer le timing de la manche
    if (payload.mancheStartTime !== undefined) {
    mancheStartTime = payload.mancheStartTime;
    }
    if (payload.mancheStartDate !== undefined) {
    mancheStartDate = payload.mancheStartDate;
    }
    if (payload.mancheEndTime !== undefined) {
    mancheEndTime = payload.mancheEndTime;
    }
    if (payload.mancheEndDate !== undefined) {
    mancheEndDate = payload.mancheEndDate;
    }
    if (payload.dureeManche !== undefined) {
    dureeManche = payload.dureeManche;
    }

    if (payload.players) players = payload.players;
    if (payload.playerIds) playerIds = payload.playerIds;

    if (payload.annonceByPlayer) annonceByPlayer = payload.annonceByPlayer;
    if (payload.emballes) emballes = payload.emballes;
    if (payload.plis) plis = payload.plis;
    if (payload.resultats) resultats = payload.resultats;
    if (payload.dames) dames = payload.dames;

    if (payload.history) history = payload.history;
    const hasAnyAnnonce = Object.values(annonceByPlayer || {}).some((v) => !!v);
    if (hasAnyAnnonce || (history && history.length > 0)) {
    hasUnsavedManche = true;
    }

    } finally {
    isHydratingFromDraft = false;
    }
    }


    // Chargement : d'abord localStorage, puis API si rien
    async function loadDraft() {
    if (typeof window === 'undefined') return;

    const key = getDraftStorageKey();

    // 1) LocalStorage
    const local = localStorage.getItem(key);
    if (local) {
    try {
    const payload = JSON.parse(local);
    applyDraft(payload);
    return;
    } catch (e) {
    console.error('Erreur parse draft local', e);
    }
    }

    // 2) API
    try {
    const res = await fetch(`${API_BASE_URL}/api/draft/load`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
    tableConfigId,
    SessionId,
    tableName,
    mancheNumber: Number(mancheNumber),
    competitionType,
    competitionNumber
    })
    });

    if (!res.ok) return;

    const dto = await res.json();
    if (dto && dto.found && dto.payloadJson) {
    const payload = JSON.parse(dto.payloadJson);
    applyDraft(payload);
    }
    } catch (err) {
    console.error('Erreur chargement draft API', err);
    }
    }

    // Sauvegarde locale + serveur (debouncée)
    function saveDraftLocallyAndRemotely() {
    if (typeof window === 'undefined' || isHydratingFromDraft) return;

    const key = getDraftStorageKey();
    const payload = buildDraftPayload();
    const json = JSON.stringify(payload);

    // Local
    localStorage.setItem(key, json);

    // Serveur (on attend 1s après la dernière modif)
    if (draftSaveTimer) {
    clearTimeout(draftSaveTimer);
    }
    draftSaveTimer = window.setTimeout(() => {
    sendDraftToServer(json).catch((e) =>
    console.error('Erreur save draft API', e)
    );
    }, 1000);
    }

    async function sendDraftToServer(payloadJson: string) {
    await fetch(`${API_BASE_URL}/api/draft/save`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
    tableConfigId,
    SessionId,
    tableName,
    mancheNumber: Number(mancheNumber),
    donneNumber,
    playerCount,
    payloadJson,
    competitionType,
    competitionNumber
    })
    });
    }


    // 🔄 Envoi des infos de timing de la manche vers la DB (WhistTableConfig)
    async function saveMancheTimingToServer(dureeMinutes: number) {
    if (!mancheStartDate || !mancheEndDate) {
    console.warn("Timing manche incomplet, rien envoyé à l'API.");
    return;
    }


    const payload = {
    tableConfigId,
    TableName: tableName,
    MancheNumber: Number(mancheNumber),
    SessionId,                 // ton SessionId déjà géré côté front
    StartTime: mancheStartDate, // string ISO
    EndTime: mancheEndDate,     // string ISO
    DureeMinutes: dureeMinutes,

    };

    console.log("Envoi timing manche à l'API :", payload);

    try {
    const res = await fetch(`${API_BASE_URL}/api/table-config/timing`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
    });

    if (!res.ok) {
    const text = await res.text();
    console.error("Erreur API timing manche :", text);
    }
    } catch (err) {
    console.error("Impossible d'envoyer le timing de manche à l'API 😢", err);
    }
    }


    // 🔄 Envoi du début de manche vers la DB
    async function saveMancheStartToServer() {
    if (!mancheStartDate) return;

    const payload = {
    tableConfigId,
    TableName: tableName,
    MancheNumber: Number(mancheNumber),
    SessionId,
    StartTime: mancheStartDate
    };

    console.log("Envoi début manche à l'API :", payload);

    try {
    const res = await fetch(`${API_BASE_URL}/api/table-config/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
    });

    if (!res.ok) {
    const text = await res.text();
    console.error("Erreur API début de manche :", text);
    }
    } catch (err) {
    console.error("Impossible d'envoyer le début de manche à l'API 😢", err);
    }
    }


    function getTemplateForAnnonce(code: string): number {
    return annonces.find(a => a.code === code)?.templateResult || 0;
    }

    function getSoloBasePlis(code: string): number {
    switch (code) {
    case "S6":
    return 6;
    case "S7":
    return 7;
    case "S8":
    case "S8_D":
    return 8;
    default:
    // valeur par défaut si jamais
    return 6;
    }
    }



    function calculerDuree(heureString: string): string | null {
    if (!heureString) return null;

    // Sépare heures/minutes
    const [h, m] = heureString.split(':').map(Number);

    if (isNaN(h) || isNaN(m)) return null;

    // Date du début
    const debut = new Date();
    debut.setHours(h, m, 0, 0);

    // Maintenant
    const now = new Date();

    // Différence en minutes
    const diffMs = now.getTime() - debut.getTime();
    if (diffMs < 0) return null; // sécurité si bug

    const diffMin = Math.floor(diffMs / 60000);
    const diffH = Math.floor(diffMin / 60);
    const minRestantes = diffMin % 60;

    // Format intelligent
    if (diffH === 0) {
        return `${diffMin} min`;
    } else {
        return `${diffH}h${minRestantes.toString().padStart(2, '0')}`;
    }
}

      function calculerDureeEntre(heureDebut: string, dateFin: Date): string {
  const [h, m] = heureDebut.split(':').map(Number);
  const debut = new Date();
  debut.setHours(h, m, 0, 0);

  const diffMs = dateFin.getTime() - debut.getTime();
  if (diffMs <= 0) return '0 min';

    const totalMin = Math.round(diffMs / 60000);
    const heures = Math.floor(totalMin / 60);
    const minutes = totalMin % 60;

    if (heures === 0) return `${totalMin} min`;
    if (minutes === 0) return `${heures} h`;
    return `${heures} h ${minutes} min`;
    }




    $: duree = calculerDuree(mancheStartTime);

     let interval: number | null = null;

onMount(() => {
  if (!browser) return;

  interval = window.setInterval(() => {
    duree = calculerDuree(mancheStartTime);
  }, 60000);
});

onDestroy(() => {
  if (interval !== null) {
    clearInterval(interval);
  }
});






    function getSoloButtons(code: string): number[] {
    const base = getSoloBasePlis(code);

    // règle : on propose 3 en moins que le nombre de plis annoncés
    const min = base - 3; // S6 -> 3, S7 -> 4, S8 -> 5

    const buttons: number[] = [];
    for (let n = min; n <= 8; n++) {
        buttons.push(n);
    }
    return buttons;
}

  
function getEmballageBasePlis(code: string): number {
    switch (code) {
        case "E8":
            return 8;
        case "E9":
            return 9;
        case "E10":
            return 10;
        case "E11":
            return 11;
        case "E12":
            return 12;
        case "E13":
            return 13;
        default:
            // valeur par défaut au cas où
            return 8;
    }
}

function getEmballageButtons(code: string): number[] {
    const base = getEmballageBasePlis(code);

    // règle : on propose 4 en moins que l’annonce
    const min = base - 4; // E8 → 4, E9 → 5, ..., E13 → 9

    const buttons: number[] = [];
    for (let n = min; n <= 13; n++) {
        buttons.push(n);
    }
    return buttons;
}
  
function isSoloFail(code: string, value: number): boolean {
    return value < getSoloBasePlis(code);
}

function isEmballageFail(code: string, value: number): boolean {
    return value < getEmballageBasePlis(code);
}
  
function clearPlayerData(player: string) {
    plis = { ...plis, [player]: undefined };
    resultats = { ...resultats, [player]: undefined };
    dames = { ...dames, [player]: undefined };
    emballes = { ...emballes, [player]: "" };
}

      function clearAllPlayersData() {
    const newPlis: Record<string, number> = {};
    const newResultats: Record<string, string> = {};
    const newDames: Record<string, number> = {};
    const newEmb: Record<string, string>
      = {};

      for (const p of players) {
      newPlis[p] = undefined;
      newResultats[p] = undefined;
      newDames[p] = undefined;
      newEmb[p] = "";
      }

      plis = newPlis;
      resultats = newResultats;
      dames = newDames;
      emballes = newEmb;
      }


      function handleAnnonceChange(player: string, code: string) {
      markMancheDirty();
      // Si l'utilisateur efface l'annonce
      if (!code) {
      clearPlayerData(player);
      annonceByPlayer = { ...annonceByPlayer, [player]: "" };
      saveDraftLocallyAndRemotely();
      return;
      }

      // ⏰ Si c'est la première annonce de la donne 1,
      // on mémorise l'heure de début de la manche
      if (!mancheStartTime && donneNumber === 1) {
      const now = new Date();
      mancheStartTime  = formatHeure(now);
      // Pour la DB
      mancheStartDate = now.toISOString();
      void saveMancheStartToServer();
      }

      const template = getTemplateForAnnonce(code);
      const copy = { ...annonceByPlayer };

      // On nettoie toujours les données du joueur qui change d'annonce
      clearPlayerData(player);

      // 🔥 RÈGLE 3 : DAMES = TOUT LE MONDE D
      if (code === "D") {
      clearAllPlayersData();

      for (const p of players) {
      copy[p] = "D";
      }
      annonceByPlayer = copy;
      soloPlayer = null;

      saveDraftLocallyAndRemotely();
      scrollToResultSection();
      return;
      }

      // 🔥 RÈGLE 1 : Templates 1,2,3 + TROU → UN SEUL joueur
      if (template === 1 || template === 2 || template === 3 || code === "TR") {
      for (const p of players) {
      if (p !== player) {
      copy[p] = "";
      clearPlayerData(p);
      }
      }
      copy[player] = code;
      annonceByPlayer = copy;
      soloPlayer = player;
      checkArbitreRequirement(code, player);

      saveDraftLocallyAndRemotely();

      if (template !== 2 && code !== "TR") {
    // jeux solo / autres → on va directement à l’encodage
    scrollToResultSection();
  } else {
    // emballage ou trou → on va d’abord sur "Avec qui ?"
    setTimeout(() => scrollToEmballage(player), 0);
  }

  return;
}


      // 🔥 RÈGLE 2 : Templates 4 (jeux à 2 joueurs)
      if (template === 4) {
      for (const p of players) {
      if (p !== player && getTemplateForAnnonce(copy[p]) !== 4) {
        copy[p] = "";
        clearPlayerData(p);
      }
    }

    const joueursAvecTemplate4 = Object.entries(copy).filter(
      ([_, c]) => getTemplateForAnnonce(c) === 4
    );

    if (
      joueursAvecTemplate4.length >= 2 &&
      !joueursAvecTemplate4.some(([p]) => p === player)
    ) {
      alert("Seulement deux joueurs peuvent choisir cette annonce à 2 joueurs.");
      return;
    }

    const autre = joueursAvecTemplate4.find(
      ([p]) => p !== player && copy[p] !== code
    );
    if (autre) {
      alert(
        `L'autre joueur a déjà choisi ${autre[1]}. Vous devez choisir la même annonce.`
      );
      return;
    }

    copy[player] = code;
    annonceByPlayer = copy;
    soloPlayer = null;
    checkArbitreRequirement(code, player);

    saveDraftLocallyAndRemotely();
    
    // ✅ Scroll UNIQUEMENT quand on vient d'atteindre 2 joueurs sur ce template
    const nbTemplate4 = Object.values(annonceByPlayer).filter(
      (c) => getTemplateForAnnonce(c) === 4
    ).length;

    if (nbTemplate4 === 2) {
      scrollToResultSection();
    }
    return;
  }

  // 🔥 Autres cas → simple assignation
  copy[player] = code;
  annonceByPlayer = copy;
  soloPlayer = null;
  checkArbitreRequirement(code, player);

  saveDraftLocallyAndRemotely();
   scrollToResultSection();
}

function handleEmballageChange(player: string) {
 markMancheDirty();
  // si un partenaire est choisi
  if (emballes[player]) {
    saveDraftLocallyAndRemotely();
    scrollToResultSection();
  } else {
    // juste sauvegarder si on efface le partenaire
    saveDraftLocallyAndRemotely();
  }
}


function findRowPlis(code: string, plisFaits: number, nbJoueursDedans: number): GrilleRowPlis | undefined {
    return GRILLE_RESULTATS.find(
        (r): r is GrilleRowPlis =>
            r.kind === 'plis' &&
            r.code === code &&
            r.nbJoueursDedans === nbJoueursDedans &&
            r.plisFaits === plisFaits
    );
}

function findRowEtat(code: string, etat: EtatJeu, nbJoueursDedans: number): GrilleRowEtat | undefined {
    return GRILLE_RESULTATS.find(
        (r): r is GrilleRowEtat =>
            r.kind === 'etat' &&
            r.code === code &&
            r.nbJoueursDedans === nbJoueursDedans &&
            r.etat === etat
    );
}

function initScores(): Record<string, number> {
    const scores: Record<string, number> = {};
    for (const p of players) {
        scores[p] = 0;
    }
    return scores;
}


function getEtatJeuPourCode(
    code: string,
    joueursAnnonce: string[],
    resultatsMap: Record<string, string>
): EtatJeu | null {
    const etats = joueursAnnonce.map((p) => resultatsMap[p]);

    const nbReussi = etats.filter((e) => e === 'Réussi').length;
    const nbRate   = etats.filter((e) => e === 'Raté').length;
    const nbCapot  = etats.filter((e) => e === 'Capot').length;

    if (nbCapot > 0) return 'Capot';
    if (nbReussi > 0 && nbRate > 0) return 'RéussiRaté';
    if (nbReussi === joueursAnnonce.length) return 'Réussi';
    if (nbRate === joueursAnnonce.length)   return 'Raté';

    return null;
}

function displayScoreValue(ligne: LigneFeuillePoints, player: string): string {
  const s = ligne.scores[player]?.score ?? 0;
  return s === 0 ? '' : String(s);
}

function computeScoresForState(
    playersList: string[],
    annonceMap: Record<string, string>,
    emballesMap: Record<string, string>,
    plisMap: Record<string, number>,
    resultatsMap: Record<string, string>,
    damesMap: Record<string, number>,
    inactivePlayers: string[] = []
): Record<string, number> {
    const inactiveSet = new Set(inactivePlayers);
    const activePlayers = playersList.filter(p => !inactiveSet.has(p));

    // Toujours un objet score pour tous les joueurs
    const scores: Record<string, number> = {};
    for (const p of playersList) {
        scores[p] = 0;
    }

    // On ne regarde que ceux qui jouent
    const joueursAvecAnnonce = activePlayers.filter((p) => !!annonceMap[p]);
    if (joueursAvecAnnonce.length === 0) {
        return scores;
    }

    const premier = joueursAvecAnnonce[0];
    const code = annonceMap[premier];
    const template = getTemplateForAnnonce(code);

    // ===== JEUX À PLIS (solo / emballage) =====
    if (template === 1 || template === 2) {
        let joueursDedans: string[] = [];
        let nbJoueursDedans = 0;

        if (template === 1) {
            // SOLO : 1 joueur dedans
            joueursDedans = [premier];
            nbJoueursDedans = 1;
        } else {
            // EMBALLAGE : l'annonceur + son partenaire
            const partenaire = emballesMap[premier];
            if (!partenaire || inactiveSet.has(partenaire)) {
                // partenaire inexistant ou inactif → on ne score pas cette donne
                return scores;
            }
            joueursDedans = [premier, partenaire];
            nbJoueursDedans = 2;
        }

        const plisRef = plisMap[premier];
        if (typeof plisRef !== 'number') {
            return scores;
        }

        const row = findRowPlis(code, plisRef, nbJoueursDedans);
        if (!row) return scores;

        const s = row.resultatInd;
        const total = row.resultatJeu;

        const A = nbJoueursDedans;
        const N = activePlayers.length - A;

        // points des joueurs "dedans"
        for (const p of joueursDedans) {
            scores[p] += s;
        }

        // répartition sur les autres joueurs actifs
        if (N > 0) {
            const y = (total - A * s) / N;
            for (const p of activePlayers) {
                if (!joueursDedans.includes(p)) {
                    scores[p] += y;
                }
            }
        }

        return scores;
    }

    // ===== TROU (TR) : cas spécial à 2 joueurs =====
    if (code === 'TR') {
        const annonceur = premier;
        const partenaire = emballesMap[annonceur];

        if (!partenaire || inactiveSet.has(partenaire)) {
            return scores;
        }

        const etat = resultatsMap[annonceur] as EtatJeu | undefined;
        if (!etat) return scores;

        const row = findRowEtat('TR', etat, 2);
        if (!row) return scores;

        const joueursDedans = [annonceur, partenaire];
        const s = row.resultatInd;
        const total = row.resultatJeu;
        const A = 2;
        const N = activePlayers.length - A;

        for (const p of joueursDedans) {
            scores[p] += s;
        }

        if (N > 0) {
            const y = (total - A * s) / N;
            for (const p of activePlayers) {
                if (!joueursDedans.includes(p)) {
                    scores[p] += y;
                }
            }
        }

        return scores;
    }

    // ===== DAMES (template 6) =====
    if (template === 6) {
        const totalDames = activePlayers.reduce(
            (acc, p) => acc + (damesMap[p] ?? 0),
            0
        );

        if (totalDames !== MAX_DAMES) {
            return scores;
        }

        const everyoneHasOne = activePlayers.every(
            (p) => (damesMap[p] ?? 0) === 1
        );

        if (everyoneHasOne) {
            for (const p of activePlayers) {
                scores[p] += -3;
            }
            return scores;
        }

        const totalDamesNeg = -3 * totalDames;
        const zeroDamesPlayers = activePlayers.filter(
            (p) => (damesMap[p] ?? 0) === 0
        );
        const nbZero = zeroDamesPlayers.length;

        for (const p of activePlayers) {
            const nb = damesMap[p] ?? 0;
            if (nb > 0) {
                scores[p] += -3 * nb;
            }
        }

        if (nbZero > 0) {
            const bonus = -totalDamesNeg / nbZero;
            for (const p of zeroDamesPlayers) {
                scores[p] += bonus;
            }
        }

        return scores;
    }

    // ===== AUTRES JEUX À ÉTAT (PM, PM2, P, P2, GM, GM2, PME2, GME2, etc.) =====
    const joueursCode = joueursAvecAnnonce.filter((p) => annonceMap[p] === code);
    const nbJoueursDedans = joueursCode.length;

    if (nbJoueursDedans === 0) {
        return scores;
    }

    const etat = getEtatJeuPourCode(code, joueursCode, resultatsMap);
    if (!etat) return scores;

    const row = findRowEtat(code, etat, nbJoueursDedans);
    if (!row) return scores;

    const total = row.resultatJeu;

    if (etat === 'RéussiRaté') {
        const gagnants = joueursCode.filter((p) => resultatsMap[p] === 'Réussi');
        const perdants = joueursCode.filter((p) => resultatsMap[p] === 'Raté');

        const s = row.resultatInd;
        const A = gagnants.length + perdants.length;
        const N = activePlayers.length - A;

        for (const p of gagnants) scores[p] += s;
        for (const p of perdants) scores[p] -= s;

        if (N > 0) {
            const y = total / N;
            for (const p of activePlayers) {
                if (!gagnants.includes(p) && !perdants.includes(p)) {
                    scores[p] += y;
                }
            }
        }
        return scores;
    } else {
        const s = row.resultatInd;
        const A = nbJoueursDedans;
        const N = activePlayers.length - A;

        for (const p of joueursCode) {
            scores[p] += s;
        }

        if (N > 0) {
            const y = (total - A * s) / N;
            for (const p of activePlayers) {
                if (!joueursCode.includes(p)) {
                    scores[p] += y;
                }
            }
        }
        return scores;
    }
}


function computePreviewScores(): Record<string, number> {
    const inactive = getInactivePlayersForDonne(donneNumber, players);

    return computeScoresForState(
        players,
        annonceByPlayer,
        emballes,
        plis,
        resultats,
        dames,
        inactive
    );
}

type LigneFeuillePoints = {
    donneNumber: number;
    annonce: string | null;  // ⬅️ ajouté
    scores: Record<string, { score: number; cumul: number }>;
};

let feuillePoints: LigneFeuillePoints[] = [];

// Recalcule la feuille à partir de l'historique
function recomputeFeuillePoints() {
    const cumul: Record<string, number> = {};
    for (const p of players) {
        cumul[p] = 0;
    }

    const lignes: LigneFeuillePoints[] = [];

    for (const donne of history) {
        // On reconstruit les maps pour cette donne
        const annonceMap: Record<string, string> = {};
        const emballesMap: Record<string, string> = {};
        const plisMap: Record<string, number> = {};
        const resultatsMap: Record<string, string> = {};
        const damesMap: Record<string, number> = {};

        for (const p of players) {
            annonceMap[p] = '';
            emballesMap[p] = '';
            plisMap[p] = undefined as any;
            resultatsMap[p] = '';
            damesMap[p] = undefined as any;
        }

        // On injecte ce qui vient de l'historique
        for (const j of donne.joueurs) {
            if (j.annonce) annonceMap[j.nom] = j.annonce;
            if (j.emballageAvec) emballesMap[j.nom] = j.emballageAvec;
            if (j.plis !== null && j.plis !== undefined) plisMap[j.nom] = j.plis;
            if (j.resultat) resultatsMap[j.nom] = j.resultat;
            if (j.dames !== null && j.dames !== undefined) damesMap[j.nom] = j.dames;
        }

     const inactive = getInactivePlayersForDonne(donne.donneNumber, players);

const scoresDonne = computeScoresForState(
    players,
    annonceMap,
    emballesMap,
    plisMap,
    resultatsMap,
    damesMap,
    inactive
);


// Trouver l’annonce principale de la donne
let annoncePrincipale: string | null = null;
const joueurAnnonceur = donne.joueurs.find(j => j.annonce);
if (joueurAnnonceur) {
    annoncePrincipale = joueurAnnonceur.annonce;
}

        const scoresLigne: Record<string, { score: number; cumul: number }> = {};
        for (const p of players) {
            const s = scoresDonne[p] ?? 0;
            cumul[p] += s;
            scoresLigne[p] = { score: s, cumul: cumul[p] };
        }

        lignes.push({
            donneNumber: donne.donneNumber,
            annonce: annoncePrincipale,
            scores: scoresLigne
        });
    }

    feuillePoints = lignes;
}

// Réactif : dès que players ou history changent, on recalcule
$: {
    players;
    history;
    recomputeFeuillePoints();
}




$: {
    annonceByPlayer;
    resultats;
    plis;
     dames;  
    players;
    previewScores = computePreviewScores();
}

$: scoresCumulés = (() => {
    if (feuillePoints.length === 0) return {};

    const last = feuillePoints[feuillePoints.length - 1];

    const result: Record<string, number>
      = {};
      for (const p of players) {
      result[p] = last.scores[p]?.cumul ?? 0;
      }

      return result;
      })();

      // Score maximum actuel (pour surligner le/les gagnant(s))
      $: leaderScore = players.length
      ? Math.max(...players.map((p) => scoresCumulés[p] ?? 0))
      : 0;

      type ClassementItem = {
      nom: string;
      score: number;
      };

      let classementFinal: ClassementItem[] = [];
      let rankByPlayer: Record<string, number> = {};

      let winnerNames = '';

      $: {classementFinal = players
      .map((p) => ({
      nom: p,
      score: scoresCumulés[p] ?? 0
      }))
      .sort((a, b) => b.score - a.score);
      
        rankByPlayer = {};
  classementFinal.forEach((item, index) => {
    rankByPlayer[item.nom] = index + 1; // 1 = premier, 2 = deuxième, ...
  });
}
      
   

      $: winnerNames = classementFinal.length
      ? classementFinal
      .filter((j) => j.score === leaderScore)
      .map((j) => j.nom)
      .join(', ')
      : '';


      // Bouton visible dès qu'au moins une annonce est choisie
      $: showValidateButton = !mancheTerminee && players.some((p) => annonceByPlayer[p]);



      // Bouton cliquable seulement si tout est correctement encodé
      $: canValidateDonne = (() => {
      const joueursAvecAnnonce = players.filter((p) => annonceByPlayer[p]);
      if (joueursAvecAnnonce.length === 0) return false;

      for (const p of joueursAvecAnnonce) {
      const code = annonceByPlayer[p];
      const template = getTemplateForAnnonce(code);

      // Template 1 & 2 : annonces à plis
      if (template === 1 || template === 2) {
      // un joueur inactif ne devrait pas avoir d'annonce
      if (inactivePlayersCurrentDonne.includes(p)) {
      return false;
      }

      if (typeof plis[p] !== 'number') return false;
      // si emballage, partenaire obligatoire
      if (template === 2 && !emballes[p]) return false;
      }

      // Trou : partenaire obligatoire aussi, même si template = 5
      if (code === 'TR' && !emballes[p]) {
      return false;
      }

      // Template 3, 4, 5 : Réussi / Raté / Capot
      if (template === 3 || template === 4 || template === 5) {
      if (inactivePlayersCurrentDonne.includes(p)) {
      // joueur inactif → ne devrait pas avoir de résultat
      if (resultats[p]) return false;
      continue;
      }

      if (!resultats[p]) return false;
      }

      // Template 6 : Dames
      if (template === 6) {
      // si joueur inactif → on n'exige rien pour lui
      if (inactivePlayersCurrentDonne.includes(p)) {
      continue;
      }

      if (typeof dames[p] !== 'number') return false;
      }
      }

      // 🔥 RÈGLE SUPPLÉMENTAIRE POUR LES JEUX À 2 JOUEURS (template 4)
      const joueursTemplate4 = joueursAvecAnnonce.filter(
      (p) =>
      !inactivePlayersCurrentDonne.includes(p) &&
      getTemplateForAnnonce(annonceByPlayer[p]) === 4
      );

      if (joueursTemplate4.length === 1) {
      // Un seul joueur a choisi un jeu à 2 → donne invalide
      return false;
      }

      if (joueursTemplate4.length > 0) {
      const codes4 = joueursTemplate4.map((p) => annonceByPlayer[p]);
      const firstCode4 = codes4[0];

      // Tous les joueurs template 4 doivent avoir la même annonce
      if (!codes4.every((c) => c === firstCode4)) {
      return false;
      }

      // Par sécurité : pas plus de 2 joueurs
      if (joueursTemplate4.length > 2) {
      return false;
      }
      }

      // 🔥 RÈGLE SUPPLÉMENTAIRE POUR LES DAMES :
      // On ne regarde que les joueurs ACTIFS qui ont D
      const joueursDames = players.filter(
      (p) =>
      annonceByPlayer[p] &&
      getTemplateForAnnonce(annonceByPlayer[p]) === 6 &&
      !inactivePlayersCurrentDonne.includes(p)
      );

      if (joueursDames.length > 0) {
      const totalDames = joueursDames.reduce(
      (acc, p) => acc + (dames[p] ?? 0),
      0
      );
      if (totalDames !== MAX_DAMES) {
      return false;
      }
      }

      return true;
      })();




      function handleInput(player: string, value: string | number) {
      const template = getTemplateForAnnonce(annonceByPlayer[player]);

      if (template === 1 || template === 2) {
      plis[player] = +value;
      plis = { ...plis };
      } else if (template === 3 || template === 4 || template === 5) {
      resultats[player] = value as string;
      resultats = { ...resultats };
      } else if (template === 6) {
      dames[player] = +value;
      dames = { ...dames };
      }
      markMancheDirty();
      saveDraftLocallyAndRemotely();
      scrollToPreviewScores();
      }




async function sendFeuillePointsByEmail(doc: jsPDF) {
  // ✅ jsPDF fournit directement un data URI en base64
  const dataUri = doc.output('datauristring');   // "data:application/pdf;base64,AAAA..."
  const pdfBase64 = dataUri.split(',')[1];      // on garde juste la partie base64

  console.log('Longueur base64 PDF :', pdfBase64.length);

  const payload = {
    tableName,
    mancheNumber: Number(mancheNumber),
    competitionType,
    competitionNumber,
      competitionTypeLabel,
  competitionSubtypeLabel,
    pdfBase64,
    fileName: `Feuille_points_Table_${tableName}_Manche_${mancheNumber}.pdf`,
    recipient: 'contact@wb-scoring.com',
  };

  try {
    const res = await fetch(`${API_BASE_URL}/api/reports/feuille-points-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    console.log('Status envoi email :', res.status);

    if (!res.ok) {
      console.error('Erreur envoi email feuille de points', await res.text());
    } else {
      console.log('Email envoyé (API OK)');
    }
  } catch (e) {
    console.error('Erreur réseau envoi email feuille de points', e);
  }
}

        
        
        

      //
async function exportFeuillePointsPdf(options?: { sendByEmail?: boolean }) {
  const sendByEmail = options?.sendByEmail ?? false;
  if (!feuillePoints.length) {
    alert('Aucune donne pour la feuille de points.');
    return;
  }

  const doc = new jsPDF({
  orientation: 'l',
  unit: 'pt',
  format: 'a4',
  compress: true   // ✅ compression
});
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 🎨 Palette
  const darkBg = [2, 5, 6];          // bandeau noir / très sombre
  const pageBg = [4, 20, 11];        // fond de page vert foncé (#04140b)
  const tableBase = [2, 11, 6];      // fond table
  const tableAlt = [4, 20, 11];
  const headPlayer = [20, 83, 45];
  const headSecond = [4, 19, 11];
  const gold = [250, 191, 36];
  const softAccent = [254, 243, 199];
  const lightText = [239, 239, 239];
  const greyHeader = [156, 163, 175];
  const borderDark = [55, 65, 81];
  const mutedText = [140, 140, 140];

  // 🟩 1) FOND DE PAGE COMPLET (vert foncé)
  doc.setFillColor(pageBg[0], pageBg[1], pageBg[2]);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

// 🔤 info compétition (avec labels de la home)
const competitionTypeText =
  competitionTypeLabel?.trim() ||
  (competitionType != null ? String(competitionType) : '');

const competitionSubtypeText =
  competitionSubtypeLabel?.trim() ||
  (competitionNumber != null ? String(competitionNumber) : '');

const competitionLine = [competitionTypeText, competitionSubtypeText]
  .filter((x) => x && x.trim() !== '')
  .join(' – ');


  // 🧱 2) BANDEAU HAUT + LOGO NON DÉFORMÉ
  try {
    const img = new Image();
    img.src = '/Logo_App_Rond_T_NB.png';

    await new Promise<void>
      ((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => reject(e);
      });

      // Bandeau noir par-dessus le fond vert
      doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
      doc.rect(0, 0, pageWidth, 90, 'F');

      // ✅ Respect du ratio du logo
      const logoTargetWidth = 60;
      const ratio = img.height / img.width;
      const logoTargetHeight = logoTargetWidth * ratio;

      doc.addImage(
      img,
      'PNG',
      30,
      15 + (60 - logoTargetHeight) / 2,
      logoTargetWidth,
      logoTargetHeight
      );
      } catch {
      // si logo KO : on garde quand même le bandeau
      doc.setFillColor(darkBg[0], darkBg[1], darkBg[2]);
      doc.rect(0, 0, pageWidth, 90, 'F');
      }

      // 🧾 TITRES
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(249, 176, 0);
      doc.text('Feuille de points', pageWidth / 2, 32, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(lightText[0], lightText[1], lightText[2]);
      doc.text(
      `Table ${tableName} – Manche ${mancheNumber}`,
      pageWidth / 2,
      52,
      { align: 'center' }
      );

      // 🌟 ligne compétition (juste sous "Table / Manche")
      if (competitionLine) {
      doc.setFontSize(9.5);
      doc.setTextColor(222, 222, 222);
      doc.text(competitionLine, pageWidth / 2, 68, { align: 'center' });
      }

      // Liste des joueurs
      const joueursStr = players.join(' • ');
      doc.setFontSize(9);
      doc.setTextColor(lightText[0], lightText[1], lightText[2]);
      doc.text(joueursStr, pageWidth / 2, 84, {
      align: 'center',
      maxWidth: pageWidth - 160
      });


      // ✨ Infos de manche (début / fin / durée) sous la ligne des joueurs
      if (mancheStartTime || mancheEndTime || dureeManche) {
      const start = mancheStartTime ?? '-';
      const end = mancheEndTime ?? '-';
      const dureeTxt = dureeManche ?? '-';

      doc.setFontSize(9);
      doc.setTextColor(249, 176, 0); // un peu comme dans la modale

      doc.text(
      `Début : ${start}    Fin : ${end}    Durée : ${dureeTxt}`,
      pageWidth / 2,
      100,
      { align: 'center' }
      );
      }


      // 📅 Date / heure
      const now = new Date();
      const dateStr = now.toLocaleDateString();
      const timeStr = now.toLocaleTimeString().slice(0, 5);

      doc.setFontSize(8);
      doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);
      doc.text(`Généré le ${dateStr} à ${timeStr}`, pageWidth - 40, 25, {
      align: 'right'
      });

      // ─────────────  TABLEAU  ─────────────

      const headRow1 = ['Donne', 'Annonce', ...players.flatMap((p) => [p.toUpperCase(), ''])];
      const headRow2 = ['', '', ...players.flatMap(() => ['Score', 'Cumul'])];
      const head = [headRow1, headRow2];

      const totalColumns = 2 + players.length * 2;
      const body: any[] = [];

      // On reproduit la logique de la modale avec feuillePointsAvecTotal
      feuillePointsAvecTotal.forEach((ligne, idx) => {
      // 🌿 Cas "ligne totale" => on insère espace + CLASSEMENT
      if (ligne.isTotal) {
      // 1) ligne vide (spacer)
      const spacer: any[] = new Array(totalColumns).fill('');
      (spacer as any)._type = 'spacer';
      body.push(spacer);

      // 2) ligne CLASSEMENT
      const classement: any[] = new Array(totalColumns).fill('');
      classement[1] = 'CLASSEMENT'; // colonne "Annonce"
      (classement as any)._type = 'classement';
      (classement as any)._rankByPlayer = rankByPlayer; // { [nom]: rang }
      body.push(classement);
      return;
      }

      // 🌱 Lignes normales (donnes)
      const row: any[] = [];

      row[0] = (ligne.donneNumber ?? '').toString();
      row[1] = ligne.annonce ?? '';

      const inactivePlayers = getInactivePlayersForDonne(ligne.donneNumber, players);
      const scoreValues: Record<string, number>= {};

        for (const p of players) {
        let displayScore = '';
        let numericScore: number | null = null;

        if (inactivePlayers.includes(p)) {
        displayScore = '-';
        } else {
        const val = displayScoreValue(ligne, p);
        numericScore = val;
        displayScore = val === 0 ? '' : String(val);
        }

        const cumul = ligne.scores?.[p]?.cumul ?? 0;

        row.push(displayScore);         // colonne "Score"
        row.push(String(cumul));        // colonne "Cumul"

        if (numericScore !== null) {
        scoreValues[p] = numericScore;
        }
        }

        (row as any)._type = 'normal';
        (row as any)._isLastDonne = idx === lastDonneIndex; // pour surlignage cumul final
        (row as any)._scoreValues = scoreValues;            // pour repérer les négatifs
        body.push(row);
        });

        autoTable(doc, {
        head,
        body,
        startY: 120,
        styles: {
        fontSize: 8,
        halign: 'center',
        valign: 'middle',
        cellPadding: 4,
        fillColor: tableBase,
        textColor: lightText,
        lineColor: borderDark,
        lineWidth: 0.6
        },
        bodyStyles: {
        fillColor: tableBase,
        textColor: lightText
        },
        alternateRowStyles: {
        fillColor: tableAlt
        },
        headStyles: {
        fillColor: tableBase,
        textColor: lightText,
        fontStyle: 'bold'
        },
        margin: { top: 115, left: 30, right: 30, bottom: 55 },
        columnStyles: {
        0: { cellWidth: 45, halign: 'center' },
        1: { cellWidth: 75, halign: 'left' }
        },

        didParseCell(data) {
        const { section, row, column, cell } = data;

        // ----- EN-TÊTES -----
        if (section === 'head') {
        const r = row.index;
        const c = column.index;

        if (r === 0) {
        // Ligne 1 d'en-tête
        if (c === 0 || c === 1) {
        cell.rowSpan = 2;
        cell.styles.fillColor = headSecond;
        cell.styles.textColor = lightText;
        cell.styles.fontSize = 8.5;
        cell.styles.fontStyle = 'bold';
        } else if (c >= 2 && c % 2 === 0) {
        // Nom du joueur (colspan=2)
        cell.colSpan = 2;
        cell.styles.fillColor = headPlayer;
        cell.styles.textColor = [254, 249, 195];
        cell.styles.fontSize = 9.2;
        cell.styles.fontStyle = 'bold';
        cell.styles.lineWidth = 1;
        cell.styles.lineColor = gold;
        } else {
        cell.text = '';
        }
        }

        if (r === 1) {
        // Ligne 2 d'en-tête : "Score" / "Cumul"
        cell.styles.fillColor = headSecond;
        cell.styles.textColor = greyHeader;
        cell.styles.fontSize = 7.5;
        cell.styles.fontStyle = 'normal';
        }

        // Trait vertical après "Annonce"
        if (c === 1) {
        cell.styles.lineColor = borderDark;
        cell.styles.lineWidth = 1.2;
        }

        // Colonnes "Cumul"
        if (c >= 2 && c % 2 === 1) {
        cell.styles.lineColor = borderDark;   // même contour que le reste
        cell.styles.lineWidth = 0.6;
        }

        return;
        }

        // ----- CORPS -----
        if (section === 'body') {
        const c = column.index;
        const raw: any = row.raw || {};

        // Séparateur après "Annonce"
        if (c === 1) {
        cell.styles.lineColor = borderDark;
        cell.styles.lineWidth = 1.2;
        }

        // Colonnes "Cumul"
        if (c >= 2 && c % 2 === 1) {
        cell.styles.lineColor = borderDark;
        cell.styles.lineWidth = 0.6;
        }


        // 🌿 LIGNE ESPACE (SPACER)
        if (raw._type === 'spacer') {
        cell.styles.fillColor = pageBg;
        cell.styles.textColor = pageBg;
        cell.text = [''];
        cell.styles.lineWidth = 0;
        return;
        }

        // 🏆 LIGNE CLASSEMENT
        if (raw._type === 'classement') {
        // Fond légèrement différent
        cell.styles.fillColor = [15, 23, 42];
        cell.styles.textColor = [249, 250, 251];
        cell.styles.fontStyle = 'bold';

        // Colonne "CLASSEMENT"
        if (c === 1) {
        cell.styles.fillColor = [30, 41, 59];
        cell.styles.textColor = [249, 250, 251];
        cell.styles.fontSize = 9;
        cell.styles.halign = 'center';
    
        }

      


        // Colonnes joueurs
        if (c >= 2) {
        const playerIndex = Math.floor((c - 2) / 2);
        const isScoreCol = c % 2 === 0;
        const playerName = players[playerIndex];
        const rank = raw._rankByPlayer?.[playerName] ?? '-';

        if (isScoreCol) {
        // On fusionne Score + Cumul (colSpan = 2) pour écrire le rang au centre
        cell.colSpan = 2;
        cell.styles.fillColor = gold;
        cell.styles.textColor = [17, 24, 39];
        cell.styles.fontSize = 9.5;
        cell.styles.halign = 'center';

        cell.text = [String(rank)];
        if (rank === 1) {
        // Petit bonus possible : 👑 pour le vainqueur
        cell.text = ['1'];
        }
        } else {
        // La 2e cellule (Cumul) du joueur est vidée (le colSpan la recouvre)
        cell.text = [''];
        }
        }

        return;
        }

        // 🌱 LIGNES NORMALES
        if (raw._type === 'normal') {
        // Score négatif en rouge (UNIQUEMENT colonne "Score")
        if (c >= 2 && c % 2 === 0) {
    const rawText = (cell.text?.[0] ?? '').trim(); // ex: "-24", "", "-"
    const val = parseInt(rawText, 10);

    if (!isNaN(val) && val < 0) {
      cell.styles.textColor = [255, 120, 120]; // rouge bien visible
      cell.styles.fontStyle = 'bold';
    }
  }

  // Cumul final (dernière donne) surligné
  if (raw._isLastDonne && c >= 2 && c % 2 === 1) {
    cell.styles.fillColor = [34, 197, 94]; // vert "victoire"
    cell.styles.textColor = [0, 0, 0];
    cell.styles.fontStyle = 'bold';
    cell.styles.lineColor = gold;
    cell.styles.lineWidth = 1.4;
  }
}

        }
        },
didDrawCell(data) {
  const { cell, column } = data;
  const c = column.index;

  // Index max = dernière colonne (Cumul du dernier joueur)
  const lastColIndex = 2 + players.length * 2 - 1;

  // 👉 On veut une ligne dorée :
  //  - après "Annonce" (c === 1)
  //  - après chaque colonne "Cumul" des joueurs (3, 5, 7, ..., lastColIndex)
  const isAfterAnnonce = c === 1;
  const isAfterCumul   = c >= 3 && c % 2 === 1;

  if (!isAfterAnnonce && !isAfterCumul) return;

  // Coordonnées du bord droit de la cellule
  const x = cell.x + cell.width;
  const y1 = cell.y;
  const y2 = cell.y + cell.height;

  // Style des traits dorés
  doc.setDrawColor(gold[0], gold[1], gold[2]);

  // On peut faire un trait un peu moins épais après "Annonce"
  if (isAfterAnnonce) {
    doc.setLineWidth(1.2);
  } else {
    doc.setLineWidth(1.6); // entre les blocs de joueurs
  }

  doc.line(x, y1, x, y2);
},


        didDrawPage(data) {
        const { pageNumber } = data;
        const totalPages = (doc as any).internal.getNumberOfPages
        ? (doc as any).internal.getNumberOfPages()
        : pageNumber;

        doc.setDrawColor(90, 90, 90);
        doc.setLineWidth(0.5);
        doc.line(30, pageHeight - 35, pageWidth - 30, pageHeight - 35);

        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(mutedText[0], mutedText[1], mutedText[2]);

        doc.text(
        'Whist Bridgé Scoring – Tous droits réservés – contact@wb-scoring.com',
        pageWidth / 2,
        pageHeight - 22,
        { align: 'center' }
        );

        doc.text(
        `Page ${pageNumber}/${totalPages}`,
        pageWidth - 40,
        pageHeight - 22,
        { align: 'right' }
        );
        }
        });


        if (sendByEmail) {
        await sendFeuillePointsByEmail(doc);
        }

        doc.save(`Feuille_points_Table_${tableName}_Manche_${mancheNumber}.pdf`);
        }








        const MAX_DAMES = 4;

        function selectDames(player: string, value: number) {
        const totalAutres = Object.keys(dames)
        .filter((p) => p !== player)
        .reduce((acc, p) => acc + (dames[p] || 0), 0);

        if (totalAutres + value <= MAX_DAMES) {
    dames[player] = value;
    dames = { ...dames };
    markMancheDirty();
    saveDraftLocallyAndRemotely();
    }
    }


    function isDamesDisabled(player: string, value: number) {
    const totalAutres = Object.keys(dames)
    .filter(p => p !== player)
    .reduce((acc, p) => acc + (dames[p] || 0), 0);
    return totalAutres + value > MAX_DAMES;
    }



    function initValidations() {
    validations = {};
    for (const p of players) validations[p] = false;
    }

async function validate() {
  if (mancheTerminee) {
    return;
  }

  // 🔐 Empêcher double-clic / double appel
  if (isSubmittingDonne) {
    return;
  }
  isSubmittingDonne = true;

  try {
    // 1. Construire les infos par joueur
    const joueursPayload = players
      .map((p, index) => {
        const annonce = annonceByPlayer[p] || null;
        const infoArbitre = isArbitreRequis(annonce, p);

        const joueurPk = playerIds[index] ?? null;

        const partenaireAlias = emballes[p] || null;
        let partenairePk: number | null = null;

        if (partenaireAlias) {
          const idxPartenaire = players.indexOf(partenaireAlias);
          if (idxPartenaire !== -1) {
            partenairePk = playerIds[idxPartenaire] ?? null;
          }
        }

        return {
          nom: p,
          emballageAvec: partenaireAlias,
          joueurPk,
          partenairePk,
          annonce,
          plis: typeof plis[p] === 'number' ? plis[p] : null,
          resultat: resultats[p] || null,
          dames: typeof dames[p] === 'number' ? dames[p] : null,
          arbitre: infoArbitre.required
        };
      })
      .filter(
        (j) =>
          j.annonce !== null ||
          j.emballageAvec !== null ||
          j.plis !== null ||
          j.resultat !== null ||
          j.dames !== null
      );

    // Si personne n'a rien encodé → on ne fait rien
    if (joueursPayload.length === 0) {
      alert('Aucune annonce / aucun résultat encodé pour cette donne.');
      return;
    }

    const dealerIndex = donneNumber % players.length;
    const DealerPlayerId = playerIds[dealerIndex] ?? null;

    // 🔹 Calcul des scores de la donne courante (en tenant compte des joueurs inactifs)
    const inactive = getInactivePlayersForDonne(donneNumber, players);

    const scoresDonne = computeScoresForState(
      players,
      annonceByPlayer,
      emballes,
      plis,
      resultats,
      dames,
      inactive
    );

    // 🔹 Préparer le payload des scores à envoyer en DB
    const scoresPayload = {
      tableName,
      mancheNumber: Number(mancheNumber),
      donneNumber,
      SessionId,
      scores: players.map((p, index) => {
        const scoreDonne = scoresDonne[p] ?? 0;
        const cumulAvant = scoresCumulés[p] ?? 0;
        const cumulApres = cumulAvant + scoreDonne;

        return {
          joueur: p,
          joueurPk: playerIds[index] ?? null,
          score: scoreDonne,
          cumul: cumulApres
        };
      })
    };

    // 🔹 Payload de la donne (avec un ID client unique)
    const clientDonneId = generateClientDonneId();

    const donnePayload = {
      tableConfigId,
      tableName,
      mancheNumber: Number(mancheNumber),
      donneNumber,
      SessionId,
      DealerPlayerId,
      clientDonneId,
      joueurs: joueursPayload
    };

    console.log('Donne ajoutée à la file d’attente locale :', {
      donneNumber,
      donnePayload,
      scoresPayload
    });

    // 🔹 Ajouter à la file d’attente locale
    const pending: PendingDonne = {
      clientDonneId,
      donneNumber,
      donnePayload,
      scoresPayload
    };
    pendingDonnes = [...pendingDonnes, pending];
    savePendingToLocalStorage();


console.log(
  '[PENDING] Donne ajoutée en file d’attente',
  { donneNumber, clientDonneId, pendingCount: pendingDonnes.length }
);


    // 🔹 Ajouter cette donne à l'historique local (pour la feuille de points, etc.)
    const donneHistorique: DonneHistorique = {
      donneNumber,
      joueurs: joueursPayload
    };
    history = [...history, donneHistorique];

    // 🔚 Si c'était la dernière donne de la manche → on termine ici
    if (donneNumber >= rows) {
      const now = new Date();
      mancheEndTime = formatHeure(now);
      mancheEndDate = now.toISOString();

      if (mancheStartTime) {
        dureeManche = calculerDureeEntre(mancheStartTime, now);
      } else {
        dureeManche = null;
      }

      let dureeMinutes = 0;
      if (mancheStartDate) {
        const start = new Date(mancheStartDate);
        const diffMs = now.getTime() - start.getTime();
        if (diffMs > 0) {
          dureeMinutes = Math.floor(diffMs / 60000);
        }
      }

      // Envoi en DB (WhistTableConfig) → si ça plante, ce n’est pas bloquant
      saveMancheTimingToServer(dureeMinutes);

      mancheTerminee = true;
      markMancheClean();

      const v: Record<string, boolean> = {};
      for (const p of players) {
        v[p] = false;
      }
      validations = v;

      showEndOfMancheModal = true;

      showConfetti = true;
      setTimeout(() => {
        showConfetti = false;
      }, 4000);

      // 💌 Générer la feuille de points et l'envoyer par email
      await exportFeuillePointsPdf({ sendByEmail: true });

      resetDonneState();

      // 🔁 On tente d’envoyer toutes les donnes en attente,
      // mais on ne bloque pas l’UI si ça échoue
      flushPendingDonnes().catch((e) =>
        console.error('Erreur flush pendings en fin de manche', e)
      );

      return;
    }

    // 4. On passe à la donne suivante (les joueurs continuent à jouer)
    nextDonne();
    saveDraftLocallyAndRemotely();

    // 🔁 On essaie d'envoyer toutes les donnes en attente en arrière-plan
    flushPendingDonnes().catch((e) =>
      console.error('Erreur lors du flush des donnes pendantes', e)
    );

  } finally {
    isSubmittingDonne = false;
  }
}




// Type sécurisé optionnel, adapte si tu veux
type LigneFeuille = {
  donneNumber: number | string;
  annonce: string | null;
  scores: Record<string, { score: number; cumul: number }>;
  isTotal?: boolean;
};

// ...

// 🔥 Version étendue de la feuille de points avec ligne "Total" si manche terminée
$: feuillePointsAvecTotal = (() => {
  if (!feuillePoints || feuillePoints.length === 0) return [];

  // Manche finie si ton flag est à true ou si toutes les donnes sont jouées
  const mancheFinie = mancheTerminee || feuillePoints.length >= rows;

  if (!mancheFinie) {
    return feuillePoints;
  }

  const last = feuillePoints[feuillePoints.length - 1];

  const totalRow: LigneFeuille = {
    donneNumber: '',
    annonce: 'Total',
    scores: {},
    isTotal: true
  };

  for (const p of players) {
    const cumulFinal = last.scores?.[p]?.cumul ?? 0;

    (totalRow.scores as any)[p] = {
      score: 0,          // on ne l’utilisera pas à l’affichage
      cumul: cumulFinal
    };
  }

  return [...feuillePoints, totalRow];
})();

//
// 🔝 Cumul gagnant sur la ligne TOTAL
$: winnerCumul = (() => {
  if (!feuillePointsAvecTotal || feuillePointsAvecTotal.length === 0) return null;

  const totalRow = feuillePointsAvecTotal.find((l) => l.isTotal);
  if (!totalRow) return null;

  let max = -Infinity;
  for (const p of players) {
    const c = totalRow.scores?.[p]?.cumul ?? 0;
    if (c > max) max = c;
  }

  return max === -Infinity ? null : max;
})();


function clearLocalDrafts() {
  if (typeof window === 'undefined') return;

  const prefix = `${DRAFT_STORAGE_PREFIX}-${tableName}-t${competitionType ?? 'none'}-n${competitionNumber ?? 'none'}-m${mancheNumber}`;

  const keysToDelete: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(prefix)) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    localStorage.removeItem(key);
  }
}

async function goToNextManche() {
  markMancheClean();

  clearLocalDrafts(); // 🔥

  try {
    await fetch(`${API_BASE_URL}/api/draft/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
      tableConfigId,
        SessionId,
        tableName,
        mancheNumber: Number(mancheNumber),
        competitionType,
        competitionNumber
      })
    });
  } catch (err) {
    console.error("Erreur lors du nettoyage du draft serveur :", err);
  }

  goto('/home');
}


async function goBackHome() {
  markMancheClean();

  clearLocalDrafts(); // 🔥

  try {
    await fetch(`${API_BASE_URL}/api/draft/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        SessionId,
        tableName,
        mancheNumber: Number(mancheNumber),
        competitionType,
        competitionNumber
      })
    });
  } catch (e) {
    console.error("Erreur nettoyage draft serveur :", e);
  }

  goto('/');
}


function openScoreSheet() {
  // On ferme le modal de fin de manche si besoin
  showEndOfMancheModal = false;

  // Et on ouvre la feuille de points (le même mécanisme que ton bouton du haut)
  showFeuillePoints = true;
}


function closeFeuillePoints() {
  showFeuillePoints = false;

  // 💛 On restaure la modale Fin de Manche si elle était ouverte
  if (mancheTerminee) {
    showEndOfMancheModal = true;
  }
}

interface PayoutRow {
  rank: number;
  amount: number;
}

// Manche libre + jetons
let jetonsParJoueur: number | null = null;
let isLibreWithJetons = false;

// Répartition des gains
let payouts: PayoutRow[] = [];
let isLoadingPayouts = false;
let payoutError = '';

$: {
  const isLibre = competitionType === 3; // 3 = Manche Libre

  if (isLibre) {
    // 3 = 4 jetons, 2 = 5 jetons
    if (competitionNumber === 3) {
      jetonsParJoueur = 4;
    } else if (competitionNumber === 2) {
      jetonsParJoueur = 5;
    } else {
      jetonsParJoueur = null;
    }
  } else {
    jetonsParJoueur = null;
  }

  isLibreWithJetons =
    isLibre &&
    jetonsParJoueur !== null &&
    playerCount != null &&
    playerCount > 0;
}

async function loadPayoutsIfNeeded() {
  if (!isLibreWithJetons || !showEndOfMancheModal || !playerCount) return;

  // si déjà chargée pour cette manche, on ne recharge pas
  if (payouts.length > 0) return;

  isLoadingPayouts = true;
  payoutError = '';

  try {
    const url =
      `${API_BASE_URL}/api/payout/manche-libre` +
      `?competitionType=${competitionType}` +
      `&competitionNumber=${competitionNumber}` +
      `&playerCount=${playerCount}`;

    const res = await fetch(url);

    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }

    payouts = await res.json();
  } catch (e) {
    console.error(e);
    payoutError = "Impossible de charger la répartition des gains.";
    payouts = [];
  } finally {
    isLoadingPayouts = false;
  }
}

$: if (showEndOfMancheModal && isLibreWithJetons) {
  loadPayoutsIfNeeded();
}


// Afficher la colonne "Gain" seulement si on a vraiment les données
$: showGainsInTable =
  isLibreWithJetons &&
  !isLoadingPayouts &&
  !payoutError &&
  payouts.length > 0;





let lastDonneIndex = -1;

$: {
  lastDonneIndex = -1;

  if (feuillePointsAvecTotal && feuillePointsAvecTotal.length > 0) {
    // On part de la fin et on cherche la dernière ligne qui n'est pas TOTAL
    for (let i = feuillePointsAvecTotal.length - 1; i >= 0; i--) {
      const ligne = feuillePointsAvecTotal[i];
      if (!ligne.isTotal) {
        lastDonneIndex = i;
        break;
      }
    }
  }
}





    </script>
<!-- Bandeau supérieur + logos extérieurs -->
<div class="page-header-wrapper">
  <!-- Logo gauche (extérieur) -->
  <img src="/Logo-tee-shirt.png" alt="Logo club" class="corner-logo corner-logo-left" />

  <!-- Encadré central -->
  <div class="header">
    <div class="header-top">
      <h2>Table {tableName} — Manche {mancheNumber}</h2>
    </div>

    <div class="header-buttons">
      <button on:click={() => showAnnonceOrder = true}>Ordre des annonces</button>
      <button on:click={() => showHistorique = true}>Historique des donnes</button>
      <button on:click={() => showFeuillePoints = true}>Feuille de points</button>
   <div class="pause-floating" on:click={handlePauseClick}>
  <svg viewBox="0 0 24 24">
    <rect x="7" y="4" width="3" height="16" rx="1.5" />
    <rect x="14" y="4" width="3" height="16" rx="1.5" />
  </svg>
</div>

    </div>

<table class="players-table">
  <thead>
    <tr>
      <th></th>
      {#each players as p, i}
      <th
          class:leader={leaderScore !== 0  && scoresCumulés[p] === leaderScore}
        >
        {#if i === currentDealer}
        <span class="dealer-icon">🖐️</span>
        {/if}
        {p}
      </th>
      {/each}
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="label-cell">Résultats</td>
      {#each players as p}
      <td
          class:leader={leaderScore !== 0 && scoresCumulés[p] === leaderScore}
        >
          {scoresCumulés[p] ?? 0}
        </td>
      {/each}
    </tr>
  </tbody>
</table>
    <!-- Texte centré sous le tableau -->
    {#if mancheStartTime}
  <div class="manche-info minimal">
    <span>Début de la manche :</span>
    <strong>{mancheStartTime}</strong>
    {#if duree}
    <span class="duree">(⏱ {duree})</span>
    {/if}
  </div>
    {/if}
  </div>




  
  <!-- Logo droit (extérieur) -->
  <img src="/logo_iwb.png" alt="Logo IWB" class="corner-logo corner-logo-right" />
</div>




<!-- MODALE : Ordre des annonces -->
{#if showAnnonceOrder}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-backdrop" on:click={() => showAnnonceOrder = false}>
		<div class="modal modal-annonces" on:click|stopPropagation>
			<h3>Ordre des annonces</h3>
        <ul class="annonces-list">
         {#each annonces
  .filter(a => {

    // 1) Retirer tous les codes finissant par 2, sauf E12
    if (a.code.endsWith("2") && a.code !== "E12") return false;

    // 2) Retirer S8_D
    if (a.code === "S8_D") return false;

    // 3) Retirer D
    if (a.code === "D") return false;

    return true;
  })
  as a}
          <li class="annonce-item">
            <span class="annonce-code">
                {#if ['A9', 'A10', 'A11', 'PC', 'CH'].includes(a.code)}
                <strong style="color:#e63946;">{a.code}</strong>
                {:else if a.code === 'TR'}
                <strong class="tr-circle">{a.code}</strong>
                {:else}
                <strong>{a.code}</strong>
                {/if}
            </span>
            <span class="annonce-label">{a.label}</span>
            </li>
        {/each}
        </ul>
      <div class="ordre-couleurs-wrapper">
        <div class="ordre-couleurs">
          <span class="c-symbole pique">♠</span>
          <span class="c-arrow">❯</span>
          <span class="c-symbole trefle">♣</span>
          <span class="c-arrow">❯</span>
          <span class="c-symbole carreau">♦</span>
          <span class="c-arrow">❯</span>
          <span class="c-symbole coeur">♥</span>
        </div>
      </div>


      <button on:click={() => showAnnonceOrder = false}>Fermer</button>
    </div>
  </div>
  {/if}

  <!-- MODALE : Historique des donnes -->
{#if showHistorique}
    <div class="modal-backdrop" on:click={() => showHistorique = false}>
        <div class="modal history-modal" on:click|stopPropagation>

            <h3>Historique des donnes</h3>

            {#if history.length === 0}
                <p>Aucune donne encodée pour l'instant.</p>
            {:else}
                <table class="history-table">
                    <thead>
                        <tr>
                            <th>Donne</th>
                            <th>Joueur</th>
                            <th>Annonce</th>
                            <th>Partenaire</th>
                            <th>Plis</th>
                            <th>Résultat</th>
                            <th>Dames</th>
                            <th>Arbitre</th>
                          <th>Carteur</th>
                        </tr>
                    </thead>
                   <tbody>
    {#each history as donne}
        {#each donne.joueurs as j, idx}
            <tr>
                {#if idx === 0}
                    <td rowspan={donne.joueurs.length}>{donne.donneNumber}</td>
                {/if}
                <td>{j.nom}</td>
                <td>{j.annonce}</td>
                <td>{j.emballageAvec}</td>
                <td>{j.plis}</td>
                <td>{j.resultat}</td>
                <td>{j.dames}</td>
                <td style="text-align:center;">
                    {#if j.arbitre}
                        ✓
                    {/if}
                </td>
               {#if idx === 0}
          <td rowspan={donne.joueurs.length}>
            {getDealerAliasForDonne(donne.donneNumber, players)}
          </td>
          {/if}
        </tr>
        {/each}
    {/each}
</tbody>
                </table>
            {/if}

            <button on:click={() => showHistorique = false}>Fermer</button>
        </div>
    </div>
{/if}


{#if showFeuillePoints}
    <div class="modal-backdrop" on:click={() => showFeuillePoints = false}>
        <div class="modal feuille-points-modal" on:click|stopPropagation>


            <h3>Feuille de points</h3>

            {#if history.length === 0}
                <p>Aucune donne encodée pour l'instant.</p>
            {:else}
                <table class="feuille-table">
                    <thead>
                        <tr>
                            <th rowspan="2" class="col-donne">Donne</th>
                           <th rowspan="2" class="col-annonce">Annonce</th> 
                          
                          
                            {#each players as p}
                                <th colspan="2" class="col-player">{p}</th>
                            {/each}
                        </tr>
                        <tr>
                            {#each players as _}
                                <th class="col-score">Score</th>
                                <th class="col-cumul">Cumul</th>
                            {/each}
                        </tr>
                    </thead>
<tbody>
  {#each feuillePointsAvecTotal as ligne, idx}
    {#if ligne.isTotal}
    
       <!-- 🌿 Ligne vide pour créer l'espace -->
      <tr class="classement-spacer-row">
        <td colspan={2 + players.length * 2}></td>
      </tr>
    
    
      <tr class="total-row">
        
        <td class="cell-total-label" colspan="2">CLASSEMENT</td>

    {#each players as p}
      <td
        class="cell-total-value"
        class:cell-cumul-final={rankByPlayer[p] === 1}
        colspan="2"
      >
        {#if rankByPlayer[p]}
          {rankByPlayer[p]}
          {#if rankByPlayer[p] === 1}
        
          {/if}
        {:else}
          -
        {/if}
      </td>
    {/each}
  </tr>
   {:else}
  {@const inactivePlayers = getInactivePlayersForDonne(ligne.donneNumber, players)}

  <tr class:last-donne-row={idx === lastDonneIndex}>
    <td class="cell-donne">{ligne.donneNumber}</td>
    <td class="cell-annonce">{ligne.annonce}</td>

   {#each players as p}
  <!-- SCORE -->
  <td
    class="cell-score"
    class:cell-score-negative={!inactivePlayers.includes(p) && displayScoreValue(ligne, p) < 0}
  >
    {#if inactivePlayers.includes(p)}
      -
    {:else}
      {displayScoreValue(ligne, p)}
    {/if}
  </td>

  <!-- CUMUL (toujours affiché, même si inactif) -->
  <td
    class="cell-cumul"
    class:cell-cumul-final={idx === lastDonneIndex}
  >
    {ligne.scores[p]?.cumul ?? 0}
  </td>
{/each}

  </tr>
{/if}

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

{#if showArbitreModal}
    <div class="modal-backdrop" on:click={() => showArbitreModal = false}>
        <div class="modal" on:click|stopPropagation style="text-align:center;">
            <h3 style="margin-bottom:1rem;">Appel à l'arbitre requis</h3>

            <p style="margin: 0 auto 1.5rem auto; max-width: 80%;">
                {arbitreMessage}
            </p>

            <div style="display:flex; justify-content:center; margin-top:1.5rem;">
                <button on:click={() => showArbitreModal = false}>
                    Fermer
                </button>
            </div>
        </div>
    </div>
{/if}


{#if showConfetti}
<div class="confetti-container">
  {#each Array.from({ length: 40 }) as _, i}
  <div class="confetti-piece confetti-{i + 1}"></div>
  {/each}
</div>
{/if}

{#if showLeaveModal}
  <div class="modal-backdrop" on:click={cancelLeave}>
    <div class="modal leave-modal" on:click|stopPropagation>
      <div class="warning-icon">
  <div class="warning-triangle">
    <span>!</span>
  </div>
</div>

      <h3>Quitter la manche en cours ?</h3>

      <p>
        Vous avez une manche en cours d'encodage.<br />
        Si vous quittez maintenant, vous risquez de perdre des données
        ou de bloquer la table pour les autres joueurs.
      </p>

      <p class="leave-warning">
        Êtes-vous sûr(e) de vouloir quitter cette manche ?
      </p>

      <div class="modal-actions">
        <button class="danger" on:click={confirmLeave}>
          Quitter quand même
        </button>
        <button class="secondary" on:click={cancelLeave}>
          Rester sur la manche
        </button>
      </div>
    </div>
  </div>
{/if}



{#if showEndOfMancheModal}
<div class="modal-backdrop" on:click={() => (showEndOfMancheModal = false)}>
  <div class="modal end-manche-modal" on:click|stopPropagation>
    <h3>Manche terminée 🎉</h3>

    <p class="end-manche-text">
      La manche est terminée après {rows} donnes.<br />
      Voici le classement final :
    </p>

    <div class="manche-infos">
      <span>
        Début : <strong>{mancheStartTime ?? '-'}</strong>
      </span>
      <span>
        Fin : <strong>{mancheEndTime ?? '-'}</strong>
      </span>
      {#if dureeManche}
        <span>
          Durée : <strong>{dureeManche}</strong>
        </span>
      {/if}
    </div>

    <table class="end-manche-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Joueur</th>
          <th>Score</th>

          {#if showGainsInTable}
            <!-- Manche libre avec jetons + payout dispo -->
            <th>Gain</th>
          {:else if !isLibreWithJetons}
            <!-- Autres types de manches → validation -->
            <th>Validation</th>
          {/if}
        </tr>
      </thead>

      <tbody>
        {#each classementFinal as j, i}
          <tr class:winner-row={j.score === leaderScore}>
            <td>{i + 1}</td>
            <td>{j.nom}</td>
            <td>{j.score}</td>

            {#if showGainsInTable}
              <!-- rang = i+1, on prend le gain correspondant -->
              <td>{payouts[i]?.amount ?? 0}</td>
            {:else if !isLibreWithJetons}
              <td>
                <label class="validation-check">
                  <input
                    type="checkbox"
                    bind:checked={validations[j.nom]}
                  />
                  ✔️
                </label>
              </td>
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>





    {#if winnerNames}
    <p class="end-manche-congrats">
      🎰 Bravo à
      <span class="end-manche-winner">{winnerNames}</span>
      pour cette manche gagnée !
    </p>
    {/if}

    <div class="end-manche-buttons">
      <button on:click={goBackHome}>
        Fermer
      </button>


      <button on:click={openScoreSheet}>
        Feuille de points
      </button>
      
      
      <button
        class="btn-next-manche"
        on:click={goToNextManche}
          disabled={!isLibreWithJetons && !allPlayersValidated}
      >
        Manche suivante
      </button>
    </div>
  </div>
</div>
{/if}



<div class="donne">
	<h3>Donne n° {donneNumber} / {rows}</h3>
	<div class="choixAnnonce">
		{#each players as p}
			<div class="player-row">
				<div class="player-block">
					<strong>{p}</strong>

          {#if inactivePlayersCurrentDonne.includes(p)}
          <div class="inactive-note">Ne joue pas cette donne</div>
          {/if}
          

          <!-- Sélection de l’annonce -->
<select
    value={annonceByPlayer[p] || ''} 
  on:change={(e) =>
    handleAnnonceChange(p, (e.target as HTMLSelectElement).value)
  }
  disabled={inactivePlayersCurrentDonne.includes(p)}
>
  <option value="">-- Choisir annonce --</option>
  {#each (annoncesParJoueur[p] ?? annonces) as a}
    <option value={a.code}>{a.label}</option>
  {/each}
</select>



		<!-- Emballage OU Trou : on choisit un partenaire -->
 {#if annonceByPlayer[p] && (
  getTemplateForAnnonce(annonceByPlayer[p]) === 2
  || annonceByPlayer[p] === 'TR'
)}
  <div class="emballage">
    <label>
      <span class="emballage-label-text">Avec qui ?</span>
      <select
        id={"emballage-" + p}
        bind:value={emballes[p]}
        on:change={() => handleEmballageChange(p)}
      >
        <option value="">-- Choisir joueur --</option>
        {#each players
          .filter(x => x !== p && !inactivePlayersCurrentDonne.includes(x)) as other}
          <option value={other}>{other}</option>
        {/each}
      </select>
    </label>
  </div>
{/if}




        </div>
			</div>
		{/each}
	</div>
</div>

<hr />

<div class="encodage" bind:this={resultatSectionEl}>
  <h3>Encodage</h3>
	{#each players as p}
		{#if annonceByPlayer[p]}
            <!-- Template 1 : solo -->
 {#if getTemplateForAnnonce(annonceByPlayer[p]) === 1}
    <div class="player-row">
        <span>{getDisplayName(p)}</span>


        <div class="number-buttons">
            {#each getSoloButtons(annonceByPlayer[p]) as n}
                <button
                    class:selected={plis[p] === n}
                    class:fail={isSoloFail(annonceByPlayer[p], n)}
                    on:click={() => handleInput(p, n)}
                >
                    {n === 8 ? "8+" : n}
                </button>
            {/each}
        </div>
    </div>
{/if}


            <!-- Template 2 : emballage -->
   {#if getTemplateForAnnonce(annonceByPlayer[p]) === 2}
    <div class="player-row emballage-encodage">
        <span>
            {p}
            {#if emballes[p]}
                &nbsp;&amp;&nbsp;{emballes[p]}
            {/if}
            ({annonceByPlayer[p]})
        </span>

        <div class="number-buttons">
            {#each getEmballageButtons(annonceByPlayer[p]) as n}
                <button
                    class:selected={plis[p] === n}
                    class:fail={isEmballageFail(annonceByPlayer[p], n)}
                    on:click={() => handleInput(p, n)}
                >
                    {n === 13 ? "Capot" : n}
                </button>
            {/each}
        </div>
    </div>
{/if}




            <!-- Template 3, 4, 5 : réussite/raté/capot -->
        {#if getTemplateForAnnonce(annonceByPlayer[p]) === 3
   || getTemplateForAnnonce(annonceByPlayer[p]) === 4
   || getTemplateForAnnonce(annonceByPlayer[p]) === 5}
    <div class="player-row">
        <span>
            {#if annonceByPlayer[p] === 'TR' && emballes[p]}
                {p} &nbsp;&amp;&nbsp;{emballes[p]} (TR)
            {:else}
                {getDisplayName(p)}
            {/if}
        </span>

        <div class="button-group">
            <button
                class:selected={resultats[p] === 'Réussi'}
                on:click={() => handleInput(p, 'Réussi')}
            >Réussi</button>

            <button
                class:selected={resultats[p] === 'Raté'}
                class:fail={true}
                on:click={() => handleInput(p, 'Raté')}
            >Raté</button>

            {#if getTemplateForAnnonce(annonceByPlayer[p]) === 5}
                <button
                    class:selected={resultats[p] === 'Capot'}
                    on:click={() => handleInput(p, 'Capot')}
                >Capot</button>
            {/if}
        </div>
    </div>
{/if}



            <!-- Template 6 : Dames (nouvelle version) -->
  <!-- Template 6 : Dames (nouvelle version) -->
  {#if getTemplateForAnnonce(annonceByPlayer[p]) === 6
  && !inactivePlayersCurrentDonne.includes(p)}
  <div class="player-row">
    <span>{getDisplayName(p)} (D)</span>

    <div class="number-buttons">
      {#each Array.from({ length: 5 }, (_, i) => i) as n}
      <button
          on:click={() =>
        selectDames(p, n)}
        class:selected={dames[p] === n}
        disabled={isDamesDisabled(p, n)}
        >
        {n}
      </button>
      {/each}
    </div>
  </div>
  {/if}
  {/if}
  {/each}


  {#if players.length}
<div class="preview-scores" bind:this={previewSectionEl}>
  <h3>Prévisualisation des scores</h3>

  <table class="preview-table">
    <colgroup>
      <col class="dealer-col" />
      <col />
      <col />
    </colgroup>

    <thead>
      <tr>
        <th></th>        <!-- col dealer -->
        <th>Joueur</th>
        <th>Score</th>
      </tr>
    </thead>

    <tbody>
      {#each players as p, i}
        <tr class:dealer-row={i === currentDealer}>
          <td class="dealer-cell">
            {#if i === currentDealer}
              <span class="dealer-icon">🖐️</span>
            {/if}
          </td>

          <td>{p}</td>

          <td
            class:positive={previewScores[p] > 0}
            class:negative={previewScores[p] < 0}
          >
            {#if inactivePlayersCurrentDonne.includes(p)}
              -
            {:else}
              {previewScores[p] ?? 0}
            {/if}
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

{/if}



    
      
      
    
  
  
<div class="BoutonValidate">
    {#if showValidateButton}
        <button class="btn-primary" on:click={validate} disabled={!canValidateDonne}>
            Valider la donne
        </button>
    {/if}
</div>


</div>
<footer class="copyright">
  © 2025 WB-Scoring — Tous droits réservés —
  <a href="mailto:contact@wb-scoring.com" class="footer-mail">
    contact@wb-scoring.com
  </a>
</footer>


<style>
  :root {
  --primary: #c62828;       /* rouge (échec, boutons spéciaux) */
  --primary-dark: #b71c1c;
  --accent: #f5b942;        /* doré */
  --accent-soft: #fff3c4;

  --border-soft: rgba(255, 255, 255, 0.08);
  --border-strong: rgba(255, 255, 255, 0.16);

  --text-main: #f9fafb;
  --text-muted: #9ca3af;

  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 18px;

  --shadow-soft: 0 10px 30px rgba(0, 0, 0, 0.45);
  }

  /* Fond simple, non répétitif */
  :global(body) {
  margin: 0;
  font-family: 'Poppins', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI',
  sans-serif;
  background: linear-gradient(180deg, #020806 0%, #04140c 40%, #020806 100%);
  color: var(--text-main);
  font-size: 30px; /* un peu plus grand par défaut */
  }

  /* --- HEADER + TABLEAU JOUEURS --- */
  .header {
  margin: 0 auto 1.5rem auto;
  padding: 0.9rem 1.6rem 0.9rem;
  max-width: 1100px;
  background: rgba(2, 8, 4, 0.96);
  backdrop-filter: blur(10px);
  border-radius: 0 0 22px 22px;
  border-bottom: 1px solid rgba(15, 118, 110, 0.7);
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.75);
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  }

  .header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  }

  .header > div:first-child {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  }

  .header h2 {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--text-main);
  }

  .header img {
  height: 48px;
  filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.8));
  }

  .header-buttons {
  display: flex;
  justify-content: center;
  gap: 0.8rem;
  margin-top: 0.2rem;
  }

  .header-buttons button {
  padding: 0.5rem 1.4rem;
  border-radius: 999px;
  border: 1px solid var(--accent);
  background: radial-gradient(circle at top, #184326 0%, #07170d 65%, #020806 100%);
  color: #fef9c3;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.7);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
  transition: transform 0.08s ease, box-shadow 0.15s ease, background 0.15s ease;
  }

  .header-buttons button:hover {
  background: radial-gradient(circle at top, #246838 0%, #0b2815 70%, #020806 100%);
  transform: translateY(-1px);
  box-shadow: 0 7px 18px rgba(0, 0, 0, 0.8);
  }


  /* Wrapper global : logos + bandeau */
  .page-header-wrapper {
  display: flex;
  align-items: stretch;
  justify-content: center;
  gap: 2rem;
  margin: 0.5rem auto 1.5rem auto;
  max-width: 1400px;       /* largeur totale */
  }

  /* Bandeau central garde ton style existant */
  .header {
  flex: 0 0 900px;         /* largeur fixe de l'encadré */
  }

  /* Logos sur les côtés */
  .corner-logo {
  align-self: center;      /* verticalement centré par rapport au header */
  height: 180px;           /* 🔥 tu peux monter à 200 / 220 si tu veux encore plus grand */
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 8px 18px rgba(0, 0, 0, 0.7));
  }

  /* optionnel : les coller un peu plus au bord */
  .corner-logo-left {
  margin-left: 0.5rem;
  }

  .corner-logo-right {
  margin-right: 0.5rem;
  }



  /* Tableau bien dans le header */
  .players-table {
  margin: 0.6rem auto 0.2 auto;
  border-collapse: collapse;
  background: rgba(2, 12, 7, 0.98);
  color: var(--text-main);
  font-size: 1rem;           /* ✅ un peu plus grand */
  border-radius: 14px;
  overflow: hidden;
  box-shadow: var(--shadow-soft);
  min-width: 420px;
  }

  .players-table th,
  .players-table td {
  padding: 0.45rem 0.7rem;
  text-align: center;
  border-bottom: 1px solid rgba(15, 23, 42, 0.6);
  }

  .players-table th {
  background: linear-gradient(to bottom, #0f3820, #071d12);
  font-weight: 600;
  }

  .label-cell {
  background: #04130b;
  font-weight: 700;
  text-align: left;
  padding-left: 1rem;
  }

  .dealer-icon {
  margin-right: 0.25rem;
  }

  hr {
  border: 0;
  border-top: 1px solid rgba(148, 163, 184, 0.3);
  max-width: 900px;
  margin: 1.5rem auto;
  }

  /* --- DONNE / CARTES D’ANNONCES --- */
  .donne {
  margin-top: 0.5rem;
  }

  .donne h3 {
  text-align: center;
  font-size: 1.2rem;
  font-weight: 600;
  color: var(--accent);
  }

  .choixAnnonce {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
  margin-top: 1rem;
  }

  .player-block {
  background: rgba(2, 12, 7, 0.96);
  border: 1px solid var(--border-soft);
  border-radius: 18px;
  padding: 1rem 1.3rem;
  min-width: 230px;
  box-shadow: var(--shadow-soft);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  box-sizing: border-box;
  }

  .player-block strong {
  font-size: 1.05rem;
  color: var(--accent);
  }

  .player-block select {
  padding: 0.45rem 0.9rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.7);
  background: #020b06;
  color: var(--text-main);
  font-size: 1rem;
  cursor: pointer;
  -webkit-text-fill-color: #fff !important;
  }
  .player-block select option {
  color: var(--text-main);
  background: #020b06;
  }
  .player-block select:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(245, 185, 66, 0.4);
  }

  .emballage {
  width: 100%;
  margin-top: 0.3rem;
  }

  .emballage label {
  font-size: 0.85rem;
  color: var(--text-muted);
  }

  .emballage select {
  width: 100%;
  margin-top: 0.2rem;
  }

  /* --- ENCODAGE (gros bloc central) --- */
  .encodage {
  max-width: 840px;
  margin: 1.8rem auto 0;
  padding: 1.3rem 1.7rem 1.7rem;
  background: rgba(2, 12, 7, 0.97);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-strong);
  box-shadow: var(--shadow-soft);
  }

  .encodage > h3 {
  margin: 0 0 0.8rem;
  text-align: center;
  color: var(--accent);
  font-size: 1.15rem;
  }

  .player-row {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 0.7rem 0.9rem;
  border-radius: 12px;
  background: rgba(4, 20, 12, 0.95);
  border: 1px solid rgba(31, 64, 50, 0.9);
  margin-top: 0.5rem;
  }

  .player-row span {
  font-weight: 600;
  text-align: center;
  color: var(--text-main);
  font-size: 1rem;
  }

  .emballage-encodage {
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  }

  .emballage-encodage span {
  text-align: left;
  }

  .number-buttons,
  .button-group {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.4rem;
  }

  .number-buttons button,
  .button-group button {
  padding: 0.4rem 0.9rem;
  font-size: 1rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.7);
  background: #07170e;
  color: var(--text-main);
  cursor: pointer;
  transition: background 0.12s ease, transform 0.05s ease, border-color 0.12s ease;
  }

  .number-buttons button:hover,
  .button-group button:hover {
  background: #0b2414;
  }

  .number-buttons button.selected:not(.fail),
  .button-group button.selected:not(.fail) {
  background: var(--accent);
  border-color: #facc6b;
  color: #1c1917;
  font-weight: 600;
  }

  .number-buttons button.fail,
  .button-group button.fail {
  color: #fca5a5;
  border-color: #fca5a5;
  background: #310c0c;
  }

  .number-buttons button.fail.selected,
  .button-group button.fail.selected {
  background: var(--primary);
  border-color: var(--primary-dark);
  color: #fff;
  }

  /* --- BOUTON VALIDER --- */
  .BoutonValidate {
  display: flex;
  justify-content: center;
  margin: 1.7rem 0 0.7rem;
  }

  .BoutonValidate button {
  padding: 0.85rem 2.6rem;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 999px;
  border: none;
  background: var(--accent);
  color: #1a1305;
  cursor: pointer;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.7);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  transition: background 0.15s ease, transform 0.08s ease, box-shadow 0.15s ease;
  }

  .BoutonValidate button:hover:enabled {
  background: #ffd25e;
  transform: translateY(-1px);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.8);
  }

  .BoutonValidate button:disabled {
  background: #4b5563;
  color: #d1d5db;
  cursor: not-allowed;
  box-shadow: none;
  transform: none;
  }

  /* --- PRÉVISUALISATION SCORES --- */
  .preview-scores {
  max-width: 340px;
  margin: 1.6rem auto 0;
  padding: 1rem 1.1rem;
  border-radius: 14px;
  background: #020b06;
  border: 1px solid var(--border-soft);
  box-shadow: var(--shadow-soft);
  font-size: 0.95rem;
  }

  .preview-scores h3 {
  margin-top: 0;
  margin-bottom: 0.5rem;
  font-size: 1rem;
  text-align: center;
  color: var(--accent);
  }

  .preview-scores table {
  width: 100%;
  border-collapse: collapse;
  }

  .preview-scores th,
  .preview-scores td {
  padding: 0.35rem 0.5rem;
  text-align: center;
  border-bottom: 1px solid rgba(55, 65, 81, 0.7);
  }

  .preview-scores th {
  background: #0b2814;
  }

  .preview-scores td.positive {
  color: #4ade80;
  font-weight: 600;
  }

  .preview-scores td.negative {
  color: #fca5a5;
  font-weight: 600;
  }

  /* --- MODALES (annonces, historique, feuille de points) --- */
  .modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(3, 7, 18, 0.75);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1100;
  }

  .modal {
  background: rgba(2, 12, 7, 0.98);
  color: var(--text-main);
  padding: 1.4rem 1.5rem 1.2rem;
  border-radius: var(--radius-lg);
  max-width: 420px;
  width: 92%;
  box-shadow: var(--shadow-soft);
  font-size: 0.95rem;

  /* AJOUT 🔥 : empêche les modales normales d'être trop hautes */
  max-height: 85vh;      /* limite à 85% de la hauteur de l'écran */
  overflow-y: auto;      /* permet le scroll si contenu trop long */
  }


  .modal h3 {
  margin-top: 0;
  margin-bottom: 0.7rem;
  font-size: 1.05rem;
  color: var(--accent);
  }

  .modal button {
  margin-top: 0.9rem;
  padding: 0.55rem 1.5rem;
  border-radius: 999px;
  border: 1px solid var(--border-soft);
  background: #0b2814;
  color: var(--text-main);
  cursor: pointer;
  }

  .modal button:hover {
  background: #114023;
  }

  .history-modal {
  max-width: 760px;
  width: 94%;
  }

  .history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
  margin-top: 0.5rem;
  }

  .history-table th,
  .history-table td {
  border: 1px solid rgba(55, 65, 81, 0.8);
  padding: 0.3rem 0.4rem;
  text-align: center;
  }

  .history-table th {
  background: #0b2814;
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
  border-right: 3px solid rgba(245, 185, 66, 0.35); /* trait doré plus visible */
  }

  /* Mais pour le tout dernier joueur, on remet une bordure "normale" */
  .feuille-table th.col-cumul:last-child,
  .feuille-table td.cell-cumul:last-child {
  border-right: 1px solid rgba(55, 65, 81, 0.9); /* même style que les autres bordures */
  }

  /* Ligne bleue verticale entre Annonce et les joueurs */
  .feuille-table th.col-annonce,
  .feuille-table td.cell-annonce {
  border-right: 3px solid rgba(55, 65, 81, 0.9)!important; /* Bleu joli */
  }


  /* Lignes verticales dorées entre les joueurs */
  .feuille-table td.cumul-col,
  .feuille-table th.cumul-col {
  border-right: 3px solid rgba(245, 185, 66, 0.35); /* ligne dorée */
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
  border-left: 1.3px solid rgba(250, 204, 21, 0.35) !important; /* doré subtil */
  }

  /* Renforce un peu la séparation mais très discret */
  .feuille-table th.col-player {
  border-right: 2px solid rgba(250, 204, 21, 0.25) !important;
  }


  /* Dernière ligne de la feuille de points (totaux) */
  .feuille-table tr.total-row {
  background: var(--accent-soft) !important;  /* fond beige */
  color: #111827 !important;                  /* texte quasi noir */
  font-weight: 700;
  }

  /* Cellules "cumul" de la dernière ligne : encore plus lisibles */
  .feuille-table tr.total-row td.cell-cumul-final {
  background: radial-gradient(circle at top, #fff7cf 0%, #ffd46a 45%, #f59e0b 100%) !important;
  color: #111 !important;
  font-weight: 900;
  font-size: 0.98rem;
  border: 2px solid #fbbf24;
  box-shadow:
  0 0 0 1px #78350f inset,
  0 0 10px rgba(250, 204, 21, .55);
  }



  /* Surbrillance de toute la dernière ligne de donne */
  .feuille-table tr.last-donne-row td.cell-cumul-final {
  background: radial-gradient(circle at top, #fff7cf 0%, #ffd46a 45%, #f59e0b 100%);
  color: #111;
  font-weight: 900;
  font-size: 0.98rem;
  border: 2px solid #fbbf24;
  box-shadow:
  0 0 0 1px #78350f inset,
  0 0 10px rgba(250, 204, 21, .55);
  }


  /* Tous les textes de la dernière ligne : bien foncés */
  .feuille-table tr.total-row td,
  .feuille-table tr.total-row th {
  color: #000 !important;
  }
  .col-donne,
  .cell-donne {
  min-width: 50px;
  }

  .col-annonce,
  .cell-annonce {
  min-width: 55px;
  }

  .annonces-list {
  list-style: none;
  padding: 0.4rem 0;
  margin: 0;
  max-height: 260px;
  overflow-y: auto;
  border-top: 1px solid var(--border-soft);
  border-bottom: 1px solid var(--border-soft);
  }

  .annonce-item {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  padding: 0.2rem 0;
  }

  .annonce-code {
  width: 3rem;
  text-align: center;
  font-weight: 700;
  }

  .tr-circle {
  display: inline-block;
  border: 2px solid #e63946;
  border-radius: 999px;
  padding: 0.1rem 0.45rem;
  }

  .force-couleurs {
  text-align: center;
  margin-top: 0.7rem;
  }

  .force-couleurs p {
  display: inline-block;
  padding: 0.35rem 0.8rem;
  border-radius: 999px;
  background: #020b06;
  border: 1px solid var(--border-soft);
  }

  /* RESPONSIVE */
  /* RESPONSIVE MOBILE */

  @media (max-width: 768px) {
  /* Header + logos en colonne */
  .page-header-wrapper {
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  margin: 0.4rem auto 0.8rem;
  max-width: 100%;
  }

  /* Logos du haut plus petits */
  .corner-logo {
  height: 90px;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.6));
  }

  .header {
  flex: 1;
  width: calc(100% - 1rem);
  margin: 0;
  border-radius: 16px;
  padding: 0.7rem 0.9rem 1rem;
  }

  .header-top {
  justify-content: center;
  }

  .header h2 {
  font-size: 1.05rem;
  text-align: center;
  }

  /* Boutons d’onglets : 2 par ligne max */
  .header-buttons {
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.8rem;
  }

  .header-buttons button {
  flex: 1 1 45%;
  font-size: 0.8rem;
  padding: 0.4rem 0.6rem;
  }

  /* Tableau des joueurs : pleine largeur et texte réduit */
  .players-table {
  width: 100%;
  min-width: auto;
  font-size: 0.85rem;
  }

  .players-table th,
  .players-table td {
  padding: 0.35rem 0.4rem;
  }

  /* Titre de la donne */
  .donne h3 {
  font-size: 1.2rem;
  margin-top: 1rem;
  margin-bottom: 1rem;
  }

  /* Cartes annonces joueurs en colonne, pleine largeur */
  .choixAnnonce {
  flex-direction: column;
  align-items: stretch;
  margin: 0 0.6rem;
  }

  .player-block {
  width: 100%;
  min-width: 0;
  padding: 0.8rem 1rem;
  }

  /* Bloc encodage : pleine largeur et moins de padding */
  .encodage {
  max-width: none;
  margin: 1.2rem 0.6rem 0;
  padding: 1rem 1rem 1.3rem;
  }

  .player-row {
  padding: 0.6rem 0.7rem;
  }

  .player-row span {
  font-size: 0.95rem;
  }

  .number-buttons button,
  .button-group button {
  font-size: 0.85rem;
  padding: 0.35rem 0.7rem;
  }

  /* Preview des scores : largeur écran, pas un petit bloc au centre */
  .preview-scores {
  max-width: none;
  margin: 1.4rem 0.6rem 1.2rem;
  font-size: 0.9rem;
  }

  /* Bouton "Valider la donne" bien centré mais pas gigantesque */
  .BoutonValidate button {
  width: auto;
  padding: 0.75rem 2rem;
  font-size: 0.9rem;
  }

  /* Modales : adaptatives, scrollables si besoin */
  .modal {
  max-width: 100%;
  width: 94%;
  max-height: 90vh;
  overflow: auto;
  padding: 1rem 0.9rem 0.9rem;
  }

  .history-modal,
  .feuille-points-modal {
  max-width: 100%;
  width: 100%;
  }

  .history-table,
  .feuille-table {
  font-size: 0.8rem;
  }
  }



  /* Wrapper autour de l'encodage et des logos */
  .encodage-wrapper {
  display: flex;
  justify-content: center;
  align-items: stretch;
  gap: 2rem;
  margin-top: 2rem;
  }

  /* Logos géants */
  .side-logo {
  height: 270px;           /* ✅ GROS – tu peux augmenter à 300 / 350 si tu veux */
  width: auto;
  object-fit: contain;
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.55));
  opacity: 0.95;
  }

  .side-logo.left {
  margin-right: 1rem;
  }

  .side-logo.right {
  margin-left: 1rem;
  }

  /* Encodage plus large pour mieux équilibrer avec les logos */
  .encodage {
  flex: 0 0 650px;        /* largeur fixe élégante */
  }

  /* Titre */
  .preview-scores h3 {
  font-size: 1.25rem;  /* plus grand */
  }

  /* Lignes du tableau */
  .preview-scores table {
  font-size: 1.15rem;  /* 🔥 beaucoup plus lisible */
  }

  /* Scores positifs / négatifs plus visibles */
  .preview-scores td.positive {
  font-size: 1.2rem;
  font-weight: 700;
  }

  .preview-scores td.negative {
  font-size: 1.2rem;
  font-weight: 700;
  }

  .preview-scores h3 {
  font-size: 1.25rem;
  }

  .preview-scores table {
  font-size: 1.15rem;
  }

  .preview-scores td.positive,
  .preview-scores td.negative {
  font-size: 1.2rem;
  font-weight: 700;
  }
  /* Titre "Encodage" un peu plus grand */
  .encodage > h3 {
  font-size: 1.45rem;
  }

  /* Nom du joueur / annonce dans les lignes d'encodage */
  .player-row span {
  font-size: 1.15rem;
  }

  /* Boutons 6 7 8 9 10 11 12 Capot plus grands */
  .number-buttons button,
  .button-group button {
  font-size: 1.1rem;
  padding: 0.45rem 1.05rem;
  }
  .header-top {
  display: flex;
  justify-content: center;   /* centre le contenu */
  }

  .header-top h2 {
  font-size: 1.7rem;         /* plus grand */
  text-align: center;
  width: 100%;
  margin: 0;
  }
  /* Tableau un peu plus “présent” + large et colonnes uniformes */
  .players-table {
  width: 100%;
  table-layout: fixed;  /* répartit les colonnes de façon égale */
  border: 1px solid rgba(148, 163, 184, 0.6);   /* contour un peu plus visible */
  }

  /* Première colonne (label "Résultats") un peu moins large */
  .players-table th:first-child,
  .players-table td:first-child {
  width: 22%;
  }

  /* Les colonnes joueurs se partagent le reste de manière égale */
  .players-table th:not(:first-child),
  .players-table td:not(:first-child) {
  width: auto;
  }

  /* Lignes un peu mieux délimitées */
  .players-table th,
  .players-table td {
  border-bottom: 1px solid rgba(75, 85, 99, 0.8);
  }

  /* Espace sous le tableau des résultats */
  .players-table {
  margin-bottom: 2.2rem !important;   /* plus d'espace */
  }

  /* Espace sous le numéro de donne */
  .donne-title {
  margin-bottom: 2.4rem !important;
  }

  /* 1️⃣ Donne n° X / Y : plus grand + plus d'espace */
  .donne {
  margin-top: 2.2rem;              /* espace entre le header et "Donne n°" */
  }

  .donne h3 {
  text-align: center;
  font-size: 1.8rem;               /* ✅ plus gros */
  font-weight: 700;
  color: var(--accent);
  margin-top: 0.5rem;
  margin-bottom: 2.2rem;           /* espace sous "Donne n°" avant les blocs joueurs */
  }

  /* 2️⃣ Plus d'espace entre les boutons (Ordre/Historique/Feuille) et le tableau */
  .header .players-table {
  margin-top: 1.4rem;              /* au lieu de 0.6rem */
  }

  /* 3️⃣ Un peu plus d'espacement entre les blocs d'annonces des joueurs */
  .choixAnnonce {
  margin-top: 1.6rem;              /* les cartes descendent un peu sous "Donne n°" */
  }

  /* 4️⃣ Lignes rouges du bas : plus d'espace avant l'encodage */
  hr {
  margin: 2.2rem auto;             /* espace entre les annonces et le bloc Encodage */
  }
  /* Espace autour des boutons et du tableau d'en-tête */

  /* On descend un peu les 3 boutons sous le titre */
  .header-buttons {
  margin-top: 1.4rem;          /* avant : 0.2rem → ils descendent un peu */
  }

  /* On rapproche le tableau de la suite de la page */
  .header .players-table {
  margin-top: 1rem;            /* léger espace au-dessus */
  margin-bottom: 0.5rem;       /* 🔥 moins d’espace en dessous */
  }

  /* On réduit aussi un peu l’espace avant le bloc "Donne n°" */
  hr {
  margin: 1.6rem auto;         /* au lieu de 2.2rem */
  }

  /* Réduit fortement l'espace entre le tableau et la ligne rouge */
  .header .players-table {
  margin-bottom: 0.6rem !important;   /* était trop grand, on réduit */
  }

  hr {
  margin-top: 0.6rem !important;      /* espace minimal au-dessus */
  margin-bottom: 1.8rem;              /* laisse l’espace normal dessous */
  }

  .players-table {
  border: 1px solid rgba(0, 255, 140, 0.35);      /* vert clair lumineux */
  border-radius: 14px;
  box-shadow:
  0 0 14px rgba(0, 255, 120, 0.25),             /* halo large et clair */
  0 0 4px rgba(0, 255, 140, 0.45) inset;         /* fine lueur interne */
  overflow: hidden;
  background: rgba(0, 40, 20, 0.45);               /* léger vert sombre derrière */
  }
  /* Uniformisation de l'arrière-plan des cellules du tableau pour que la bordure soit visible partout */
  .players-table th,
  .players-table td {
  background: transparent !important;
  }

  /* Highlight du/des gagnant(s) dans le tableau des résultats */
  /* Highlight discret du gagnant */
  /* Effet gold discret sur le joueur en tête (nom + score) */
  /* Effet gold très discret et élégant */
  .players-table .leader {
  background: transparent !important;
  color: #e7c76a;                    /* or doux, pas jaune fluo */
  font-weight: 700;

  text-shadow:
  0 0 2px rgba(231, 199, 106, 0.55),
  0 0 6px rgba(231, 199, 106, 0.25);
  }

  /* Optionnel : scintillement ultra discret */
  @keyframes goldSoftPulse {
  0% {
  text-shadow:
  0 0 2px rgba(231, 199, 106, 0.45),
  0 0 5px rgba(231, 199, 106, 0.2);
  }
  100% {
  text-shadow:
  0 0 4px rgba(231, 199, 106, 0.65),
  0 0 9px rgba(231, 199, 106, 0.30);
  }
  }

  .players-table .leader {
  animation: goldSoftPulse 2.5s ease-in-out infinite alternate;
  /* Tu peux enlever l’animation si tu veux un effet figé */
  }



  .inactive-note {
  margin-top: 0.2rem;
  font-size: 0.8rem;
  color: #9ca3af;
  font-style: italic;
  }

  .end-manche-modal {
  max-width: 520px;
  width: 95%;
  text-align: center;
  background: radial-gradient(circle at top, #052e16 0%, #020b06 65%, #000 100%);
  border: 1px solid rgba(250, 204, 21, 0.6);
  box-shadow:
  0 0 25px rgba(0, 0, 0, 0.9),
  0 0 18px rgba(250, 204, 21, 0.4);
  }

  .end-manche-text {
  margin-top: 0.3rem;
  margin-bottom: 0.9rem;
  font-size: 0.95rem;
  color: var(--text-muted);
  }

  .end-manche-table {
  width: 100%;
  border-collapse: collapse;
  margin: 0.4rem 0 0.8rem;
  font-size: 0.9rem;
  background: #020b06;
  }

  .end-manche-table th,
  .end-manche-table td {
  border: 1px solid rgba(55, 65, 81, 0.9);
  padding: 0.35rem 0.5rem;
  text-align: center;
  }

  .end-manche-table th {
  background: linear-gradient(to bottom, #14532d, #052e16);
  color: #fef9c3;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  font-size: 0.78rem;
  }

  .end-manche-table tr:nth-child(even) {
  background: #04130b;
  }

  .end-manche-table tr.winner-row {
  background: radial-gradient(circle at top, #fff7cf 0%, #facc15 45%, #f97316 100%);
  color: #111827;
  font-weight: 700;
  box-shadow: 0 0 10px rgba(250, 204, 21, 0.6);
  }
  .end-manche-table th.validation-col {
  width: 60px;              /* tu peux descendre à 90 si tu veux plus petit */
  }

  .end-manche-table th.score-col{
  width: 240px;   /* augmente si tu veux plus large */
  }


  .end-manche-congrats {
  margin-top: 0.4rem;
  margin-bottom: 0.4rem;
  font-size: 0.95rem;
  color: #e5e7eb;
  }

  .end-manche-winner {
  color: #facc15;
  font-weight: 700;
  text-shadow: 0 0 6px rgba(250, 204, 21, 0.8);
  }
  .validation-check {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.85rem;
  color: #e5e7eb;
  }

  .validation-check input[type="checkbox"] {
  width: 15px;
  height: 15px;
  cursor: pointer;
  }

  .end-manche-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 0.8rem;
  }

  .end-manche-buttons button {
  padding: 0.55rem 1.6rem;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.7);
  background: #0b2814;
  color: #f9fafb;
  cursor: pointer;
  font-size: 0.9rem;
  font-weight: 600;
  }

  .end-manche-buttons button:hover:enabled {
  background: #14532d;
  }

  .end-manche-buttons .btn-next-manche {
  background: #f5b942;
  border-color: #facc6b;
  color: #1c1917;
  }

  .end-manche-buttons .btn-next-manche:disabled {
  background: #4b5563;
  color: #d1d5db;
  cursor: not-allowed;
  border-color: #374151;
  }

  /* Réduire la colonne validation */
  .col-validation {
  width: 60px;
  text-align: center;
  }

  /* Agrandir Score */
  .col-score {
  width: 120px;
  }

  /* Alignement du score */
  .score-value {
  font-weight: 600;
  text-align: right;
  }

  /* Cellule validation */
  .validation-cell {
  text-align: center;
  }

  /* Style checkbox custom */
  .validation-check {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
  font-size: 0.85rem;
  }
  .validation-check input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  }

  .validation-check .checkmark {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background-color: #143017; /* vert foncé casino */
  border: 2px solid #2f6f38;
  transition: 0.2s ease;
  position: relative;
  }

  .validation-check input:checked + .checkmark {
  background-color: #1fa247;
  border-color: #35ce61;
  box-shadow: 0 0 8px #1fa247aa;
  }

  .validation-check input:checked + .checkmark::after {
  content: "✔";
  position: absolute;
  left: 4px;
  top: -1px;
  font-size: 18px;
  color: white;
  font-weight: bold;
  }

  /* Le ✔ violet qui s’allume quand validé */
  .validation-check span {
  opacity: 0.15;
  color: #a855f7;               /* violet */
  font-size: 0.95rem;
  transition: opacity 0.15s ease;
  }

  .validation-check span.validated {
  opacity: 1;
  }
  /* === CONFETTIS VERT-OR === */
  .confetti-container {
  position: fixed;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 1200; /* au-dessus du fond, mais derrière le contenu du modal si tu veux, à ajuster */
  }

  /* Base confettis */
  .confetti-piece {
  position: absolute;
  width: 8px;
  height: 14px;
  border-radius: 2px;
  opacity: 0.9;
  animation: confettiFall 2.8s linear infinite;
  }

  /* Couleurs vert/or alternées */
  .confetti-piece:nth-child(odd) {
  background: #22c55e; /* vert vif */
  }
  .confetti-piece:nth-child(even) {
  background: #facc15; /* or */
  }

  /* Positions et vitesses différentes (un peu randomisées) */
  .confetti-1  { left: 5%;  animation-duration: 2.4s; }
  .confetti-2  { left: 10%; animation-duration: 3.0s; }
  .confetti-3  { left: 15%; animation-duration: 2.7s; }
  .confetti-4  { left: 20%; animation-duration: 2.9s; }
  .confetti-5  { left: 25%; animation-duration: 2.5s; }
  .confetti-6  { left: 30%; animation-duration: 3.1s; }
  .confetti-7  { left: 35%; animation-duration: 2.6s; }
  .confetti-8  { left: 40%; animation-duration: 3.2s; }
  .confetti-9  { left: 45%; animation-duration: 2.8s; }
  .confetti-10 { left: 50%; animation-duration: 3.0s; }
  .confetti-11 { left: 55%; animation-duration: 2.5s; }
  .confetti-12 { left: 60%; animation-duration: 3.1s; }
  .confetti-13 { left: 65%; animation-duration: 2.7s; }
  .confetti-14 { left: 70%; animation-duration: 3.3s; }
  .confetti-15 { left: 75%; animation-duration: 2.9s; }
  .confetti-16 { left: 80%; animation-duration: 2.6s; }
  .confetti-17 { left: 85%; animation-duration: 3.2s; }
  .confetti-18 { left: 90%; animation-duration: 2.4s; }
  .confetti-19 { left: 12%; animation-duration: 3.4s; }
  .confetti-20 { left: 28%; animation-duration: 2.3s; }
  .confetti-21 { left: 38%; animation-duration: 3.2s; }
  .confetti-22 { left: 48%; animation-duration: 2.6s; }
  .confetti-23 { left: 58%; animation-duration: 3.3s; }
  .confetti-24 { left: 68%; animation-duration: 2.7s; }
  .confetti-25 { left: 78%; animation-duration: 3.1s; }
  .confetti-26 { left: 88%; animation-duration: 2.5s; }
  .confetti-27 { left: 8%;  animation-duration: 3.0s; }
  .confetti-28 { left: 18%; animation-duration: 2.8s; }
  .confetti-29 { left: 27%; animation-duration: 3.1s; }
  .confetti-30 { left: 37%; animation-duration: 2.6s; }
  .confetti-31 { left: 47%; animation-duration: 2.9s; }
  .confetti-32 { left: 57%; animation-duration: 3.2s; }
  .confetti-33 { left: 67%; animation-duration: 2.7s; }
  .confetti-34 { left: 77%; animation-duration: 3.0s; }
  .confetti-35 { left: 87%; animation-duration: 2.5s; }
  .confetti-36 { left: 95%; animation-duration: 3.3s; }
  .confetti-37 { left: 3%;  animation-duration: 2.9s; }
  .confetti-38 { left: 22%; animation-duration: 3.2s; }
  .confetti-39 { left: 42%; animation-duration: 2.6s; }
  .confetti-40 { left: 62%; animation-duration: 3.1s; }

  @keyframes confettiFall {
  0% {
  transform: translate3d(0, -120%, 0) rotateZ(0deg);
  }
  50% {
  transform: translate3d(10px, 40vh, 0) rotateZ(180deg);
  }
  100% {
  transform: translate3d(-10px, 110vh, 0) rotateZ(360deg);
  }
  }

  .heure-manche-centree {
  margin-top: 12px;
  text-align: center;
  color: #e7c671;
  font-size: 1.1rem;
  font-weight: 500;
  }


  .manche-info.minimal {
  margin-top: 14px;
  text-align: center;
  font-size: 1rem;
  color: #d5d5d5;
  }

  .manche-info.minimal strong {
  color: #d5d5d5;
  font-weight: 600;
  }

  .manche-info.minimal .duree {
  margin-left: 4px;
  color: #9AD9B6;
  font-size: 0.95rem;
  }

  .manche-infos {
  display: flex;
  justify-content: center;
  gap: 1.5rem;
  margin: 0.6rem 0 1rem;
  font-size: 0.9rem;
  color: #d1d5db; /* gris doux */
  }

  .manche-infos strong {
  color: #fbbf24; /* doré */
  }


  /* 🔥 Cacher uniquement le logo IWB sur mobile */
  @media (max-width: 768px) {
  img[src*="logo_iwb"],
  .right-logo,
  .corner-logo.right {
  display: none !important;
  }
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



  /* Étiquette "Avec qui ?" – style élégant */
  .emballage-label-text {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;

  margin: 0.35rem 0 0.2rem;

  font-weight: 600;
  font-size: 0.78rem;
  text-transform: uppercase;
  letter-spacing: 0.18em;

  color: #d8a25a !important;
  opacity: 0.95;

  position: relative;
  }

  /* Fines lignes dorées de chaque côté du texte */
  .emballage-label-text::before,
  .emballage-label-text::after {
  content: "";
  flex: 1;
  height: 1px;
  border-radius: 999px;
  background: linear-gradient(
  to right,
  transparent,
  rgba(245, 185, 66, 0.7)
  );
  opacity: 0.8;
  }

  .emballage-label-text::before {
  background: linear-gradient(
  to left,
  transparent,
  rgba(245, 185, 66, 0.7)
  );
  }

  /* Légère mise en valeur du select associé */
  .emballage select {
  width: 100%;
  margin-top: 0.15rem;
  border-color: rgba(245, 185, 66, 0.45);
  }

  .emballage select:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(245, 185, 66, 0.35);
  }


  /* Taille des scores dans la ligne "Résultats" */
  .players-table tbody tr td:not(.label-cell) {
  font-size: 1.2rem !important;
  font-weight: 700;
  color: #e7e7e7;
  }


  .modal {
  max-height: 88vh  /* utilise plus d’écran */
  min-height: 60vh;             /* évite une petite modale */
  overflow: auto;               /* scroll interne si besoin */
  }


  .casino-arrow {
  color: #fbbf24;
  font-size: 2.2rem;
  opacity: 0.9;
  }


  .ordre-couleurs {
  margin: 1.3rem auto 0.8rem;
  padding: 0.6rem 1.2rem;
  border: 1px solid rgba(245, 185, 66, 0.25);
  border-radius: 14px;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.9rem;
  background: rgba(0, 0, 0, 0.25);
  box-shadow: inset 0 0 12px rgba(0, 0, 0, 0.35);
  }

  .c-symbole {
  font-size: 2.6rem;
  font-weight: bold;
  text-shadow: 0 0 6px rgba(0,0,0,0.7);
  }

  .c-symbole.pique,
  .c-symbole.trefle {
  color: #e6e6e6;
  }

  .c-symbole.carreau {
  color: #ff4747;
  }

  .c-symbole.coeur {
  color: #ff3333;
  }

  .c-arrow {
  font-size: 2rem;
  color: #f5b942;
  opacity: 0.88;
  text-shadow:
  0 0 5px rgba(245,185,66,0.55),
  0 0 10px rgba(245,185,66,0.35);
  }

  .c-symbole {
  font-size: 2.6rem;
  text-shadow:
  0 0 3px #00ff9c,
  0 0 6px #00ff9c,
  0 0 12px rgba(0,255,160,0.5),
  0 0 18px rgba(0,255,160,0.35);
  }

  .c-symbole.pique,
  .c-symbole.trefle {
  color: #000;
  }

  .c-symbole.carreau,
  .c-symbole.coeur {
  color: #e63946; /* rouge vif */
  }

  /* Modale "Ordre des annonces" un peu plus haute */
  .modal-annonces {
  max-height: 86vh;              /* laisse une petite marge en haut/bas */
  }

  /* Liste qui prend plus de place dans la modale */
  .modal-annonces .annonces-list {
  max-height: 560px;             /* augmente pour remplir l’espace */
  margin-bottom: 0.6rem;         /* rapproche du bloc des couleurs */
  }
  /* Wrapper centré */
  .ordre-couleurs-wrapper {
  display: flex;
  justify-content: center;
  margin-top: 1rem;
  }

  /* Cadre or – légèrement plus petit, mais pas minuscule */
  .ordre-couleurs {
  display: flex;
  align-items: center;
  gap: 1rem;

  padding: 0.6rem 1.4rem;         /* 🔥 moins haut, mais cadre visible */
  border-radius: 18px;

  border: 1px solid rgba(245, 185, 66, 0.65);
  background: rgba(0, 0, 0, 0.18);

  box-shadow:
  0 0 14px rgba(245, 185, 66, 0.32),
  0 0 4px rgba(245, 185, 66, 0.55) inset;
  }

  /* Symboles bien alignés */
  .c-symbole {
  font-size: 2.4rem;              /* 🔥 taille uniforme */
  line-height: 1;                 /* 🔥 évite qu’ils montent ou descendent */
  display: flex;
  align-items: center;
  justify-content: center;

  text-shadow:
  0 0 6px rgba(0,255,160,0.7),
  0 0 12px rgba(0,255,160,0.45),
  0 0 18px rgba(0,255,160,0.25);
  }

  /* ♠ & ♣ noirs */
  .c-symbole.pique,
  .c-symbole.trefle {
  color: #000;
  filter: brightness(1.3); /* noir un peu relevé pour la lisibilité */
  }

  /* ♦ & ♥ rouge + glow vert */
  .c-symbole.carreau,
  .c-symbole.coeur {
  color: #ff4444;
  text-shadow:
  0 0 6px rgba(0,255,160,0.7),
  0 0 12px rgba(0,255,160,0.45),
  0 0 18px rgba(0,255,160,0.25);
  }

  /* Flèches centrées verticalement */
  .c-arrow {
  font-size: 1.8rem;
  line-height: 1;
  display: flex;
  align-items: center;

  color: #facc15;
  text-shadow:
  0 0 5px rgba(250,204,21,0.6),
  0 0 14px rgba(250,204,21,0.35);
  }

  .modal-annonces button {
  display: block;
  margin: 1.2rem auto 0 auto;   /* 🔥 centré horizontalement */
  }

  /* 🔔 Modale "quitter la manche" */

  .leave-modal {
  max-width: 480px;
  text-align: center;
  box-shadow:
  0 0 40px rgba(250, 204, 21, 0.23),
  0 0 0 1px rgba(250, 204, 21, 0.08);
  }

  .leave-modal h3 {
  margin-top: 0;
  margin-bottom: 0.75rem;
  font-size: 1.1rem;
  color: #fde68a; /* jaune doux */
  }

  .leave-modal p {
  margin: 0.25rem 0;
  }

  .leave-warning {
  margin-top: 0.75rem;
  font-size: 0.95rem;
  font-weight: 600;
  color: #f97316; /* orange avertissement */
  }

  .modal-actions {
  margin-top: 1.4rem;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.75rem;
  }

  .modal-actions .danger {
  background: #7f1d1d;
  border-color: #f97316;
  color: #fff;
  padding-inline: 1.8rem;
  }

  .modal-actions .danger:hover {
  background: #991b1b;
  }

  .modal-actions .secondary {
  background: transparent;
  border-color: #64748b;
  color: #e5e7eb;
  }

  .modal-actions .secondary:hover {
  background: rgba(15, 23, 42, 0.8);
  }

  /* Conteneur de l’icône */
  .warning-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 0.6rem;
  }

  /* Cercle doré premium */
  .warning-triangle {
  width: 65px;
  height: 65px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;

  /* 🌟 disque doré, centre moins blanc */
  background: radial-gradient(circle at 30% 30%,
  #fee9a8 0%,
  #fddf6a 35%,
  #f4a21c 70%,
  #b45309 100%
  );

  /* halo doré */
  box-shadow:
  0 0 12px rgba(250, 204, 21, 0.6),
  0 0 30px rgba(250, 160, 30, 0.4);

  /* 🔥 flash casino */
  animation: warning-pulse 1.2s ease-in-out infinite;
  }

  /* Point d’exclamation premium */
  .warning-triangle span {
  position: relative;
  z-index: 1;

  font-size: 2.4rem;
  font-weight: 900;

  /* 🎯 bien contrasté, presque noir */
  color: #111827 !important;

  /* on annule toute ancienne astuce de texte transparent */
  background: none !important;
  -webkit-background-clip: initial;
  -webkit-text-fill-color: initial;

  /* halo doré autour pour le côté casino */
  text-shadow:
  0 0 3px rgba(255, 255, 255, 0.9),
  0 0 8px rgba(250, 204, 21, 0.8);
  }

  /* Animation douce casino */
  @keyframes warning-pulse {
  0% {
  transform: scale(1);
  box-shadow:
  0 0 10px rgba(250, 204, 21, 0.5),
  0 0 25px rgba(250, 160, 30, 0.35);
  }
  40% {
  transform: scale(1.08);
  box-shadow:
  0 0 18px rgba(250, 204, 21, 0.9),
  0 0 45px rgba(250, 160, 30, 0.55);
  }
  100% {
  transform: scale(1);
  box-shadow:
  0 0 10px rgba(250, 204, 21, 0.5),
  0 0 25px rgba(250, 160, 30, 0.35);
  }
  }


  .pause-floating {
  position: fixed;
  top: 10px;
  right: 10px;
  background: #04140a; /* ton vert foncé */
  border: 1px solid #00995a;
  border-radius: 50%;
  width: 44px;
  height: 44px;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 0 6px rgba(0, 179, 107, 0.40);
  }

  .pause-floating svg {
  width: 22px;
  height: 22px;
  fill: #d4af37;
  }

  .footer-mail {
  color: #d4af37; /* ton doré */
  text-decoration: none;
  margin-left: 4px;
  }
  .footer-mail:hover {
  text-decoration: underline;
  }

  .dealer-col {
  width: 20px;        /* assez large pour une emoji */
  text-align: center; /* icône bien centrée */
  padding-right: 0;
  padding-left: 0;
  }

  .dealer-icon {
  font-size: 1rem;
  display: inline-block;
  }

  .preview-scores .preview-table {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
  }

  .preview-scores .preview-table .dealer-col {
  width: 1.8rem;   /* ajuste si tu veux plus/moins large */
  }

  .preview-scores .preview-table .dealer-cell {
  text-align: center;
  padding-left: 0;
  padding-right: 0;
  }

  .preview-scores .preview-table .dealer-icon {
  display: inline-block;
  font-size: 1.1rem;
  }
  /* on neutralise les bordures existantes */
  .preview-scores .preview-table td {
  border-bottom: none;
  }

  /* on remet la ligne sous Joueur + Score uniquement */
  .preview-scores .preview-table tbody tr:not(:last-child) td:nth-child(n + 2) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.2);
  }


  .cell-score-negative {
  color: #ff8b8b;      /* rouge doux */
  font-weight: 600;    /* léger accent sans être criard */
  }


  /* Ligne Total en bas de la feuille de points */
  .total-row td {
  background: rgba(247, 198, 79, 0.12);   /* léger fond doré */
  font-weight: 600;
  border-top: 2px solid rgba(247, 198, 79, 0.7); /* petite séparation au-dessus */
  }

  /* Optionnel : style du libellé "Total" */
  .total-row .cell-annonce {
  text-transform: uppercase;
  letter-spacing: 0.06em;
  }

  /* Ligne TOTAL (fond léger + séparation) */
  .total-row td {
  background: rgba(247, 198, 79, 0.12);
  font-weight: 600;
  border-top: 2px solid rgba(247, 198, 79, 0.7);
  }

  /* Cellule "TOTAL" à gauche */
  .cell-total-label {
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  }

  /* Cellule de total par joueur */
  .cell-total-value {
  text-align: center;
  }

  /* Gagnant en surbrillance 📌 */
  .winner-total {
  background: rgba(247, 198, 79, 0.35);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.4) inset;
  font-weight: 700;
  }

  .feuille-points-modal {
  position: relative;
  overflow: hidden;
  }



  /* Harmoniser l'encadré doré sur la dernière ligne de donne */

  /* Bordures dorées pour Score + Cumul sur la dernière donne */
  .feuille-table tr.last-donne-row td.cell-score,
  .feuille-table tr.last-donne-row td.cell-cumul-final {
  border-right: 2px solid #fbbf24;
  }


  .feuille-table tr.classement-spacer-row td {
  height: 0.3rem;     /* épaisseur de l'espace */
  background: transparent;
  border: none;
  }

  /* ✅ Ajustement spécial tablettes (paysage) : 769px à 1200px */
  @media (min-width: 769px) and (max-width: 1200px) {
  .page-header-wrapper {
  max-width: 100%;      /* pas plus large que l'écran */
  gap: 1rem;            /* un peu moins d'espace entre logo / header */
  padding: 0 0.5rem;    /* petit padding intérieur pour éviter d'être collé au bord */
  box-sizing: border-box;
  }

  .corner-logo {
  height: 120px;        /* au lieu de 180px → plus adapté à une tablette */
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.65));
  }

  .corner-logo-left {
  margin-left: 0;       /* évite de pousser vers l'extérieur */
  }

  .corner-logo-right {
  margin-right: 0;
  }
  }
 
</style>

