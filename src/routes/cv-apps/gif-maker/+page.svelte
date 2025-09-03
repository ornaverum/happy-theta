
<script lang="ts">
    import { Stage, Layer, Rect, Image as KonvaImage } from 'svelte-konva';
    import { onMount, tick } from 'svelte';
    import {Fileupload, Helper, Label, Button, type ImgType, Range,} from 'flowbite-svelte';
    import cv from '@techstark/opencv-js'
    import gifshot from 'gifshot';

    onMount(() => {
        // Your initialization code here
    });

    let selectedFiles = $state<File[] | undefined>(undefined);
    let fileListForUpload = $state<FileList | undefined>(undefined);
    let selectedFileIndex: number = $state(0);

    // Convert FileList to File[] when files are selected
    $effect(() => {
        if (fileListForUpload) {
            selectedFiles = Array.from(fileListForUpload);
        } else {
            selectedFiles = undefined;
        }
    });

    // Precompute file names
    let fileNames = $derived(
        selectedFiles
        ? selectedFiles
            .map((file) => file.name)
            .join(", ")
        : undefined
    );

    // Precompute object URLs for all selected files
    let fileObjectURLs = $derived(
        selectedFiles
        ? selectedFiles.map((file) => URL.createObjectURL(file))
        : []
    );
    let dataURLs: string[] = $state([]);

    let images: ImgType[] = $derived(
        dataURLs.map((dataURL) => ({ src: dataURL, alt: "Image" }))
    );

    $inspect(images);

    // Convert files to dataURLs
    const readFileAsDataURL = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
        });
    };

    $effect(() => {
        // Clean up object URLs when files change
        return () => {
            if (fileObjectURLs) {
                fileObjectURLs.forEach((url) => URL.revokeObjectURL(url));
            }
        };
    });

    const handleMakeGif = async () => {
        if (!selectedFiles) {
            console.error("No files selected!");
            return;
        }
  
        gifLoading = true;
        // Convert files to dataURLs
        const readFileAsDataURL = (file: File): Promise<string> => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.onerror = () => reject(reader.error);
                reader.readAsDataURL(file);
            });
        };
        
        try {
            dataURLs = await Promise.all(
                selectedFiles.map((file) => readFileAsDataURL(file))
            );

            let {w, h}: {w: number, h:number} = await getImageWidth(dataURLs[0]);
            gifshot.createGIF({
                'images': dataURLs,
                'gifWidth': 500,
                'gifHeight': h/w*500,
                'frameDuration': 10*frameDelay,
                'text': gifTitle,
                'textAlign': 'right',
                'fontColor': '#ff9922',
                'fontSize': '24px',
                'fontWeight': 'bold',
                }, function (obj) {
                if (!obj.error) {
                    var image = obj.image,
                    animatedImage = document.createElement('img');
                    animatedImage.src = image;
                    document.getElementById('gif-preview')?.appendChild(animatedImage);
                }
            });
        } catch (error) {
            console.error("Error reading files:", error);
        }
        gifLoading = false;
    };


    const clearAll = () => {
        selectedFiles = undefined;
        fileListForUpload = undefined;
        fileObjectURLs = [];
        dataURLs = [];
        selectedFileIndex = 0;
        const gifPreviewDiv = document.getElementById('gif-preview');
        if (gifPreviewDiv) {
            gifPreviewDiv.innerHTML = '';
        }
    };
    const removeFile = (index: number) => {
        if (selectedFiles) {
            const filesArray = [...selectedFiles]; // Create a copy of the array
            filesArray.splice(index, 1);
            selectedFiles = filesArray.length > 0 ? filesArray : undefined;
        }
    };

    function getImageWidth(imageUrl:string) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          resolve({w: img.naturalWidth, h: img.naturalHeight}); // Or img.width if you want the rendered width
        };
        img.onerror = (error) => {
          reject(error);
        };
        img.src = imageUrl;
      });
    }

    let mainViewDiv: HTMLDivElement | null = null;

    let frameDelay:number = $state(1);
    let gifTitle:string = $state("My GIF");

    let gifLoading: boolean = $state(false);

    const clearFiles = () => {
        selectedFiles = undefined;
        fileObjectURLs = [];
        selectedFileIndex = 0;
        gifLoading = false;
    };

    const saveGif = () => {
        const gifPreviewDiv = document.getElementById('gif-preview');
        if (gifPreviewDiv) {
            const imgElement = gifPreviewDiv.querySelector('img');
            if (imgElement) {
                const link = document.createElement('a');
                link.href = imgElement.src;
                link.download = 'generated.gif';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                console.error("No GIF image found to save.");
            }
        } else {
            console.error("GIF preview div not found.");
        }
    };
