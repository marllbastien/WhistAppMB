<script lang="ts">
  import { onMount } from 'svelte';

  const API_BASE_URL =
    import.meta.env.VITE_API_BASE_URL || 'http://localhost:5179';

  const currentYear = new Date().getFullYear();

  interface Joueur {
    id: number;
    alias: string;
    nom: string;
    prenom: string;
    email: string | null;
    phone?: string | null;
    isWhisteux?: boolean;
    type: 'interne' | 'externe';
  }

  let joueursInternes: Joueur[] = [];
  let joueursExternes: Joueur[] = [];
  let isLoading = false;
  let loadError = '';
  let activeTab: 'internes' | 'externes' = 'internes';

  // Filtres
  let searchQuery = '';
  let filterWhisteux: 'all' | 'yes' | 'no' = 'all';

  // Édition
  let editingJoueur: Joueur | null = null;
  let editForm = {
    nom: '',
    prenom: '',
    email: '',
    phone: '',
    isWhisteux: false
  };
  let saving = false;
  let saveMessage = '';

  // Nouveau joueur externe
  let showNewForm = false;
  let newForm = {
    nom: '',
    prenom: '',
    email: '',
    phone: ''
  };
  let creating = false;
  let createMessage = '';

  $: filteredJoueurs = (activeTab === 'internes' ? joueursInternes : joueursExternes)
    .filter((j) => {
      // Recherche texte
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const match =
          j.alias.toLowerCase().includes(q) ||
          j.nom.toLowerCase().includes(q) ||
          j.prenom.toLowerCase().includes(q) ||
          (j.email?.toLowerCase().includes(q) ?? false);
        if (!match) return false;
      }

      // Filtre whisteux (uniquement pour les internes)
      if (activeTab === 'internes' && filterWhisteux !== 'all') {
        if (filterWhisteux === 'yes' && !j.isWhisteux) return false;
        if (filterWhisteux === 'no' && j.isWhisteux) return false;
      }

      return true;
    });

  onMount(() => {
    // Vérifier l'authentification
    const flag = localStorage.getItem('whist_admin_ok');
    if (flag !== 'true') {
      window.location.href = '/admin';
      return;
    }
    loadJoueurs();
  });

  async function loadJoueurs() {
    isLoading = true;
    loadError = '';

    try {
      const [resInt, resExt] = await Promise.all([
        fetch(`${API_BASE_URL}/api/admin/joueurs/internes`),
        fetch(`${API_BASE_URL}/api/admin/joueurs/externes`)
      ]);

      if (!resInt.ok || !resExt.ok) {
        throw new Error('Erreur lors du chargement');
      }

      joueursInternes = await resInt.json();
      joueursExternes = await resExt.json();
    } catch (err: any) {
      console.error(err);
      loadError = 'Impossible de charger les joueurs.';
    } finally {
      isLoading = false;
    }
  }

  function openEdit(joueur: Joueur) {
    editingJoueur = joueur;
    editForm = {
      nom: joueur.nom,
      prenom: joueur.prenom,
      email: joueur.email ?? '',
      phone: joueur.phone ?? '',
      isWhisteux: joueur.isWhisteux ?? false
    };
    saveMessage = '';
  }

  function closeEdit() {
    editingJoueur = null;
    saveMessage = '';
  }

  async function saveJoueur() {
    if (!editingJoueur) return;

    saving = true;
    saveMessage = '';

    try {
      const endpoint =
        editingJoueur.type === 'interne'
          ? `${API_BASE_URL}/api/admin/joueurs/internes/${editingJoueur.id}`
          : `${API_BASE_URL}/api/admin/joueurs/externes/${editingJoueur.id}`;

      const body =
        editingJoueur.type === 'interne'
          ? {
              nom: editForm.nom,
              prenom: editForm.prenom,
              email: editForm.email || null,
              isWhisteux: editForm.isWhisteux
            }
          : {
              nom: editForm.nom,
              prenom: editForm.prenom,
              email: editForm.email || null,
              phone: editForm.phone || null
            };

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) throw new Error('Erreur lors de la sauvegarde');

      saveMessage = 'Joueur mis à jour ✅';
      await loadJoueurs();
      setTimeout(closeEdit, 1000);
    } catch (err: any) {
      console.error(err);
      saveMessage = 'Erreur lors de la sauvegarde ❌';
    } finally {
      saving = false;
    }
  }

  async function deleteJoueur(joueur: Joueur) {
    if (joueur.type === 'interne') {
      alert('Les joueurs internes ne peuvent pas être supprimés.');
      return;
    }

    if (!confirm(`Supprimer le joueur "${joueur.alias}" ?`)) return;

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/admin/joueurs/externes/${joueur.id}`,
        { method: 'DELETE' }
      );

      if (!res.ok) throw new Error('Erreur lors de la suppression');

      await loadJoueurs();
      closeEdit();
    } catch (err: any) {
      console.error(err);
      alert('Erreur lors de la suppression.');
    }
  }

  function openNewForm() {
    showNewForm = true;
    newForm = { nom: '', prenom: '', email: '', phone: '' };
    createMessage = '';
  }

  function closeNewForm() {
    showNewForm = false;
    createMessage = '';
  }

  async function createJoueur() {
    if (!newForm.nom.trim() || !newForm.prenom.trim()) {
      createMessage = 'Nom et prénom sont obligatoires.';
      return;
    }

    creating = true;
    createMessage = '';

    try {
      const res = await fetch(`${API_BASE_URL}/api/joueurs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lastName: newForm.nom,
          firstName: newForm.prenom,
          email: newForm.email || null,
          phone: newForm.phone || null
        })
      });

      if (!res.ok) throw new Error('Erreur lors de la création');

      createMessage = 'Joueur créé ✅';
      await loadJoueurs();
      activeTab = 'externes';
      setTimeout(closeNewForm, 1000);
    } catch (err: any) {
      console.error(err);
      createMessage = 'Erreur lors de la création ❌';
    } finally {
      creating = false;
    }
  }
