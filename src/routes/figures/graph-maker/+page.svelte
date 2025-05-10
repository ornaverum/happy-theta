<script lang="ts">
	import {getContext, setContext} from 'svelte';
	import {onMount} from 'svelte';
	import { Stage, Layer, Line, Circle, Path} from 'svelte-konva';


	import {page} from '$app/stores';
	import EditLabel from '$lib/Components/EditLabel.svelte';
	import type {GraphPath, Point} from '$lib/types.ts';

    import { Label, Select, Input, Button, Checkbox, Toggle, Tooltip} from 'flowbite-svelte';
    import {TrashBinOutline, FileExportOutline, ChevronDownOutline, CirclePlusOutline, RefreshOutline} from 'flowbite-svelte-icons';
	import { Dropdown, DropdownItem } from 'flowbite-svelte';

	import QualGraph from '$lib/Components/QualGraph.svelte';

	const url = $page.url;
	console.log(url);

	let name: string = 'graph-maker';

	let showControlButtons = getContext('ctrl');

	let idIncrement = 0;


	let groupIDIncrement = $state(0);
	let graphIDIncrement = 0;

	type Graph = {
		title: string;
		labels: {x:string, y:string};
		graphID: number;
		groupID: number;
		pathList: GraphPath[];
	}

	type Group = {
		id: number;
		graphsIDs: number[];
	}

	let graphs: Graph[] = $state([]);
	let groupIDs: number[] = $state([0]);

	const addNewGraph = (groupID: number) =>{
		let newGraph:Graph = {title: 'Title', graphID:(++graphIDIncrement), groupID: groupID, pathList:[], labels: {x:'Time', y:'Position'}};
		graphs = [...graphs, newGraph];
	}

	const handleDelete = (killId:number) => {
		graphs = graphs.filter(graph => graph.graphID !== killId);
	}

	const labelGroupTitle = (groupID:number) => {
		console.log(groupID);

		let tempGraphs = [...graphs];
		let n = 0;
		tempGraphs.forEach((graph) => {
			console.log(graph);
			if(graph.groupID === groupID){
				graph.title = String.fromCharCode(65 + n++);
			}
		});
		graphs = [...tempGraphs];
	};

	const labelGroupYAxis = (groupID:number, yaxis:string) => {
		console.log('Label Y axes', groupID, yaxis);

		let tempGraphs = [...graphs];
		let n = 0;
		tempGraphs.forEach((graph) => {
			console.log(graph);
			if(graph.groupID === groupID){
				graph.labels.y = yaxis;
			}
		});
		graphs = [...tempGraphs];
	};

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

	let ylabel:string = $state('Position');
	
	let btnActions = getContext('btnActions');
	onMount( ()=>{
			btnActions.saveData = saveData;
			btnActions.loadData = loadData;
			btnActions.refreshAllData = refreshAllData;
				// console.log(document.querySelector('#savedata'));
				// document.querySelector('#savedata')?.addEventListener('click', saveData);
				// document.querySelector('#loaddata')?.addEventListener('click', loadData);
				// document.querySelector('#refreshalldata')?.addEventListener('click', refreshAllData);
				// document.querySelector('#autolabel')?.addEventListener('click', labelTitle);
			

			graphs = [
					{title: '', graphID: 0, groupID: 0, pathList: [{points: [], color: 'blue'}], labels: {x:'Time', y:'Position'}},
					{title: '', graphID: 1, groupID: 0, pathList: [{points: [], color: 'green'}], labels: {x:'Time', y:'Velocity'}},
					{title: '', graphID: 2, groupID: 0, pathList: [{points: [], color: 'red'}], labels: {x:'Time', y:'Acceleration'}},
				];
			graphIDIncrement = graphs.length;
		}
	);

	

	// addNewGraph(0);
	const saveData = () => {
		console.log('saveData from graph-maker page');
	}
	const loadData = () => {
		console.log('loadData from graph-maker page');
	}
	const refreshAllData = () => {
		console.log('refreshAllData from graph-maker page');
		graphs = [];
		groupIDs = [0];
		graphIDIncrement = 0;
		groupIDIncrement = 0;
		addNewGraph(0);
	}

</script>

<div class="flex flex-col bg-gray-100 w-full rounded-xl shadow-lg items-center">
	{#each groupIDs as group (group)}
		<div class="flex flex-row flex-wrap">

			{#if showControlButtons() && groupIDs.length >= 0}
				<div class='flex flex-col justify-center'>
					<Button class='my-1' color='blue' onclick={()=>{groupIDs = groupIDs.filter(g => g !== group)}}><TrashBinOutline/></Button>
					<Tooltip>Delete Graph Group</Tooltip>
					<Button class='my-1' color='blue'  onclick={()=>labelGroupTitle(group)}>Autotitle</Button>
					<Tooltip>Give graphs alphabetical titles</Tooltip>
					<!-- <div class='flex flex-col mr-2 mt-3'>
						<Label for="select-y-label" class="">Select y-label for group</Label>
						<Select on:change={()=>labelGroupYAxis(group, ylabel)} id='select-y-label' class="" size="sm" items={yLabelOptions} bind:value={ylabel} />
					</div> -->
				</div>
			{/if}
			<!-- <div class='transform -translate-x-full origin-top-right -rotate-90 h-auto w-48'> -->
			<div class='h-full my-auto mx-auto'>
				<!-- <p class='text-2xl'>Hi there friend</p> -->
				<!-- <EditLabel text='Group One'/> -->
					<p class='text-xl select-none [writing-mode:sideways-lr]'>group 1</p>
			</div>
			{#each graphs as graph (graph.graphID)}
				{#if graph.groupID == group}
					<QualGraph {handleDelete} bind:title={graph.title} id={graph.graphID} bind:pathList={graph.pathList} width={200} height={200} bind:labels={graph.labels} color='green'/>
				{/if}
			{/each}
			{#if showControlButtons()}
				<Button color='alternative' onclick={()=>addNewGraph(group)}><CirclePlusOutline/></Button>
			{/if}
		</div>
	{/each}
</div>

{#if showControlButtons()}
	<Button color='alternative' class='w-full' onclick={()=>{groupIDs=[...groupIDs, ++groupIDIncrement]}}>
		<CirclePlusOutline class='mx-2'/> Add New Group
	</Button>
{/if}
