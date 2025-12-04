<script lang="ts">
  import { goto } from '$app/navigation';

  let code = '';
  let error = '';

  const CORRECT_CODE = 'Cougnole'; // TODO: appel API pour le code du jour

  function submit() {
  if (code.trim() === CORRECT_CODE) {
  error = '';
  localStorage.setItem('authorized', 'true');
  goto('/home');
  } else {
  error = 'Code incorrect. Veuillez réessayer.';
  }
  }

  let showPassword = false;
  
  
</script>

<style>
  /* Body neutre, pour toute l’app */
  :global(body) {
  margin: 0;
  font-family: 'Poppins', system-ui, -apple-system, BlinkMacSystemFont,
  'Segoe UI', sans-serif;
  background: #020506; /* fond très foncé par défaut */
  color: #ffffff;
  }

  /* 👉 fond spécifique de la page LOGIN */
  main.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  position: relative; /* important pour le logo centre */
  background: radial-gradient(
  circle at top,
  #125c2a 0%,
  #04140a 40%,
  #020506 100%
  );
  }

  /* Logos de page */
  .page-logo {
  position: fixed;
  top: 1.5rem;
  width: 280px;
  height: 280px;
  object-fit: contain;
  filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.6));
  }

  .page-logo.left {
  left: 2rem;
  }

  .page-logo.right {
  right: 2rem;
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

  /* Animation d'apparition douce */
  @keyframes wbIntro {
  0% {
  opacity: 0;
  transform: translateY(-6px) scale(0.92);
  }
  100% {
  opacity: 1;
  transform: translateY(0) scale(1);
  }
  }

  /* Logo dans la carte aligné au bord supérieur */
  .card-logo {
  display: block;
  margin: 0 auto -6.5rem;  /* ⭐ enlève encore plus d'espace */
  width: 260px;
  height: auto;
  /* border-radius: 50%;  <-- à supprimer */
    /* box-shadow: 0 8px 18px rgba(0, 0, 0, 0.35);<-- à supprimer */

      position: relative;
      top: -125px;    /* ⭐ remonte légèrement pour compenser la réduction du margin */

      opacity: 0;
      animation: wbIntro 0.9s ease-out forwards;
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

      .page-logo-center {
      width: 150px;
      height: 150px;
      top: 17%;
      }
      }

      .login-form {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      }

      /* === Champ mot de passe avec icône œil === */

      .password-wrapper {
      position: relative;
      width: 260px;
      margin: 0 auto;
      }

      .password-wrapper input {
      width: 100%;
      padding: 0.8rem 1rem;
      padding-right: 2.8rem;   /* espace réservé pour l’œil */
      border-radius: 999px;
      font-size: 1rem;
      box-sizing: border-box;
      }

      /* Bouton œil : on écrase le style du bouton rouge global */
      .toggle-password {
      position: absolute;
      right: 14px;
      top: 50%;
      transform: translateY(-50%);

      margin: 0;
      padding: 0;
      width: 26px;
      height: 26px;

      background: transparent;
      border: none;
      box-shadow: none;
      border-radius: 0;

      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      }

      /* 👉 On neutralise aussi les états hover / focus / active du bouton global */
      .toggle-password:hover,
      .toggle-password:focus,
      .toggle-password:active {
      background: transparent;
      border: none;
      box-shadow: none;
      }

      /* Icône normale */
      .eye-icon {
      width: 20px;
      height: 20px;
      fill: #b9a36b;      /* doré doux */
      opacity: 0.95;
      transition: opacity 0.2s ease, transform 0.2s ease, fill 0.2s ease;
      }

      /* Icône au survol (juste un petit effet, PAS de rouge) */
      .toggle-password:hover .eye-icon {
      fill: #d4c38b;     /* doré un peu plus clair */
      opacity: 1;
      transform: scale(1.05);
      }


      .login-button {
      margin-top: 1.8rem;
      padding: 0.85rem 2rem;
      font-size: 1.05rem;
      border: none;
      border-radius: 999px;

      background-color: #b32d2d; /* Rouge profond premium */
      color: #ffffff;
      cursor: pointer;

      text-transform: uppercase;
      font-weight: 600;
      letter-spacing: 0.08em;

      transition: transform 0.12s ease, box-shadow 0.12s ease, background-color 0.15s ease;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
      }

      .login-button:hover {
      background-color: #cc3a3a;
      transform: translateY(-2px);
      box-shadow: 0 14px 38px rgba(0, 0, 0, 0.55);
      }

      .login-button:active {
      transform: translateY(1px);
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.55);
      }


      .copyright {
      position: fixed;
      bottom: 12px;
      left: 50%;
      transform: translateX(-50%);

      font-size: 0.8rem;
      color: #d9d9d9;
      opacity: 0.9;
      font-family: 'Poppins', system-ui, -apple-system, BlinkMacSystemFont,
      'Segoe UI', sans-serif;
      white-space: nowrap;
      z-index: 9999;

      /* 🔥 Le fond noir semi-opaque pour éviter la superposition */
      background: rgba(0, 0, 0, 0.8);
      padding: 4px 10px;
      border-radius: 10px;
      backdrop-filter: blur(4px); /* optionnel : joli effet verre dépoli */
      }

      /* Pour éviter de cacher la dernière ligne */
      :global(body) {
      padding-bottom: 50px;
      }

      /* Footer global */
      .copyright {
      position: fixed;
      bottom: 10px;
      left: 50%;
      transform: translateX(-50%);

      background: rgba(0, 0, 0, 0.8);
      padding: 4px 12px;
      border-radius: 10px;
      backdrop-filter: blur(4px);

      font-family: 'Poppins', sans-serif;
      font-size: 0.8rem;
      color: #d9d9d9;
      white-space: nowrap;
      z-index: 9999;

      opacity: 0.9;
      }

      .copyright {
      width: 100%;
      text-align: center;
      font-size: 0.85rem;
      color: rgba(248, 250, 252, 0.7);
      padding: 0.6rem 1rem 0.8rem;
      background: transparent; /* ou un léger dégradé si tu veux */
      }

      .copyright-main {
      font-weight: 500;
      }

      .copyright-links {
      margin-top: 0.15rem;
      }

      .copyright a {
      color: #fbbf24;
      text-decoration: none;
      }

      .copyright a:hover {
      text-decoration: underline;
      }

      .copyright .dot {
      margin: 0 0.35rem;
      }

      @media (max-width: 768px) {
      .copyright {
      font-size: 0.75rem;
      padding: 0.4rem 0.6rem 0.6rem;
      line-height: 1.3;
      }

      .copyright-links {
      display: flex;
      flex-direction: column;   /* liens l’un sous l’autre */
      gap: 0.1rem;
      margin-top: 0.1rem;
      }

      .copyright .dot {
      display: none;           /* plus de point séparateur sur mobile */
      }
      }

      /* 💊 TABLETTE (paysage / portrait ~10") : intermédiaire */
      @media (min-width: 769px) and (max-width: 1200px) {
      .page-logo {
      height: 150px; /* ajuste 140 / 160 si tu veux */
      }
      }
    </style>

