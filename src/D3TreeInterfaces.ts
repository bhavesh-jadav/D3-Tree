
// interfaces

import { HierarchyPointNode, HierarchyNode } from 'd3-hierarchy';

/**
 * Extension of `HierarchyPointNode` from `D3` with extra properties.
 */
export interface TreePointNode<Datum> extends HierarchyPointNode<Datum>, OptionalTreeData {
    /**
     * Stores collpased nodes.
     */
    _children?: HierarchyNode<Datum>[] | null;
}

export interface TreeData extends OptionalTreeData {
    /**
     * Name of the node.
     */
    name: string;
    /**
     * Optional children of the node.
     */
    children?: TreeData[] | null;
    
}

export interface OptionalTreeData {
    /**
     * Show image on the node and expand and collpase color will be applied
     * on stroke of the image if only image is visible on node.
     */
    imageURL?: string | null;
    /**
     * Optional text url that will be used to add hyperlink to node text.
     */
    externalURL?: string | null;
    /**
     * Weight of the node. Can be used to sort the nodes.
     */
    weight?: number | null;
}

export interface TreeGeneralProperties {
    /**
     * Either vertical or horizontal orientation.
     */
    orientation: TreeOrientation,
    defaultMaxDepth: number,
    containerHeight: number,
    containerWidth: number,
    enableZoom: boolean,
    /**
     * If `enableZoom` is true then use this property to specify MINIMUM ZOOM that is allowed on tree.
     * To find possible for value for your tree, expand all your node in tree by setting `defaultMaxDepth`
     * in `TreeGeneralProperties` and lower this value until full tree is visible.
     */
    minZoomScale?: number,
    /**
     * If `enableZoom` is true then use this property to specify MAXZIMUM ZOOM that is allowed on tree.
     */
    maxZoomScale?: number,
    isClusterLayout?: boolean,
    extraPerLevelDepthInPx?: number,
    extraSpaceBetweenNodesInPx?: number
}

export interface TreeNodeShapeProperties {
    shapeType: TreeNodeShapeTypes,
    expandedNodeColor: string,
    collapsedNodeColor: string,
    stroke: string,
    strokeWidth: number,
    animation: boolean,
    radius?: number,
    width?: number,
    height?: number,
    animationDuration?: number
}

export interface TreeNodeLinkProperties {
    treeNodeLinkType: TreeNodeLinkTypes
    stroke: string,
    strokeWidth: number,
    animation: boolean,
    animationDuration?: number
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
}

export interface TreeProperties {
    generalProperties: TreeGeneralProperties,
    nodeShapeProperties: TreeNodeShapeProperties,
    nodeLinkProperties: TreeNodeLinkProperties,
    nodeTextProperties: TreeNodeTextProperties
}

//enums
export enum TreeNodeShapeTypes {
    circle = 'circle',
    rect = 'rect'
}

export enum TreeNodeLinkTypes {
    straight = 'straight',
    curved = 'curved',
    corner = 'corner'
}

export enum TreeOrientation {
    horizontal = 'horizontal',
    vertical = 'vertical'
}