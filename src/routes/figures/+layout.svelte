<script lang="ts">
	import { setContext, getContext } from 'svelte';
	import {saveDivAsImage, copyDivAsImageToClipboard} from '$lib/capturediv';

	import { ButtonGroup, Button, Toggle, Tooltip } from 'flowbite-svelte';
    import {TrashBinOutline, FileExportOutline, FileCopyOutline, FloppyDiskOutline, FolderOpenOutline, RefreshOutline} from 'flowbite-svelte-icons';

	let { children } = $props();
	let showControlButtons = $state(false);

	setContext('ctrl', ()=>showControlButtons);
	let btnActions = $state({
		saveData: () => {},
		loadData: () => {},
		refreshAllData: () => {},
	});


	setContext('btnActions', btnActions);

</script>


<div class="w-9/12 mx-auto">
	<ButtonGroup class = 'w-full flex flex-row justify-end space-x-px'>
		<Button id='savediv' color='dark' onclick={saveDivAsImage}><FileExportOutline/></Button>
			<Tooltip>Download image as png</Tooltip>
		<Button id='copydiv' color='dark' onclick={copyDivAsImageToClipboard}><FileCopyOutline/></Button>
			<Tooltip>Copy image to clipboard</Tooltip>
		<Button id='savedata' color='dark' disabled onclick={btnActions.saveData}><FloppyDiskOutline/></Button>
			<Tooltip>Save data locally (TBD)</Tooltip>
		<Button id='loaddata' color='dark' disabled onclick={btnActions.loadData}><FolderOpenOutline/></Button>
			<Tooltip>Load local data (TBD)</Tooltip>
		<Button id='refreshalldata' color='dark' onclick={btnActions.refreshAllData}><RefreshOutline/></Button>
			<Tooltip>Delete data and refresh</Tooltip>
	</ButtonGroup>
	<Toggle checked={showControlButtons} class='mr-2' onclick={()=>{console.log('layout: showControlButtons = ', showControlButtons)}}>Show Element Controls</Toggle>
	<div id='capture' class="w-full mx-auto">
		{@render children?.()}
	</div>
</div>
