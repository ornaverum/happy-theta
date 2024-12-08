<script lang="ts">
	import { Stage, Layer, Line, Circle, Arrow, Text, Rect, type KonvaMouseEvent} from 'svelte-konva';
	import Grid from './MotionDiagramComponents/Grid.svelte';
	import GridLogic from './MotionDiagramComponents/GridLogic';

	import type { Point, Position, Velocity, acceleration } from './kinematicsTypes';

    import { Label, Select, Input, Button, Toggle } from 'flowbite-svelte';
    import {TrashBinOutline, FileExportOutline, EditOutline, ArrowRightOutline, RefreshOutline} from 'flowbite-svelte-icons';

	let name: string = 'Motion Diagram Component';

	interface Props {
		width?: number;
		height?: number;
		label?: string;
		title?: string;
		gridNum?: number;
		showControlButtons?: boolean;
		id?: number;
		marginY?: number;
		posList?: Point[];
		velList?: Velocity[];
		accList?: Velocity[];
		handleDelete?: (e: MouseEvent)=> void;
	}

	let {
		width = 800,
		height = 200,
		label = 'x',
		title = $bindable('Title'),
		gridNum = 30,
		showControlButtons = true,
		id = 0,
		marginY = 5,
		posList = $bindable([]),
		velList = $bindable([]),
		accList = $bindable([]),
		handleDelete = (e: MouseEvent) => {},
	}: Props = $props();

	let nextId:number = 0;
	let positionCircleProps = {radius: 8, fill: 'blue', opacity: 1}
	let velocityArrowProps = {width: 2, color: 'green'}
	
	// constructor(size:Point, margin:Point, numCells:Point, origin:Point)
	let gridLogic = new GridLogic({x:width, y:height}, {x:5, y:5}, {x:30, y:0}, {x: 0, y: 0});
	let editTitle:boolean = $state(false);

	let toggleChecked:boolean = $state(false);
	let onStage:boolean = $state(false);
	
	// let divToCapture: HTMLDivElement = document.querySelector('#capture');
	let samplePositions: Point[] = [];
	samplePositions.push({x:0, y:0});
	samplePositions.push({x:100, y:10});

	// let previewPos:Position = $state({pos:{x:0, y:0}, id:0, ...positionCircleProps, opacity: 0.5});
	let previewPos:Point = $state({x:0, y:0});


	const handleGridMouseMove:(e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
		// console.log('grid mouse move', e);
		let pt:Point = gridLogic.getSnappedPointFromStage({x:e.evt.layerX, y:e.evt.layerX});
		previewPos = gridLogic.getStageFromPoint(pt);
	}
	const handleGridClick:(e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
		addPosition();
	}

	const addPosition:Function = () => {
		let pos:Point = {...previewPos};
		posList = [...posList, pos];
	}

</script>

{#snippet drawPositions(xs:Point[])}
	<Layer>
		{#each xs as x}
			<Circle {...positionCircleProps} {...x} id={(nextId++)+''} />
		{/each}
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

					<Layer>
						<Circle {...previewPos} {...positionCircleProps} opacity={0.5} id={'preview'}/>
					</Layer>

				</Stage>
			</div>
		</div>
	</div>

</main>
