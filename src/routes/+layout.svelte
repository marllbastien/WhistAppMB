<script lang="ts">
  import { onMount } from 'svelte';
  import favicon from '$lib/assets/favicon.svg';
  import CookieBubble from '$lib/components/CookieBubble.svelte';



  let updateAvailable = false;

  function reloadApp() {
  window.location.reload();
  }

  onMount(() => {
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

<slot />

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


</style>
