<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { browser } from '$app/environment';
  import favicon from '$lib/assets/favicon.svg';
  import CookieBubble from '$lib/components/CookieBubble.svelte';

  // Pages publiques (pas besoin d'être authentifié par l'app principale)
  // Note: /admin a son propre système d'authentification dans +layout.svelte admin
  const PUBLIC_ROUTES = ['/', '/legal'];

  // Préfixes de routes avec leur propre authentification
  const SELF_AUTH_PREFIXES = ['/admin'];
  
  // Durée de validité de l'autorisation (12 heures en millisecondes)
  const AUTH_EXPIRY_MS = 12 * 60 * 60 * 1000;

  let updateAvailable = false;
  let isAuthorized = false;
  let isChecking = true;

  function reloadApp() {
    window.location.reload();
  }

  // Vérifie si l'autorisation est encore valide (non expirée)
  function isAuthValid(): boolean {
    const authorized = localStorage.getItem('authorized') === 'true';
    if (!authorized) return false;
    
    const authorizedAt = localStorage.getItem('authorizedAt');
    if (!authorizedAt) {
      // Pas de timestamp = ancienne autorisation, on la considère expirée
      clearAuth();
      return false;
    }
    
    const elapsed = Date.now() - parseInt(authorizedAt, 10);
    if (elapsed > AUTH_EXPIRY_MS) {
      // Autorisation expirée
      clearAuth();
      return false;
    }
    
    return true;
  }
  
  // Supprime l'autorisation du localStorage
  function clearAuth() {
    localStorage.removeItem('authorized');
    localStorage.removeItem('authorizedAt');
  }

  // Vérification de l'autorisation
  function checkAuth(pathname: string) {
    if (!browser) return;

    const isPublicRoute = PUBLIC_ROUTES.includes(pathname);
    const hasSelfAuth = SELF_AUTH_PREFIXES.some(prefix => pathname.startsWith(prefix));
    const authorized = isAuthValid();

    if (!isPublicRoute && !hasSelfAuth && !authorized) {
      // Redirection vers la page de login
      goto('/');
      return;
    }

    isAuthorized = authorized || isPublicRoute || hasSelfAuth;
    isChecking = false;
  }

  // Réactif : vérifie à chaque changement de page
  $: if (browser) {
    checkAuth($page.url.pathname);
  }

  onMount(() => {
    // Vérification initiale
    checkAuth($page.url.pathname);

    if ('serviceWorker' in navigator) {
  // 🔔 messages du SW
  navigator.serviceWorker.addEventListener('message', (event) => {
  if (event.data?.type === 'NEW_VERSION') {
  updateAvailable = true;
  }
  });

  // SW déjà waiting ?
  navigator.serviceWorker.ready.then((reg) => {
  if (reg.waiting) {
  updateAvailable = true;
  }
  });

  // SW uniquement en prod
  if (import.meta.env.PROD) {
  navigator.serviceWorker
  .register('/service-worker.js')
  .then((reg) => {
  console.log('Service worker enregistré :', reg.scope);
  })
  .catch((err) => {
  console.error("Échec de l'enregistrement du service worker :", err);
  });
  }
  }
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

{#if isChecking}
  <!-- Affichage pendant la vérification d'auth -->
  <div class="auth-checking"></div>
{:else}
  <slot />
{/if}

<CookieBubble />



{#if updateAvailable}
  <div class="update-banner">
    <span>Une nouvelle version de WB-Scoring est disponible.</span>
    <button type="button" on:click={reloadApp}>Recharger</button>
  </div>
{/if}
<style>
  .update-banner {
  position: fixed;
  bottom: 4.5rem; /* ⭐ placé au-dessus de la cookie banner */
  left: 50%;
  transform: translateX(-50%);
  background: rgba(15, 23, 42, 0.95);
  color: #f9fafb;
  padding: 0.4rem 0.9rem;
  border-radius: 999px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  gap: 0.75rem;
  z-index: 99999;
  font-size: 0.8rem;
  }

  .update-banner button {
  border: none;
  border-radius: 999px;
  padding: 0.25rem 0.7rem;
  background: #22c55e;
  color: #020617;
  font-weight: 600;
  cursor: pointer;
  font-size: 0.78rem;
  }

  .update-banner button:hover {
  filter: brightness(1.05);
  }

  .auth-checking {
    min-height: 100vh;
    background: #020506;
  }

</style>
