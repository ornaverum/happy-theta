<script lang='ts'>
	import html2canvas from 'html2canvas';

	interface Props {
		children? : any;
		saveData?: ()=> void;
		loadData?: ()=> void;
		refreshAll?: ()=> void;
		showControlButtons?: boolean;
	}

	let { 
		children, 
		saveData=()=>{}, 
		loadData=()=>{}, 
		refreshAll=()=>{},
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
    <div id='controls' class = 'my-4'>
        <Button color='dark' onclick={saveDivAsImage}><FileExportOutline/></Button>
        <Button color='dark' onclick={copyDivAsImageToClipboard}><FileCopyOutline/></Button>
        <Button color='dark' onclick={()=>{}}><FloppyDiskOutline/></Button>
        <Button color='dark' onclick={()=>{}}><FolderOpenOutline/></Button>
        <Button color='dark' onclick={refreshAll}><RefreshOutline/></Button>
    </div>
	<div class='my-4'>
		<Toggle bind:checked={showControlButtons} > Show Control Buttons</Toggle>
	</div>
	<div id='capture'>
		{@render children?.()}
	</div>	
</div>