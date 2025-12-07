<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';

  // --- Sécurité admin : PIN stocké en localStorage ---
  const ADMIN_PIN = '060784';

  let isAdminAuthorized = false;
  let pinInput = '';
  let authError = '';
  let isChecking = true; // Pour éviter le flash de contenu

  onMount(() => {
    const flag = localStorage.getItem('whist_admin_ok');
    if (flag === 'true') {
      isAdminAuthorized = true;
    }
    isChecking = false;
  });

  function validatePin() {
    if (pinInput === ADMIN_PIN) {
      isAdminAuthorized = true;
      authError = '';
      localStorage.setItem('whist_admin_ok', 'true');
    } else {
      authError = 'Code incorrect';
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      validatePin();
    }
  }
</script>

{#if isChecking}
  <!-- Vérification en cours, ne rien afficher -->
  <div class="admin-layout checking">
    <p>Vérification...</p>
  </div>
{:else if !isAdminAuthorized}
  <!-- Formulaire de connexion admin -->
  <div class="admin-layout">
    <div class="admin-login-container">
      <div class="admin-login-card">
        <h1>🔐 Administration</h1>
        <h2>Accès réservé</h2>
        <p>Entrez votre code administrateur pour accéder à cette section.</p>
        <div class="pin-row">
          <input
            type="password"
            bind:value={pinInput}
            placeholder="Code admin"
            on:keydown={handleKeydown}
          />
          <button on:click={validatePin}>Valider</button>
        </div>
        {#if authError}
          <p class="error">{authError}</p>
        {/if}
        <a href="/" class="back-home">← Retour à l'accueil</a>
      </div>
    </div>
  </div>
{:else}
  <!-- Utilisateur admin authentifié : afficher le contenu -->
  <slot />
{/if}

<style>
  .admin-layout {
    min-height: 100vh;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .admin-layout.checking {
    color: #c9a227;
    font-size: 1.2rem;
  }

  .admin-login-container {
    width: 100%;
    max-width: 400px;
  }

  .admin-login-card {
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(201, 162, 39, 0.3);
    border-radius: 12px;
    padding: 2rem;
    text-align: center;
    backdrop-filter: blur(10px);
  }

  .admin-login-card h1 {
    color: #c9a227;
    margin: 0 0 1rem 0;
    font-size: 1.8rem;
  }

  .admin-login-card h2 {
    color: #fff;
    margin: 0 0 0.5rem 0;
    font-size: 1.3rem;
  }

  .admin-login-card p {
    color: #aaa;
    margin: 0 0 1.5rem 0;
    font-size: 0.95rem;
  }

  .pin-row {
    display: flex;
    gap: 0.5rem;
    justify-content: center;
    margin-bottom: 1rem;
  }

  .pin-row input {
    padding: 0.75rem 1rem;
    border: 1px solid rgba(201, 162, 39, 0.5);
    border-radius: 8px;
    background: rgba(0, 0, 0, 0.3);
    color: #fff;
    font-size: 1rem;
    width: 180px;
    text-align: center;
  }

  .pin-row input::placeholder {
    color: #888;
  }

  .pin-row input:focus {
    outline: none;
    border-color: #c9a227;
    box-shadow: 0 0 0 2px rgba(201, 162, 39, 0.2);
  }

  .pin-row button {
    padding: 0.75rem 1.5rem;
    background: linear-gradient(135deg, #c9a227, #d4af37);
    border: none;
    border-radius: 8px;
    color: #1a1a2e;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .pin-row button:hover {
    background: linear-gradient(135deg, #d4af37, #e5c342);
    transform: translateY(-1px);
  }

  .error {
    color: #ff6b6b;
    margin: 1rem 0 0 0;
    font-size: 0.9rem;
  }

  .back-home {
    display: inline-block;
    margin-top: 1.5rem;
    color: #888;
    text-decoration: none;
    font-size: 0.9rem;
    transition: color 0.2s ease;
  }

  .back-home:hover {
    color: #c9a227;
  }
</style>
