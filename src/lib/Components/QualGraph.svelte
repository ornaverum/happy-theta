<script lang="ts">
	import { Stage, Layer, Line, Circle, Path, Group, type KonvaMouseEvent} from 'svelte-konva';
	import type {GraphPath, Point} from './kinematicsTypes.js';
    import { Label, Select, Input, Button} from 'flowbite-svelte';
	import Grid from './Grid.svelte';
	import GridLogic from './GridLogic.js';
    import {TrashBinOutline, ChevronDownOutline, ChevronRightOutline, RefreshOutline} from 'flowbite-svelte-icons';
	import { Dropdown, DropdownItem } from 'flowbite-svelte';
	import EditLabel from './EditLabel.svelte';

	let name: string = 'QualGraph';


    let nCells = 6;

	interface Props {
		width?: number;
		height?: number;
		color?: string;
		title?: string;
		labels?: any;
		showNegativeAxes?: any;
		showControlButtons?: boolean;
		showGrid?: boolean;
		id?: number;
		dotList?: Dot[];
		pathList?: GraphPath[];
	}

	let {
		width = 500,
		height = 500,
		color = 'blue',
		title = $bindable('Graph Title'),
		labels = $bindable({
        	x: 'Time',
        	y: 'Position',
    	}),
		showNegativeAxes = $bindable({
        x: false,
        y: true,
    }),
		showControlButtons = true,
		showGrid = true,
		id = 0,
		dotList = $bindable([]),
		pathList = $bindable([])
	}: Props = $props();


	type Dot = {
		id: number,
		pt: Point,
		radius: number,
		fill: string,
		opacity: number,
	}
	let previewDot: Dot = $state({
			id: 0,
			pt: {x:0, y:0},
			radius: 6,
			fill: color,
			opacity: 1.0,
		});
	let previewGraph: GraphPath = $state(null);

	let addingDot: boolean = $state(true); // true if adding dot, false if adding path

	let showYLabelOptions = false;
	let showAxisOptions = false;


	let gridLogic = new GridLogic({size:{x:width, y:height}, numCells: {x:6, y:6}, origin:{x:0, y:3}});

	let id_num = 0;

	const getpreviewDot= (pos = {x:0, y:0}) => {
		let snappedPos = {...gridLogic.getSnappedPointFromStage(pos)};
		previewDot = {
			id: dotList.length,
			pt: {...snappedPos},
			radius: 6,
			fill: color,
			opacity: 0.6,
		};
	}

	const addNewDot = (pos = {x:0, y:0}) => {

		dotList = [...dotList, {...previewDot, opacity:1, radius:4}];
		if (dotList.length >1){
			addingDot = false;
		}
	}

	const getPathForGraph = (dots: Point[] = [{x:0, y:0}, {x:1,y:0}], curvature: number = 0)=> {

		let ctrl = dots[0].y + (dots[1].y - dots[0].y) * 0.5*( 1 - curvature);

		let pathData = 'M ' + dots[0].x + ' ' + dots[0].y + 
		' Q ' + (dots[1].x + dots[0].x)/2 + ' ' + ctrl + ' ' 
		+ (dots[1].x) + ' ' + (dots[1].y);

		return pathData;
	}

	const getPreviewGraphPath = (dots: Dot[], curvature: number = 1, opacity: number = 1) => {
		if (dots.length != 2) {
			return;
		}

		let pathData = getPathForGraph(dots, curvature);
		let points = dots.map((dot) => {
			return {x: dot.x, y: dot.y};
		});
		previewGraph = {
			id: ''+pathList.length,
			data: pathData,
			points: points,
			curvature: curvature,
			stroke: color,
			strokeWidth: 4,
			opacity: opacity,
		};
	}

	const handleClickCanvas: (e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) =>{
		if (addingDot){
			let pos = {x: e.evt.layerX, y: e.evt.layerY};
			addNewDot(pos);
			if (dotList.length > 1){
				addingDot = false;
				getPreviewGraphPath(dotList, 0, 0.5);
			}
			
		} else {
			previewGraph.opacity = 1;
			pathList = [...pathList, previewGraph];
			dotList = [];
			addingDot = true;
		}
	}

	const getCurvature = (pos: Point) => {
		if (dotList.length != 2) 
			return;
		
		if (pos.y > Math.max(dotList[0].y, dotList[1].y)/2 +  (dotList[0].y + dotList[1].y)/4)
				return -Math.sign(dotList[1].y - dotList[0].y);
		else if (pos.y < Math.min(dotList[0].y, dotList[1].y)/2 +  (dotList[0].y + dotList[1].y)/4)
				return  Math.sign(dotList[1].y - dotList[0].y);
		else
				return 0
	};

	const handleMoveCanvas : (e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
		console.log('Move Canvas');
		let pos = {x: e.evt.layerX, y: e.evt.layerY};
		if (addingDot){
			getpreviewDot(pos);
		} else {
			getPreviewGraphPath(dotList, getCurvature(pos), 0.5);
		}
	}

	const handleDelete = (evt:Event)=>{
		dotList = [];
		pathList = [];
		addingDot = true;
	}

	const handleLeaveCanvas : (e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) =>{
		if (addingDot){
			previewDot = null;
		} else {
			previewGraph = null;
		}
	}

	const yLabelOptions = [
		{value: 'Position', name: 'Position', color:'blue'},
		{value: 'Velocity', name: 'Velocity', color:'green'},
		{value: 'Acceleration', name: 'Acceleration', color:'red'},
	];

	const svgPathXpYp:string = 'M 2 2 V 13 H 13';
	const svgPathXpYn:string = 'M 2 2 V 13 M 2 8 H 13';
	const svgPathXnYp:string = 'M 2 13 H 13 M 8 2 V 13';
	const svgPathXnYn:string = 'M 8 2 V 14 M 2 8 H 14';

	const axisSets = [
		{svg: svgPathXpYp, x: false, y: false},
		{svg: svgPathXpYn, x: false, y: true},
		{svg: svgPathXnYp, x: true, y: false},
		{svg: svgPathXnYn, x: true, y: true},
	];

