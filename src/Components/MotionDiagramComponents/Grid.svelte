<script lang='ts'>

    import { Stage, Layer, Line, Circle, Arrow, Text, Group, Rect} from 'svelte-konva';
	import type { Point } from '../kinematicsTypes';
	import {onMount} from 'svelte';

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
		size: {x:number, y:number};
		cellNum?: {x:number, y:number};
		gridList?: GridLine[];
		gridCenteredValue?: {x: number, y: number};
		margin?: {x:number, y:number};
		active?: boolean;
	}

	let {
		size = {x: 800, y:100},
		cellNum = {x:30, y:0},
		gridCenteredValue = {x: 10, y:0},
		gridList = [],
		margin = {x: 5, y:5},
		active = false
	}: Props = $props();


	const range = (start:number, end:number, step:number = 1) => {
		const length = Math.ceil((end - start) / step);
		return Array.from({ length }, (_, i) => start + i * step);
	}

	

	// size is the height or width, depending
	const generateGridCoords = (size:number, numGrids:number, margin:number = 10)=>{
		return range(margin, size-margin, numGrids);
	}


	let label: {x:string, y:string};
    let id_num: number = 0;
	let cellSize: number;  // make aspect ratio of all cells 1:1
	let gridCenter: {x: number, y: number};
	let yValue :number;

	onMount(()=>{
		label = {x:'x', y:'y'};
		cellSize = Math.min(size.x/(cellNum.x+1), size.y/(cellNum.y+1));
		gridCenter = {x: size.x/2.0, y: size.y/2.0};
		yValue = cellSize;
		buildGridLines();
	});

	// translate from coordinate values to pixel coordinates
	export const findClosestGridPoint:Function = (pt:Point)=>{
		let pix: {x: number, y: number} = {x: 0 , y:0};
		pix.x = (pt.x - gridCenteredValue.x)*cellSize + gridCenter.x;
		pix.y = (pt.y - gridCenteredValue.y)*cellSize + gridCenter.y;

		return pix;
	};

	const buildGridLines:Function = ()=>{
		// gridlines for x (i.e., parallel to y-axis)
		for (let i = 0; i <= cellNum.x; i++) {
			let startParallel = (i - gridCenteredValue.x) * cellSize +gridCenter.x;
			let startPerp = margin.y;
			let endPerp = size.y - margin.y;
			gridList.push({
				id: id_num++,
				x0: startParallel,
				y0: startPerp,
				x1: startParallel,
				y1: endPerp,
				strokeWidth: i%5==0 ? 4 : 2,
				strokeColor: 'gray',
			});
		}

		// gridlines for y (i.e., parallel to x-axis)

		for (let i = 0; i <= cellNum.y; i++) {
			let startParallel = (i-gridCenteredValue.y) * cellSize + gridCenter.y;
			let startPerp = margin.x;
			let endPerp = size.x - margin.x;
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

		gridList.push({
			id: id_num++,
			x0: -(cellNum.x-gridCenteredValue.x) * cellSize + gridCenter.x,
			y0: margin.y,
			x1: -(cellNum.x-gridCenteredValue.x) * cellSize + gridCenter.x,
			y1: size.y-margin.y,
			strokeWidth: 5,
			strokeColor: 'black',
		});

		gridList.push({
			id: id_num++,
			x0: margin.x,
			y0: gridCenter.y,
			x1: size.x - margin.x,
			y1: gridCenter.y,
			strokeWidth:  5,
			strokeColor: 'black',
		});
	}

</script>


<Layer id='grid_layer' >

		{#each gridList as item (item.id)}
			<Line 
				points= {[item.x0, item.y0, item.x1, item.y1]}
				stroke= {item.strokeColor}
				strokeWidth= {item.strokeWidth}
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
	<!-- </Layer> -->
	{#if active}
		<!-- <Layer config={{id: 'active_layer'}}> -->
		<Rect 
			x= {0}
			y= {0}
			height = {size.y}
			width = {size.x}
			fill= 'white'
			opacity= {0}
		 
		on:click={(e) => console.log(' grid click')}
		/>
		<!-- </Layer> -->
	{/if}
</Layer>