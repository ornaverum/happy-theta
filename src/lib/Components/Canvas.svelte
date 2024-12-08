<script lang="ts">
    import {onMount} from 'svelte';


	interface Props {
		name?: string;
		width?: number;
		height?: number;
		background?: string;
	}

	let {
		name = 'Canvas',
		width = 300,
		height = 300,
		background = '#fff'
	}: Props = $props();
	
	let canvas = $state();
	let context


</script>


<div>
    <canvas bind:this={canvas} width={width} height={height} class='bg-primary-200'></canvas>
</div>