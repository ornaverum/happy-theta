<script lang='ts'>

    import { Stage, Layer, Line, Circle, Arrow, Text, Group, Rect, type KonvaMouseEvent} from 'svelte-konva';
	import type { Point, Position } from './kinematicsTypes';
	import {onMount} from 'svelte';
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
		active?: boolean;
		gridLogic?: GridLogic;
	}

	let {
		active = false,
		gridLogic = $bindable(),
	}: Props = $props();

    let id_num: number = 0;
	let cellSize: number = $state(1);  // make aspect ratio of all cells 1:1
	let gridCenter: Point;
	let yValue :number;
	let offSet: Point = $state({x: 0, y: 0});

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

</script>


<Layer id='grid_layer' >
		<!-- <Rect x= {400} y= {50} height = {100} width = {800} fill= 'green' opacity= {0.5} /> -->
		<!-- <Line points= {[400, 50, 800, 100, 0, 0 , 50, 50]} strokeWidth={18} stroke= {'blue'} opacity= {1} /> -->
		{#each gridLogic?.getGridList() as item}
			<Line 
				points= {[item.x0, 
						item.y0 , 
						item.x1 , 
						item.y1 ]}
				strokeWidth= {gridLineStyles[item.gridLineType].strokeWidth}
				stroke= {gridLineStyles[item.gridLineType].strokeColor}
				opacity= {1}
				/>
		{/each}

</Layer>
