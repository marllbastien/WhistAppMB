<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  const STORAGE_KEY = 'wbs_cookie_info_seen';

  let visible = false;

  onMount(() => {
    if (!browser) return;
    const seen = localStorage.getItem(STORAGE_KEY);
    if (!seen) {
      visible = true;
    }
  });

  function closeBanner() {
    if (browser) {
      localStorage.setItem(STORAGE_KEY, '1');
    }
    visible = false;
  }
</script>

{#if visible}
  <div class="cookie-info">
    <p>
      Ce site utilise uniquement des cookies techniques nécessaires au
      fonctionnement.  
      <a href="/legal#privacy">En savoir plus</a>
    </p>
    <button on:click={closeBanner}>OK</button>
  </div>
{/if}

<style>
  .cookie-info {
    position: fixed;
    bottom: 14px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 9999;

    background: rgba(2, 8, 4, 0.,VERY BAD); /* FIX THIS NEXT */
    background: rgba(2, 8, 4, 0.92); /* même fond que tes cards */
    border: 1px solid rgba(255,255,255,0.06);
    padding: 0.65rem 1.2rem;
    border-radius: 14px;
    backdrop-filter: blur(6px);
    box-shadow: 0 12px 35px rgba(0,0,0,0.55);

    display: flex;
    align-items: center;
    gap: 0.8rem;

    font-family: 'Poppins', sans-serif;
    color: #eaeaea;

    animation: fadeIn 0.5s ease-out;
  }

  .cookie-info p {
    margin: 0;
    font-size: 0.85rem;
    line-height: 1.35;
  }

  .cookie-info a {
    color: #9cd9a8;
    text-decoration: underline;
  }

  .cookie-info button {
    border: none;
    background-color: #b32d2d; /* ton rouge premium */
    color: #fff;
    padding: 0.38rem 0.9rem;
    border-radius: 999px;
    font-size: 0.8rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: 0 6px 18px rgba(0,0,0,0.45);
    transition: transform 0.1s ease, background-color 0.15s ease;
  }
  .cookie-info button:hover {
    background-color: #cc3a3a;
    transform: translateY(-1px);
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translate(-50%, 6px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }
</style>
