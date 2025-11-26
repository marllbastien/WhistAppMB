<script lang="ts">
  import { onMount } from 'svelte';
  import favicon from '$lib/assets/favicon.svg';

  let { children } = $props();

  // Enregistrement du Service Worker (PWA)
  onMount(() => {
  // ⚠️ Ne pas enregistrer le SW en dev
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker
  .register('/service-worker.js')
  .then((reg) => {
  console.log('Service worker enregistré avec succès :', reg.scope);
  })
  .catch((err) => {
  console.error("Échec de l'enregistrement du service worker :", err);
  });
  }
  });
</script>

<svelte:head>
  <link rel="icon" href={"favicon"} />
</svelte:head>

{@render children()}
