<script lang="ts">
    import {onMount} from 'svelte';

	interface Props {
		name?: string;
		width?: number;
		height?: number;
		background?: string;
		children?: any;
	}

	let {
		name = 'Canvas',
		width = 300,
		height = 300,
		background = '#fff',
		children = []
	}: Props = $props();
	
	let canvas:HTMLCanvasElement = $state();
	let context: CanvasRenderingContext2D = $state();

	onMount(() => {
		context = canvas.getContext('2d');
		context.fillStyle = background;
		context.fillRect(0, 0, width, height);

		console.log(children);
	});

	const getContext = () => {return context};

	const addImage = (img:HTMLImageElement) => {
		img.onload = () => {
			context.drawImage(img, 0, 0);
		};
	};

</script>


<div>
    <canvas bind:this={canvas} width={width} height={height} class='bg-primary-200'/>
</div>