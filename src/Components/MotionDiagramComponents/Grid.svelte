<script lang='ts'>

    import { Stage, Layer, Line, Circle, Arrow, Text, Group, Rect} from 'svelte-konva';
	import type { Point } from '../kinematicsTypes';
	import {onMount} from 'svelte';

	import Grid from './Grid.svelte';

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
		getStageFromPoint?:Function;
		getPointFromStage?:Function;
	}

	let {
		size = {x: 800, y:100},
		numCell = {x:30, y:0},
		origin = {x: 10, y:0},
		gridList = [],
		margin = {x: 5, y:5},
		active = false,
		getStageFromPoint = $bindable(()=>{}),
		getPointFromStage = $bindable(()=>{}),
	}: Props = $props();


	const range = (start:number, end:number, step:number = 1) => {
		const length = Math.ceil((end - start) / step);
		return Array.from({ length }, (_, i) => start + i * step);
	}

	
	// size is the height or width, depending
	const generateGridCoords = (size:number, numGrids:number, margin:number = 10)=>{
		return range(margin, size-margin, numGrids);
	}

	let label: {x:string, y:string} = $state({x:'x', y:'y'});
    let id_num: number = 0;
	let cellSize: number = $state(1);  // make aspect ratio of all cells 1:1
	let gridCenter: Point;
	let yValue :number;
	let offSet: Point = $state({x: 0, y: 0});
	let grid:Grid;

	

	onMount(()=>{
		label = {x:'x', y:'y'};
		cellSize = Math.min((size.x-2*margin.x)/(numCell.x+1), (size.y-2*margin.y)/(numCell.y+1));
		gridCenter = {x: size.x/2.0, y: size.y/2.0};
		yValue = cellSize;
		offSet = calculateOffset( {x: numCell.x/2.0 * cellSize, y: numCell.y/2.00*cellSize}, {x: size.x/2.0, y: size.y/2.0});
		buildGridLines();

		getStageFromPoint = (point: Point)=>{
			return {x: point.x*cellSize + offSet.x, y: point.y*cellSize + offSet.y};
		}

		getPointFromStage = (point: Point)=>{
			return {x: (point.x - offSet.x)/cellSize, y: (point.y - offSet.y)/cellSize};
		}
	});

	// translate from coordinate values to pixel coordinates


	const calculateOffset:Function= (gridCenter: Point, stageCenter: Point)=>{
		return {x: -gridCenter.x + stageCenter.x, y: -gridCenter.y + stageCenter.y};
	}



	const buildGridLines:Function = ()=>{
		// gridlines for x (i.e., parallel to y-axis)
		for (let i = 0; i <= numCell.x; i++) {
			let xVal = i*cellSize;
			let yVali = numCell.y==0 ? -cellSize : 0;
			let yValf = numCell.y*cellSize | cellSize;
			gridList.push({
				id: id_num++,
				x0: xVal,
				y0: yVali,
				x1: xVal,
				y1: yValf,
				strokeWidth: i%5==0 ? 4 : 2,
				strokeColor: 'gray',
			});
		}

		// gridlines for y (i.e., parallel to x-axis)

		for (let i = 0; i <= numCell.y; i++) {
			let startParallel = i * cellSize;
			let startPerp = 0;
			let endPerp = numCell.x * cellSize;
			gridList.push({
				id: id_num++,
				x0: startPerp,
				y0: startParallel,
				x1: endPerp,
				y1: startParallel,
				strokeWidth: i%5==0 ? 4 : 2,
				strokeColor: 'gray',
			});
		}

		// y axis
		gridList.push({
			id: id_num++,
			x0: origin.x * cellSize,
			y0: numCell.y==0?cellSize * 1.5:numCell.y*cellSize,
			x1: origin.x * cellSize,
			y1: numCell.y==0?-cellSize * 1.5:0-2.5,
			strokeWidth: 5,
			strokeColor: 'black',
		});

		// x axis
		gridList.push({
			id: id_num++,
			x0: -2.5,
			y0: (numCell.y - origin.y) * cellSize,
			x1: numCell.x*cellSize +2.5,
			y1: (numCell.y - origin.y) * cellSize,
			strokeWidth:  5,
			strokeColor: 'black',
		});

		console.log('gridList: ', gridList);
	}

</script>


<Layer id='grid_layer' >
		{#each gridList as item (item.id)}
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