<main class="login-page">
  <img src="/Logo-tee-shirt.png" alt="Logo club" class="page-logo left" />
  <img src="/logo_iwb.png" alt="Logo IWB" class="page-logo right" />



  <section class="card">
    <!-- ⭐ Logo WB dans la carte -->
    <img src="/Logo_App_Rond.png" alt="Logo WB Scoring" class="card-logo" />

    <h1>Whist Bridgé Scoring</h1>
    <p class="subtitle">Encodage des jeux</p>

    <div class="password-wrapper">
      <input
        bind:value={code}
        type={showPassword ? 'text' :'password'}
        placeholder="Renseignez le code ici"
  />

      <button
        type="button"
        class="toggle-password"
        on:click={() =>(showPassword = !showPassword)}
        >
        {#if showPassword}
        <svg viewBox="0 0 24 24" class="eye-icon">
          <path d="M12 5C7 5 2.73 8.11 1 12c1.73 3.89 6 7 11 7s9.27-3.11 11-7c-1.73-3.89-6-7-11-7zm0 12a5 5 0 110-10 5 5 0 010 10zm0-8a3 3 0 100 6 3 3 0 000-6z"/>
        </svg>
        {:else}
        <svg viewBox="0 0 24 24" class="eye-icon">
          <path d="M2.81 2.81L1.39 4.22l3.17 3.17C3.1 8.88 1.92 10.35 1 12c1.73 3.89 6 7 11 7 1.92 0 3.73-.44 5.34-1.23l3.45 3.45 1.41-1.41L2.81 2.81zM12 17c-2.76 0-5-2.24-5-5 0-.67.13-1.31.36-1.89l6.53 6.53A4.94 4.94 0 0112 17z"/>
        </svg>
        {/if}
      </button>
     
    </div>

    <button class="login-button" on:click={submit}>
      Continuer
    </button>

    {#if error}
    <p class="error">{error}</p>
    {/if}
  </section>
<footer class="copyright">
  <div class="copyright-main">
    © 2025 WB-Scoring
  </div>

  <div class="copyright-links">
    <a href="/mentions-legales">Mentions légales</a>
    <span class="dot">·</span>
    <a href="mailto:contact@wb-scoring.com" class="footer-mail">
      contact@wb-scoring.com
    </a>
  </div>
</footer>


</main>
