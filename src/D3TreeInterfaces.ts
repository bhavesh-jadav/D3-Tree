
import { HierarchyPointNode, HierarchyNode } from 'd3-hierarchy';


/**
 * Extension of `HierarchyPointNode` from `D3` with extra properties.
 */
export interface TreePointNode<Datum> extends HierarchyPointNode<Datum>, OptionalTreeData {
    /**
     * Stores collapsed nodes.
     */
    _children?: HierarchyNode<Datum>[] | null;
}

/**
 * Interface for format of tree data
 */
export interface TreeData extends OptionalTreeData {
    /**
     * Name of the node.
     */
    name: string;
    /**
     * Children of the node.
     */
    children?: TreeData[] | null;
    
}

export interface OptionalTreeData {
    /**
     * Show image on the node and expand and collapse color will be applied
     * on stroke of the image if only image is visible on node.
     */
    imageURL?: string | null;
    /**
     * Text url that will be used to add hyperlink to node text.
     */
    externalURL?: string | null;
    /**
     * Weight of the node. Can be used to sort the nodes.
     */
    weight?: number | null;
    /**
     * Node Color. Can be used to add different color to individual node.
     */
    nodeColor?: string | null;
    /**
     * Node text color.
     */
    nodeTextColor?: string | null;
}

export interface TreeGeneralProperties {
    /**
     * Specify Orientation for tree. It can be either horizontal or vertical.
     * @property {Orientation=} orientation
     */
    orientation: Orientation,
    /**
     * Specify maximum depth and till this depth tree will be expanded by default.
     */
    defaultMaxDepth: number,
    /**
     * Specify height of SVG element which will be parent of tree.
     */
    containerHeight: number,
    /**
     * Specify width of SVG element which will be parent of tree.
     */
    containerWidth: number,
    /**
     * Enable zooming functionality for large trees. If zooming is enable then tree height and width 
     * will be calculated dynamically otherwise container height and width will be 
     */
    enableZoom: boolean,
    /**
     * (optional) If `enableZoom` is true then use this property to specify MINIMUM ZOOM that is allowed on tree.
     * To find possible for value for your tree, expand all your node in tree by setting `defaultMaxDepth`
     * in `TreeGeneralProperties` and lower this value until full tree is visible.
     * @default 0.2
     */
    minZoomScale?: number,
    /**
     * If `enableZoom` is true then use this property to specify MAXIMUM ZOOM that is allowed on tree.
     * @default 3
     */
    maxZoomScale?: number,
    /**
     * If `true` then will show tree as cluster layout where all children will be at the same level.
     * @default false
     */
    isClusterLayout?: boolean,
    depthWiseHeight?: number,
    extraSpaceBetweenNodes?: number,
}

export interface TreeNodeShapeProperties {
    shapeType: ShapeType,
    expandedNodeColor: string,
    collapsedNodeColor: string,
    strokeColor: string,
    strokeWidth: number,
    circleRadius?: number,
    rectWidth?: number,
    rectHeight?: number,
    /**
     * If `true` then colors such as node colors, text color etc. will be taken from data rather than showing 
     * default colors specified in properties.
     */
    takeColorsFromData?: boolean;
}

export interface TreeLinkProperties {
    treeNodeLinkType: LineType
    strokeColor: string,
    strokeWidth: number,
    animation: boolean,
    animationDuration?: number
    /**
     * If `true` then colors such as node colors, text color etc. will be taken from data rather than showing 
     * default colors specified in properties.
     */
    takeColorsFromData?: boolean
}

export interface TreeNodeTextProperties {
    fontFamily: string,
    fontSize: string,
    foregroundColor: string,
    fontWeight?: string,
    fontStyle?: string,
    showBackground?: boolean,
    backgroundColor?: string,
    maxAllowedWidth?: number,
    spaceBetweenNodeAndText?: number
    /**
     * Use textPadding when showBackground is true. It will set padding between text and it's background in px.
     * This propeties is only used when text is shown outside the node shape.
     * 
     * Defalut Values:
     * 
     * `showBackground` : `false` then 0.
     * 
     * `showBackground` : `true` and no `textPadding` is specified than 4.
     * 
     */
    textPadding?: number,
    /**
     * If `true` then will display text inside the shape. Make sure to adjust size of shape so that text fits inside correctly.
     */
    showTextInsideShape?: boolean
    /**
     * If `true` then colors such as node colors, text color etc. will be taken from data rather than showing 
     * default colors specified in properties.
     */
    takeColorsFromData?: boolean
}

export interface TreeNodeImageProperties {
    /**
     * If `true` then will display image on nodes and images are taken from data.
     */
    showImage: boolean;
    /**
     * If there is no image for the node than we show this image.
     */
    defaultImageURL?: string;
    height?: number,
    width?: number,
    strokeColor?: string,
    strokeWidth?: number,
    shape?: ShapeType,
    position?: Position
    xOffset?: number,
    yOffset?: number
}

export interface TreeNodeProperties {
    shapeProperties: TreeNodeShapeProperties,
    textProperties: TreeNodeTextProperties,
    imageProperties: TreeNodeImageProperties,
    animation: boolean,
    animationDuration?: number
}

export interface TreeProperties {
    generalProperties: TreeGeneralProperties,
    nodeProperties: TreeNodeProperties,
    linkProperties: TreeLinkProperties
}

//enums
export enum ShapeType {
    Circle = 'circle',
    Rectangle = 'rectangle',
    None = 'none'
}

export enum LineType {
    Straight = 'straight',
    Curved = 'curved',
    Corner = 'corner'
}

export enum Orientation {
    Horizontal = 'horizontal',
    Vertical = 'vertical'
}

export enum Position {
    Left = 'left',
    Right = 'right',
    Top = 'top',
    Bottom = 'bottom'
}