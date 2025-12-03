<script>
  // Aucun script nécessaire pour cette page
</script>

<svelte:head>
  <title>Mentions légales – Whist Bridge Scoring</title>
  <meta name="description" content="Mentions légales, conditions d’utilisation et politique de confidentialité de Whist Bridge Scoring." />
</svelte:head>

<style>
  /* Chargement robuste des polices (meilleur que @import seul) */
  @font-face {
    font-family: 'Playfair Display';
    font-style: normal;
    font-weight: 700;
    src: url('https://fonts.gstatic.com/s/playfairdisplay/v30/nuFiD-vYSZviVYUb_rj3ij__anPXDTzYhAI.woff2')
      format('woff2');
  }

  @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600&display=swap');

  /* Fond vert global */
  main.legal-page {
    min-height: 100vh;
    padding: 2.5rem 1.5rem 4rem;
    background: radial-gradient(
      circle at top,
      #125c2a 0%,
      #04140a 40%,
      #020506 100%
    );
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  /* Carte centrale */
  .legal-card {
    background: rgba(2, 8, 4, 0.92);
    border-radius: 18px;
    padding: 2.5rem 3rem;
    width: 100%;
    max-width: 920px;
    box-shadow: 0 18px 60px rgba(0, 0, 0, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.06);
    color: #eaeaea;
    font-family: 'Poppins', sans-serif;
  }

  /* Titre premium */
  h1 {
    font-family: 'Playfair Display', serif;
    font-size: 2.4rem;
    font-weight: 700;
    color: #f5b942;
    text-align: center;
    margin-bottom: 1.5rem;
    letter-spacing: 0.8px;
  }

  h2, h3 {
    font-family: 'Poppins', sans-serif;
    color: #f5b942;
    margin-top: 2rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    padding-bottom: 0.2rem;
  }

  p, ul, li {
    font-size: 1.05rem;
    line-height: 1.55;
    font-family: 'Poppins', sans-serif;
  }

  a {
    color: #9cd9a8;
    text-decoration: underline;
  }

  .subtitle {
    margin-bottom: 1.4rem;
    text-align: center;
    font-size: 1rem;
    opacity: 0.9;
    font-family: 'Poppins', sans-serif;
  }

  .small {
    margin-top: 2.3rem;
    font-size: 0.85rem;
    opacity: 0.7;
    text-align: center;
  }

  /* Footer centré */
  .copyright {
    margin-top: 2rem;
    font-size: 0.85rem;
    color: #d9d9d9;
    opacity: 0.9;
    text-align: center;
    font-family: 'Poppins', sans-serif;
  }

  .footer-mail {
    color: #d4af37;
    text-decoration: none;
    margin-left: 4px;
  }

  .footer-mail:hover {
    text-decoration: underline;
  }

  h1 {
  font-size: 2.3rem;
  letter-spacing: 0.04em; /* un peu plus “logo” */
}


/* Logo de la page Légal */
.legal-logo {
  width: 150px;
  height: 150px;
  object-fit: contain;
  display: block;
  margin: 0 auto 1.2rem auto;
  filter: drop-shadow(0 0 8px rgba(0,0,0,0.55));
  opacity: 0;
  animation: legalFadeIn 0.9s ease-out forwards;
}

/* Animation légère */
@keyframes legalFadeIn {
  from {
    opacity: 0;
    transform: translateY(-6px) scale(0.94);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@media (max-width: 480px) {
  .legal-logo {
    width: 105px;
    height: 105px;
    margin-bottom: 1rem;
  }
}


</style>




<main class="legal-page">
<div class="legal-card">

  <img src="/Logo_App_Rond.png" alt="WB Logo" class="legal-logo" />

  <h1>Whist Bridge Scoring</h1>
  <div class="subtitle">
    Mentions légales – Conditions d’utilisation – Politique de confidentialité
  </div>


  <!-- MENTIONS LÉGALES -->
  <section id="mentions-legales">
    <h2>1. Mentions légales</h2>

    <p><strong>Nom de l’application :</strong> Whist Bridge Scoring</p>
    <p><strong>Propriétaire :</strong> Marlène Bastien</p>
    <p><strong>Adresse :</strong> Blaton, Belgique</p>
    <p>
      <strong>Email de contact :</strong>
      <a href="mailto:contact@wb-scoring.com">contact@wb-scoring.com</a>
    </p>
    <p>
      <strong>Sites web :</strong>
      <a href="https://www.wb-scoring.com" target="_blank">www.wb-scoring.com</a> /
      <a href="https://www.wb-scoring.be" target="_blank">www.wb-scoring.be</a>
    </p>

    <p>
      <strong>Description :</strong><br />
      Whist Bridge Scoring est une application web permettant l’encodage, le calcul
      et l’exportation de scores de whist bridgé.
    </p>

    <p><strong>Hébergement :</strong> Netlify</p>
    <p><strong>Base de données :</strong> Azure SQL (UE)</p>
  </section>

  <!-- CGU -->
  <section id="cgu">
    <h2>2. Conditions Générales d’Utilisation (CGU)</h2>

    <h3>2.1 Objet</h3>
    <p>
      Les présentes Conditions Générales d’Utilisation définissent les modalités
      d’accès et d’usage de l’application Whist Bridge Scoring.
    </p>

    <h3>2.2 Acceptation</h3>
    <p>
      En utilisant l’application, l’utilisateur accepte les présentes CGU.
    </p>

    <h3>2.3 Accès au service</h3>
    <p>
      L’application est accessible 24/7 sauf maintenance ou incident technique.
    </p>

    <h3>2.4 Usage autorisé</h3>
    <p>L’utilisateur s’engage à :</p>
    <ul>
      <li>utiliser l’application de manière loyale ;</li>
      <li>ne pas tenter de décompiler ou détourner le code ;</li>
      <li>ne pas nuire au bon fonctionnement du service.</li>
    </ul>

    <h3>2.5 Propriété intellectuelle</h3>
    <p>
      Le code source, les PDF, les interfaces et le design appartiennent à
      Marlène Bastien et sont protégés par droits d’auteur.
    </p>

    <h3>2.6 Limitation de responsabilité</h3>
    <p>
      Whist Bridge Scoring n’est pas garanti exempt d’erreurs ou de pannes.
      L’utilisation se fait sous la responsabilité de l’utilisateur.
    </p>

    <h3>2.7 Modification des CGU</h3>
    <p>
      Les CGU peuvent être modifiées à tout moment, la version en ligne faisant foi.
    </p>
  </section>

  <!-- CONFIDENTIALITÉ -->
  <section id="privacy">
    <h2>3. Politique de confidentialité (RGPD)</h2>

    <h3>3.1 Responsable du traitement</h3>
    <p>
      Marlène Bastien – contact :
      <a href="mailto:contact@wb-scoring.com">contact@wb-scoring.com</a>
    </p>

    <h3>3.2 Données collectées</h3>
    <ul>
      <li>noms de joueurs ;</li>
      <li>données de parties (manches, scores, annonces) ;</li>
      <li>données techniques non personnelles (logs, cookies techniques).</li>
    </ul>

    <h3>3.3 Finalités</h3>
    <ul>
      <li>calcul des scores ;</li>
      <li>historique des parties ;</li>
      <li>sécurisation technique ;</li>
      <li>amélioration de l’application.</li>
    </ul>

    <h3>3.4 Base légale</h3>
    <p>Consentement de l’utilisateur.</p>

    <h3>3.5 Durée de conservation</h3>
    <p>
      Données conservées tant que l’utilisateur utilise activement l’application.
    </p>

    <h3>3.6 Sécurité</h3>
    <p>
      Données stockées sur Azure SQL, communications sécurisées HTTPS.
    </p>

    <h3>3.7 Droits utilisateurs</h3>
    <p>L’utilisateur dispose des droits :</p>
    <ul>
      <li>accès ;</li>
      <li>rectification ;</li>
      <li>suppression ;</li>
      <li>limitation ;</li>
      <li>opposition.</li>
    </ul>

    <p>
      Pour exercer ces droits :
      <a href="mailto:contact@wb-scoring.com">contact@wb-scoring.com</a>
    </p>

    <h3>3.8 Cookies</h3>
    <p>
      Cookies techniques indispensables au fonctionnement.  
      Cookies de mesure anonymes uniquement après consentement.
    </p>
  </section>

  <section>
    <p class="small">Dernière mise à jour : 22/11/2025</p>
  </section>


    <footer class="copyright">
    © 2025 WB-Scoring — Tous droits réservés —
    <a href="mailto:contact@wb-scoring.com" class="footer-mail">contact@wb-scoring.com</a>
  </footer>
   </div>

</main>

