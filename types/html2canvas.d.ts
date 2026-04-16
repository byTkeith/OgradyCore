declare module 'html2canvas' {
  interface Html2CanvasOptions {
    onclone?: (clonedDoc: Document) => void;
    scale?: number;
    useCORS?: boolean;
    // add other options you use
  }
  
  function html2canvas(element: HTMLElement, options?: Html2CanvasOptions): Promise<HTMLCanvasElement>;
  export default html2canvas;
}