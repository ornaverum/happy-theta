<script lang='ts'>

    import { Stage, Layer, Line, Circle, Arrow, Text, Group, Rect} from 'svelte-konva';
	import type { Point } from '../kinematicsTypes';
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
	}

	interface Props {
		size: Point;
		numCell?: Point;
		gridList?: GridLine[];
		origin?: Point;
		margin?: Point;
		active?: boolean;
		gridLogic?: GridLogic;
	}

	let {
		size = {x: 800, y:100},
		numCell = {x:30, y:0},
		origin = {x: 10, y:0},
		gridList = [],
		margin = {x: 5, y:5},
		active = false,
		gridLogic = $bindable(),
	}: Props = $props();


	let label: {x:string, y:string} = $state({x:'x', y:'y'});
    let id_num: number = 0;
	let cellSize: number = $state(1);  // make aspect ratio of all cells 1:1
	let gridCenter: Point;
	let yValue :number;
	let offSet: Point = $state({x: 0, y: 0});

	

	onMount(()=>{
		label = {x:'x', y:'y'};
		cellSize = Math.min((size.x-2*margin.x)/(numCell.x+1), (size.y-2*margin.y)/(numCell.y+1));
		gridCenter = {x: size.x/2.0, y: size.y/2.0};
		yValue = cellSize;
		offSet = calculateOffset( {x: numCell.x/2.0 * cellSize, y: numCell.y/2.00*cellSize}, {x: size.x/2.0, y: size.y/2.0});


	});

	// translate from coordinate values to pixel coordinates


	const calculateOffset:Function= (gridCenter: Point, stageCenter: Point)=>{
		return {x: -gridCenter.x + stageCenter.x, y: -gridCenter.y + stageCenter.y};
	}



</script>


<Layer id='grid_layer' >
		{#each gridLogic?.getGridList() as item (item.id)}
			<Line 
				points= {[item.x0 + offSet.x, 
						item.y0 + offSet.y, 
						item.x1 + offSet.x, 
						item.y1 + offSet.y]}
				stroke= {item.strokeColor}
				strokeWidth= {item.strokeWidth}
				opacity= {1}
				/>
		{/each}
		<Text 
			x= {size.x-10}
			y= {0.5*cellSize}
			text= {label.x}
			fontSize={20}
			fill= 'black'
			align= 'center'
		/>
	{#if active}
		<Rect 
			x= {0}
			y= {0}
			height = {size.y}
			width = {size.x}
			fill= 'white'
			opacity= {0}
		 
		on:click={(e) => console.log(' grid click')}
		/>
	{/if}
</Layer>

<!-- <Layer>
	<Rect 
		x= {0}
		y= {0}
		height = {size.y}
		width = {size.x}
		fill= 'green'
		opacity= {1}
		on:click={(e) => console.log(' grid click')}/>
</Layer> -->