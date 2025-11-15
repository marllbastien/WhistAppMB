<script lang="ts">
	import { onMount } from 'svelte';

	let tableName = '';
	let mancheNumber = '';
	let players: string[] = [];
	let playerCount = 0;
	let rows = 0;

	let showModal = false;
	let currentRow = -1;
	let step = 1;

let annonces = [
  { code: 'Capot', label: 'Embal-13 plis' },
  { code: 'S6', label: 'Seul 6 plis' },
  { code: 'S7', label: 'Seul 7 plis' },
  { code: 'S8_18', label: 'Seul 8 plis' },
  { code: 'PM', label: 'Petite misère' },
  { code: 'A9', label: 'Abondance 9 plis' },
  { code: 'A10', label: 'Abondance 10 plis' },
  { code: 'A11', label: 'Abondance 11 plis' },
  { code: 'P', label: 'Piccolo' },
  { code: 'GM', label: 'Grande misère' },
  { code: 'GME', label: 'Grande misère étalée' },
  { code: 'PC', label: 'Petit chelem' },
  { code: 'CH', label: 'Chelem' },
  { code: 'TR Capot', label: 'Trou Capot' },
  { code: 'P2', label: 'Piccolo 2 joueurs' },
  { code: 'S8_21', label: 'Seul 8 plis direct' },
  { code: 'E8', label: 'Emballage 8 plis' },
  { code: 'E9', label: 'Emballage 9 plis' },
  { code: 'E10', label: 'Emballage 10 plis' },
  { code: 'E11', label: 'Emballage 11 plis' },
  { code: 'E12', label: 'Emballage 12 plis' },
  { code: 'E13', label: 'Emballage 13 plis' },
  { code: 'GM2', label: 'Grande misère 2 joueurs' },
  { code: 'PM2', label: 'Petite misère 2 joueurs' },
  { code: 'GME2', label: 'Grande misère étalée 2 joueurs' },
  { code: 'TR', label: 'Trou' },
  { code: 'D', label: 'Dames' },
  { code: 'V', label: 'Valets' },
  { code: 'PME', label: 'Petite misère étalée' },
  { code: 'PME2', label: 'Petite misère étalée 2 joueurs' }
];


	let annonceByPlayer: string[] = [];
	let emballes: (string | null)[] = [];
	let plis: number[] = [];
	let tableData: { annonces: string[]; plis: number[]; emballes: (string | null)[] }[] = [];

	onMount(() => {
		const url = new URL(window.location.href);
		tableName = url.searchParams.get('tableName') || 'A';
		mancheNumber = url.searchParams.get('mancheNumber') || '1';
		playerCount = Number(url.searchParams.get('playerCount') || 4);
		players = JSON.parse(url.searchParams.get('players') || '["Alice","Bob","Claire","David"]');

		rows = playerCount === 4 ? 16 : playerCount === 5 ? 20 : 24;
		//resetArrays();
	});

	function resetArrays() {
		annonceByPlayer = Array(playerCount).fill('');
		plis = Array(playerCount).fill(0);
		emballes = Array(playerCount).fill(null);
		tableData = Array(rows)
			.fill(null)
			.map(() => ({
				annonces: Array(playerCount).fill(''),
				plis: Array(playerCount).fill(0),
				emballes: Array(playerCount).fill(null)
			}));
	}

	function openModal(rowIndex: number) {
		currentRow = rowIndex;
		step = 1;
		const ligne = tableData[rowIndex];
		annonceByPlayer = [...ligne.annonces];
		plis = [...ligne.plis];
		emballes = [...ligne.emballes];
		showModal = true;
	}

	function closeModal() {
		showModal = false;
	}

	function isEmballage(code: string) {
		return code.startsWith('E');
	}

	function nextStep() {
		step = 2;
	}

	function previousStep() {
		step = 1;
	}

	function updatePlis(index: number, value: string) {
		const v = Number(value);
		if (isNaN(v)) return;
		plis[index] = v;

		// Si ce joueur a un partenaire emballé, lui attribuer le même nombre de plis
		const partnerName = emballes[index];
		if (partnerName) {
			const partnerIndex = players.findIndex((p) => p === partnerName);
			if (partnerIndex !== -1) plis[partnerIndex] = v;
		}
	}

	function validateRow() {
		tableData[currentRow] = {
			annonces: [...annonceByPlayer],
			plis: [...plis],
			emballes: [...emballes]
		};
		showModal = false;
	}

	// Préparer le JSON pour affichage
	$: jsonOutput = JSON.stringify(
		{
			table: tableName,
			manche: Number(mancheNumber),
			lignes: tableData
				.filter((l) => l.plis.some((p) => p > 0) || l.annonces.some((a) => a))
				.map((ligne) => ({
					joueurs: players.map((p, i) => ({
						nom: p,
						annonce: ligne.annonces[i] || null,
						plis: ligne.plis[i],
						partenaire: ligne.emballes[i]
					}))
				}))
		},
		null,
		2
	);
