import { 
    TreeGeneralProperties, TreeLinkProperties, TreeNodeTextProperties, TreeProperties,
    TreeNodeShapeProperties, ShapeType, Orientation, LineType, TreeData,
    TreeNodeProperties, TreeNodeImageProperties, Position
} from '../D3TreeInterfaces';

export let treeProperties1: TreeProperties = {
    generalProperties: {
        orientation: Orientation.Vertical,
        defaultMaxDepth: 1, // n - 1 depth
        isClusterLayout: false,
        containerHeight: 600,
        containerWidth: 800,
        enableZoom: false,
        minZoomScale: 0.2,
        maxZoomScale: 3,
        depthWiseHeight: 200,
        extraSpaceBetweenNodes: 20
    },
    nodeProperties: {
        shapeProperties: {
            shapeType: ShapeType.Rectangle,
            circleRadius: 25,
            rectWidth: 100,
            rectHeight: 70,
            expandedColor: 'red',
            collapsedColor: 'green',
            strokeColor: 'black',
            strokeWidth: 2,
            takeColorFromData: false
        },
        textProperties: {
            fontFamily: 'Arial',
            fontSize: '20px',
            foregroundColor: 'black',
            showBackground: false,
            backgroundColor: 'pink',
            maxAllowedWidth: 100,
            textPadding: 5,
            spaceBetweenNodeAndText: 10,
            showTextInsideShape: true,
            showUrlOnText: true
        },
        imageProperties: {
            showImage: false,
            height:80,
            width:80,
            strokeColor: 'black',
            strokeWidth: 3,
            shape: ShapeType.None,
            xOffset: 50,
            yOffset: 0,
            position: Position.Right
        },
        enableAnimation: true,
        animationDuration: 1000
    },
    linkProperties: {
        treeNodeLinkType: LineType.Curved,
        strokeColor: '#ccc',
        strokeWidth: 5,
        enableAnimation: true
    }
}