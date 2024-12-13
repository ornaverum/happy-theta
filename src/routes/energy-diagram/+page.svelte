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

	let name: string = 'Free Body Diagram';

	let width = 500;
    let height = 500;

	let gridPointList: number[] = [];
	for (let i = -5; i <= 5; i++) {
		gridPointList.push(i);
	}

	let gridList: any[] = [];
	let id_num: number = 0;
	let gridSize = Math.min(height, width);
	let cellSize = gridSize/11.0;
	let gridCenter = gridSize/2.0;
	let snapToGrid = true;
	let showNetForce = $state(false);

	let showControlButtons:boolean = $state(true);

	

	// let gridLogic = new GridLogic({x:width, y:height}, {...margin}, {...numCells}, {...originPoint});

</script>

<main class="flex flex-col justify-center p-4 rounded-xl">
	<div id='capture' class='mx-auto w-max'>
		<EnergyDiagram/>
	</div>
</main>