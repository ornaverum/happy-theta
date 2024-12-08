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
	import FreeBodyDiagram from '$lib/Components/FreeBodyDiagram.svelte';

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

	const colorList = ['red', 'green', 'blue', 'purple', 'orange', 'brown', 'pink', 'cyan', 'magenta', 'yellow'];
		// brown and magenta need work


	const colorVariants: { [key: string]: string } = {
		red: 'bg-red-500',
		green: 'bg-green-500',
		blue: 'bg-blue-500',
		purple: 'bg-purple-500',
		orange: 'bg-orange-500',
		black: 'bg-black-500',
		brown: 'bg-brown-500',
		pink: 'bg-pink-500',
		cyan: 'bg-cyan-500',
		magenta: 'bg-magenta-500',
		yellow: 'bg-yellow-200',
	};


    let fontColorList: string[] = [];
    for (let i = 0; i < colorList.length; i++) {
        fontColorList.push('bg-' + colorList[i] + '-500');
    } 

</script>

<main class="flex flex-col justify-center p-4 rounded-xl">
	<div id='capture' class='mx-auto w-max'>
		<FreeBodyDiagram
			width={width}
			height={height}
			title='Free Body Diagram'
			numCells={{x: 10, y:10}}
			showControlButtons={showControlButtons}
			id={id_num}
			margin={{x:5, y:5}}
			forceList={[]}
			handleDelete={(e: MouseEvent) => {}}/>
	</div>
</main>