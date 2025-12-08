<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  // Props passés par le parent
  export let players: string[] = [];
  export let inactivePlayers: string[] = [];
  export let annonces: { code: string; label: string; templateResult: number }[] = [];

  // État local
  let selectedAnnonce: string = '';
  let selectedPreneur: string = '';
  let selectedPartenaire: string = '';

  // Joueurs actifs
  $: activePlayers = players.filter(p => !inactivePlayers.includes(p));

  // Template de l'annonce sélectionnée
  $: selectedTemplate = annonces.find(a => a.code === selectedAnnonce)?.templateResult ?? 0;

  // Joueurs restants pour partenaire (excluant le preneur)
  $: partnersAvailable = activePlayers.filter(p => p !== selectedPreneur);

  // L'annonce nécessite-t-elle un partenaire ?
  $: needsPartner = selectedTemplate === 2 || selectedAnnonce === 'TR';

  // L'annonce est-elle un jeu à 2 joueurs (template 4) ?
  $: isDual = selectedTemplate === 4;

  // Est-ce l'annonce Dames ?
  $: isDames = selectedTemplate === 6;

  // Réinitialiser tout
  export function reset() {
    selectedAnnonce = '';
    selectedPreneur = '';
    selectedPartenaire = '';
    previousAnnonce = '';
  }

  // Flag pour éviter le reset lors de la synchronisation
  let isSyncing = false;

  // Synchroniser depuis l'état classique
  export function syncFromClassic(annonceByPlayer: Record<string, string>, emballes: Record<string, string>) {
    console.log('[LightModeEncoder] syncFromClassic called with:', { annonceByPlayer, emballes });
    isSyncing = true;
    
    // Trouver le premier joueur avec une annonce (le preneur)
    const entries = Object.entries(annonceByPlayer).filter(([_, code]) => code && code !== '');
    
    if (entries.length === 0) {
      // Pas d'annonce, on reset
      isSyncing = false;
      reset();
      return;
    }

    // Prendre la première annonce trouvée
    const [preneur, annonceCode] = entries[0];
    
    // Vérifier si c'est une annonce Dames (tous les joueurs ont la même annonce 'D')
    const allDames = entries.every(([_, code]) => code === 'D');
    if (allDames && entries.length > 1) {
      previousAnnonce = 'D';
      selectedAnnonce = 'D';
      selectedPreneur = '';
      selectedPartenaire = '';
      isSyncing = false;
      return;
    }

    // Vérifier si c'est un jeu dual (deux joueurs avec la même annonce)
    const template = annonces.find(a => a.code === annonceCode)?.templateResult ?? 0;
    if (template === 4 && entries.length === 2) {
      previousAnnonce = annonceCode;
      selectedAnnonce = annonceCode;
      selectedPreneur = entries[0][0];
      selectedPartenaire = entries[1][0];
      isSyncing = false;
      return;
    }

    // Sinon c'est un jeu solo ou avec partenaire
    previousAnnonce = annonceCode;
    selectedAnnonce = annonceCode;
    selectedPreneur = preneur;
    
    // Vérifier s'il y a un partenaire (emballage)
    if (emballes[preneur]) {
      selectedPartenaire = emballes[preneur];
    } else {
      selectedPartenaire = '';
    }
    
    console.log('[LightModeEncoder] syncFromClassic result:', { selectedAnnonce, selectedPreneur, selectedPartenaire, previousAnnonce });
    isSyncing = false;
  }

  // Variable pour tracker le changement d'annonce
  let previousAnnonce = '';

  // Reactive: quand selectedAnnonce change, reset les sélections (sauf lors de la sync)
  $: if (selectedAnnonce !== previousAnnonce && !isSyncing) {
    console.log('[LightModeEncoder] Annonce changed from', previousAnnonce, 'to', selectedAnnonce);
    const wasNotEmpty = previousAnnonce !== '';
    previousAnnonce = selectedAnnonce;
    selectedPreneur = '';
    selectedPartenaire = '';
    
    // Si on change d'annonce (pas le premier chargement), on réinitialise le parent
    if (wasNotEmpty && selectedAnnonce) {
      // Pour les Dames, on applique directement à tous les joueurs
      if (annonces.find(a => a.code === selectedAnnonce)?.templateResult === 6) {
        applyDames();
      } else {
        // Sinon on efface les annonces précédentes
        dispatch('update', {
          annonceByPlayer: {},
          emballes: {}
        });
      }
    } else if (selectedAnnonce && annonces.find(a => a.code === selectedAnnonce)?.templateResult === 6) {
      // Premier chargement avec Dames
      applyDames();
    }
  }

  // Quand on sélectionne le preneur
  function handlePreneurSelect(player: string) {
    console.log('[LightModeEncoder] handlePreneurSelect:', player, 'needsPartner:', needsPartner, 'isDual:', isDual, 'selectedAnnonce:', selectedAnnonce);
    const previousPreneur = selectedPreneur;
    selectedPreneur = player;
    
    // Si le partenaire était le même que le nouveau preneur, on le désélectionne
    if (selectedPartenaire === player) {
      selectedPartenaire = '';
    }
    
    // Si pas besoin de partenaire, on applique directement
    if (!needsPartner && !isDual) {
      applySelection();
    } else if (selectedPartenaire) {
      // Si un partenaire est déjà sélectionné, on re-applique avec le nouveau preneur
      if (isDual) {
        applyDualSelection();
      } else {
        applySelection();
      }
    } else if (previousPreneur) {
      // On a changé le preneur mais pas encore de partenaire - on efface l'ancien état
      dispatch('update', {
        annonceByPlayer: {},
        emballes: {}
      });
    }
  }

  // Quand on sélectionne le partenaire
  function handlePartenaireSelect(player: string) {
    selectedPartenaire = player;
    
    // On applique la sélection
    if (isDual) {
      applyDualSelection();
    } else {
      applySelection();
    }
  }

  // Appliquer la sélection simple (solo ou avec partenaire)
  function applySelection() {
    // Réinitialiser les annonces précédentes
    const newAnnonceByPlayer: Record<string, string> = {};
    const newEmballes: Record<string, string> = {};

    // Définir l'annonce pour le preneur
    newAnnonceByPlayer[selectedPreneur] = selectedAnnonce;
    console.log('[LightModeEncoder] applySelection:', { selectedPreneur, selectedAnnonce, newAnnonceByPlayer });

    // Si partenaire requis
    if (needsPartner && selectedPartenaire) {
      newEmballes[selectedPreneur] = selectedPartenaire;
    }

    dispatch('update', {
      annonceByPlayer: newAnnonceByPlayer,
      emballes: newEmballes
    });

    // Ne PAS réinitialiser - on garde la sélection affichée
    // Le reset sera fait par le parent quand on passe à la donne suivante
  }

  // Appliquer la sélection pour jeu à 2 joueurs (même annonce pour les 2)
  function applyDualSelection() {
    const newAnnonceByPlayer: Record<string, string> = {};
    
    newAnnonceByPlayer[selectedPreneur] = selectedAnnonce;
    newAnnonceByPlayer[selectedPartenaire] = selectedAnnonce;

    dispatch('update', {
      annonceByPlayer: newAnnonceByPlayer,
      emballes: {}
    });

    // Ne PAS réinitialiser - on garde la sélection affichée
  }

  // Appliquer l'annonce Dames à tous les joueurs actifs
  function applyDames() {
    const newAnnonceByPlayer: Record<string, string> = {};
    
    for (const p of activePlayers) {
      newAnnonceByPlayer[p] = 'D';
    }

    dispatch('update', {
      annonceByPlayer: newAnnonceByPlayer,
      emballes: {}
    });

    // Ne PAS réinitialiser - on garde la sélection affichée
  }