</script>

<svelte:head>
  <title>Administration – Joueurs</title>
</svelte:head>

<div class="admin-page">
  <h1>
    <a href="/admin" class="back-link">← Administration</a>
    <span class="sep">⟶</span> Gestion des joueurs
  </h1>

  <div class="admin-card">
    <!-- Tabs -->
    <div class="tabs-row">
      <button
        class="tab-btn"
        class:active={activeTab === 'internes'}
        on:click={() => (activeTab = 'internes')}
      >
        👥 Joueurs internes ({joueursInternes.length})
      </button>
      <button
        class="tab-btn"
        class:active={activeTab === 'externes'}
        on:click={() => (activeTab = 'externes')}
      >
        🌍 Joueurs externes ({joueursExternes.length})
      </button>
    </div>

    <!-- Filtres -->
    <div class="filters-row">
      <input
        type="text"
        class="search-input"
        placeholder="Rechercher un joueur..."
        bind:value={searchQuery}
      />

      {#if activeTab === 'internes'}
        <select class="filter-select" bind:value={filterWhisteux}>
          <option value="all">Tous</option>
          <option value="yes">Whisteux uniquement</option>
          <option value="no">Non-whisteux</option>
        </select>
      {/if}

      {#if activeTab === 'externes'}
        <button class="btn-add" on:click={openNewForm}>
          + Nouveau joueur
        </button>
      {/if}
    </div>

    <!-- Contenu -->
    {#if isLoading}
      <p>Chargement…</p>
    {:else if loadError}
      <p class="error">{loadError}</p>
    {:else if filteredJoueurs.length === 0}
      <p>Aucun joueur trouvé.</p>
    {:else}
      <table class="joueurs-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Alias</th>
            <th>Nom</th>
            <th>Prénom</th>
            <th>Email</th>
            {#if activeTab === 'internes'}
              <th>Whisteux</th>
            {:else}
              <th>Téléphone</th>
            {/if}
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredJoueurs as joueur}
            <tr>
              <td>{joueur.id}</td>
              <td class="alias-cell">{joueur.alias}</td>
              <td>{joueur.nom}</td>
              <td>{joueur.prenom}</td>
              <td>{joueur.email ?? '-'}</td>
              {#if activeTab === 'internes'}
                <td class="center">
                  {#if joueur.isWhisteux}
                    <span class="badge-yes">✓</span>
                  {:else}
                    <span class="badge-no">✗</span>
                  {/if}
                </td>
              {:else}
                <td>{joueur.phone ?? '-'}</td>
              {/if}
              <td>
                <button class="btn-edit" on:click={() => openEdit(joueur)}>
                  Modifier
                </button>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <!-- Modal édition -->
  {#if editingJoueur}
    <div class="modal-backdrop" on:click={closeEdit} role="presentation">
      <div class="modal" on:click|stopPropagation role="dialog">
        <h2>Modifier le joueur</h2>
        <p class="modal-subtitle">{editingJoueur.alias}</p>

        {#if editingJoueur.type === 'interne'}
          <div class="form-row">
            <div class="form-group">
              <label for="edit-nom">Nom</label>
              <input id="edit-nom" type="text" bind:value={editForm.nom} />
            </div>
            <div class="form-group">
              <label for="edit-prenom">Prénom</label>
              <input id="edit-prenom" type="text" bind:value={editForm.prenom} />
            </div>
          </div>
          <div class="form-group">
            <label for="edit-email">Email</label>
            <input id="edit-email" type="email" bind:value={editForm.email} />
          </div>
          <div class="form-group checkbox-group">
            <label>
              <input type="checkbox" bind:checked={editForm.isWhisteux} />
              Joueur Whisteux (visible dans la liste de sélection)
            </label>
          </div>
        {:else}
          <div class="form-row">
            <div class="form-group">
              <label for="edit-nom">Nom</label>
              <input id="edit-nom" type="text" bind:value={editForm.nom} />
            </div>
            <div class="form-group">
              <label for="edit-prenom">Prénom</label>
              <input id="edit-prenom" type="text" bind:value={editForm.prenom} />
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="edit-email">Email</label>
              <input id="edit-email" type="email" bind:value={editForm.email} />
            </div>
            <div class="form-group">
              <label for="edit-phone">Téléphone</label>
              <input id="edit-phone" type="text" bind:value={editForm.phone} />
            </div>
          </div>
        {/if}

        {#if saveMessage}
          <p class={saveMessage.includes('✅') ? 'success' : 'error'}>{saveMessage}</p>
        {/if}

        <div class="modal-actions">
          <button class="btn-cancel" on:click={closeEdit}>Annuler</button>
          {#if editingJoueur.type === 'externe'}
            <button class="btn-danger" on:click={() => deleteJoueur(editingJoueur!)}>
              Supprimer
            </button>
          {/if}
          <button class="btn-save" on:click={saveJoueur} disabled={saving}>
            {saving ? 'Sauvegarde...' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  {/if}

  <!-- Modal nouveau joueur -->
  {#if showNewForm}
    <div class="modal-backdrop" on:click={closeNewForm} role="presentation">
      <div class="modal" on:click|stopPropagation role="dialog">
        <h2>Nouveau joueur externe</h2>

        <div class="form-row">
          <div class="form-group">
            <label for="new-prenom">Prénom *</label>
            <input id="new-prenom" type="text" bind:value={newForm.prenom} />
          </div>
          <div class="form-group">
            <label for="new-nom">Nom *</label>
            <input id="new-nom" type="text" bind:value={newForm.nom} />
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label for="new-email">Email</label>
            <input id="new-email" type="email" bind:value={newForm.email} />
          </div>
          <div class="form-group">
            <label for="new-phone">Téléphone</label>
            <input id="new-phone" type="text" bind:value={newForm.phone} />
          </div>
        </div>

        {#if createMessage}
          <p class={createMessage.includes('✅') ? 'success' : 'error'}>{createMessage}</p>
        {/if}

        <div class="modal-actions">
          <button class="btn-cancel" on:click={closeNewForm}>Annuler</button>
          <button class="btn-save" on:click={createJoueur} disabled={creating}>
            {creating ? 'Création...' : 'Créer le joueur'}
          </button>
        </div>
      </div>
    </div>
  {/if}
</div>

<footer class="copyright">
  © {currentYear} Wb-Scoring — Tous droits réservés
</footer>

<style>
  :global(html, body) {
    margin: 0;
    padding: 0;
    height: 100%;
  }

  :global(body) {
    font-family: 'Poppins', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: radial-gradient(circle at top, #125c2a 0%, #04140a 40%, #020506 100%);
    background-attachment: fixed;
    background-repeat: no-repeat;
    background-color: #020506;
    color: #ffffff;
    padding-bottom: 50px;
  }

  .admin-page {
    max-width: 1200px;
    margin: 2rem auto;
    padding: 1rem;
    color: #f9fafb;
  }

  h1 {
    font-size: 1.8rem;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .back-link {
    color: #22c55e;
    text-decoration: none;
    font-size: 1.2rem;
    font-weight: 600;
  }

  .back-link:hover {
    text-decoration: underline;
  }

  .sep {
    opacity: 0.9;
    margin: 0 0.4rem;
  }

  .admin-card {
    background: #020617;
    border-radius: 16px;
    padding: 1.5rem;
    border: 1px solid rgba(34, 197, 94, 0.3);
    box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
  }

  .tabs-row {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .tab-btn {
    padding: 0.6rem 1.2rem;
    border: 1px solid rgba(34, 197, 94, 0.3);
    background: transparent;
    color: #9ca3af;
    border-radius: 8px;
    cursor: pointer;
    font-size: 0.9rem;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    border-color: rgba(34, 197, 94, 0.6);
  }

  .tab-btn.active {
    background: linear-gradient(135deg, #14532d, #052e16);
    color: #f9fafb;
    border-color: #22c55e;
  }

  .filters-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    align-items: center;
  }

  .search-input {
    flex: 1;
    min-width: 200px;
    padding: 0.5rem 1rem;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.6);
    background: #020617;
    color: #f9fafb;
  }

  .filter-select {
    padding: 0.5rem 1rem;
    border-radius: 999px;
    border: 1px solid rgba(148, 163, 184, 0.6);
    background: #020617;
    color: #f9fafb;
  }

  .btn-add {
    padding: 0.5rem 1rem;
    border-radius: 999px;
    border: none;
    background: #22c55e;
    color: #020617;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-add:hover {
    filter: brightness(1.1);
  }

  .joueurs-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 1rem;
    font-size: 0.9rem;
  }

  .joueurs-table th,
  .joueurs-table td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid rgba(51, 65, 85, 0.9);
    text-align: left;
  }

  .joueurs-table th {
    background: linear-gradient(to bottom, #14532d, #052e16);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.78rem;
  }

  .joueurs-table tbody tr:nth-child(even) {
    background: #020b06;
  }

  .joueurs-table tbody tr:hover {
    background: #064e3b;
  }

  .alias-cell {
    font-weight: 600;
    color: #22c55e;
  }

  .center {
    text-align: center;
  }

  .badge-yes {
    color: #22c55e;
    font-weight: bold;
  }

  .badge-no {
    color: #6b7280;
  }

  .btn-edit {
    padding: 0.3rem 0.7rem;
    border-radius: 6px;
    border: 1px solid rgba(34, 197, 94, 0.5);
    background: transparent;
    color: #22c55e;
    cursor: pointer;
    font-size: 0.8rem;
  }

  .btn-edit:hover {
    background: rgba(34, 197, 94, 0.1);
  }

  /* Modal */
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    background: #020617;
    border: 1px solid rgba(34, 197, 94, 0.4);
    border-radius: 16px;
    padding: 1.5rem;
    max-width: 500px;
    width: 90%;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.8);
  }

  .modal h2 {
    margin: 0 0 0.25rem 0;
    color: #f9fafb;
  }

  .modal-subtitle {
    color: #22c55e;
    margin: 0 0 1rem 0;
    font-weight: 600;
  }

  .form-row {
    display: flex;
    gap: 1rem;
    margin-bottom: 0.75rem;
  }

  .form-group {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .form-group label {
    font-size: 0.85rem;
    color: #9ca3af;
  }

  .form-group input[type='text'],
  .form-group input[type='email'] {
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    border: 1px solid rgba(75, 85, 99, 0.8);
    background: #020617;
    color: #e5e7eb;
  }

  .form-group input[type='checkbox'] {
    margin-right: 0.5rem;
  }

  .info {
    font-size: 0.85rem;
    color: #6b7280;
    margin: 0.5rem 0;
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    margin-top: 1.5rem;
  }

  .btn-cancel {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: 1px solid rgba(75, 85, 99, 0.8);
    background: transparent;
    color: #9ca3af;
    cursor: pointer;
  }

  .btn-save {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: none;
    background: #22c55e;
    color: #020617;
    font-weight: 600;
    cursor: pointer;
  }

  .btn-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-danger {
    padding: 0.5rem 1rem;
    border-radius: 8px;
    border: none;
    background: #dc2626;
    color: white;
    cursor: pointer;
  }

  .error {
    color: #f97373;
  }

  .success {
    color: #22c55e;
  }

  .copyright {
    position: fixed;
    bottom: 12px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 0.8rem;
    color: #d9d9d9;
    opacity: 0.9;
    background: rgba(0, 0, 0, 0.8);
    padding: 4px 10px;
    border-radius: 10px;
    backdrop-filter: blur(4px);
    z-index: 9999;
  }
</style>
