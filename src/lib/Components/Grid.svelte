<script lang='ts'>

    import { Stage, Layer, Line, Circle, Arrow, Text, Group, Rect, type KonvaMouseEvent} from 'svelte-konva';
	import type { Point } from '$lib/types';
	import {onMount, tick} from 'svelte';
	import GridLogic from './GridLogic';

	type GridLine = {
		id: number,
		x0: number,
		y0: number,
		x1: number,
		y1: number,
		strokeWidth: number,
		strokeColor: string,
		gridLineType: 'minor' | 'major' | 'axis',
	}

	interface Props {
		gridLogic?: GridLogic;
	}

	let {
		gridLogic = undefined,
	}: Props = $props();

	let gridLineStyles:
	{
		minor: {strokeWidth: number, strokeColor: string},
		major: {strokeWidth: number, strokeColor: string},
		axis: {strokeWidth: number, strokeColor: string},
	} 

	= {
		minor : {strokeWidth: 1, strokeColor: 'gray'},
		major : {strokeWidth: 2, strokeColor: 'gray'},
		axis : {strokeWidth: 4, strokeColor: 'black'},
	}

	let stage:Stage|null = $state(null);
	let layer:Layer|null = $state(null);

	onMount(async () => {
		await tick();
		console.log('layer', layer.node);
		console.log('stage', stage);
	})

</script>


<Layer id='grid_layer' bind:this={layer}>
		<!-- <Rect x= {400} y= {50} height = {100} width = {800} fill= 'green' opacity= {0.5} /> -->
		<!-- <Line points= {[400, 50, 800, 100, 0, 0 , 50, 50]} strokeWidth={18} stroke= {'blue'} opacity= {1} /> -->
		{#each gridLogic?.getGridList() as item}
			{#if item.gridLineType === 'axis'}
				<Arrow 
					points= {[item.x0, 
							item.y0 , 
							item.x1 , 
							item.y1 ]}
					strokeWidth= {gridLineStyles[item.gridLineType].strokeWidth}
					stroke= {gridLineStyles[item.gridLineType].strokeColor}
					opacity= {1}
					/>

			{:else}
				<Line 
					points= {[item.x0, 
							item.y0 , 
							item.x1 , 
							item.y1 ]}
					strokeWidth= {gridLineStyles[item.gridLineType].strokeWidth}
					stroke= {gridLineStyles[item.gridLineType].strokeColor}
					opacity= {1}
					/>
			{/if}
		{/each}

</Layer>
