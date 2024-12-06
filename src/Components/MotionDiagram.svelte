<script lang="ts">
	import { Stage, Layer, Line, Circle, Arrow, Text, Rect} from 'svelte-konva';
	import Acceleration from './MotionDiagramComponents/Acceleration.svelte';
	import Velocity from './MotionDiagramComponents/Velocity.svelte';
	import Position from './MotionDiagramComponents/Position.svelte';
	import Grid from './MotionDiagramComponents/Grid.svelte';
	import {getPointFromStage, getStageFromPoint} from './MotionDiagramComponents/Grid.svelte';

	import type { Point, Dot, VectorArrow, acceleration } from './kinematicsTypes';

    import { Label, Select, Input, Button, Toggle } from 'flowbite-svelte';
    import {TrashBinOutline, FileExportOutline, EditOutline, ArrowRightOutline, RefreshOutline} from 'flowbite-svelte-icons';
	// import { position } from 'html2canvas/dist/types/css/property-descriptors/position';

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
		posList?: Dot[];
		velList?: VectorArrow[];
		accList?: VectorArrow[];
		handleDelete?: (e: MouseEvent)=> void;
	}

	let {
		width = 800,
		height = 100,
		label = 'x',
		title = $bindable('Title'),
		gridNum = 30,
		showControlButtons = true,
		id = 0,
		marginY = 5,
		posList = $bindable([]),
		velList = $bindable([]),
		accList = $bindable([]),
		handleDelete
	}: Props = $props();


	let circleProps = {radius: 8, color: 'blue'}

	let editTitle:boolean = $state(false);

	let gridPointList: number[] = [];
	for (let i = -15; i <= 15; i++) {
		gridPointList.push(i);
	}

	let gridSize:number = width;
	let cellSize:number = gridSize/(gridNum + 1);
	let gridCenter:number = gridSize/2.0;
	let yValue:number = $state(cellSize);

	let toggleChecked:boolean = $state(false);
	let onStage:boolean = $state(false);
	
	let params = $state({
		width: width,
		height: height,
		cellSize: cellSize,
		gridCenter: gridCenter,
		yValue: yValue,
		gridNum: gridNum,
		marginY: marginY,
	})

	// let divToCapture: HTMLDivElement = document.querySelector('#capture');
	let samplePositions: Point[] = [];
	samplePositions.push({x:0, y:0});
	samplePositions.push({x:100, y:10});


	getStageFromPoint({x: 0, y: 0});
</script>

{#snippet drawPositionDots(xs:Point[])}
	<Layer>
		{#each xs as x}
			<Circle {...x, circleProps} />
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
				Howard
			</div>
		{/if}
		<div id='capture'>
			<div id='fbd' class='bg-gray-50 p-4'>
				<Stage {width} {height} id='main_stage'
					on:mouseleave={() => {onStage = false;}}
					on:mouseenter={() => {onStage = true;}}
					>
					<Grid size={{x:width, y:height}} origin={{x:15, y:0}} numCell={{x:30, y:0}}/>
					<!-- <Velocity bind:velList={velList} {posList}/>
					<Acceleration active={toggleChecked && onStage} bind:accList={accList} {...params} {posList}/>

					{@render drawPositionDots(samplePositions)} -->
					<!-- <Layer>
						<Rect x={0} y={0} width={width/2} height={height/2} fill='blue' opacity={1}/>
					</Layer> -->
					

				</Stage>
			</div>
		</div>
	</div>

</main>
