
<script lang="ts">
    import { Stage, Layer, Rect, Image } from 'svelte-konva';
    import { onMount, tick } from 'svelte';
    import {Fileupload, Helper, Label, Carousel, } from 'flowbite-svelte';
    import GIF from '@dhdbstjr98/gif.js';

    onMount(() => {
        // Your initialization code here
    });

    let selectedFiles = $state<FileList | null>(null);
    let selectedFileIndex: number = $state(0);

    // Precompute file names
    let fileNames = $derived(
        selectedFiles
        ? Array.from(selectedFiles)
            .map((file) => file.name)
            .join(", ")
        : null
    );

    // Precompute object URLs for all selected files
    let fileObjectURLs = $derived(
        selectedFiles
        ? Array.from(selectedFiles).map((file) => URL.createObjectURL(file))
        : []
    );

    $effect(() => {
        // Clean up object URLs when files change
        return () => {
            if (fileObjectURLs) {
                fileObjectURLs.forEach((url) => URL.revokeObjectURL(url));
            }
        };
    });

    // Function to create GIF from selected files
    async function createGif() {
        if (!selectedFiles || selectedFiles.length === 0) return;

        console.log("Creating GIF from files:", selectedFiles);

        const gif = new GIF({
            workers: 2,
            quality: 10,
        });

        console.log("GIF creation started", gif);

        // Load each image as an Image element and add as a frame
        for (const file of Array.from(selectedFiles)) {
            const url = URL.createObjectURL(file);
            await new Promise<void>((resolve) => {
                const img = new window.Image();
                img.src = url;
                img.onload = () => {
                    gif.addFrame(img, { delay: 500 }); // 500ms per frame
                    URL.revokeObjectURL(url);
                    resolve();
                };
            });
        }

        console.log("GIF frames completed?", gif);


        gif.on('finishRendering', function(blob: Blob) {
            console.log("GIF creation finished", blob);
            const gifUrl = URL.createObjectURL(blob);
            window.open(gifUrl, '_blank');
        });

        gif.render();
    }
</script>


<div>
    <div id='gif' class='mx-auto w-4/5 flex flex-col bg-gray-100 rounded-xl shadow-lg items-center'>
        <div id='gif-label' class='p-3 ml-4 text-lg font-bold'>
            GIF Maker
        </div>
        
        
        <div class='flex flex-row bg-green-200 p-3 m-3 '>
            <div id='main-view' class='min-w-40 max-w-4/5  bg-slate-200 p-4'>
                {#if selectedFiles}
                    <img src={fileObjectURLs[selectedFileIndex]} alt='Selected Image' class='max-w-full max-h-96'/>
                {:else}
                    <div class='w-full h-40 bg-gray-300 flex items-center justify-center text-gray-500'>
                        No image selected
                    </div>
                {/if}
            </div>
            <div class='flex flex-col max-h-80 p-2 space-y-2 overflow-y-scroll'>
                {#if selectedFiles && selectedFiles.length > 1}
                    <div class='text-sm font-semibold'>Select Image:</div>
                    {#each Array.from(selectedFiles) as file, index}
                        <button 
                            class="px-2 py-1 text-xs rounded {selectedFileIndex === index ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}"
                            onclick={() => selectedFileIndex = index}
                        >
                            <img src={fileObjectURLs[index]} alt='Selected Image' class='max-w-full max-h-10 object-contain'/>
                        </button>
                    {/each}
                {/if}
            </div>
            
        </div>
        <div class='w-1/2 m-4'>
            <Label class="p-2" for="image_files" >Upload image files</Label>
            <Fileupload clearable bind:files={selectedFiles} multiple  onchange={(e) => {console.log(e.target.files)}}/>
            <Helper class="mt-2">Selected files: {fileNames ? fileNames : "No files selected"}</Helper>
            <button class="mt-4 px-4 py-2 bg-blue-500 text-white rounded" onclick={createGif}>
                Create GIF from Images
            </button>
        </div>
        

    </div> 
</div>