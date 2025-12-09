<script lang="ts">
	export let color: 'rouge' | 'bleu' | 'noir' = 'rouge';
	export let size: number = 24;

	const colors = {
		rouge: { main: '#dc2626', dark: '#991b1b', accent: '#ef4444' },
		bleu: { main: '#2563eb', dark: '#1d4ed8', accent: '#3b82f6' },
		noir: { main: '#1f2937', dark: '#111827', accent: '#374151' }
	};

	$: colorScheme = colors[color];
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 100 100"
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	class="jeton-poker"
>
	<!-- Fond du jeton -->
	<circle cx="50" cy="50" r="48" fill={colorScheme.main} stroke={colorScheme.dark} stroke-width="2" />
	
	<!-- Cercle intérieur -->
	<circle cx="50" cy="50" r="35" fill={colorScheme.main} stroke="white" stroke-width="2" stroke-dasharray="8 4" />
	
	<!-- Encoches blanches sur le bord (8 encoches) -->
	{#each [0, 45, 90, 135, 180, 225, 270, 315] as angle}
		<rect
			x="46"
			y="2"
			width="8"
			height="12"
			rx="2"
			fill="white"
			transform="rotate({angle} 50 50)"
		/>
	{/each}
	
	<!-- Effet de brillance -->
	<ellipse cx="35" cy="35" rx="15" ry="10" fill="white" opacity="0.15" transform="rotate(-45 35 35)" />
	
	<!-- Cercle central décoratif -->
	<circle cx="50" cy="50" r="20" fill={colorScheme.dark} opacity="0.3" />
	<circle cx="50" cy="50" r="15" fill={colorScheme.main} stroke="white" stroke-width="1" opacity="0.8" />
	
	<!-- Points décoratifs au centre (comme les dés sur l'image) -->
	<circle cx="40" cy="40" r="3" fill="white" opacity="0.9" />
	<circle cx="60" cy="40" r="3" fill="white" opacity="0.9" />
	<circle cx="40" cy="60" r="3" fill="white" opacity="0.9" />
	<circle cx="60" cy="60" r="3" fill="white" opacity="0.9" />
	<circle cx="50" cy="50" r="3" fill="white" opacity="0.9" />
</svg>

<style>
	.jeton-poker {
		display: inline-block;
		vertical-align: middle;
	}
</style>
