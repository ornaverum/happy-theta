<script lang="ts">
	import { Stage, Layer, Line, Circle, Arrow, Text, Rect, type KonvaMouseEvent} from 'svelte-konva';
	import Grid from './Grid.svelte';
	import GridLogic from './GridLogic';

	import type { Point, Vector } from '$lib/types';

    import { Label, Select, Input, Button, Toggle } from 'flowbite-svelte';
    import {TrashBinOutline, FileExportOutline, EditOutline, ArrowRightOutline, RefreshOutline} from 'flowbite-svelte-icons';

	let name: string = 'Motion Diagram Component';

	interface Props {
		width?: number;
		height?: number;
		label?: string;
		title?: string;
		numCells?: Point;
		showControlButtons?: boolean;
		id?: number;
		marginY?: number;
		posList?: Point[];
		accList?: Vector[];
		handleDelete?: (e: MouseEvent)=> void;
	}

	let {
		width = 800,
		height = 200,
		label = 'x',
		title = $bindable('Title'),
		numCells = {x: 30, y:0},
		showControlButtons = true,
		id = 0,
		marginY = 5,
		posList = $bindable([]),
		accList = $bindable([]),
		handleDelete = (e: MouseEvent) => {},
	}: Props = $props();

	let nextId:number = 0;
	let positionCircleProps = {radius: 8, fill: 'blue', opacity: 1}
	let velocityArrowProps = {strokeWidth: 3, stroke: 'green', fill: 'green', opacity: 1}
	
	// constructor(size:Point, margin:Point, numCells:Point, origin:Point)
	let gridLogic = new GridLogic({x:width, y:height}, {x:5, y:5}, {...numCells}, {x: 0, y: 0});
	let editTitle:boolean = $state(false);

	let toggleChecked:boolean = $state(false);
	let onStage:boolean = $state(false);
	
	// let divToCapture: HTMLDivElement = document.querySelector('#capture');

	let previewPos:Point = $state({x:-100, y:-100});


	// in case of 1D, shift points to avoid overlap
	const shiftPoint:Function = (pt:Point, prior:Point, prePrior:Point) => {
		if ( (numCells.y>0 && numCells.x>0) || !prior)
			return pt;
		
		let dV:Point = {x: pt.x - prior.x, y: pt.y - prior.y};
		let shift:Point = {x:0, y:0};

		if (numCells.y == 0 && dV.x == 0)
			shift.y = 10;
		else if (numCells.x == 0 && dV.y == 0)
			shift.x = 10;

		if (prePrior){
			let dV2:Point = {x: prior.x - prePrior.x, y: prior.y - prePrior.y};
			if (numCells.y==0 && (Math.sign(dV.x) == -Math.sign(dV2.x))){
				shift.y = 10;
			} else if (numCells.x==0 && (Math.sign(dV.y) == -Math.sign(dV2.y))){
				shift.x = 10;
			}
		}
		return {x:pt.x + shift.x, y:pt.y + shift.y};
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

</script>

{#snippet drawPositions(xs:Point[])}
	<Layer>
		{#each xs as x}
			<Circle {...positionCircleProps} {...x} id={(nextId++)+''} />
		{/each}
	</Layer>
{/snippet}

{#snippet drawVelocities(xs:Point[])}
	<Layer>
		{#if xs.length > 1}
			{#each xs as x, i}
				{#if i > 0}
					{#if (numCells.y==0 && (xs[i-1].x == x.x))}
					{:else if (numCells.x==0 && (xs[i-1].y == x.y))}
					{:else}
						<Arrow {...velocityArrowProps} points={[xs[i-1].x, xs[i-1].y, x.x, x.y]} id={(nextId++)+''} />
					{/if}
				{/if}
			{/each}
		{/if}
	</Layer>
{/snippet}

<main class="flex flex-col justify-center p-4 items-center">
	<div id='Title' class='m-4 p-2 text-2xl font-bold flex flex-row rounded-xl border-1'>
		<Button color='alternative' class='mr-3' size='xs' on:click={()=>{editTitle = !editTitle}}>
			<EditOutline/>
		</Button>
		{#if editTitle}
			<Input bind:value={title} placeholder="Free Body Diagram"
				on:keydown={(evt) => { if (evt.key == 'Enter') { editTitle = false;}}}
			/>
		{:else}
			{title}
		{/if}
		<!-- <div contenteditable="true">{title}</div> -->
	</div>
	<div class="flex flex-row">
		{#if (showControlButtons)}
			<div id='button-container flex flex-row m-4 p-4'>
				<!-- <Button class='bg-accent hover:bg-red-800' on:click={handleDelete}
					><TrashBinOutline/></Button> -->
				<!-- <Button class='bg-accent hover:bg-secondary-600' on:click={()=>{
					posList = [];
					velList = [];
					accList = [];
					yValue = cellSize;
					params.yValue = yValue;
				}}><RefreshOutline/></Button> -->
				<!-- <div class='flex flex-row text-sm'>
					Position
					<Toggle bind:checked={toggleChecked} class='ml-2'/>
					Acceleration
				</div> -->
			</div>
		{/if}
		<div id='capture'>
			<div id='fbd' class='bg-gray-50 p-4'>
				<Stage {width} {height} id='main_stage'
					onmouseleave={() => {onStage = false; console.log('mouseleave')}}
					onmouseenter={() => {onStage = true; console.log('mouseenter')}}
					onclick={handleGridClick}
					onmousemove={handleGridMouseMove}
					>
					<Grid {gridLogic} active={onStage}/>
					<!-- <Velocity bind:velList={velList} {posList}/>
					<Acceleration active={toggleChecked && onStage} bind:accList={accList} {...params} {posList}/> -->

					{@render drawPositions(posList)}

					{@render drawVelocities(posList)}


					<Layer>
						<Circle {...previewPos} {...positionCircleProps} opacity={0.5} id={'preview'}/>
					</Layer>

				</Stage>
			</div>
		</div>
	</div>

</main>