</script>

<div>
    <div id='gif' class='mx-auto w-4/5 flex flex-col bg-gray-100 rounded-xl shadow-lg items-center'>
        <div id='gif-label' class='p-3 ml-4 text-lg font-bold'>
            GIF Maker
        </div>
        
        
        <div class='flex flex-row bg-green-200 p-3 m-3 min-h-40 items-stretch'>
            <div id='main-view' class='min-w-40 max-w-4/5 p-4 flex-1 flex items-center justify-center relative' bind:this={mainViewDiv}>
                {#if selectedFiles}
                    <img src={fileObjectURLs[selectedFileIndex]} alt='' class='object-contain w-full h-full max-h-96 max-w-full'/>
                {:else}
                    <div class='w-full h-40 bg-gray-300 flex items-center justify-center text-gray-500'>
                        No image selected
                    </div>
                {/if}
            </div>
            <div id='thumbnails' class='flex flex-col p-2 space-y-2 overflow-y-scroll {selectedFiles ? "h-full" : ""}'>
                {#if selectedFiles && selectedFiles.length > 1}
                    <div class='text-sm font-semibold'>Select Image:</div>
                    {#each selectedFiles as file, index}
                        <div class='relative p-2 bg-yellow-100'>
                            <div class=" px-2 py-1 text-xs rounded {selectedFileIndex === index ? 'bg-blue-500 text-white' : 'bg-gray-200 hover:bg-gray-300'}"
                                onclick={() => selectedFileIndex = index}
                            >
                                <img src={fileObjectURLs[index]} alt='Selected Image' class='max-w-full max-h-10 object-contain'/>
                                
                            </div>
                            <div class="absolute top-0 right-0 p-1">
                                    <button class="bg-red-500 text-white rounded px-1 py-0.5 text-xs" onclick={() => removeFile(index)}>X</button>
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>
            
        </div>

        <div class='w-1/2 m-4'>
            <Label class="p-2" for="image_files" >Upload image files</Label>
            <Fileupload class="bg-white text-white" clearable bind:files={fileListForUpload} 
                multiple accept='.jpg, .jpeg, .heic, .png'  onchange={(e) => {console.log((e.target as HTMLInputElement)?.files)}}/>
            <Helper class="mt-2">Selected files: {fileNames ? fileNames : "No files selected"}</Helper>
            <label for="slider">Select frame duration (seconds): {frameDelay}</label><br />
            <input type="range" id="slider" min="0.1" max="1" step="0.1" bind:value={frameDelay} class='w-full'/>
            <div class='w-full flex flex-row'>
                <label for='gifTitle' class='pr-4 my-auto'>GIF Title:</label>
                <input id='gifTitle' type='text' bind:value={gifTitle} class='grow border border-gray-300 rounded px-2' />

            </div>

            <div id='gif-preview' class='mx-auto py-3'>
                {#if gifLoading}
                    <div>Loading...</div>
                {/if}
            </div>
            <div class='flex space-x-2'>
                <Button disabled={!selectedFiles || selectedFiles.length === 0} class="mt-4 px-4 py-2 bg-blue-500 text-white rounded" onclick={handleMakeGif}>
                    Create GIF from Images
                </Button>

                <Button disabled={!selectedFiles || selectedFiles.length === 0}  class="mt-4 px-4 py-2 bg-blue-500 text-white rounded" onclick={saveGif}>Save Gif</Button>
                <Button class="mt-4 px-4 py-2 bg-red-500 text-white rounded" onclick={clearAll}>Reset</Button>
            </div>
        </div>
    </div> 
</div>