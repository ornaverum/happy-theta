<script lang='ts'>
    import { Fileupload, Helper, Button, Gallery, type ImgType } from 'flowbite-svelte';
    import cv from '@techstark/opencv-js'
    import {Stage, Layer} from 'svelte-konva';
    import gifshot from 'gifshot';
	import { scale } from 'svelte/transition';

    let selectedFiles: FileList | undefined = $state(null);
    let fileNames: string[] | string = $derived(
        selectedFiles ? Array.from(selectedFiles).map((file) => file.name).join(", "): "No files selected"
    );
    let dataURLs: string[] = $state([]);
    let images: ImgType[] = $derived(
        dataURLs.map((dataURL) => ({ src: dataURL, alt: "Image" }))
    );

    let imageSrcMats: cv.Mat[] = $state([]);
    let imageDstMats: cv.Mat[] = $state([]);

    let cans: HTMLCanvasElement[] = $state([]);

    let canvasHelper: HTMLCanvasElement;
    let canvasOutput: HTMLCanvasElement;

    let currentImageIndex: number = $state(0);

    const scaleMat = (src: cv.Mat, dst: cv.Mat, scale: number) => {
        let dsize = new cv.Size(src.cols * scale, src.rows * scale);
        cv.resize(src, dst, dsize, 0, 0, cv.INTER_AREA);
    };

    const rotateAll = ()=>{
        document.querySelectorAll('#image-canvases canvas').forEach((canvas, i) => {
            const ctx = canvas.getContext('2d');
            let src = cv.imread(canvas);
            let dst = new cv.Mat();
            rotateMat(src, dst, 90);
            cv.imshow(canvas, dst);
            src.delete(); dst.delete();
        });
    }
    const rotateMat = (src: cv.Mat, dst:cv.Mat, angle: number) => {
        let dsize = new cv.Size(src.rows, src.cols);
        let center = new cv.Point(src.cols / 2, src.cols / 2);
        let M = cv.getRotationMatrix2D(center, angle, 1);
        cv.warpAffine(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
        M.delete();
    };

    const showMainView = (dataURL:string) => {

        const img = new Image();
        img.src = dataURL;
        img.onload = () => {
            const canvas:HTMLCanvasElement = document.querySelector('#main-view');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx:CanvasRenderingContext2D = canvas?.getContext('2d');
            ctx?.drawImage(img, 0, 0);  
        };
    };

    const testHandleImg = async () =>{
        const img = new Image();
        img.src = '/small-2025-01-04 19.11.43.jpg';
        img.onload = () => {
            const canvas = document.querySelector('#canvasHelper') as HTMLCanvasElement;
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            let src = cv.imread('canvasHelper');
            let dst = new cv.Mat();

            let dsize = new cv.Size(src.rows, src.cols);
            let center = new cv.Point(src.cols/2, src.cols/2);
            // You can try more different parameters
            let M = cv.getRotationMatrix2D(center, 90, 1);
            cv.warpAffine(src, dst, M, dsize, cv.INTER_LINEAR);

            cv.imshow('canvasHelper', src);
            cv.imshow('canvasOutput', dst);
            src.delete(); dst.delete(); M.delete();

        };
    }


    const showImageFiles = async ()=>{
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

        dataURLs = await Promise.all(
                Array.from(selectedFiles).map((file) => readFileAsDataURL(file))
            );
        
    }
    const handleImg = async ()=>{
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

        dataURLs = await Promise.all(
                Array.from(selectedFiles).map((file) => readFileAsDataURL(file))
            );

        const rotateMat = (src: cv.Mat, dst:cv.Mat, angle: number) => {
            let dsize = new cv.Size(src.rows, src.cols);
            let center = new cv.Point(src.cols / 2, src.cols / 2);
            let M = cv.getRotationMatrix2D(center, angle, 1);
            cv.warpAffine(src, dst, M, dsize, cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
            M.delete();
        };
        
        const img = new Image();
        img.src = await readFileAsDataURL(selectedFiles[0]) as unknown as string;
        img.onload = () => {
            const canvas = document.querySelector('#canvasHelper') as HTMLCanvasElement;
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0);
            let src = cv.imread('canvasHelper');
            let dst = new cv.Mat();
            // To distinguish the input and output, we graying the image.
            // You can try different conversions.

            rotateMat(src, dst, 90);

            let dsize = new cv.Size(src.rows/5, src.cols/5);
            
            canvasOutput.width = dst.cols;
            canvasOutput.height = dst.rows;

            cv.imshow('canvasOutput', dst);
            src.delete(); dst.delete();
        };
    }

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

            dataURLs.forEach((dataURL,i) => {
                const img = new Image();
                img.src = dataURL;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.id = `canvas-${i}`;
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0);
                    cans = [...cans, canvas];
                    document.querySelector('#image-canvases')?.appendChild(canvas);
                };
            });
           
            console.log(cans);
            showMainView(dataURLs[0]);
        } catch (error) {
            console.error("Error reading files:", error);
        }
    };

</script>

<main>
    <!-- <Fileupload clearable bind:files={selectedFiles} multiple accept='.jpg, .jpeg, .heic, .png'/> -->
    <Fileupload clearable bind:files={selectedFiles} multiple accept='.jpg, .jpeg, .heic, .png'/>
    <Helper color="green" class="mt-2">Selected files: {fileNames}</Helper>
    <Button color='alternative' onclick={handleMakeGif}>Create Gif</Button>
    <Button color='alternative' onclick={rotateAll}>Rotate</Button>

    <div class='flex flex-row gap-4'>
        <div>
            <canvas id='main-view' class='max-w-96' />
        </div>
        <div id='image-canvases' class='flex flex-col gap-1 max-w-24'>
            {#each cans as can, i}
                <canvas bind:this={cans[i]} class='max-w-96 flex'/>
            {/each}
        </div>    
    </div>
    
    <canvas id='canvasHelper' class='max-w-96' bind:this={canvasHelper} />
    <canvas id='canvasOutput' class='max-w-96' bind:this={canvasOutput} />


</main>