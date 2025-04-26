<script lang="ts">
	import { setContext, getContext } from 'svelte';
	import {saveDivAsImage, copyDivAsImageToClipboard} from '$lib/capturediv';

	import { Button, Toggle } from 'flowbite-svelte';
    import {TrashBinOutline, FileExportOutline, FileCopyOutline, FloppyDiskOutline, FolderOpenOutline, RefreshOutline} from 'flowbite-svelte-icons';

	let { children } = $props();
	let showControlButtons = $state(false);

	setContext('ctrl', showControlButtons);
	let btnActions = $state({
		saveData: () => {},
		loadData: () => {},
		refreshAllData: () => {},
	});


	setContext('btnActions', btnActions);

</script>


<div class="w-max mx-auto w-9/12">
	<div id='controls' class = 'w-full flex flex-row justify-end space-x-2'>
		<Button id='savediv' color='dark' onclick={saveDivAsImage}><FileExportOutline/></Button>
		<Button id='copydiv' color='dark' onclick={copyDivAsImageToClipboard}><FileCopyOutline/></Button>
		<Button id='savedata' color='dark' onclick={btnActions.saveData}><FloppyDiskOutline/></Button>
		<Button id='loaddata' color='dark' onclick={btnActions.loadData}><FolderOpenOutline/></Button>
		<Button id='refreshalldata' color='dark' onclick={btnActions.refreshAllData}><RefreshOutline/></Button>
	</div>
	<div id='capture' class="w-max mx-auto w-9/12">
		{@render children?.()}
	</div>
</div>
