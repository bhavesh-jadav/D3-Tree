
// interfaces

import { HierarchyPointNode, HierarchyNode } from 'd3-hierarchy';

/**
 * Extension of `HierarchyPointNode` from `D3` with extra properties.
 */
export interface TreePointNode<Datum> extends HierarchyPointNode<Datum> {
    /**
     * It is used to stores collpased nodes.
     */
    _children?: HierarchyNode<Datum>[] | null;
    /**
     * Will be used to show image on the node and expand and collpase color will be applied
     * on stroke of the image if only image is visible on node.
     */
    imageURL?: string | null;
    /**
     * Will be used to add URL to the text.
     */
    externalURL?: string | null;
}

export interface TreeData {
    /**
     * Name of the node.
     */
    name: string;
    /**
     * Optional children of the node.
     */
    children?: TreeData[] | null;
    /**
     * Optional image url that will be used to display image on nodes.
     */
    imageURL?: string | null;
    /**
     * Optional text url that will be used to add hyperlink to node text.
     */
    externalURL?: string | null;
    /**
     * Weigt of the node. Can be used to sort the nodes.
     */
    weight?: number | null;
}

export interface TreeGeneralProperties {
    orientation: TreeOrientation,
    defaultMaxDepth: number,
    containerHeight: number,
    containerWidth: number,
    treeHeight?: number,
    treeWidth?: number,
    isClusterLayout?: boolean,
    extraDepthinPx?: number
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