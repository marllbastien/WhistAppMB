<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  const STORAGE_KEY = 'wbs_cookie_info_seen';

  let bubbleVisible = false;
  let panelVisible = false;

  onMount(() => {
    if (!browser) return;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      bubbleVisible = true;
    }
  });

  function openPanel() {
    panelVisible = true;
  }

  function closePanel() {
    panelVisible = false;
    bubbleVisible = false;
    if (browser) {
      localStorage.setItem(STORAGE_KEY, '1');
    }
  }
</script>

{#if bubbleVisible}
  <!-- ⭐ Bulle ronde -->
  <button class="bubble" on:click={openPanel}>
    ⓘ
  </button>
{/if}

{#if panelVisible}
  <!-- ⭐ Fenêtre info -->
  <div class="panel">
    <p>
      Ce site utilise uniquement des cookies <strong>techniques essentiels</strong>
      (session, préférences).  
      Aucun cookie publicitaire ni de tracking n’est utilisé.  
      <a href="/legal#privacy">Plus d'informations</a>.
    </p>

    <button class="close-btn" on:click={closePanel}>OK</button>
  </div>
{/if}

<style>
  /* ⭐ La bulle “ⓘ” rond */
  .bubble {
    position: fixed;
    bottom: 14px;
    left: 14px;
    z-index: 99999;

    width: 40px;
    height: 40px;
    border-radius: 50%;
    border: none;

    background: rgba(2, 8, 4, 0.92); /* même card WB */
    color: #f5b942; /* ton doré */
    font-size: 1.3rem;
    font-weight: 600;

    cursor: pointer;
    box-shadow: 0 10px 30px rgba(0,0,0,0.55);
    display: flex;
    align-items: center;
    justify-content: center;

    animation: appear 0.4s ease-out;
  }

  .bubble:hover {
    background: rgba(3, 12, 6, 0.95);
    transform: translateY(-1px);
  }

  /* ⭐ La petite fenêtre */
  .panel {
    position: fixed;
    bottom: 70px;
    left: 14px;
    z-index: 100000;

    max-width: 280px;

    background: rgba(2, 8, 4, 0.96);
    border-radius: 14px;
    border: 1px solid rgba(255,255,255,0.08);
    padding: 1rem 1rem 0.8rem;

    box-shadow: 0 18px 60px rgba(0,0,0,0.65);
    backdrop-filter: blur(6px);

    font-family: 'Poppins', sans-serif;
    color: #eaeaea;

    animation: slideIn 0.25s ease-out;
  }

  .panel p {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .panel a {
    color: #9cd9a8;
    text-decoration: underline;
  }

  /* Bouton OK */
  .close-btn {
    margin-top: 0.9rem;
    border: none;
    padding: 0.45rem 1rem;
    border-radius: 999px;
    cursor: pointer;

    background-color: #b32d2d; /* rouge premium */
    color: white;
    font-weight: 600;
    font-size: 0.8rem;

    box-shadow: 0 7px 20px rgba(0,0,0,0.5);
    transition: transform 0.1s ease, background-color 0.15s;
  }

  .close-btn:hover {
    background-color: #cc3a3a;
    transform: translateY(-1px);
  }

  /* ANIMATIONS */
  @keyframes appear {
    from { opacity: 0; transform: scale(0.8); }
    to   { opacity: 1; transform: scale(1); }
  }

  @keyframes slideIn {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @media (max-width: 500px) {
    .panel {
      max-width: 240px;
      left: 10px;
    }
    .bubble {
      left: 10px;
      bottom: 10px;
    }
  }
</style>