</script>

<style>
	table {
		border-collapse: collapse;
		width: 100%;
		margin-top: 1.5rem;
	}
	th,
	td {
		border: 1px solid #ccc;
		padding: 0.6rem;
		text-align: center;
		cursor: pointer;
	}
	th {
		background-color: #f5b942;
		color: #1a1a1a;
	}
	tr:hover {
		background-color: #f0f0f0;
	}
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.modal {
		background: white;
		padding: 2rem;
		border-radius: 10px;
		width: 420px;
		max-width: 90%;
		position: relative;
	}
	.close-btn {
		position: absolute;
		top: 10px;
		right: 10px;
		font-size: 1.5rem;
		cursor: pointer;
	}
	.player-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}
	select,
	input[type='number'] {
		width: 160px;
	}
	.red-name {
		color: #f54242;
		font-weight: bold;
	}
	.fusion {
		background-color: #d7f7d7;
	}
	button {
		margin-top: 1rem;
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 6px;
		background: #f5b942;
		cursor: pointer;
	}
</style>

<main>
	<h2>Table {tableName} — Manche {mancheNumber}</h2>

	{#if players.length > 0}
		<table>
			<thead>
				<tr>
					{#each players as p}
						<th>{p}</th>
					{/each}
				</tr>
			</thead>
			<tbody>
				{#each Array(rows) as _, i}
					<tr on:click={() => openModal(i)}>
						{#each players as _, j}
							<td>
								{#if tableData[i].annonces[j]}
									<strong>{tableData[i].annonces[j]}</strong> ({tableData[i].plis[j]})
								{:else if tableData[i].plis[j] > 0}
									{tableData[i].plis[j]}
								{/if}
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}

	<h3>Données actuelles (JSON)</h3>
	<pre>{jsonOutput}</pre>
</main>

{#if showModal}
	<div class="modal-backdrop">
		<div class="modal">
			<div class="close-btn" on:click={closeModal}>×</div>

			<!-- Étape 1 -->
			{#if step === 1}
				<h3>Attribuer l'annonce à un joueur</h3>

				{#each players as p, idx}
					<div class="player-row">
						<span>{p}</span>
						<select bind:value={annonceByPlayer[idx]}>
							<option value="">-- Choisir annonce --</option>
							{#each annonces as a}
								<option value={a.code}>{a.label}</option>
							{/each}
						</select>
					</div>

					{#if annonceByPlayer[idx] && isEmballage(annonceByPlayer[idx])}
						<div style="margin-left:1rem;">
							<label>
								Avec qui {p} est emballé ?
								<select bind:value={emballes[idx]}>
									<option value="">-- Choisir joueur --</option>
									{#each players.filter((x) => x !== p) as other}
										<option value={other}>{other}</option>
									{/each}
								</select>
							</label>
						</div>
					{/if}
				{/each}

				<button on:click={nextStep}>Suivant</button>

			<!-- Étape 2 -->
			{:else if step === 2}
			<h3>Renseigner les plis</h3>

			{#each players as p, idx}
				{#if emballes[idx]}
					{#if idx < players.findIndex(x => x === emballes[idx])}
						<!-- Ligne fusionnée -->
						<div class="player-row fusion">
							<span class:red-name={!!annonceByPlayer[idx]}>
								{p} & {emballes[idx]} ({annonceByPlayer[idx]})
							</span>
							<input
								type="number"
								min="0"
								max="13"
								value={plis[idx]}
								on:input={(e) => updatePlis(idx, (e.target as HTMLInputElement).value)}
							/>
						</div>
					{/if}
				{:else}
					<!-- Joueur seul -->
					<div class="player-row">
						<span class:red-name={!!annonceByPlayer[idx]}>
							{p}{#if annonceByPlayer[idx]} ({annonceByPlayer[idx]}){/if}
						</span>
						<input
							type="number"
							min="0"
							max="13"
							value={plis[idx]}
							on:input={(e) => updatePlis(idx, (e.target as HTMLInputElement).value)}
						/>
					</div>
				{/if}
			{/each}


			<div style="display:flex; justify-content:space-between;">
				<button on:click={previousStep}>← Retour</button>
				<button on:click={validateRow}>Valider</button>
			</div>

			{/if}
		</div>
	</div>
{/if}
