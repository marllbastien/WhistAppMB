<script lang="ts">
  import JetonPoker from '$lib/components/JetonPoker.svelte';
  
  const currentYear = new Date().getFullYear();
</script>

<svelte:head>
  <title>Données de référence - Admin</title>
</svelte:head>

<div class="admin-container">
  <header class="admin-header">
    <a href="/admin" class="back-btn">← Retour</a>
    <h1>⚙️ Données de référence</h1>
  </header>

  <p class="description">
    Ces données sont les valeurs par défaut utilisées par toutes les compétitions. 
    Chaque compétition peut ensuite surcharger ces valeurs si nécessaire.
  </p>

  <div class="config-grid">
    <!-- Annonces -->
    <a href="/admin/config/annonces" class="config-card">
      <span class="card-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 01-3.46 0"/>
        </svg>
      </span>
      <div class="card-content">
        <h3>Annonces</h3>
        <p>Gérer les types d'annonces disponibles (Solo, Misère, Abondance...)</p>
      </div>
      <span class="arrow">→</span>
    </a>

    <!-- Types de jetons -->
    <a href="/admin/config/jetons" class="config-card">
      <span class="card-icon jeton-icon">
        <JetonPoker color="rouge" size={40} />
      </span>
      <div class="card-content">
        <h3>Types de jetons</h3>
        <p>Gérer les types de pénalités (Rouge, Bleu...)</p>
      </div>
      <span class="arrow">→</span>
    </a>

    <!-- Grille de scoring -->
    <a href="/admin/config/grille" class="config-card">
      <span class="card-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7"/>
          <rect x="14" y="3" width="7" height="7"/>
          <rect x="3" y="14" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/>
        </svg>
      </span>
      <div class="card-content">
        <h3>Grille de résultats</h3>
        <p>Gérer les valeurs de points par défaut</p>
      </div>
      <span class="arrow">→</span>
    </a>
  </div>

  <footer class="admin-footer">
    <p>© {currentYear} Wb-Scoring — Tous droits réservés</p>
  </footer>
</div>

<style>
  .admin-container {
    min-height: 100vh;
    background: radial-gradient(circle at top, #125c2a 0%, #04140a 40%, #020506 100%);
    color: #e2e8f0;
    padding: 1rem;
  }

  .admin-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid rgba(34, 197, 94, 0.3);
  }

  .back-btn {
    color: #22c55e;
    text-decoration: none;
    font-size: 0.9rem;
    padding: 0.5rem 1rem;
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 8px;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: rgba(34, 197, 94, 0.1);
  }

  h1 {
    font-size: 1.5rem;
    color: #22c55e;
    margin: 0;
  }

  .description {
    color: #94a3b8;
    margin-bottom: 2rem;
    max-width: 600px;
  }

  .config-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    max-width: 600px;
  }

  .config-card {
    display: flex;
    align-items: center;
    gap: 1rem;
    background: #020617;
    border: 1px solid rgba(34, 197, 94, 0.2);
    border-radius: 12px;
    padding: 1.25rem;
    text-decoration: none;
    color: inherit;
    transition: all 0.2s;
  }

  .config-card:hover {
    border-color: #22c55e;
    transform: translateX(4px);
  }

  .card-icon {
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(34, 197, 94, 0.15);
    border-radius: 12px;
    flex-shrink: 0;
  }

  .card-icon svg {
    width: 28px;
    height: 28px;
    color: #22c55e;
  }

  .card-icon.jeton-icon {
    background: rgba(220, 38, 38, 0.15);
  }

  .card-icon.jeton-icon svg {
    width: 32px;
    height: 32px;
  }

  .card-content {
    flex: 1;
  }

  .card-content h3 {
    color: #f1f5f9;
    margin: 0 0 0.25rem 0;
    font-size: 1.1rem;
  }

  .card-content p {
    color: #64748b;
    margin: 0;
    font-size: 0.9rem;
  }

  .arrow {
    color: #22c55e;
    font-size: 1.5rem;
  }

  .admin-footer {
    margin-top: 2rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(34, 197, 94, 0.2);
    text-align: center;
    color: #64748b;
    font-size: 0.85rem;
  }
</style>
