import { TreeGeneralProperties, Orientation } from './../../D3TreeInterfaces';

export let generalPropertiesDefault: TreeGeneralProperties = {
    orientation: Orientation.Horizontal,
    defaultMaxDepth: 0, // n - 1 depth
    isClusterLayout: false,
    containerHeight: 700,
    containerWidth: 700,
    enableZoom: false,
    minZoomScale: 0.2,
    maxZoomScale: 3,
    depthWiseHeight: 200,
    nodeSize: 150,
    horizontalPadding: 30,
    verticalPadding: 160
}