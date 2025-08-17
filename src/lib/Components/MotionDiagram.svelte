<script lang="ts">
	import { Stage, Layer, Line, Circle, Arrow, Text, Rect, type KonvaMouseEvent, Group } from 'svelte-konva';
	import Grid from './Grid.svelte';
	import GridLogic from './GridLogic';
	import EditLabel from './EditLabel.svelte';

	import {onMount} from 'svelte';

	import type { Point, Vector } from '$lib/types';

    import { Label, Select, Input, Button, Toggle } from 'flowbite-svelte';
    import {TrashBinOutline, FileExportOutline, EditOutline, ArrowRightOutline, RefreshOutline} from 'flowbite-svelte-icons';

	let name: string = 'Motion Diagram Component';

	interface Props {
		size?: Point;
		title?: string;
		numCells?: Point;
		initCellSize?: number;
		showControlButtons?: boolean;
		posList?: Point[];
		accList?: Vector[];
		margin?: Point;
		origin?: Point;
		handleDelete?: (e: KonvaMouseEvent)=> void;
	}

	let {
		size = {x:800, y:800},
		title = $bindable('Title'),
		numCells = {x: 20, y:0},
		initCellSize = 20,
		showControlButtons = false,
		posList = $bindable([]),
		accList = $bindable([]),
		origin = {x:10, y:0},
        margin = {x:5, y:5},
		handleDelete = (e: KonvaMouseEvent) => {},
	}: Props = $props();


	let nextId:number = 0;  // don't make it state, since it updates in the snippets.

	let positionCircleProps = {radius: 8, fill: 'blue', opacity: 1}
	let velocityArrowProps = {strokeWidth: 3, stroke: 'green', fill: 'green', opacity: 1}

	let toggleChecked:boolean = $state(false);
	let onStage:boolean = $state(false);
	
	let previewPos:Point = $state({x:400, y:100});

	let windowSize:Point = $state({x:0, y:0});
	let stageContainerSize: Point = $state({x:0, y:0});

    let maxStageSize: Point = $derived.by(() => {
		let gridAspectRatio:number = (numCells.x + 2)/(numCells.y + 2);
		let containerAspectRatio:number = windowSize.x / windowSize.y;
		let szX:number = 200;
		let szY:number = 200;

		if (gridAspectRatio > 1){  // Landscape
			szX = 0.5*Math.max(windowSize.x, 200);
	        szY = szX/gridAspectRatio;
		}

		if (gridAspectRatio <= 1){ //|| szY > stageContainerSize.y){ // portrait, or width is too much for screen height
			szY = 0.5*Math.max(windowSize.y, 200);
			szX = szY*gridAspectRatio;
		}

	    return {x: szX, y: szY};
    });

	let cellSize:number = $derived.by(() => {
		let szX = maxStageSize.x / (numCells.x + 2);
		let szY = maxStageSize.y / (numCells.y + 2);
		return Math.min(szX, szY) || initCellSize;
	});


	let gridLogic:GridLogic = $derived(new GridLogic( {
		numCells: {...numCells},
		origin: {...origin},
		cellSize: cellSize
	}));


	// in case of 1D, shift points to avoid overlap
	const shiftPoint:Function = (pt:Point, prior:Point, prePrior:Point) => {

		// If it's 2D, don't need shift
		if ( numCells.y>0 && numCells.x>0)
			return pt;

		// If this is the first dot, don't need shift
		if (Object.keys(prior).length == 0)
			return pt;

		let newPt:Point = {...pt};
		let dV:Point = {x: pt.x - prior.x, y: pt.y - prior.y};
		newPt.y = prior.y;


		// if horizontal and the x value is the same, shift down
		if (numCells.y == 0 && dV.x == 0)
			newPt.y += 10;
		// else if vertical and the y value is the same, shift right
		else if (numCells.x == 0 && dV.y == 0)
			newPt.x += 10;

		// if there is a prePrior point, check if the direction is reversed
		if (prePrior){
			let dV2:Point = {x: prior.x - prePrior.x, y: prior.y - prePrior.y};
			if (numCells.y==0 && (Math.sign(dV.x) == -Math.sign(dV2.x))){
				newPt.y += 10;
			} else if (numCells.x==0 && (Math.sign(dV.y) == -Math.sign(dV2.y))){
				newPt.x += 10;
			}
		} 
		return {...newPt};
	}

	const handleGridMouseMove:(e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
		let pt:Point = gridLogic.getSnappedPointFromStage({x:e.evt.layerX, y:e.evt.layerY});
		let newPt: Point = gridLogic.getStageFromPoint(pt);
		if (numCells.y == 0 || numCells.x == 0){
			let prior:Point|null = posList[posList.length-1]||null;
			let prePrior:Point|null = posList[posList.length-2]||null;
			newPt = shiftPoint({...newPt}, {...prior}, {...prePrior});
		}

		previewPos = {...newPt};
	}
	const handleGridClick:(e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
		addPosition();
	}

	const addPosition:Function = () => {
		posList = [...posList, {...previewPos}];

	}


	$inspect('stageContainerSize', stageContainerSize);
	$inspect('maxStageSize', maxStageSize);
	$inspect(gridLogic);

	
