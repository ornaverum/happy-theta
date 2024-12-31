<script lang='ts'>
	import html2canvas from 'html2canvas';
    let { children } = $props();
    let divToCapture: HTMLDivElement;

    import { Button, Toggle } from 'flowbite-svelte';
    import {TrashBinOutline, FileExportOutline, FileCopyOutline, FloppyDiskOutline, FolderOpenOutline} from 'flowbite-svelte-icons';

    
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

<div class="flex flex-col justify-center p-4 rounded-xl">
    <div id='controls' class = 'mx-auto w-max my-4'>
        <Button color='dark' onclick={saveDivAsImage}><FileExportOutline/></Button>
        <Button color='dark' onclick={copyDivAsImageToClipboard}><FileCopyOutline/></Button>
        <Button color='dark' onclick={saveDivAsImage}><FloppyDiskOutline/></Button>
        <Button color='dark' onclick={saveDivAsImage}><FolderOpenOutline/></Button>
        <Button color='dark' onclick={()=>{}}><TrashBinOutline/></Button>
    </div>
	<div id='capture' class='w-max mx-auto'>
		{@render children?.()}
	</div>	
</div>