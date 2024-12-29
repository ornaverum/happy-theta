<script lang="ts">
	import { run } from 'svelte/legacy';

	import { Stage, Layer, Line} from 'svelte-konva';
  	import DragArrow from '$lib/Components/DragArrow.svelte';
	import html2canvas from 'html2canvas';

    import { Button, Toggle, Label, Select, Input, Hr } from 'flowbite-svelte';
    import {TrashBinOutline, CirclePlusOutline, FileExportOutline, EditOutline, RefreshOutline} from 'flowbite-svelte-icons';
	import EditLabel from '$lib/Components/EditLabel.svelte';

	import Grid from '$lib/Components/Grid.svelte';
	import GridLogic from '$lib/Components/GridLogic';
	import EnergyDiagram from '$lib/Components/EnergyDiagram.svelte';
	import EnergyDiagramWork from '$lib/Components/EnergyDiagramWork.svelte';

	let name: string = 'Free Body Diagram';

	let width = 800;
    let height = 200;

	let gridPointList: number[] = [];
	for (let i = -5; i <= 5; i++) {
		gridPointList.push(i);
	}

	let gridSize = Math.min(height, width);
	let showControlButtons:boolean = $state(true);

	let margin = {x:5, y:5};
	let numCells = {x: 10, y:5};
	let originPoint = {x:5, y:1};

	let gridLogic = new GridLogic({size:{x:width, y:height}, margin:{...margin}, numCells:{...numCells}, origin:{...originPoint}});
	let gridLogicW = new GridLogic({size:{x:width, y:100}, margin:{...margin}, numCells:{x:10,y:1}, origin:{...originPoint},
		cellSize:gridLogic.cellSize});
	// Object.assign(gridLogicW, gridLogic, {numCells:{x:10, y:1}, size:{x:width, y:100}, origin:{x:5, y:0}});
	// gridLogicW.rebuildGridLines();
	console.log(gridLogic);
	console.log(gridLogicW);

</script>

<main class="flex flex-col justify-center rounded-xl">
	<div id='capture' class='mx-auto w-full p-0 m-0'>
		<EnergyDiagram {gridLogic}/>
		<div class="p-0 my-0 w-max justify-center align-center mx-auto font-bold text-4xl">+</div>
		<EnergyDiagramWork gridLogic={gridLogicW}/>
		<div class="p-0 my-0 w-max justify-center align-center mx-auto font-bold text-4xl">=</div>
		<EnergyDiagram {gridLogic}/>

	</div>
</main>