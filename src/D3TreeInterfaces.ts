
import { HierarchyPointNode, HierarchyNode } from 'd3-hierarchy';


/**
 * Extension of `HierarchyPointNode` from `D3` with extra properties.
 */
export interface TreePointNode<Datum> extends HierarchyPointNode<Datum>, OptionalTreeData {
    /**
     * Stores collapsed nodes.
     */
    _children?: TreePointNode<Datum>[] | null;
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
     * External url that will be used to add hyperlink to node text.
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
     * If `enableZoom` is true then use this property to specify MINIMUM ZOOM that is allowed on tree.
     * To find possible for value for your tree, expand all your node in tree by setting `defaultMaxDepth`
     * in `TreeGeneralProperties` and lower this value until full tree is visible.
     */
    minZoomScale?: number,
    /**
     * If `enableZoom` is true then use this property to specify MAXIMUM ZOOM that is allowed on tree.
     */
    maxZoomScale?: number,
    /**
     * If `true` then will show tree as cluster layout where all children will be at the same level.
     */
    isClusterLayout?: boolean,
    /**
     * Specify the height between depths or levels of the tree in pixels.
     * Only applicable when `enableZoom` is true.
     */
    depthWiseHeight: number,
    /**
     * Specify extra space between nodes. When nodes seems to be too close or far away,
     * you can change this value to get appropriate distance between node.
     */
    extraSpaceBetweenNodes?: number,
}

export interface TreeNodeShapeProperties {
    /**
     * Specify shape type such as circle, rectangle etc.
     */
    shapeType: ShapeType,
    /**
     * This color will be visible on node when the node is expanded or node does not have any children.
     * In case of `takeColorFromData` is `true` then this will be applied to stroke of shape rather than fill.
     */
    expandedColor: string,
    /**
     * This color will be visible when node is collapsed.
     * In case of `takeColorFromData` is `true` then this will be applied to stroke of shape rather than fill.
     */
    collapsedColor: string,
    /**
     * Stroke color of node shape.
     */
    strokeColor: string,
    /**
     * Stroke width of node shape.
     */
    strokeWidth: number,
    /**
     * If shape type is circle then specify radius for it.
     */
    circleRadius?: number,
    /**
     * If shape type is rectangle then specify width of rectangle.
     */
    rectWidth?: number,
    /**
     * If shape type is rectangle then specify height of rectangle.
     */
    rectHeight?: number,
    /**
     * If `true` then colors such as node colors, text color etc. will be taken from data rather than showing 
     * default colors specified in properties.
     */
    takeColorFromData?: boolean;
}

export interface TreeLinkProperties {
    /**
     * Link type can be straight, curved etc.
     */
    treeNodeLinkType: LineType
    /**
     * Color of the link.
     */
    strokeColor: string,
    /**
     * Width of the link.
     */
    strokeWidth: number,
    /**
     * Enable or disable animation.
     */
    enableAnimation: boolean,
    /**
     * If animation is enable then specify duration of animation.
     */
    animationDuration?: number
    /**
     * If `true` then colors such as node colors, text color etc. will be taken from data rather than showing 
     * default colors specified in properties.
     */
    takeColorsFromData?: boolean
}

export interface TreeNodeTextProperties {
    /**
     * Font family of text.
     */
    fontFamily: string,
    /**
     * Font size of text. e,g. '20px'.
     */
    fontSize: string,
    /**
     * Color of text.
     */
    foregroundColor: string,
    /**
     * Weight of font. e.g. 'bold'
     */
    fontWeight?: string,
    /**
     * Style of font. e.g. 'italic'
     */
    fontStyle?: string,
    /**
     * Enable this to show background to text.
     */
    showBackground?: boolean,
    /**
     * Specify background color. Only visible when `showBackground` is enable.
     */
    backgroundColor?: string,
    /**
     * Maximum allowed width in pixels of the text. Any text with width greater this value
     * will be truncated.
     */
    maxAllowedWidth?: number,
    /**
     * Specify space between node and text. Used when text is displayed outside the node shape.
     */
    spaceBetweenNodeAndText?: number
    /**
     * Specify text padding.
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
    /**
     * Shows hyperlink on text. Url for hyperlink is fetched from data itself.
     */
    showUrlOnText?: boolean
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
    /**
     * Height of the image.
     */
    height?: number,
    /**
     * Width of the image.
     */
    width?: number,
    /**
     * Stroke color of the image.
     */
    strokeColor?: string,
    /**
     * Stroke width of the image.
     */
    strokeWidth?: number,
    /**
     * Shape of the image. e.g. circle, rectangle etc.
     */
    shape?: ShapeType,
    /**
     * Position of image respect to node i.e. either left, right, top or bottom.
     */
    position?: Position
    /**
     * Offset image on X axis. Value is in pixels
     */
    xOffset?: number,
    /**
     * Offset image on Y axis. Value is in pixels
     */
    yOffset?: number
}

export interface TreeNodeProperties {
    shapeProperties: TreeNodeShapeProperties,
    textProperties: TreeNodeTextProperties,
    imageProperties: TreeNodeImageProperties,
    /**
     * Enable or disable animation for node.
     */
    enableAnimation: boolean,
    /**
     * If animation is enabled then specify the duration.
     */
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
    Corner = 'corner',
    None = 'none'
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