import html2canvas from 'html2canvas';

export const saveDivAsImage = async () => {
    // let tempCtrl = showControlButtons;
    // await setControlButtons(false);
    let divToCapture: HTMLDivElement | null = document.querySelector('#capture');
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

export const copyDivAsImageToClipboard = async () => {
    let divToCapture: HTMLDivElement | null = document.querySelector('#capture');
    const canvas = await html2canvas(divToCapture);
    canvas.toBlob(blob => navigator.clipboard.write([new ClipboardItem({'image/png': blob})]))
};

