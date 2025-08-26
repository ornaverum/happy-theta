<script lang="ts">
    import { Stage, Layer, Rect, Image } from 'svelte-konva';
    import { onMount } from 'svelte';
    import {Fileupload, Helper, Label, Carousel, } from 'flowbite-svelte';

    onMount(() => {
        // Your initialization code here
    });

    let selectedFiles = $state<FileList | null>(null);

    let fileNames = $derived(
        selectedFiles
        ? Array.from(selectedFiles)
            .map((file) => file.name)
            .join(", ")
        : null
    );

    $inspect(fileNames);
    let selectedFileIndex:number = $state(0);

    let mainViewImage:HTMLImageElement | undefined = $state(undefined);
    let mainViewCanvasImage: CanvasImageSource|undefined = $state(undefined);

    const onMainViewImageChange = (i:number = 0) => {
        if (fileNames){
            mainViewImage = new window.Image();
            mainViewImage.src = fileNames[i];
            mainViewImage.onload = () => mainViewCanvasImage = mainViewImage;
        } else {
            mainViewImage = undefined;
        }
    };

    let mainViewCanvas: HTMLCanvasElement | undefined = $state(undefined);
    let mainViewContext: CanvasRenderingContext2D | undefined = $derived(
        () => mainViewCanvas?.getContext("2d")
    );

</script>


<div>
    <div id='gif' class='mx-auto w-4/5 flex flex-col bg-gray-100 w-full rounded-xl shadow-lg items-center'>
        <div id='gif-label' class='p-3 ml-4 text-lg font-bold'>
            GIF Maker
        </div>
        
        <div class='flex flex-row bg-green-200 p-3 m-3 overflow-y-scroll'>
            <div id='main-view' class='min-w-40 w-4/5 bg-slate-200 '>
                {#if fileNames}
                    <canvas bind:this={mainViewCanvas}>

                    </canvas>

                {:else}

                {/if}
                
                
            </div>
            <div class='flex flex-col max-h-xl'>
                {#each [1, 2, 3, 4] as i}
                    <div>               
                        <Stage width={100} height={100} style="border: 1px solid black; background-color: white;">
                            <Layer>
                                <Rect x={10} y={10} width={80} height={80} fill="blue" />   
                            </Layer>
                        </Stage>
                    </div>
                {/each}
            </div>
            
        </div>
        <div class='w-1/2 m-4'>
            <Label class="p-2" for="image_files">Upload image files</Label>
                <Fileupload clearable bind:files={selectedFiles} multiple />
                <Helper class="mt-2">Selected files: {fileNames ? fileNames : "No files selected"}</Helper>
        </div>
        

    </div> 
</div>