</script>	

{#snippet drawDot(dot:Dot)}
	<Circle 
		x= {gridLogic.getStageFromPoint(dot.pt).x}
		y= {gridLogic.getStageFromPoint(dot.pt).y}
		radius= {8}
		fill= {color}
		opacity = {dot.opacity}
	/>
{/snippet}

<div id='graph-container' class='p-4 flex flex-col border-2'>
	
	{#if showControlButtons}
		<div id='button-header' class="justify-left flex flex-row m-2 p-2">
			<Button color="red" size="xs" class="mr-2"
				on:click={handleDelete}
				>
				<RefreshOutline size='xs' class="text-white-500"/>
			</Button>
			<Button color="red" size="xs" class="mr-2"
				on:click={()=>{console.log('s5-pass callback for delete')}}
				>
				<TrashBinOutline size='xs' class="text-white-500"/>
			</Button>
			<!-- <div class='flex flex-col mr-2'>
				<Label for="select-y-label" class="">Select y-label</Label>
				<Select id='select-y-label' class="" size="sm" items={yLabelOptions} bind:value={labels.y} />
			</div> -->


			<!-- <Button size='xs'>Select Axis <ChevronDownOutline/></Button>
			<Dropdown inline>
				{#each axisSets as axis (axis)}
					<DropdownItem
						on:click={(evt)=>handleAxis({x:axis.x, y:axis.y})}
						size='xs'
						class='px-0'
					>
						<svg width="15" height="15" xmlns="http://www.w3.org/2000/svg">
							<path d={axis.svg} fill="transparent" stroke="black" stroke-width="2"/>
						</svg>
					</DropdownItem>
				{/each}	
			</Dropdown> -->
		</div>
	{/if}
	<EditLabel text={title} size='xs' {showControlButtons}/>
	<div class='flex flex-row '>
		<div id='y-label-container' class="my-auto relative h-30 w-30">
			<div id='ylabel' class='transform -rotate-90 label-menu'>
				{labels.y}
			</div>
		</div>
		<div id='graph' class="flex flex-col" >

			<Stage {width} {height} id='main_stage'
				onclick={handleClickCanvas}
				onmousemove={handleMoveCanvas}
				onmouseleave={handleLeaveCanvas}
			>
				<Grid {gridLogic}/>
				<Layer id='dot_layer'>
					{#each dotList as dot (dot.id)}
						{@render drawDot(dot)}
					{/each}
					{#if addingDot && previewDot}
						{@render drawDot(previewDot)}
					{/if}
				</Layer>
				<Layer id= 'path_layer'>
					{#if !addingDot && previewGraph}
						<Path {previewGraph} />
					{/if}
					{#each pathList as path (path.id)}
						<Path {path} />
					{/each}
				</Layer>
			</Stage>
			<div id='x-label' class="mx-auto justify-center">{labels.x}</div>

		</div>
	</div>
	
</div>