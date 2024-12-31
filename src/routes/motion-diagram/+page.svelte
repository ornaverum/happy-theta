<script lang="ts">
	import MotionDiagram from '$lib/Components/MotionDiagram.svelte';
	import CaptureDiv from '$lib/Components/CaptureDiv.svelte';
	import type { MD } from '$lib/types';

    import { Label, Select, Input, Button, Toggle } from 'flowbite-svelte';
    import {TrashBinOutline, FileExportOutline, CirclePlusOutline} from 'flowbite-svelte-icons';

	interface Props {
		name?: string;
	}

	let { name = 'Motion Diagram' }: Props = $props();
	let showControlButtons: boolean = $state(true);

	let width = 800;
    let height = 200;

	let mdArray: MD[] = $state([]);
	let id_ind = 0;

	const defaultMD: MD = {
		id: id_ind,
		width: width,
		height: height,
		title: 'Title',
		gridNum: 30,
		marginY: 5,
		posList: [],
		velList: [],
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

	addNewMD();

</script>

<CaptureDiv>
	<div id='button-group' class = 'flex flex-row p-4 w-1/3 justify-around'>
		<Button color='dark' class='my-1' on:click={()=>labelTitle()}>Autolabel</Button>
		<Toggle bind:checked={showControlButtons}>Show Control Buttons</Toggle>
	</div>
	<div id='capture' class='w-max mx-auto'>
		<ul class='list-none'>
			{#each mdArray as md}
				<li>
					<MotionDiagram {...md} bind:posList={md.posList} bind:accList={md.accList} bind:title={md.title} {showControlButtons}/>
				</li>
			{/each}
		</ul>
	</div>
	<Button color='alternative' onclick={()=>addNewMD()}><CirclePlusOutline/>Add New Diagram</Button>	
</CaptureDiv>
