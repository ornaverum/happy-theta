<script lang="ts">
	import Canvas from '../../Components/Canvas.svelte';
	import Katex from 'svelte-katex';
	let canvas;
</script>

<main class='flex flex-col items-center h-3/4'>
	<h1 class = 'text-2xl h-3/4'>
		Coming soon...
	</h1>
	<!--inline math example-->
	Here is my favorite equation, <Katex displayMode="false">ax^2+bx+c=0</Katex>.
	<!--display math example-->
	<Katex displayMode>ax^2+bx+c=0</Katex>
	
</main>