</script>

<div class="light-encoder-content">
  <!-- Dropdown Annonce -->
  <select bind:value={selectedAnnonce}>
    <option value="">-- Choisir annonce --</option>
    {#each annonces as a}
      <option value={a.code}>{a.label}</option>
    {/each}
  </select>

  <!-- Sélection du preneur (sauf pour Dames) -->
  {#if selectedAnnonce && !isDames}
    <div class="player-selector">
      <span class="selector-label">
        {#if isDual || needsPartner}
          Joueur 1 :
        {:else}
          Joueur :
        {/if}
      </span>
      <div class="partner-buttons">
        {#each activePlayers as p}
          <button
            type="button"
            class:selected={selectedPreneur === p}
            on:click={() => handlePreneurSelect(p)}
          >
            {p}
          </button>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Sélection du partenaire (pour Emballage, Trou ou Dual) -->
  {#if selectedPreneur && (needsPartner || isDual)}
    <div class="player-selector">
      <span class="selector-label">
        Joueur 2 :
      </span>
      <div class="partner-buttons">
        {#each partnersAvailable as p}
          <button
            type="button"
            class:selected={selectedPartenaire === p}
            on:click={() => handlePartenaireSelect(p)}
          >
            {p}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  /* Contenu du LightModeEncoder - le parent .encodage gère la carte */
  .light-encoder-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.8rem;
    width: 100%;
  }

  .light-encoder-content select {
    padding: 0.5rem 1rem;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.7);
    background: #020b06;
    color: #f9fafb;
    font-size: 1rem;
    cursor: pointer;
    -webkit-text-fill-color: #fff !important;
  }

  .light-encoder-content select option {
    color: #f9fafb;
    background: #020b06;
  }

  .light-encoder-content select:focus {
    outline: none;
    border-color: #f5b942;
    box-shadow: 0 0 0 2px rgba(245, 185, 66, 0.4);
  }

  .player-selector {
    width: 100%;
    max-width: 500px;
    display: flex;
    flex-direction: column;
    align-items: center;
    /* Même style que .player-row dans Encodage */
    background: rgba(4, 20, 12, 0.95);
    border: 1px solid rgba(31, 64, 50, 0.9);
    border-radius: 12px;
    padding: 0.7rem 0.9rem;
    margin-top: 0.5rem;
  }

  .selector-label {
    font-size: 0.85rem;
    color: #9ca3af;
    margin-bottom: 0.4rem;
  }

  .partner-buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 0.4rem;
  }

  .partner-buttons button {
    padding: 0.4rem 0.9rem;
    font-size: 1rem;
    font-weight: 600;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.7);
    background: #07170e;
    color: #f9fafb;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .partner-buttons button:hover {
    background: #0b2414;
    border-color: #f5b942;
  }

  .partner-buttons button.selected {
    background: #f5b942;
    color: #1c1917;
    border-color: #facc6b;
    font-weight: 600;
  }

  /* RESPONSIVE MOBILE */
  @media (max-width: 768px) {
    .player-selector {
      max-width: 100%;
      padding: 0.6rem 0.7rem;
    }

    .partner-buttons button {
      font-size: 0.85rem;
      padding: 0.35rem 0.7rem;
    }

    .selector-label {
      font-size: 0.8rem;
    }

    .light-encoder-content select {
      font-size: 0.95rem;
      padding: 0.45rem 0.9rem;
    }
  }

  @media (max-width: 480px) {
    .partner-buttons button {
      font-size: 0.8rem;
      padding: 0.3rem 0.6rem;
    }

    .partner-buttons {
      gap: 0.3rem;
    }
  }
</style>
