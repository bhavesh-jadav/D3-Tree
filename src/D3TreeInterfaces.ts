
// interfaces

export interface TreeGeneralProperties {
    'orientation': TreeOrientation,
    'defaultMaxDepth': number,
    'containerHeight': number,
    'containerWidth': number,
    'treeHeight'?: number,
    'treeWidth'?: number,
    'isClusterLayout'?: boolean,
    'depthWiseHeight'?: number
}

export interface TreeNodeShapeProperties {
    'shapeType': TreeNodeShapeTypes,
    'expandedNodeColor': string,
    'collapsedNodeColor': string,
    'stroke': string,
    'size': number,
    'strokeWidth': number,
    'animation': boolean,
    'animationDuration'?: number
}

export interface TreeNodeLinkProperties {
    'treeNodeLinkType': TreeNodeLinkTypes
    'stroke': string,
    'strokeWidth': number,
    'animation': boolean,
    'animationDuration'?: number
}

export interface TreeNodeTextProperties {
    'fontFamily': string,
    'fontSize': string,
    'foregroundColor': string,
    'fontWeight'?: string | number,
    'fontStyle'?: string,
    'showBackground'?: boolean,
    'backgroundColor'?: string,
    'maxAllowedWidth'?: number,
    'spaceBetweenNodeAndText'?: number
    /**
     * Use textPadding when showBackground is true. It will set padding between text and background in px.
     */
    'textPadding'?: number
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
    square = 'square'
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