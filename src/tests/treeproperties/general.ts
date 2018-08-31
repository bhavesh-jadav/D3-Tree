import { TreeGeneralProperties, Orientation } from './../../D3TreeInterfaces';

export let generalProperties1: TreeGeneralProperties = {
    orientation: Orientation.Horizontal,
    defaultMaxDepth: 1, // n - 1 depth
    isClusterLayout: false,
    containerHeight: 600,
    containerWidth: 800,
    enableZoom: false,
    minZoomScale: 0.2,
    maxZoomScale: 3,
    depthWiseHeight: 200,
    nodeSize: 150,
    horizontalPadding: 30,
    verticalPadding: 160
}