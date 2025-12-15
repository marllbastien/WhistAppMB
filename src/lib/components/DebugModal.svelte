<script lang="ts">
  import { browser } from '$app/environment';

  // Props
  export let show = false;
  export let appVersion = 'dev';
  export let buildTime = '';

  // Props optionnels pour infos spécifiques à la page Annonces
  export let tableConfigId: number | null = null;
  export let donnes: number | null = null;
  export let competitionLabel: string | null = null;
  export let grilleSource: string | null = null;
  export let annoncesSource: string | null = null;

  // Infos système dynamiques
  $: isOnline = browser ? navigator.onLine : true;
  $: userAgent = browser ? navigator.userAgent : '';
  $: browserInfo = parseBrowserInfo(userAgent);

  function parseBrowserInfo(ua: string): string {
    if (!ua) return 'Inconnu';

    // Détection du navigateur
    let browser = 'Navigateur inconnu';
    if (ua.includes('Firefox/')) {
      const match = ua.match(/Firefox\/(\d+)/);
      browser = `Firefox ${match?.[1] ?? ''}`;
    } else if (ua.includes('Edg/')) {
      const match = ua.match(/Edg\/(\d+)/);
      browser = `Edge ${match?.[1] ?? ''}`;
    } else if (ua.includes('Chrome/')) {
      const match = ua.match(/Chrome\/(\d+)/);
      browser = `Chrome ${match?.[1] ?? ''}`;
    } else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
      const match = ua.match(/Version\/(\d+)/);
      browser = `Safari ${match?.[1] ?? ''}`;
    }

    // Détection de l'OS
    let os = 'OS inconnu';
    if (ua.includes('Android')) {
      const match = ua.match(/Android (\d+(?:\.\d+)?)/);
      os = `Android ${match?.[1] ?? ''}`;
    } else if (ua.includes('iPhone') || ua.includes('iPad')) {
      const match = ua.match(/OS (\d+)_/);
      os = `iOS ${match?.[1] ?? ''}`;
    } else if (ua.includes('Windows NT 10')) {
      os = 'Windows 10/11';
    } else if (ua.includes('Windows')) {
      os = 'Windows';
    } else if (ua.includes('Mac OS X')) {
      os = 'macOS';
    } else if (ua.includes('Linux')) {
      os = 'Linux';
    }

    return `${browser} / ${os}`;
  }

  function close() {
    show = false;
  }

  // Formater la date de build
  $: formattedBuildTime = buildTime
    ? new Date(buildTime).toLocaleString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'N/A';

  // Service Worker version (on essaie de la récupérer)
  let swVersion = 'N/A';
  if (browser && 'serviceWorker' in navigator) {
    navigator.serviceWorker.ready.then((reg) => {
      // On ne peut pas facilement récupérer la version du SW
      // On affiche juste s'il est actif
      swVersion = reg.active ? 'Actif' : 'Inactif';
    }).catch(() => {
      swVersion = 'Non disponible';
    });
  }

  // Détecter si c'est une PWA installée
  $: isPWA = browser && window.matchMedia('(display-mode: standalone)').matches;

  // Écouter les changements de connexion
  function handleOnline() {
    isOnline = true;
  }
  function handleOffline() {
    isOnline = false;
  }

  import { onMount, onDestroy } from 'svelte';

  onMount(() => {
    if (browser) {
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
    }
  });

  onDestroy(() => {
    if (browser) {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  });
</script>

{#if show}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="modal-backdrop" on:click={close}>
    <div class="modal debug-modal" on:click|stopPropagation>
      <button class="modal-close-btn" on:click={close} aria-label="Fermer">✕</button>

      <h3>Informations de debug</h3>

      <div class="debug-section">
        <h4>Application</h4>
        <div class="debug-row">
          <span class="debug-label">Version</span>
          <span class="debug-value">v{appVersion}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Build</span>
          <span class="debug-value">{formattedBuildTime}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Service Worker</span>
          <span class="debug-value">{swVersion}</span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Mode</span>
          <span class="debug-value">{isPWA ? 'PWA installée' : 'Navigateur'}</span>
        </div>
      </div>

      <div class="debug-section">
        <h4>Connexion</h4>
        <div class="debug-row">
          <span class="debug-label">Statut</span>
          <span class="debug-value status" class:online={isOnline} class:offline={!isOnline}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </span>
        </div>
        <div class="debug-row">
          <span class="debug-label">Appareil</span>
          <span class="debug-value">{browserInfo}</span>
        </div>
      </div>

      {#if tableConfigId !== null}
        <div class="debug-section">
          <h4>Session en cours</h4>
          <div class="debug-row">
            <span class="debug-label">TableConfigId</span>
            <span class="debug-value mono">{tableConfigId}</span>
          </div>
          {#if donnes !== null}
            <div class="debug-row">
              <span class="debug-label">Donnes</span>
              <span class="debug-value">{donnes}</span>
            </div>
          {/if}
          {#if competitionLabel}
            <div class="debug-row">
              <span class="debug-label">Compétition</span>
              <span class="debug-value">{competitionLabel}</span>
            </div>
          {/if}
          {#if grilleSource}
            <div class="debug-row">
              <span class="debug-label">Source grille</span>
              <span class="debug-value source" class:local={grilleSource.includes('local') || grilleSource.includes('Fallback')}>
                {grilleSource}
              </span>
            </div>
          {/if}
          {#if annoncesSource}
            <div class="debug-row">
              <span class="debug-label">Source annonces</span>
              <span class="debug-value source" class:local={annoncesSource.includes('local') || annoncesSource.includes('Draft')}>
                {annoncesSource}
              </span>
            </div>
          {/if}
        </div>
      {/if}

      <button class="btn-close" on:click={close}>Fermer</button>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(3, 7, 18, 0.85);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
  }

  .debug-modal {
    background: linear-gradient(180deg, #0a1f14 0%, #061510 100%);
    color: #e5e7eb;
    padding: 1.5rem;
    border-radius: 16px;
    max-width: 380px;
    width: 90%;
    box-shadow: 0 0 40px rgba(0, 255, 120, 0.2);
    border: 1px solid rgba(0, 255, 156, 0.3);
    position: relative;
  }

  .modal-close-btn {
    position: absolute;
    top: 0.6rem;
    right: 0.6rem;
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: #9ca3af;
    font-size: 1.2rem;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    cursor: pointer;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .modal-close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    color: white;
  }

  h3 {
    margin: 0 0 1rem 0;
    font-size: 1.1rem;
    color: #f5b942;
    text-align: center;
  }

  .debug-section {
    margin-bottom: 1rem;
    padding: 0.8rem;
    background: rgba(0, 0, 0, 0.3);
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .debug-section h4 {
    margin: 0 0 0.6rem 0;
    font-size: 0.8rem;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .debug-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.3rem 0;
    font-size: 0.85rem;
  }

  .debug-row:not(:last-child) {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }

  .debug-label {
    color: #9ca3af;
  }

  .debug-value {
    color: #e5e7eb;
    font-weight: 500;
  }

  .debug-value.mono {
    font-family: monospace;
    background: rgba(255, 255, 255, 0.1);
    padding: 0.15rem 0.4rem;
    border-radius: 4px;
    font-size: 0.8rem;
  }

  .debug-value.status.online {
    color: #4ade80;
  }

  .debug-value.status.offline {
    color: #f87171;
  }

  .debug-value.source.local {
    color: #fbbf24;
  }

  .btn-close {
    display: block;
    width: 100%;
    margin-top: 0.5rem;
    padding: 0.6rem 1.5rem;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: #0b2814;
    color: #e5e7eb;
    cursor: pointer;
    font-size: 0.9rem;
    transition: background 0.2s ease;
  }

  .btn-close:hover {
    background: #114023;
  }
</style>
