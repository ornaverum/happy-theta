declare module 'gifshot' {
  interface GifshotOptions {
    /**
     * The images to be used in the GIF creation
     */
    images?: string[] | HTMLImageElement[] | HTMLCanvasElement[];
    
    /**
     * Video element or path to video
     */
    video?: HTMLVideoElement | string;
    
    /**
     * Webcam element
     */
    webcam?: HTMLVideoElement;
    
    /**
     * The width of the GIF
     */
    gifWidth?: number;
    
    /**
     * The height of the GIF
     */
    gifHeight?: number;
    
    /**
     * The frame rate of the GIF
     */
    frameDuration?: number;
    
    /**
     * How long to capture from video or webcam (in seconds)
     */
    interval?: number;
    
    /**
     * The number of frames to capture from video or webcam
     */
    numFrames?: number;
    
    /**
     * The font weight of the text overlay
     */
    fontWeight?: string;
    
    /**
     * The font size of the text overlay
     */
    fontSize?: string;
    
    /**
     * The font family of the text overlay
     */
    fontFamily?: string;
    
    /**
     * The font color of the text overlay
     */
    fontColor?: string;
    
    /**
     * The text overlay content
     */
    text?: string;
    
    /**
     * The x position of the text overlay
     */
    textXCoordinate?: number;
    
    /**
     * The y position of the text overlay
     */
    textYCoordinate?: number;
    
    /**
     * The baseline of the text overlay
     */
    textBaseline?: string;
    
    /**
     * The alignment of the text overlay
     */
    textAlign?: string;
    
    /**
     * Show progress during GIF creation
     */
    showProgress?: boolean;
    
    /**
     * Save the GIF as a file
     */
    saveRenderingContexts?: boolean;
    
    /**
     * The quality of the GIF
     */
    quality?: number;
  }

  interface GifshotCallback {
    (obj: { image: string; error?: string }): void;
  }

  interface GifshotStatic {
    /**
     * Creates a GIF from images
     */
    createGIF(options: GifshotOptions, callback: GifshotCallback): void;
    
    /**
     * Takes a screenshot
     */
    takeShot(options?: any, callback?: (obj: { image: string; error?: string }) => void): void;
    
    /**
     * Check if WebRTC is supported
     */
    isSupported(): boolean;
    
    /**
     * Check if webcam is supported
     */
    isWebCamGIFSupported(): boolean;
    
    /**
     * Check if existing video GIF is supported
     */
    isExistingVideoGIFSupported(): boolean;
    
    /**
     * Check if existing images GIF is supported
     */
    isExistingImagesGIFSupported(): boolean;
    
    /**
     * Get version information
     */
    VERSION: string;
  }

  const gifshot: GifshotStatic;
  export = gifshot;
}
