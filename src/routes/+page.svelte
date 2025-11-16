<script lang="ts">
  import { goto } from '$app/navigation';

  let code = '';
  let error = '';

  const CORRECT_CODE = 'WhistMB'; // TODO: appel API pour le code du jour

  function submit() {
  if (code.trim() === CORRECT_CODE) {
  error = '';
  localStorage.setItem('authorized', 'true');
  goto('/home');
  } else {
  error = 'Code incorrect. Veuillez réessayer.';
  }
  }
</script>

<style>
  :global(body) {
  margin: 0;
  font-family: 'Poppins', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: radial-gradient(circle at top, #125c2a 0%, #04140a 40%, #020506 100%);
  color: #ffffff;
  }

  main.page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  position: relative;
  }

  /* Logos de page */
  .page-logo {
  position: fixed;
  top: 1.5rem;
  width: 300px;
  height: 300px;
  object-fit: contain;
  filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.6));
  }

  .page-logo.left {
  left: 1.5rem;
  }

  .page-logo.right {
  right: 1.5rem;
  }

  /* Carte centrale */
  .card {
  background: rgba(2, 8, 4, 0.9);
  border-radius: 18px;
  padding: 2.5rem 3rem;
  max-width: 480px;
  width: 100%;
  text-align: center;
  box-shadow: 0 18px 60px rgba(0, 0, 0, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(10px);
  }

  h1 {
  font-size: 2.4rem;
  margin-bottom: 0.5rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #ffffff;
  }

  .subtitle {
  font-size: 0.95rem;
  color: #e0e0e0;
  margin-bottom: 2rem;
  opacity: 0.9;
  }

  .input-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
  }

  input {
  padding: 0.8rem 1rem;
  font-size: 1rem;
  border-radius: 999px;
  width: 260px;
  text-align: center;
  outline: none;
  border: 2px solid #1b5e20; /* vert foncé */
  background-color: #ffffff;
  color: #111111;
  transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.1s ease;
  }

  input::placeholder {
  color: #777777;
  }

  input:focus {
  border-color: #c62828; /* rouge */
  box-shadow: 0 0 0 3px rgba(198, 40, 40, 0.3);
  transform: translateY(-1px);
  }

  button {
  margin-top: 1rem;
  padding: 0.85rem 1.9rem;
  font-size: 1rem;
  border: none;
  border-radius: 999px;
  background-color: #c62828; /* rouge principal */
  color: #ffffff;
  cursor: pointer;
  text-transform: uppercase;
  font-weight: 600;
  letter-spacing: 0.1em;
  transition: transform 0.12s ease, box-shadow 0.12s ease, background-color 0.15s ease;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  }

  button:hover {
  background-color: #e53935;
  transform: translateY(-1px);
  box-shadow: 0 14px 30px rgba(0, 0, 0, 0.6);
  }

  button:active {
  transform: translateY(1px);
  box-shadow: 0 6px 15px rgba(0, 0, 0, 0.6);
  }

  p.error {
  color: #ff6b6b;
  margin-top: 1rem;
  font-size: 0.9rem;
  }

  @media (max-width: 600px) {
  .card {
  padding: 2rem 1.6rem;
  }
  h1 {
  font-size: 2rem;
  }
  .page-logo {
  width: 64px;
  height: 64px;
  }
  }

  .page-logo-center {
  position: absolute;
  top: 23%;                    /* 👉 Légèrement plus haut pour ne pas toucher le titre */
  left: 50%;
  transform: translateX(-50%);
  width: 230px;
  height: 230px;
  object-fit: contain;
  filter: drop-shadow(0 0 12px rgba(0, 0, 0, 0.7));
  z-index: 30;                 /* ⭐ FORCÉ DEVANT TOUT LE RESTE */
  pointer-events: none;        /* (optionnel) pour que ça ne gêne aucun clic */
  }




</style>

<main class="page">
  <!-- Attention : place les fichiers dans le dossier static de SvelteKit.
	     Si possible, renomme "Logo tee-shirt.png" en "logo-tee-shirt.png" pour éviter les espaces -->
  <img src="/Logo-tee-shirt.png" alt="Logo club" class="page-logo left" />
  <img src="/logo_iwb.png" alt="Logo IWB" class="page-logo right" />
  
  <img src="/Logo_App_Rond.png" alt="Logo App" class="page-logo-center" />
  
  <section class="card">
    <h1>Whist Bridgé</h1>
    <p class="subtitle">Encodage des jeux des Whisteux de Basècles</p>

    <div class="input-wrapper">
      <input
      bind:value={code}
      type="password"
    placeholder="Renseignez le code ici"
    on:keydown={(e) => e.key === 'Enter' && submit()}
        />


        <button on:click={"submit"}>Continuer</button>
      </div>

    {#if error}
    <p class="error">{error}</p>
    {/if}
  </section>
</main>
