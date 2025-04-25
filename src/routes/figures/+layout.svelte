<script lang="ts">
	import { setContext, getContext } from 'svelte';
	import {saveDivAsImage, copyDivAsImageToClipboard} from '$lib/capturediv';

	import { Button, Toggle } from 'flowbite-svelte';
    import {TrashBinOutline, FileExportOutline, FileCopyOutline, FloppyDiskOutline, FolderOpenOutline, RefreshOutline} from 'flowbite-svelte-icons';

	let { children } = $props();
	let showControlButtons = $state(false);

	setContext('ctrl', showControlButtons);

</script>

<div class="w-max mx-auto w-9/12">
	<div id='controls' class = 'w-full flex flex-row justify-end space-x-2'>
		<Button id='savediv' color='dark' onclick={saveDivAsImage}><FileExportOutline/></Button>
		<Button id='copydiv' color='dark' onclick={copyDivAsImageToClipboard}><FileCopyOutline/></Button>
		<Button id='savedata' color='dark'><FloppyDiskOutline/></Button>
		<Button id='loaddata' color='dark'><FolderOpenOutline/></Button>
		<Button id='refreshalldata' color='dark'><RefreshOutline/></Button>
	</div>
	<div class='my-4'>
		<Toggle id='ctrlbtn' class='w-full flex flex-row justify-end'> {showControlButtons ? 'Hide' : 'Show'} Control Buttons</Toggle>
		<Button id='autolabel' color='dark' class='my-1'>Autolabel</Button>
	</div>

	<div class="w-max mx-auto w-9/12">
		{@render children?.()}
	</div>
</div>
