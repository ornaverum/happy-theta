<script lang='ts'>
    import { Fileupload, Helper, Button, Gallery, type ImgType } from 'flowbite-svelte';
    import {Stage, Layer} from 'svelte-konva';
    import gifshot from 'gifshot';

    let selectedFiles: FileList | undefined = $state(null);
    let fileNames: string[] | string = $derived(
        selectedFiles ? Array.from(selectedFiles).map((file) => file.name).join(", "): "No files selected"
    );
    let dataURLs: string[] = $state([]);
    let images: ImgType[] = $derived(
        dataURLs.map((dataURL) => ({ src: dataURL, alt: "Image" }))
    );

    let cans: HTMLCanvasElement[] = $state([]);

    const rotateCanvas90 = (canvas: HTMLCanvasElement) => {
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.src = canvas.toDataURL();
        img.onload = () => {
            ctx?.clearRect(0, 0, canvas.width, canvas.height);
            ctx?.translate(canvas.width / 2, canvas.height / 2);
            ctx?.rotate(Math.PI / 2);
            ctx?.drawImage(img, -img.width / 2, -img.height / 2);
        };
    };

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
                Array.from(selectedFiles).map((file) => readFileAsDataURL(file))
            );

            console.log("Data URLs:", dataURLs); // Debuggin    g

            dataURLs.forEach((dataURL) => {
                const img = new Image();
                img.src = dataURL;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0);
                    // cans.push(canvas);
                    rotateCanvas(canvas);
                    cans = [...cans, canvas];
                    console.log("Canvas:", canvas); // Debugging
                    console.log("ctx:", ctx); // Debugging
                    document.querySelector('#image-canvases').appendChild(canvas);
                };
            });
            console.log(cans); // Debugging
            // Create GIF using gifshot
            gifshot.createGIF(
                {
                    images: dataURLs, // Pass dataURLs to gifshot
                    gifWidth: 500,    // Adjust as needed
                    gifHeight: 500,   // Adjust as needed
                    interval: 0.5,    // Frame interval in seconds
                },
                (obj) => {
                    if (!obj.error) {
                        const image = obj.image;
                        const animatedImage = document.querySelector('#gif-target');
                        animatedImage.src = image;
                        animatedImage.classList.remove('hidden');

                        // Append the GIF to the body (you can customize this)
                    } else {
                        console.error("Error creating GIF:", obj.errorMsg);
                    }
                }
            );
        } catch (error) {
            console.error("Error reading files:", error);
        }
    };

</script>

<main>
    <Fileupload clearable bind:files={selectedFiles} multiple accept='.jpg, .jpeg, .heic, .png'/>
    <Helper color="green" class="mt-2">Selected files: {fileNames}</Helper>
    <Button color='alternative' onclick={handleMakeGif}>Create Gif</Button>

    <div id='image-canvases' class='flex flex-col gap-4 max-w-lg'>
        <!-- {#each cans as can, i}
            <canvas bind:this={cans[i]} />
        {/each} -->
    </div>
    <!-- <Gallery items={images} class="gap-4 grid-cols-2 md:grid-cols-3 max-w-xl rotate-270" /> -->
    <img id='gif-target' src="https://via.placeholder.com/500" alt="Image" class='hidden max-w-sm'/>

    <!-- {#if images.length > 0}
        <div class='flex flex-row gap-4 border border-gray-300 rounded-lg p-4 rotate-270    '>
            <div>
                <img src={images[0].src} alt={images[0].alt} class="max-w-96" />
            </div>
            <div class='grid grid-rows-3 grid-flow-col gap-4'>
                {#each images as image}
                    <div class='max-w-24 max-h-24'>
                        <img src={image.src} alt={image.alt} />
                    </div>
                {/each}
               
            </div>
        </div>
    {/if} -->

</main>