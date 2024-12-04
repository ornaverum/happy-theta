<script>
	import { Stage, Layer, Rect } from 'svelte-konva';

	let myX = $state(100);
	let myY = $state(100);

	$effect(() => {
		console.log('x changed:', myX);
	});
</script>

<Stage width={window.innerWidth} height={window.innerHeight}>
	<Layer>
		<Rect bind:x={myX} bind:y={myY} width={400} height={200} fill="blue" draggable/>
	</Layer>
</Stage>