</script>

{#snippet drawPositions(xs:Point[])}
	<Layer>
		{#each xs as x}
			<Group data-id={(nextId++)+''} on:click={(e) => handleDelete(e)}>
				<Circle {...positionCircleProps} {...x} />
			</Group>
		{/each}
	</Layer>
{/snippet}

{#snippet drawVelocities(xs:Point[])}
	<Layer>
		{#if xs.length > 1}
			{#each xs as x, i}
				{#if i > 0 && !(numCells.y==0 && xs[i-1].x == x.x) && !(numCells.x==0 && xs[i-1].y == x.y)}
					<Group data-id={(nextId++)+''} on:click={(e) => handleDelete(e)}>
						<Arrow {...velocityArrowProps} points={[xs[i-1].x, xs[i-1].y, x.x, x.y]} />
					</Group>
				{/if}
			{/each}
		{/if}
	</Layer>
{/snippet}

<svelte:window bind:innerWidth={windowSize.x} bind:innerHeight={windowSize.y}/>

<main class="flex flex-col items-center bg-gray-100 p-4 shadow-lg w-full"
			bind:offsetWidth={stageContainerSize.x} bind:offsetHeight={stageContainerSize.y}>
	<EditLabel bind:text={title} size={'xl2'} />
	<div class="flex flex-row">
		{#if (showControlButtons)}
			<div id='button-container flex flex-row m-4 p-4'>
				<Button color='alternative' class='bg-accent hover:bg-red-800' on:click={handleDelete}
					><TrashBinOutline/></Button>
				<Button color='alternative' class='bg-accent hover:bg-red-800' on:click={()=>{
					posList = [];
					accList = [];
				}}><RefreshOutline/></Button>
				<div class='flex flex-row text-sm m-3'>
					Position
					<Toggle bind:checked={toggleChecked} class='ml-2'/>
					Acceleration
				</div>
			</div>
		{/if}
		<div id='stageContainer' class='min-w-11/12 mx-auto'>

			<Stage width={maxStageSize.x} height={maxStageSize.y} id='main_stage'
				onmouseleave={() => {onStage = false;}}
				onmouseenter={() => {onStage = true;}}
				onclick={handleGridClick}
				onmousemove={handleGridMouseMove}
				>
				<Grid {gridLogic}/>

				{@render drawPositions(posList)}

				{@render drawVelocities(posList)}

				{#if onStage}
					<Layer>
						<Circle {...previewPos} {...positionCircleProps} opacity={0.5} id={'preview'}/>
					</Layer>
				{/if}

			</Stage>
		</div>
	</div>
</main>
