<script lang="ts">
	import { Stage, Layer, Line, Circle, Path, Group} from 'svelte-konva';


	import type {Dot, GraphPath, Point} from './kinematicsTypes.js';
    import { Label, Select, Input, Button} from 'flowbite-svelte';
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
		dotList?: Dot[] | null;
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
	let previewDot: Dot | null = $state(null);
	let previewGraph: GraphPath | null = $state(null);

	let addingDot: boolean = $state(true); // true if adding dot, false if adding path

	let showYLabelOptions = false;
	let showAxisOptions = false;

    let margin = 5;
    let windowSize = Math.min(width, height);
	let gridSize = windowSize - 2*margin;
    let cellSize = gridSize/nCells;
	let gridCenter = windowSize/2.0;
    let origin = {x:margin, y:gridSize+margin};  // Assuming origin is at bottom left

	

	let gridList: any[] = $state([]);
	let id_num = 0;

	let xAxisTicks = [1, 2, 3, 4, 5, 6];
	let yAxisTicks = [1, 2, 3, 4, 5, 6];
    
	const createGrid = () =>{

		gridList = [];
		origin = {x:margin, y:gridSize+margin};

	    // Create y-axis
		xAxisTicks = [1, 2, 3, 4, 5, 6];

		if (showNegativeAxes.x){
			origin.x = margin + 3*cellSize;
			xAxisTicks = [-3, -2, -1, 1, 2, 3];
		}

		gridList.push({
				id: id_num++,
				x0: origin.x,
				y0: margin,
				x1: origin.x,
				y1: margin + 6*cellSize,
				strokeWidth: 4,
			});

		// Create x-axis
		
		yAxisTicks = [1, 2, 3, 4, 5, 6];
		
		if (showNegativeAxes.y){
			origin.y = margin + 3*cellSize;
			yAxisTicks = [-3, -2, -1, 1, 2, 3];

		}

		gridList.push({
				id: id_num++,
				x0: margin,
				y0: origin.y,
				x1: margin + 6*cellSize,
				y1: origin.y,
				strokeWidth: 4,
			});



		// create x grid lines
		xAxisTicks.forEach((tick) => {
			let startParallel = tick * cellSize + origin.x;
			let startPerp = margin+6*cellSize;
			let endPerp = margin + 0*cellSize;
			gridList.push({id: id_num++,
				x0: startParallel,
				y0: startPerp,
				x1: startParallel,
				y1: endPerp,
				strokeWidth: 1,
			});
		});


	// create x grid lines
		yAxisTicks.forEach((tick) => {
			let startParallel = -tick * cellSize + origin.y;
			let startPerp = margin + 0*cellSize;
			let endPerp = margin + 6*cellSize;
			gridList.push({id: id_num++,
				x0: startPerp,
				y0: startParallel,
				x1: endPerp,
				y1: startParallel,
				strokeWidth: 1,
			});
		});
	}




	const getPreviewDot= (pos = {x:gridCenter, y:height/2.0}) => {
		if (pos.x < 0 || pos.x > width || pos.y < 0 || pos.y > height) {
			return;
		} 

		let snappedPos = {...pos};
		snappedPos.x = Math.round((pos.x - gridCenter) / cellSize) * cellSize + gridCenter;
		snappedPos.y = Math.round((pos.y - gridCenter) / cellSize) * cellSize + gridCenter;

		previewDot = {
			id: dotList.length,
			x: snappedPos.x,
			y: snappedPos.y,
			radius: 6,
			fill: color,
			opacity: 1.0,
		};
	}

	const addNewDot = (pos = {x:gridCenter, y:height/2.0}) => {

		dotList = [...dotList, previewDot];
		if (dotList.length >1){
			addingDot = false;
		}
	}

	const getPathForGraph = (dots: Point[] = [{x:0, y:0}, {x:1,y:0}], curvature: number = 0)=> {
		// curvature = 0 is straight line
		// curvature = 1 is speeding up
		// curvature = -1 is slowing down


		// 0 => 0.5
		// -1 => 0
		// 1 => 1
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

	const handleClickCanvas = (event:CustomEvent) => {
		if (addingDot){
			const nd = event.detail.currentTarget;
			let pos = {x: event.detail.evt.layerX, y: event.detail.evt.layerY};
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

	const handleMoveCanvas = (event:CustomEvent) => {
		const nd = event.detail.currentTarget;
		let pos = {x: event.detail.evt.layerX, y: event.detail.evt.layerY};
		if (addingDot){
			getPreviewDot(pos);
		} else {
			getPreviewGraphPath(dotList, getCurvature(pos), 0.5);
		}
	}

	const handleDelete = (evt:Event)=>{
		dotList = [];
		pathList = [];
		addingDot = true;
	}

	const handleLeaveCanvas = (evt:Event) => {
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

	const handleAxis = (axes) => {
		showNegativeAxes = {...axes};
		createGrid();
	}

	createGrid();

	const handleDropdown = (evt) => {
		console.log(evt);
	}

	let axisLabelDropdown;
	let axisDropdown;

</script>	


<div id='graph-container' class='p-4 flex flex-col border-2'>
	
	{#if showControlButtons}
		<div id='button-header' class="justify-left flex flex-row m-2 p-2">
			<Button color="red" size="xs" variant="outline" class="mr-2"
				on:click={handleDelete}
				>
				<RefreshOutline size='xs' class="text-white-500"/>
			</Button>
			<Button color="red" size="xs" variant="outline" class="mr-2"
				on:click={()=>dispatch('deleteMe', {id:id})}
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
				on:click={handleClickCanvas}
				on:mousemove={handleMoveCanvas}
				on:mouseleave={handleLeaveCanvas}
			>
				<Layer config={{id: 'grid_layer'}}>
					{#each gridList as item (item.id)}
						<Line points= {[item.x0, item.y0, item.x1, item.y1]}
							stroke='gray'
							strokeWidth= {item.strokeWidth}
							/>
					{/each}
				</Layer>
				<Layer id='dot_layer'>
					{#each dotList as dot (dot.id)}
						<Circle 
							x= {dot.x}
							y= {dot.y}
							radius= {dot.radius}
							fill= {dot.fill}
							opacity = {dot.opacity}
						/>
					{/each}
					{#if addingDot && previewDot}
						<Circle x={previewDot.x} y={previewDot.y} radius= {previewDot.radius}
							fill= {previewDot.fill} opacity= {previewDot.opacity} />
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