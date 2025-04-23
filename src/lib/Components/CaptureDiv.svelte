<script lang='ts'>
	import html2canvas from 'html2canvas';
	import { getContext, setContext } from 'svelte';

	interface Props {
		children? : any;
		saveData?: ()=> void;
		loadData?: ()=> void;
		refreshAllData?: ()=> void;
		showControlButtons?: boolean;
	}

	let { 
		children, 
		saveData=()=>{}, 
		loadData=()=>{}, 
		refreshAllData=()=>{console.log('refreshData def in CaptureDiv')},
		showControlButtons=$bindable(true)
	}: Props = $props();

    let divToCapture: HTMLDivElement | null = null;

    import { Button, Toggle } from 'flowbite-svelte';
    import {TrashBinOutline, FileExportOutline, FileCopyOutline, FloppyDiskOutline, FolderOpenOutline, RefreshOutline} from 'flowbite-svelte-icons';

    
	const saveDivAsImage = async () => {
		// let tempCtrl = showControlButtons;
		// await setControlButtons(false);
		divToCapture = document.querySelector('#capture');
		console.log('divToCapture', divToCapture);
		const canvas = await html2canvas(divToCapture);
		const dataUrl = canvas.toDataURL('image/png');
		const link = document.createElement('a');
		link.href = dataUrl;
		link.download = 'div-image.png';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		// await setControlButtons(tempCtrl);
	};

	const copyDivAsImageToClipboard = async () => {
		divToCapture = document.querySelector('#capture');
		console.log('divToCapture', divToCapture);
		const canvas = await html2canvas(divToCapture);
		canvas.toBlob(blob => navigator.clipboard.write([new ClipboardItem({'image/png': blob})]))
	};


</script>

<div class="">
    <div id='controls' class = 'w-full flex flex-row justify-end space-x-2'>
        <Button color='dark' onclick={saveDivAsImage}><FileExportOutline/></Button>
        <Button color='dark' onclick={copyDivAsImageToClipboard}><FileCopyOutline/></Button>
        <Button color='dark' onclick={saveData}><FloppyDiskOutline/></Button>
        <Button color='dark' onclick={loadData}><FolderOpenOutline/></Button>
        <Button color='dark' onclick={refreshAllData}><RefreshOutline/></Button>
    </div>
	<div class='my-4'>
		<Toggle bind:checked={showControlButtons} class='w-full flex flex-row justify-end'> Show Control Buttons</Toggle>
	</div>
	<div id='capture'>
		{@render children?.({test: 'test'})}
	</div>	
</div>