<script lang="ts">
  import { onMount } from 'svelte';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let showDescription = false; // Affiche la description complète (pour la page Home)
  export let compact = false; // Version compacte (pour la page Annonces)

  // Mode actuel : 'classic' ou 'light'
  let mode: 'classic' | 'light' = 'classic';
  let showTooltip = false;

  const STORAGE_KEY = 'whist-encoding-mode';

  onMount(() => {
    // Charger la préférence depuis sessionStorage
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'classic') {
      mode = saved;
    }
  });

  function toggleMode() {
    mode = mode === 'classic' ? 'light' : 'classic';
    sessionStorage.setItem(STORAGE_KEY, mode);
    dispatch('change', { mode });
  }

  function handleTooltipToggle() {
    showTooltip = !showTooltip;
  }

  // Export pour que les parents puissent lire le mode
  export function getMode(): 'classic' | 'light' {
    return mode;
  }

  // Fonction pour récupérer le mode depuis n'importe où
  export function getModeFromStorage(): 'classic' | 'light' {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved === 'light' || saved === 'classic') {
        return saved;
      }
    }
    return 'classic';
  }
</script>

{#if showDescription}
  <!-- Version avec description complète (page Home) -->
  <div class="mode-toggle-section">
    <div class="mode-toggle-header">
      <span class="mode-label">Mode d'encodage</span>
      <button 
        class="info-btn" 
        on:click={handleTooltipToggle}
        aria-label="Plus d'informations"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4M12 8h.01"/>
        </svg>
      </button>
    </div>

    {#if showTooltip}
      <div class="tooltip-box">
        <p><strong>Mode Tablette :</strong> Encodage par joueur, chaque joueur choisit son annonce. Interface optimisée pour tablettes.</p>
        <p><strong>Mode Tel :</strong> Encodage par annonce, optimisé pour les téléphones. Gain de place significatif.</p>
        <button class="close-tooltip" on:click={() => showTooltip = false}>✕</button>
      </div>
    {/if}

    <div class="toggle-container">
      <button
        class="mode-btn"
        class:active={mode === 'classic'}
        on:click={() => { if (mode !== 'classic') toggleMode(); }}
      >
        <svg width="18" height="14" viewBox="0 0 24 18" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="1" y="1" width="22" height="16" rx="2" ry="2"/>
          <circle cx="20" cy="9" r="1" fill="currentColor"/>
        </svg>
        Tablette
      </button>
      <button
        class="mode-btn"
        class:active={mode === 'light'}
        on:click={() => { if (mode !== 'light') toggleMode(); }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
          <line x1="12" y1="18" x2="12" y2="18.01"/>
        </svg>
        Tel
      </button>
    </div>
  </div>
{:else if compact}
  <!-- Version compacte (page Annonces) -->
  <div class="mode-toggle-compact">
    <span class="mode-icon" class:light={mode === 'light'} title={mode === 'classic' ? 'Mode Tablette' : 'Mode Tel'}>
      {#if mode === 'light'}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
          <line x1="12" y1="18" x2="12" y2="18.01"/>
        </svg>
      {:else}
        <svg width="16" height="12" viewBox="0 0 24 18" fill="none" stroke="currentColor" stroke-width="1.8">
          <rect x="1" y="1" width="22" height="16" rx="2" ry="2"/>
          <circle cx="20" cy="9" r="1" fill="currentColor"/>
        </svg>
      {/if}
    </span>
    <button
      class="toggle-switch"
      class:light={mode === 'light'}
      on:click={toggleMode}
      aria-label="Changer de mode"
      title={mode === 'classic' ? 'Passer en mode Tel' : 'Passer en mode Tablette'}
    >
      <span class="switch-track">
        <span class="switch-thumb"></span>
      </span>
    </button>
  </div>
{:else}
  <!-- Version standard (toggle simple) -->
  <div class="mode-toggle-simple">
    <span class="label-text">Mode :</span>
    <button
      class="toggle-switch"
      class:light={mode === 'light'}
      on:click={toggleMode}
      aria-label="Changer de mode d'encodage"
    >
      <span class="switch-track">
        <span class="switch-thumb"></span>
      </span>
    </button>
    <span class="mode-name">{mode === 'classic' ? 'Tablette' : 'Tel'}</span>
  </div>
{/if}

<style>
  /* Version avec description (Home) */
  .mode-toggle-section {
    background: rgba(5, 46, 22, 0.4);
    border: 1px solid rgba(34, 197, 94, 0.4);
    border-radius: 10px;
    padding: 0.6rem 1rem;
    margin: 0.6rem 0;
  }

  .mode-toggle-header {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 0.5rem;
  }

  .mode-label {
    font-weight: 600;
    color: #e5e7eb;
    font-size: 0.9rem;
  }

  .info-btn {
    background: none;
    border: none;
    font-size: 1rem;
    cursor: pointer;
    opacity: 0.6;
    transition: opacity 0.2s;
    padding: 0;
    color: #9ca3af;
    display: flex;
    align-items: center;
  }

  .info-btn:hover {
    opacity: 1;
    color: #e5e7eb;
  }

  .tooltip-box {
    background: rgba(0, 0, 0, 0.9);
    border: 1px solid rgba(34, 197, 94, 0.4);
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin-bottom: 0.75rem;
    position: relative;
    font-size: 0.85rem;
    color: #d1d5db;
  }

  .tooltip-box p {
    margin: 0.3rem 0;
  }

  .close-tooltip {
    position: absolute;
    top: 4px;
    right: 6px;
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    font-size: 0.9rem;
    padding: 2px 6px;
  }

  .toggle-container {
    display: flex;
    gap: 0.5rem;
  }

  .mode-btn {
    flex: 1;
    padding: 0.45rem 0.8rem;
    border-radius: 8px;
    border: 1px solid rgba(75, 85, 99, 0.6);
    background: rgba(0, 0, 0, 0.3);
    color: #9ca3af;
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
  }

  .mode-btn svg {
    flex-shrink: 0;
  }

  .mode-btn:hover {
    border-color: rgba(255, 255, 255, 0.3);
    color: #e5e7eb;
  }

  .mode-btn.active {
    background: rgba(255, 255, 255, 0.1);
    border-color: #d4a855;
    color: #fff;
    font-weight: 600;
  }

  .mode-description {
    margin: 0.5rem 0 0 0;
    font-size: 0.8rem;
    color: #9ca3af;
    text-align: center;
  }

  .mode-description strong {
    color: #fbbf24;
  }

  /* Version compacte (Annonces) */
  .mode-toggle-compact {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    position: relative;
  }

  .mode-icon {
    font-size: 0.9rem;
    color: #9ca3af;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.2s;
  }

  .mode-icon.light {
    color: #fbbf24;
  }

  .mode-icon svg {
    width: 14px;
    height: 14px;
  }

  .info-btn-small {
    background: none;
    border: none;
    font-size: 0.85rem;
    cursor: pointer;
    opacity: 0.6;
    padding: 0;
    transition: opacity 0.2s;
  }

  .info-btn-small:hover {
    opacity: 1;
  }

  .tooltip-compact {
    position: absolute;
    top: 100%;
    left: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.95);
    border: 1px solid rgba(34, 197, 94, 0.4);
    border-radius: 8px;
    padding: 0.5rem 0.75rem;
    margin-top: 0.25rem;
    font-size: 0.8rem;
    color: #d1d5db;
    white-space: nowrap;
  }

  .tooltip-compact p {
    margin: 0.2rem 0;
  }

  .tooltip-hint {
    color: #fbbf24;
    font-size: 0.75rem;
  }

  .close-tooltip-small {
    position: absolute;
    top: 2px;
    right: 4px;
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    font-size: 0.75rem;
    padding: 0;
  }

  /* Toggle switch */
  .toggle-switch {
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }

  .switch-track {
    display: block;
    width: 32px;
    height: 18px;
    background: rgba(75, 85, 99, 0.6);
    border: 1px solid rgba(156, 163, 175, 0.3);
    border-radius: 999px;
    position: relative;
    transition: all 0.2s ease;
  }

  .toggle-switch:hover .switch-track {
    border-color: rgba(251, 191, 36, 0.5);
  }

  .toggle-switch.light .switch-track {
    background: rgba(251, 191, 36, 0.25);
    border-color: rgba(251, 191, 36, 0.6);
  }

  .switch-thumb {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 12px;
    height: 12px;
    background: #9ca3af;
    border-radius: 50%;
    transition: all 0.2s ease;
  }

  .toggle-switch.light .switch-thumb {
    transform: translateX(14px);
    background: #fbbf24;
  }

  /* Version simple */
  .mode-toggle-simple {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .label-text {
    font-size: 0.85rem;
    color: #9ca3af;
  }

  .mode-name {
    font-size: 0.85rem;
    color: #e5e7eb;
    font-weight: 500;
  }

  /* Responsive */
  @media (max-width: 500px) {
    .mode-toggle-section {
      padding: 0.75rem 1rem;
    }

    .mode-btn {
      padding: 0.5rem 0.75rem;
      font-size: 0.85rem;
    }

    .toggle-container {
      gap: 0.4rem;
    }
  }
</style>
