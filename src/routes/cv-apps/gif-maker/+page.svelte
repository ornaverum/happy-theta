
<script lang="ts">
    import { Stage, Layer, Rect, Image as KonvaImage } from 'svelte-konva';
    import { onMount, tick } from 'svelte';
    import {Fileupload, Helper, Label, Carousel, type ImgType} from 'flowbite-svelte';
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
                'frameDuration': 10,
                'text': 'boo',
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
        <div id='gif-preview' class='bg-emerald-100 mx-auto'>
        </div>
        <div class='w-1/2 m-4'>
            <Label class="p-2" for="image_files" >Upload image files</Label>
            <Fileupload class="bg-white text-white" clearable bind:files={fileListForUpload} 
                multiple accept='.jpg, .jpeg, .heic, .png'  onchange={(e) => {console.log((e.target as HTMLInputElement)?.files)}}/>
            <Helper class="mt-2">Selected files: {fileNames ? fileNames : "No files selected"}</Helper>
            <button class="mt-4 px-4 py-2 bg-blue-500 text-white rounded" onclick={handleMakeGif}>
                Create GIF from Images
            </button>
        </div>
    </div> 
</div>