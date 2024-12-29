<script lang="ts">
	import html2canvas from 'html2canvas';

    import { Button, Toggle, Label, Select, Input, Hr } from 'flowbite-svelte';
    import {TrashBinOutline, CirclePlusOutline, FileExportOutline, EditOutline, RefreshOutline} from 'flowbite-svelte-icons';
	import EditLabel from '$lib/Components/EditLabel.svelte';

	import FreeBodyDiagram from '$lib/Components/FreeBodyDiagram.svelte';

	let name: string = 'Free Body Diagram';

	let width = 400;
    let height = 400;

	let gridPointList: number[] = [];
	for (let i = -5; i <= 5; i++) {
		gridPointList.push(i);
	}

	let id_num: number = 0;

	let showControlButtons:boolean = $state(true);
	let forceList = $state([]);

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
			forceList={forceList}
			handleDelete={(e: MouseEvent) => {}}/>
	</div>
</main>