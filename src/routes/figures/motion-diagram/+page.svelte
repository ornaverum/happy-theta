<script lang="ts">
	import CaptureDiv from '$lib/Components/CaptureDiv.svelte';
import MotionDiagram from '$lib/Components/MotionDiagram.svelte';
	import type { MD } from '$lib/types';

    import { Label, Select, Input, Button, Toggle } from 'flowbite-svelte';
    import {TrashBinOutline, FileExportOutline, CirclePlusOutline} from 'flowbite-svelte-icons';

	interface Props {
		name?: string;
	}

	let { name = 'Motion Diagram' }: Props = $props();
	let showControlButtons: boolean = $state(true);

	let width = 800;
    let height = 100;

	let mdArray: MD[] = $state([]);
	let id_ind = 0;

	const defaultMD: MD = {
		id: id_ind,
		width: width,
		height: height,
		title: 'Title',
		gridNum: 20,
		marginY: 5,
		posList: [],
		accList: [],
	};


	const addNewMD = () => {
		let md = {...defaultMD, id: id_ind++};
		mdArray = [...mdArray, md];
	}

	async function setControlButtons(ctrl:boolean){
		showControlButtons = ctrl;
	} 

	const handleDelete = (e:CustomEvent) => {
		mdArray = mdArray.filter(md => md.id !== e.detail.id);
	}

	const labelTitle = ()=>{
		mdArray.forEach((md,i) => {
			md.title = String.fromCharCode(65 + i);;
		});
		mdArray = [...mdArray];
	}

	const saveData = () => {
		console.log('saveData from page');
	}
	const loadData = () => {
		console.log('loadData from page');
	}

	const refreshAllData = () => {
		mdArray = [];
		addNewMD();
	}

	addNewMD();

</script>



<CaptureDiv bind:showControlButtons {saveData} {loadData} {refreshAllData}>
	<div id='button-group' class = 'p-4 pr-4 ml-4 w-max'>
		<Button color='dark' class='my-1' on:click={()=>labelTitle()}>Autolabel</Button>
	</div>
	<ul class='list-none'>
		{#each mdArray as md}
			<li>
				<MotionDiagram {...md} bind:posList={md.posList} bind:accList={md.accList} bind:title={md.title} {showControlButtons}/>
			</li>
		{/each}
	</ul>
	<Button color='alternative' onclick={()=>addNewMD()}><CirclePlusOutline/>Add New Diagram</Button>
</CaptureDiv>